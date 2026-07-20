/**
 * Executes a service-validation run (API / MCP / DOWNLOAD channel) and persists evidence.
 */
import {
  PackStatus,
  Prisma,
  type ServiceValidationChannel,
  type ServiceValidationStatus,
} from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import type { ServiceChannel } from "@/lib/distribution/service-channel-policy";
import {
  buildRagExportPackage,
  isRagExportRunDetails,
  ragExportDetailsFromPackage,
  RagExportBuildError,
} from "@/lib/exports/rag-export-builder";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { executeMcpValidation } from "@/lib/mcp/mcp-validation-runtime";
import { prisma } from "@/lib/prisma";
import {
  evaluateRetrievalValidationHits,
  executeRetrievalApiRequest,
  resolveRetrievalContextSourceDocumentId,
} from "@/lib/retrieval/retrieval-api-adapter";
import type { RetrievalContextDto } from "@/lib/retrieval-dto";
import {
  loadSourceDocumentTitles,
  mapContextsToInternalResultItems,
  type InternalValidationResultItem,
} from "@/lib/distribution/service-validation-result-snapshot";
import { resolveCurrentValidationBindingTx } from "@/lib/distribution/service-validation-binding";
import { computeResultFingerprint } from "@/lib/distribution/service-validation-share";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "@/lib/retrieval/relevance-diversity-rerank";
import {
  adapterPathForChannel,
  asRecord,
  assertSearchEvaluationCurrentForChannel,
  rerankDetailsFromStats,
  SEARCH_VALIDATION_PREPARATION_CHANNELS,
  type ServiceValidationChannelDto,
} from "@/lib/distribution/service-validation-policy";
import {
  assertNoOpenPackReview,
  loadBindingContext,
  requireOwnedDraftPackForServiceValidationRun,
} from "@/lib/distribution/service-validation-queries";
import { mapRunToProviderChannelDto } from "@/lib/distribution/service-validation-provider-status";

async function buildSafeRetrievalItems(input: {
  contexts: RetrievalContextDto[];
  expectedVersionId: string;
  normalizedDocumentId: string;
}): Promise<InternalValidationResultItem[]> {
  const sourceIds = input.contexts
    .map((c) => resolveRetrievalContextSourceDocumentId(c))
    .filter((id): id is string => Boolean(id));
  const titles = await loadSourceDocumentTitles(sourceIds);
  const items = mapContextsToInternalResultItems(input.contexts, titles);
  if (items.length === 0) return [];
  const chunkIds = items.map((i) => i.chunkId);
  const chunks = await prisma.knowledgeChunk.findMany({
    where: { id: { in: chunkIds } },
    select: { id: true, versionId: true },
  });
  const allowed = new Set(
    chunks.filter((c) => c.versionId === input.expectedVersionId).map((c) => c.id),
  );
  const filtered = items.filter((i) => allowed.has(i.chunkId));
  if (filtered.length === 0) return [];

  const docs = await prisma.sourceDocument.findMany({
    where: {
      id: { in: [...new Set(filtered.map((i) => i.sourceDocumentId))] },
      versionId: input.expectedVersionId,
    },
    select: { id: true },
  });
  const normalizedDocument = await prisma.normalizedDocument.findFirst({
    where: {
      id: input.normalizedDocumentId,
      versionId: input.expectedVersionId,
      isActive: true,
      sourceFileId: { not: null },
      bundle: {
        versionId: input.expectedVersionId,
        isActive: true,
        deletedAt: null,
        storageStatus: "ACTIVE",
        status: "REVIEW_READY",
      },
    },
    select: { sourceFileId: true, bundleId: true },
  });
  const sourceFile = normalizedDocument?.sourceFileId
    ? await prisma.knowledgePackFile.findFirst({
        where: {
          id: normalizedDocument.sourceFileId,
          bundleId: normalizedDocument.bundleId,
          versionId: input.expectedVersionId,
          role: "SOURCE_ORIGINAL",
          bundle: {
            isActive: true,
            deletedAt: null,
            storageStatus: "ACTIVE",
            status: "REVIEW_READY",
          },
        },
        select: { id: true },
      })
    : null;
  const validSourceDocumentIds = new Set(docs.map((doc) => doc.id));
  const expectedSourceDocumentIds = new Set(filtered.map((item) => item.sourceDocumentId));
  if (!sourceFile || validSourceDocumentIds.size !== expectedSourceDocumentIds.size) return [];

  return filtered.map((item) => ({
    ...item,
    sourceFileId: validSourceDocumentIds.has(item.sourceDocumentId) ? sourceFile.id : null,
  }));
}

export async function runServiceChannelValidation(input: {
  userId: string;
  clientId: string;
  packId: string;
  channel: ServiceChannel;
  query?: string | null;
}): Promise<ServiceValidationChannelDto> {
  const { pack, version, profile } = await requireOwnedDraftPackForServiceValidationRun(input);
  await assertNoOpenPackReview(prisma, pack.packId);
  const { latest, binding, bindingState } = await loadBindingContext(pack.packId, version.id);
  if (!SEARCH_VALIDATION_PREPARATION_CHANNELS.includes(input.channel)) {
    throw new PayloadServiceError(
      "SERVICE_CHANNEL_DISABLED",
      "지원하지 않는 검증 채널입니다.",
      400,
    );
  }
  if (!binding || !latest || bindingState.status !== "CURRENT") {
    if (bindingState.status === "NOT_READY") {
      throw new PayloadServiceError(
        "SERVICE_VALIDATION_STALE",
        "데이터 구조화가 아직 진행 중입니다. 완료 후 다시 검증해 주세요.",
        409,
      );
    }
    if (bindingState.status === "STALE") {
      throw new PayloadServiceError(
        "SERVICE_VALIDATION_STALE",
        "지식 데이터가 변경되어 서비스 검증을 다시 실행해야 합니다.",
        409,
      );
    }
    throw new PayloadServiceError(
      "INCOMPLETE",
      "데이터 구조화가 완료되어야 검색데이터 검증을 진행할 수 있습니다.",
      400,
    );
  }

  if (input.channel === "API" || input.channel === "MCP") {
    const evalStep = await prisma.pipelineStepLog.findFirst({
      where: { runId: latest.id, step: "SEARCH_EVALUATING" },
      select: { status: true, details: true },
    });
    assertSearchEvaluationCurrentForChannel({
      channel: input.channel,
      status: evalStep?.status,
      details: evalStep?.details,
    });
  }

  const started = Date.now();
  let status: ServiceValidationStatus = "FAIL";
  let failureCode: string | null = null;
  let failureMessage: string | null = null;
  let resultCount: number | null = null;
  let topChunkId: string | null = null;
  let sourceDocumentId: string | null = null;
  let page: number | null = null;
  const query = input.query?.trim() || null;
  let latencyMs = 0;
  let details: Record<string, unknown> = {
    adapter: input.channel === "API" ? "RETRIEVAL_API" : input.channel === "MCP" ? "MCP_HANDLER" : "OBJECT_STORAGE",
    adapterPath: adapterPathForChannel(input.channel),
  };
  let retrievalContexts: RetrievalContextDto[] = [];
  let safeItems: InternalValidationResultItem[] = [];
  let resultFingerprint: string | null = null;

  if (input.channel === "API") {
    if (!query || query.length < 2) {
      throw new PayloadServiceError(
        "INCOMPLETE",
        "검색할 질문을 입력해 주세요.",
        400,
      );
    }
    const result = await executeRetrievalApiRequest({
      knowledgePackId: pack.packId,
      query,
      topK: 5,
      retrievalMode: "hybrid",
      includeMetadata: true,
      requestId: `provider-api-validation-${Date.now()}`,
      serviceChannel: "API",
      executionMode: "PROVIDER_VALIDATION",
      versionId: version.id,
      indexGenerationId: binding.indexGenerationId,
    });
    latencyMs = result.ok ? result.latencyMs : Date.now() - started;
    if (!result.ok) {
      failureCode = result.code;
      failureMessage = result.message;
    } else {
      const hits = evaluateRetrievalValidationHits({
        data: result.data,
        expectedVersionId: version.id,
        expectedIndexGenerationId: binding.indexGenerationId,
      });
      resultCount = result.data.contexts.length;
      retrievalContexts = result.data.contexts;
      const top = result.data.contexts[0];
      topChunkId = top?.chunkId ?? null;
      sourceDocumentId = top ? resolveRetrievalContextSourceDocumentId(top) : null;
      const meta = asRecord(top?.metadata);
      page =
        typeof meta?.page === "number"
          ? meta.page
          : typeof meta?.pageStart === "number"
            ? meta.pageStart
            : null;
      details = {
        ...details,
        hitCount: resultCount,
        responseDtoReady: true,
        requestId: `provider-api-validation`,
        retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
        rerankMode: RETRIEVAL_RANKING_POLICY_VERSION,
        ...rerankDetailsFromStats(result.rerankStats),
      };
      if (!hits.ok) {
        failureCode = hits.code;
        failureMessage = hits.message;
      } else {
        safeItems = await buildSafeRetrievalItems({
          contexts: retrievalContexts,
          expectedVersionId: version.id,
          normalizedDocumentId: binding.normalizedDocumentId,
        });
        if (safeItems.length < 1) {
          failureCode = "SERVICE_VALIDATION_RESULT_SNAPSHOT_EMPTY";
          failureMessage = "검색 결과 Snapshot을 저장할 수 없습니다. 다시 검증해 주세요.";
        } else {
          status = "PASS";
          resultFingerprint = computeResultFingerprint({
            query,
            indexGenerationId: binding.indexGenerationId,
            rankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
            items: safeItems,
          });
        }
      }
    }
  } else if (input.channel === "MCP") {
    if (!query || query.length < 2) {
      throw new PayloadServiceError(
        "INCOMPLETE",
        "검색할 질문을 입력해 주세요.",
        400,
      );
    }
    const result = await executeMcpValidation({
      packId: pack.packId,
      versionId: version.id,
      query,
      indexGenerationId: binding.indexGenerationId,
    });
    latencyMs = result.ok ? result.latencyMs : Date.now() - started;
    if (!result.ok) {
      failureCode = result.code;
      failureMessage = result.message;
    } else {
      resultCount = result.data.contexts.length;
      retrievalContexts = result.data.contexts;
      const top = result.data.contexts[0];
      topChunkId = top?.chunkId ?? null;
      sourceDocumentId = top ? resolveRetrievalContextSourceDocumentId(top) : null;
      const meta = asRecord(top?.metadata);
      page =
        typeof meta?.page === "number"
          ? meta.page
          : typeof meta?.pageStart === "number"
            ? meta.pageStart
            : null;
      details = {
        ...details,
        toolName: result.toolName,
        mcpProtocolVersion: result.mcpProtocolVersion,
        responseBytes: result.responseBytes,
        hitCount: resultCount,
        retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
        rerankMode: RETRIEVAL_RANKING_POLICY_VERSION,
        ...rerankDetailsFromStats(result.rerankStats),
      };
      safeItems = await buildSafeRetrievalItems({
        contexts: retrievalContexts,
        expectedVersionId: version.id,
        normalizedDocumentId: binding.normalizedDocumentId,
      });
      if (safeItems.length < 1) {
        failureCode = "SERVICE_VALIDATION_RESULT_SNAPSHOT_EMPTY";
        failureMessage = "검색 결과 Snapshot을 저장할 수 없습니다. 다시 검증해 주세요.";
      } else {
        status = "PASS";
        resultFingerprint = computeResultFingerprint({
          query,
          indexGenerationId: binding.indexGenerationId,
          rankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
          items: safeItems,
        });
      }
    }
  } else {
    // DOWNLOAD channel = RAG Export package build + validate (not original PDF).
    try {
      const evalStep = await prisma.pipelineStepLog.findFirst({
        where: { runId: binding.pipelineRunId, step: "SEARCH_EVALUATING" },
        select: { status: true, details: true },
      });
      assertSearchEvaluationCurrentForChannel({
        channel: "API",
        status: evalStep?.status,
        details: evalStep?.details,
      });
      const pkg = await buildRagExportPackage({
        packId: pack.packId,
        versionId: version.id,
        expectedPipelineRunId: binding.pipelineRunId,
        expectedSearchIndexGenerationId: binding.indexGenerationId,
        expectedNormalizedDocumentId: binding.normalizedDocumentId,
        expectedFingerprint: binding.fingerprint,
        includeZipBytes: true,
      });
      latencyMs = Date.now() - started;
      if (!pkg.validation.valid) {
        failureCode = pkg.validation.issueCodes[0] ?? "RAG_EXPORT_BUILD_FAILED";
        failureMessage = "RAG Export 패키지 검증에 실패했습니다. 다시 실행해 주세요.";
      } else {
        status = "PASS";
        resultCount = pkg.chunkCount;
        details = {
          ...details,
          ...ragExportDetailsFromPackage(pkg),
        };
      }
    } catch (err) {
      latencyMs = Date.now() - started;
      if (err instanceof RagExportBuildError) {
        failureCode = err.code;
        failureMessage =
          err.code === "RAG_EXPORT_BINDING_STALE"
            ? err.message
            : err.message || "RAG Export 패키지 생성에 실패했습니다.";
      } else if (err instanceof PayloadServiceError) {
        failureCode = err.code;
        failureMessage = err.message;
      } else {
        failureCode = "RAG_EXPORT_BUILD_FAILED";
        failureMessage = "RAG Export 패키지 생성에 실패했습니다.";
      }
    }
  }

  const row = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id"
      FROM "KnowledgePack"
      WHERE "packId" = ${pack.packId}
      FOR UPDATE
    `;
    const packInTx = await tx.knowledgePack.findFirst({
      where: {
        packId: pack.packId,
        providerProfileId: profile.id,
        status: PackStatus.DRAFT,
      },
      select: { packId: true },
    });
    const versionInTx = await tx.knowledgePackVersion.findFirst({
      where: { packId: pack.packId },
      orderBy: latestKnowledgePackVersionOrderBy,
      select: { id: true },
    });
    if (!packInTx || versionInTx?.id !== version.id) {
      throw new PayloadServiceError(
        "SERVICE_VALIDATION_NOT_EDITABLE",
        "지식팩 상태 또는 현재 버전이 변경되었습니다. 다시 시도해 주세요.",
        409,
      );
    }
    await assertNoOpenPackReview(tx, pack.packId);
    const bindingInTx = await resolveCurrentValidationBindingTx(tx, {
      packId: pack.packId,
      versionId: version.id,
      expectedPipelineRunId: latest.id,
    });
    if (
      bindingInTx.indexGenerationId !== binding.indexGenerationId ||
      bindingInTx.normalizedDocumentId !== binding.normalizedDocumentId ||
      bindingInTx.fingerprint !== binding.fingerprint
    ) {
      throw new PayloadServiceError(
        "SERVICE_VALIDATION_STALE",
        "지식 데이터가 변경되어 서비스 검증을 다시 실행해야 합니다.",
        409,
      );
    }
    if (input.channel === "API" || input.channel === "MCP") {
      const evalStepInTx = await tx.pipelineStepLog.findFirst({
        where: { runId: bindingInTx.pipelineRunId, step: "SEARCH_EVALUATING" },
        select: { status: true, details: true },
      });
      assertSearchEvaluationCurrentForChannel({
        channel: input.channel,
        status: evalStepInTx?.status,
        details: evalStepInTx?.details,
      });
    }
    if (!SEARCH_VALIDATION_PREPARATION_CHANNELS.includes(input.channel)) {
      throw new PayloadServiceError(
        "SERVICE_CHANNEL_DISABLED",
        "지원하지 않는 검증 채널입니다.",
        409,
      );
    }
    if (status === "PASS" && (input.channel === "API" || input.channel === "MCP")) {
      const sourceDocumentIds = [...new Set(safeItems.map((item) => item.sourceDocumentId))];
      const sourceFileIds = [...new Set(safeItems.map((item) => item.sourceFileId).filter(Boolean))];
      const [sourceDocumentCount, sourceFileCount] = await Promise.all([
        tx.sourceDocument.count({
          where: { id: { in: sourceDocumentIds }, versionId: version.id },
        }),
        tx.knowledgePackFile.count({
          where: {
            id: { in: sourceFileIds as string[] },
            versionId: version.id,
            role: "SOURCE_ORIGINAL",
            bundle: {
              id: bindingInTx.bundleId,
              isActive: true,
              deletedAt: null,
              storageStatus: "ACTIVE",
              status: "REVIEW_READY",
            },
          },
        }),
      ]);
      if (
        sourceDocumentCount !== sourceDocumentIds.length ||
        sourceFileIds.length < 1 ||
        sourceFileCount !== sourceFileIds.length
      ) {
        throw new PayloadServiceError(
          "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
          "검색 결과와 원문 파일 연결이 변경되었습니다. 다시 검증해 주세요.",
          409,
        );
      }
    }
    if (status === "PASS" && input.channel === "DOWNLOAD") {
      if (!isRagExportRunDetails(details)) {
        throw new PayloadServiceError(
          "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
          "RAG Export 검증 증적이 올바르지 않습니다. 다시 검증해 주세요.",
          409,
        );
      }
      const expectedFp =
        details && typeof details === "object" && !Array.isArray(details)
          ? (details as Record<string, unknown>).exportFingerprint
          : null;
      const rebuilt = await buildRagExportPackage({
        packId: pack.packId,
        versionId: version.id,
        expectedPipelineRunId: bindingInTx.pipelineRunId,
        expectedSearchIndexGenerationId: bindingInTx.indexGenerationId,
        expectedNormalizedDocumentId: bindingInTx.normalizedDocumentId,
        expectedFingerprint: bindingInTx.fingerprint,
        includeZipBytes: false,
      });
      if (
        typeof expectedFp !== "string" ||
        rebuilt.exportFingerprint !== expectedFp
      ) {
        throw new PayloadServiceError(
          "RAG_EXPORT_BINDING_STALE",
          "현재 검색데이터가 변경되었습니다. RAG Export 검증을 다시 실행해 주세요.",
          409,
        );
      }
    }
    // P4.1: SearchIndexGeneration READY is required for new Docling validation runs.
    const generationRow = await tx.searchIndexGeneration.findUnique({
      where: { id: binding.indexGenerationId },
    });
    if (!generationRow) {
      throw new PayloadServiceError(
        "SEARCH_GENERATION_REQUIRED",
        "검색 인덱스 세대가 없어 서비스 검증을 실행할 수 없습니다. 검색 데이터를 다시 생성해 주세요.",
        409,
      );
    }
    if (
      generationRow.status !== "READY" ||
      generationRow.scope !== "DRAFT" ||
      generationRow.versionId !== version.id ||
      generationRow.pipelineRunId !== latest.id ||
      generationRow.normalizedDocumentId !== binding.normalizedDocumentId ||
      generationRow.fingerprint !== binding.fingerprint ||
      generationRow.chunkGenerationId !== binding.indexGenerationId
    ) {
      throw new PayloadServiceError(
        "SEARCH_GENERATION_NOT_CURRENT",
        "검색 인덱스 세대가 현재 자료와 일치하지 않거나 READY가 아닙니다. 다시 생성·검증해 주세요.",
        409,
      );
    }
    const generationDualWrite = {
      searchIndexGenerationId: generationRow.id,
      indexGenerationId: generationRow.id,
    };
    const created = await tx.serviceValidationRun.create({
      data: {
        packId: pack.packId,
        versionId: version.id,
        channel: input.channel as ServiceValidationChannel,
        status,
        pipelineRunId: latest.id,
        ...generationDualWrite,
        normalizedDocumentId: binding.normalizedDocumentId,
        fingerprint: binding.fingerprint,
        resultFingerprint,
        testedAt: new Date(),
        testedByUserId: input.userId,
        query,
        resultCount,
        topChunkId,
        sourceDocumentId,
        page,
        latencyMs,
        failureCode,
        failureMessage,
        details: details as Prisma.InputJsonValue,
      },
    });
    if (status === "PASS" && (input.channel === "API" || input.channel === "MCP")) {
      if (safeItems.length < 1) {
        throw new PayloadServiceError(
          "SERVICE_VALIDATION_RESULT_SNAPSHOT_EMPTY",
          "검색 결과 Snapshot을 저장할 수 없습니다. 다시 검증해 주세요.",
          500,
        );
      }
      await tx.serviceValidationResultItem.createMany({
        data: safeItems.map((item) => ({
          runId: created.id,
          rank: item.rank,
          chunkId: item.chunkId,
          title: item.title,
          snippet: item.snippet,
          score: item.score,
          sourceDocumentId: item.sourceDocumentId,
          sourceDocumentTitle: item.sourceDocumentTitle,
          sourceFileId: item.sourceFileId,
          pageStart: item.pageStart,
          pageEnd: item.pageEnd,
          sourceLocator: item.sourceLocator,
        })),
      });
    }
    return created;
  });

  return mapRunToProviderChannelDto({
    channel: input.channel,
    run: row,
    bindingFingerprint: binding.fingerprint,
    bindingIndexGenerationId: binding.indexGenerationId,
    canRunValidation: true,
    userNames: new Map(),
  });
}
