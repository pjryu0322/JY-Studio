/**
 * Per-channel execution for `runServiceChannelValidation`: calls the API/MCP/
 * DOWNLOAD adapter, evaluates the raw response, and produces a
 * {@link ChannelRunOutcome} the orchestrator can persist without needing to
 * know how each channel's adapter response is shaped.
 */
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import type { ServiceChannel } from "@/lib/distribution/service-channel-policy";
import {
  buildRagExportPackage,
  ragExportDetailsFromPackage,
  RagExportBuildError,
} from "@/lib/exports/rag-export-builder";
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
import { computeResultFingerprint } from "@/lib/distribution/service-validation-share";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "@/lib/retrieval/relevance-diversity-rerank";
import {
  adapterPathForChannel,
  asRecord,
  assertSearchEvaluationCurrentForChannel,
  rerankDetailsFromStats,
} from "@/lib/distribution/service-validation-policy";
import type { ServiceValidationStatus } from "@prisma/client";
import type { CurrentValidationBinding } from "@/lib/distribution/service-validation-binding";

export type ChannelRunOutcome = {
  status: ServiceValidationStatus;
  failureCode: string | null;
  failureMessage: string | null;
  resultCount: number | null;
  topChunkId: string | null;
  sourceDocumentId: string | null;
  page: number | null;
  latencyMs: number;
  details: Record<string, unknown>;
  safeItems: InternalValidationResultItem[];
  resultFingerprint: string | null;
};

function initialChannelDetails(channel: ServiceChannel): Record<string, unknown> {
  return {
    adapter: channel === "API" ? "RETRIEVAL_API" : channel === "MCP" ? "MCP_HANDLER" : "OBJECT_STORAGE",
    adapterPath: adapterPathForChannel(channel),
  };
}

/** DB-backed: filters raw retrieval contexts down to items whose chunk/source/file evidence is still valid. */
export async function buildSafeRetrievalItems(input: {
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

/** Pure: require a non-trivial search query for API/MCP channels. */
export function assertValidationQueryPresent(query: string | null): asserts query is string {
  if (!query || query.length < 2) {
    throw new PayloadServiceError("INCOMPLETE", "검색할 질문을 입력해 주세요.", 400);
  }
}

/** Pure: pull the top-hit chunk/source/page fields off a retrieval-context list. */
function extractTopHitFields(contexts: RetrievalContextDto[]): {
  topChunkId: string | null;
  sourceDocumentId: string | null;
  page: number | null;
} {
  const top = contexts[0];
  const meta = asRecord(top?.metadata);
  return {
    topChunkId: top?.chunkId ?? null,
    sourceDocumentId: top ? resolveRetrievalContextSourceDocumentId(top) : null,
    page:
      typeof meta?.page === "number"
        ? meta.page
        : typeof meta?.pageStart === "number"
          ? meta.pageStart
          : null,
  };
}

/** DB-backed + pure: build safe result items and, if non-empty, mark the outcome PASS with its fingerprint. */
async function finalizeRetrievalOutcome(input: {
  contexts: RetrievalContextDto[];
  expectedVersionId: string;
  normalizedDocumentId: string;
  query: string;
  indexGenerationId: string;
  outcome: ChannelRunOutcome;
}): Promise<ChannelRunOutcome> {
  const safeItems = await buildSafeRetrievalItems({
    contexts: input.contexts,
    expectedVersionId: input.expectedVersionId,
    normalizedDocumentId: input.normalizedDocumentId,
  });
  if (safeItems.length < 1) {
    return {
      ...input.outcome,
      failureCode: "SERVICE_VALIDATION_RESULT_SNAPSHOT_EMPTY",
      failureMessage: "검색 결과 Snapshot을 저장할 수 없습니다. 다시 검증해 주세요.",
    };
  }
  return {
    ...input.outcome,
    status: "PASS",
    safeItems,
    resultFingerprint: computeResultFingerprint({
      query: input.query,
      indexGenerationId: input.indexGenerationId,
      rankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
      items: safeItems,
    }),
  };
}

function emptyOutcome(channel: ServiceChannel): ChannelRunOutcome {
  return {
    status: "FAIL",
    failureCode: null,
    failureMessage: null,
    resultCount: null,
    topChunkId: null,
    sourceDocumentId: null,
    page: null,
    latencyMs: 0,
    details: initialChannelDetails(channel),
    safeItems: [],
    resultFingerprint: null,
  };
}

/** Runs the API-channel retrieval adapter and evaluates its result into a run outcome. */
export async function runApiChannelValidation(input: {
  query: string;
  versionId: string;
  packId: string;
  indexGenerationId: string;
  normalizedDocumentId: string;
  started: number;
}): Promise<ChannelRunOutcome> {
  let outcome = emptyOutcome("API");
  const result = await executeRetrievalApiRequest({
    knowledgePackId: input.packId,
    query: input.query,
    topK: 5,
    retrievalMode: "hybrid",
    includeMetadata: true,
    requestId: `provider-api-validation-${Date.now()}`,
    serviceChannel: "API",
    executionMode: "PROVIDER_VALIDATION",
    versionId: input.versionId,
    indexGenerationId: input.indexGenerationId,
  });
  outcome.latencyMs = result.ok ? result.latencyMs : Date.now() - input.started;
  if (!result.ok) {
    return { ...outcome, failureCode: result.code, failureMessage: result.message };
  }
  const hits = evaluateRetrievalValidationHits({
    data: result.data,
    expectedVersionId: input.versionId,
    expectedIndexGenerationId: input.indexGenerationId,
  });
  outcome = {
    ...outcome,
    resultCount: result.data.contexts.length,
    ...extractTopHitFields(result.data.contexts),
    details: {
      ...outcome.details,
      hitCount: result.data.contexts.length,
      responseDtoReady: true,
      requestId: `provider-api-validation`,
      retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
      rerankMode: RETRIEVAL_RANKING_POLICY_VERSION,
      ...rerankDetailsFromStats(result.rerankStats),
    },
  };
  if (!hits.ok) {
    return { ...outcome, failureCode: hits.code, failureMessage: hits.message };
  }
  return finalizeRetrievalOutcome({
    contexts: result.data.contexts,
    expectedVersionId: input.versionId,
    normalizedDocumentId: input.normalizedDocumentId,
    query: input.query,
    indexGenerationId: input.indexGenerationId,
    outcome,
  });
}

/** Runs the MCP-channel validation adapter and evaluates its result into a run outcome. */
export async function runMcpChannelValidation(input: {
  query: string;
  versionId: string;
  packId: string;
  indexGenerationId: string;
  normalizedDocumentId: string;
  started: number;
}): Promise<ChannelRunOutcome> {
  let outcome = emptyOutcome("MCP");
  const result = await executeMcpValidation({
    packId: input.packId,
    versionId: input.versionId,
    query: input.query,
    indexGenerationId: input.indexGenerationId,
  });
  outcome.latencyMs = result.ok ? result.latencyMs : Date.now() - input.started;
  if (!result.ok) {
    return { ...outcome, failureCode: result.code, failureMessage: result.message };
  }
  outcome = {
    ...outcome,
    resultCount: result.data.contexts.length,
    ...extractTopHitFields(result.data.contexts),
    details: {
      ...outcome.details,
      toolName: result.toolName,
      mcpProtocolVersion: result.mcpProtocolVersion,
      responseBytes: result.responseBytes,
      hitCount: result.data.contexts.length,
      retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
      rerankMode: RETRIEVAL_RANKING_POLICY_VERSION,
      ...rerankDetailsFromStats(result.rerankStats),
    },
  };
  return finalizeRetrievalOutcome({
    contexts: result.data.contexts,
    expectedVersionId: input.versionId,
    normalizedDocumentId: input.normalizedDocumentId,
    query: input.query,
    indexGenerationId: input.indexGenerationId,
    outcome,
  });
}

/** Pure: map a caught RAG-export/payload error into failureCode/failureMessage. */
function ragExportFailureFromError(err: unknown): { failureCode: string; failureMessage: string } {
  if (err instanceof RagExportBuildError) {
    return {
      failureCode: err.code,
      failureMessage:
        err.code === "RAG_EXPORT_BINDING_STALE"
          ? err.message
          : err.message || "RAG Export 패키지 생성에 실패했습니다.",
    };
  }
  if (err instanceof PayloadServiceError) {
    return { failureCode: err.code, failureMessage: err.message };
  }
  return { failureCode: "RAG_EXPORT_BUILD_FAILED", failureMessage: "RAG Export 패키지 생성에 실패했습니다." };
}

/** Builds + validates the RAG Export package for the DOWNLOAD channel into a run outcome. */
export async function runDownloadChannelValidation(input: {
  packId: string;
  versionId: string;
  binding: CurrentValidationBinding;
  started: number;
}): Promise<ChannelRunOutcome> {
  const outcome = emptyOutcome("DOWNLOAD");
  try {
    const evalStep = await prisma.pipelineStepLog.findFirst({
      where: { runId: input.binding.pipelineRunId, step: "SEARCH_EVALUATING" },
      select: { status: true, details: true },
    });
    assertSearchEvaluationCurrentForChannel({
      channel: "API",
      status: evalStep?.status,
      details: evalStep?.details,
    });
    const pkg = await buildRagExportPackage({
      packId: input.packId,
      versionId: input.versionId,
      expectedPipelineRunId: input.binding.pipelineRunId,
      expectedSearchIndexGenerationId: input.binding.indexGenerationId,
      expectedNormalizedDocumentId: input.binding.normalizedDocumentId,
      expectedFingerprint: input.binding.fingerprint,
      includeZipBytes: true,
    });
    const latencyMs = Date.now() - input.started;
    if (!pkg.validation.valid) {
      return {
        ...outcome,
        latencyMs,
        failureCode: pkg.validation.issueCodes[0] ?? "RAG_EXPORT_BUILD_FAILED",
        failureMessage: "RAG Export 패키지 검증에 실패했습니다. 다시 실행해 주세요.",
      };
    }
    return {
      ...outcome,
      latencyMs,
      status: "PASS",
      resultCount: pkg.chunkCount,
      details: { ...outcome.details, ...ragExportDetailsFromPackage(pkg) },
    };
  } catch (err) {
    return { ...outcome, latencyMs: Date.now() - input.started, ...ragExportFailureFromError(err) };
  }
}
