import { AuditAction, PackStatus } from "@prisma/client";
import { rebuildPackEmbeddings } from "@/lib/chunk-embedding-service";
import {
  DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
  DOCLING_RETRIEVAL_CHUNK_TYPE,
} from "@/lib/docling-knowledge/docling-knowledge-stages";
import { runDoclingRetrievalEvaluation } from "@/lib/docling-knowledge/docling-knowledge-eval";
import {
  activateDraftIndexGeneration,
  failDraftIndexGeneration,
} from "@/lib/docling-knowledge/docling-nd-knowledge-builder";
import {
  getDoclingKnowledgePipelineStatus,
  isDoclingStructurePassed,
} from "@/lib/docling-knowledge/docling-knowledge-pipeline-service";
import { parseKnowledgeRunBinding } from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { LOCAL_E5_EMBEDDING_PROVIDER } from "@/lib/embedding/e5-embedding-constants";
import {
  EmbeddingProviderError,
  isEmbeddingProviderError,
} from "@/lib/embedding/embedding-provider-errors";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { recordProviderAudit } from "@/lib/provider-audit";
import { prisma } from "@/lib/prisma";
import { completePipelineStep } from "@/lib/pipeline-service";
import { createSearchGenerationForPipeline } from "@/lib/search-generation/search-generation-pipeline-sync";
import {
  markSearchGenerationEmbedding,
  markSearchGenerationIndexing,
} from "@/lib/search-generation/search-generation-service";
import { resolveSearchGenerationEmbeddingDescriptor } from "@/lib/search-generation/search-generation-types";
import {
  buildSearchDataStatusResponse,
  type SearchDataStatusResponse,
} from "@/lib/search-data/search-data-state";

const SEARCH_DATA_LOCK_KEY = (packId: string) => `search-data:${packId}`;

async function assertPgvectorRuntimeReady(): Promise<void> {
  const ext = await prisma.$queryRaw<Array<{ extversion: string }>>`
    SELECT extversion FROM pg_extension WHERE extname = 'vector'
  `;
  if (ext.length !== 1) {
    throw new EmbeddingProviderError(
      "SEARCH_RUNTIME_UNAVAILABLE",
      "검색 저장소를 사용할 수 없습니다. 관리자에게 문의 바랍니다.",
    );
  }
  const table = await prisma.$queryRaw<Array<{ reg: string | null }>>`
    SELECT to_regclass('"SearchIndexVector"')::text AS reg
  `;
  const reg = table[0]?.reg;
  if (reg !== "SearchIndexVector" && reg !== '"SearchIndexVector"') {
    throw new EmbeddingProviderError(
      "SEARCH_RUNTIME_UNAVAILABLE",
      "검색 저장소를 사용할 수 없습니다. 관리자에게 문의 바랍니다.",
    );
  }
}

async function countVectorsForGeneration(generationId: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*)::bigint AS n
    FROM "SearchIndexVector"
    WHERE "searchIndexGenerationId" = ${generationId}
  `;
  return Number(rows[0]?.n ?? 0);
}

async function loadOwnedPack(input: { userId: string; clientId: string; packId: string }) {
  const profile = await findOrEnsureProviderProfileForUser(input.userId, input.clientId);
  if (!profile) return { ok: false as const, error: "PROFILE_REQUIRED" as const };
  const pack = await prisma.knowledgePack.findFirst({
    where: { packId: input.packId, providerProfileId: profile.id },
    include: {
      versions: { orderBy: latestKnowledgePackVersionOrderBy, take: 1 },
    },
  });
  if (!pack) return { ok: false as const, error: "NOT_FOUND" as const };
  return { ok: true as const, profile, pack };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/**
 * Resolves current structure binding + Local E5 search-data status for the provider UI.
 */
export async function getSearchDataStatus(input: {
  userId: string;
  clientId: string;
  packId: string;
}): Promise<{ error: "NOT_FOUND" | "PROFILE_REQUIRED" } | SearchDataStatusResponse> {
  const owned = await loadOwnedPack(input);
  if (!owned.ok) return { error: owned.error };

  const knowledge = await getDoclingKnowledgePipelineStatus({
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });
  if ("error" in knowledge) return { error: knowledge.error };

  const version = owned.pack.versions[0];
  if (!version) {
    return buildSearchDataStatusResponse({
      structurePassed: false,
      pipelineCurrent: false,
      packStatusIsDraft: owned.pack.status === PackStatus.DRAFT,
      chunkCount: 0,
      generation: null,
      vectorCount: 0,
      message: "버전 정보가 없습니다.",
    });
  }

  const latest = await prisma.pipelineRun.findFirst({
    where: { packId: input.packId, triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER },
    orderBy: { startedAt: "desc" },
    include: { steps: true },
  });
  const binding = latest ? parseKnowledgeRunBinding(latest.summary) : null;
  const indexGenerationId = binding?.indexGenerationId?.trim() || null;

  let chunkCount = 0;
  if (indexGenerationId) {
    chunkCount = await prisma.knowledgeChunk.count({
      where: {
        versionId: version.id,
        chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
        OR: [
          { chunkGenerationId: indexGenerationId },
          {
            AND: [
              { chunkGenerationId: null },
              { metadata: { path: ["indexGenerationId"], equals: indexGenerationId } },
            ],
          },
        ],
      },
    });
  }

  const generation = indexGenerationId
    ? await prisma.searchIndexGeneration.findUnique({ where: { id: indexGenerationId } })
    : null;

  const isCurrentLocalE5 =
    generation &&
    binding &&
    generation.embeddingProvider === LOCAL_E5_EMBEDDING_PROVIDER &&
    generation.versionId === version.id &&
    generation.normalizedDocumentId === binding.normalizedDocumentId &&
    generation.fingerprint === binding.fingerprint &&
    generation.chunkGenerationId === binding.indexGenerationId
      ? generation
      : null;

  const vectorCount = isCurrentLocalE5 ? await countVectorsForGeneration(isCurrentLocalE5.id) : 0;

  const indexingStep = latest?.steps.find((s) => s.step === "INDEXING");
  const evalStep = latest?.steps.find((s) => s.step === "SEARCH_EVALUATING");
  const indexDetails = asRecord(indexingStep?.details);
  const evalDetails = asRecord(evalStep?.details);

  const legacyLocalHashPresent =
    Boolean(indexingStep && indexingStep.status === "PASS") &&
    (indexDetails?.embeddingProvider === "local-hash" ||
      !isCurrentLocalE5 ||
      (generation != null && generation.embeddingProvider === "local-hash"));

  const evalTotal =
    typeof evalDetails?.questionCount === "number"
      ? evalDetails.questionCount
      : typeof evalDetails?.totalCases === "number"
        ? evalDetails.totalCases
        : null;
  const evalPassed =
    typeof evalDetails?.passedCount === "number"
      ? evalDetails.passedCount
      : typeof evalDetails?.passedCases === "number"
        ? evalDetails.passedCases
        : null;

  // Only treat INDEXING PASS as current when Local E5 generation is complete —
  // otherwise legacy PASS must not drive CREATED/VALIDATED.
  const indexingStatusForUi =
    isCurrentLocalE5 && indexingStep?.status === "RUNNING"
      ? "RUNNING"
      : isCurrentLocalE5 && indexingStep?.status === "FAIL"
        ? "FAIL"
        : isCurrentLocalE5
          ? indexingStep?.status ?? null
          : null;

  const evaluationStatusForUi =
    isCurrentLocalE5 && evalStep?.status === "RUNNING"
      ? "RUNNING"
      : isCurrentLocalE5
        ? evalStep?.status ?? null
        : null;

  return buildSearchDataStatusResponse({
    structurePassed: knowledge.structurePassed,
    pipelineCurrent: knowledge.pipelineCurrent,
    packStatusIsDraft: owned.pack.status === PackStatus.DRAFT,
    chunkCount,
    generation: isCurrentLocalE5
      ? {
          id: isCurrentLocalE5.id,
          status: isCurrentLocalE5.status,
          scope: isCurrentLocalE5.scope,
          embeddingProvider: isCurrentLocalE5.embeddingProvider,
          embeddingModel: isCurrentLocalE5.embeddingModel,
          embeddingModelRevision: isCurrentLocalE5.embeddingModelRevision,
          embeddingDimension: isCurrentLocalE5.embeddingDimension,
          chunkCount: isCurrentLocalE5.chunkCount,
          embeddedCount: isCurrentLocalE5.embeddedCount,
          failedCount: isCurrentLocalE5.failedCount,
          chunkGenerationId: isCurrentLocalE5.chunkGenerationId,
          pipelineRunId: isCurrentLocalE5.pipelineRunId,
          normalizedDocumentId: isCurrentLocalE5.normalizedDocumentId,
          fingerprint: isCurrentLocalE5.fingerprint,
        }
      : null,
    vectorCount,
    indexingStepStatus: indexingStatusForUi,
    evaluationStepStatus: evaluationStatusForUi,
    evaluationPassedCases: evalPassed,
    evaluationTotalCases: evalTotal,
    legacyLocalHashPresent,
    serviceChannelsReady: true,
  });
}

async function resetGenerationForRebuild(generationId: string): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM "SearchIndexVector" WHERE "searchIndexGenerationId" = ${generationId}
  `.catch(() => undefined);
  await prisma.knowledgeChunkEmbedding
    .deleteMany({ where: { searchIndexGenerationId: generationId } })
    .catch(() => undefined);
  await prisma.searchIndexGeneration.delete({ where: { id: generationId } }).catch(() => undefined);
}

/**
 * Creates Local E5 Draft SearchIndexGeneration + Passage embeddings + SearchIndexVector
 * for the current structure binding (does not re-run Docling structure).
 */
export async function startSearchDataGeneration(input: {
  userId: string;
  clientId: string;
  packId: string;
}): Promise<
  | { error: "NOT_FOUND" | "PROFILE_REQUIRED" | "INVALID"; message: string; code?: string }
  | SearchDataStatusResponse
> {
  const owned = await loadOwnedPack(input);
  if (!owned.ok) return { error: owned.error, message: "팩을 찾을 수 없습니다." };
  if (owned.pack.status !== PackStatus.DRAFT) {
    return {
      error: "INVALID",
      message: "초안 상태에서만 검색데이터를 생성할 수 있습니다.",
      code: "PACK_NOT_DRAFT",
    };
  }

  const structureOk = await isDoclingStructurePassed(input.packId);
  if (!structureOk) {
    return {
      error: "INVALID",
      message: "데이터 구조화가 완료되지 않았습니다. 구조화 단계로 이동해 주세요.",
      code: "STRUCTURE_REQUIRED",
    };
  }

  const knowledge = await getDoclingKnowledgePipelineStatus({
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });
  if ("error" in knowledge) return { error: knowledge.error, message: "팩을 찾을 수 없습니다." };
  if (!knowledge.pipelineCurrent) {
    return {
      error: "INVALID",
      message: "자료 또는 구조화 결과가 변경되었습니다. 데이터 구조화를 다시 실행해 주세요.",
      code: "STALE",
    };
  }

  const version = owned.pack.versions[0];
  if (!version) {
    return { error: "INVALID", message: "버전 정보가 없습니다.", code: "VERSION_REQUIRED" };
  }

  const latest = await prisma.pipelineRun.findFirst({
    where: { packId: input.packId, triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER },
    orderBy: { startedAt: "desc" },
  });
  if (!latest) {
    return {
      error: "INVALID",
      message: "구조화 실행 기록을 찾을 수 없습니다.",
      code: "PIPELINE_REQUIRED",
    };
  }
  const binding = parseKnowledgeRunBinding(latest.summary);
  if (!binding?.indexGenerationId || !binding.fingerprint || !binding.normalizedDocumentId) {
    return {
      error: "INVALID",
      message: "현재 구조화 Binding이 없습니다.",
      code: "BINDING_REQUIRED",
    };
  }

  const indexGenerationId = binding.indexGenerationId;
  const chunkCount = await prisma.knowledgeChunk.count({
    where: {
      versionId: version.id,
      chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
      OR: [
        { chunkGenerationId: indexGenerationId },
        {
          AND: [
            { chunkGenerationId: null },
            { metadata: { path: ["indexGenerationId"], equals: indexGenerationId } },
          ],
        },
      ],
    },
  });
  if (chunkCount < 1) {
    return {
      error: "INVALID",
      message: "검색 단위(Chunk)가 없습니다. 데이터 구조화를 다시 실행해 주세요.",
      code: "CHUNKS_REQUIRED",
    };
  }

  try {
    await assertPgvectorRuntimeReady();
    process.env.JYKSTORE_REQUIRE_PGVECTOR = process.env.JYKSTORE_REQUIRE_PGVECTOR || "true";

    // Serialize create/reset under advisory lock, then embed outside the lock.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${SEARCH_DATA_LOCK_KEY(input.packId)}))`;
      const locked = await tx.searchIndexGeneration.findUnique({
        where: { id: indexGenerationId },
      });
      if (
        locked &&
        locked.embeddingProvider === LOCAL_E5_EMBEDDING_PROVIDER &&
        ["PENDING", "EMBEDDING", "INDEXING"].includes(locked.status)
      ) {
        return;
      }
      if (locked) {
        await tx.$executeRaw`
          DELETE FROM "SearchIndexVector" WHERE "searchIndexGenerationId" = ${indexGenerationId}
        `.catch(() => undefined);
        await tx.knowledgeChunkEmbedding
          .deleteMany({ where: { searchIndexGenerationId: indexGenerationId } })
          .catch(() => undefined);
        await tx.searchIndexGeneration
          .delete({ where: { id: indexGenerationId } })
          .catch(() => undefined);
      }
    });

    // Re-check after lock (another request may have started).
    const afterLock = await prisma.searchIndexGeneration.findUnique({
      where: { id: indexGenerationId },
    });
    if (
      afterLock &&
      afterLock.embeddingProvider === LOCAL_E5_EMBEDDING_PROVIDER &&
      ["PENDING", "EMBEDDING", "INDEXING"].includes(afterLock.status)
    ) {
      return getSearchDataStatus(input) as Promise<SearchDataStatusResponse>;
    }
    if (
      afterLock &&
      afterLock.embeddingProvider === LOCAL_E5_EMBEDDING_PROVIDER &&
      afterLock.embeddingDimension === 384 &&
      (afterLock.status === "READY" || afterLock.status === "INDEXING")
    ) {
      const vectors = await countVectorsForGeneration(afterLock.id);
      if (vectors === chunkCount && afterLock.embeddedCount >= chunkCount) {
        return getSearchDataStatus(input) as Promise<SearchDataStatusResponse>;
      }
      await resetGenerationForRebuild(indexGenerationId);
    } else if (afterLock) {
      await resetGenerationForRebuild(indexGenerationId);
    }

    const descriptor = await resolveSearchGenerationEmbeddingDescriptor();

    await recordProviderAudit({
      action: AuditAction.PROVIDER_PACK_UPDATE,
      entityType: "KnowledgePack",
      entityId: input.packId,
      actorUserId: input.userId,
      metadata: {
        event: "SEARCH_DATA_GENERATION_STARTED",
        packId: input.packId,
        versionId: version.id,
        normalizedDocumentId: binding.normalizedDocumentId,
        chunkGenerationId: indexGenerationId,
        searchIndexGenerationId: indexGenerationId,
        chunkCount,
      },
    });

    await createSearchGenerationForPipeline({
      id: indexGenerationId,
      packId: input.packId,
      versionId: version.id,
      pipelineRunId: latest.id,
      normalizedDocumentId: binding.normalizedDocumentId,
      fingerprint: binding.fingerprint,
      chunkGenerationId: indexGenerationId,
      descriptor,
    });

    await markSearchGenerationEmbedding(indexGenerationId);
    const embeddings = await rebuildPackEmbeddings({
      packId: input.packId,
      versionId: version.id,
      force: true,
      chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
      indexGenerationId,
      searchIndexGenerationId: indexGenerationId,
      pipelineRunId: latest.id,
      fingerprint: binding.fingerprint,
      normalizedDocumentId: binding.normalizedDocumentId,
      chunkGenerationId: indexGenerationId,
      includeInactiveForGeneration: true,
    });

    if (!embeddings) {
      await failDraftIndexGeneration({
        versionId: version.id,
        indexGenerationId,
        failureCode: "INDEX_BUILD_FAILED",
        failureMessage: "embedding rebuild returned null",
      }).catch(() => undefined);
      await recordProviderAudit({
        action: AuditAction.PROVIDER_PACK_UPDATE,
        entityType: "KnowledgePack",
        entityId: input.packId,
        actorUserId: input.userId,
        metadata: {
          event: "SEARCH_DATA_GENERATION_FAILED",
          failureCode: "INDEX_BUILD_FAILED",
          searchIndexGenerationId: indexGenerationId,
        },
      });
      return {
        error: "INVALID",
        message: "검색데이터 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        code: "INDEX_BUILD_FAILED",
      };
    }

    const embedded =
      embeddings.createdCount + embeddings.updatedCount + embeddings.skippedCount;
    await markSearchGenerationIndexing(indexGenerationId, {
      embeddedCount: embedded,
      chunkCount: embeddings.processedCount,
      failedCount: 0,
    });

    const vectorCount = await countVectorsForGeneration(indexGenerationId);
    if (vectorCount !== chunkCount || embedded < chunkCount) {
      await failDraftIndexGeneration({
        versionId: version.id,
        indexGenerationId,
        failureCode: "VECTOR_COUNT_MISMATCH",
        failureMessage: `vectors=${vectorCount} chunks=${chunkCount} embedded=${embedded}`,
      }).catch(() => undefined);
      await recordProviderAudit({
        action: AuditAction.PROVIDER_PACK_UPDATE,
        entityType: "KnowledgePack",
        entityId: input.packId,
        actorUserId: input.userId,
        metadata: {
          event: "SEARCH_DATA_GENERATION_FAILED",
          failureCode: "VECTOR_COUNT_MISMATCH",
          chunkCount,
          vectorCount,
          searchIndexGenerationId: indexGenerationId,
        },
      });
      return {
        error: "INVALID",
        message: "검색데이터 저장이 완료되지 않았습니다. 다시 생성해 주세요.",
        code: "VECTOR_COUNT_MISMATCH",
      };
    }

    // Align pipeline INDEXING step so status UI / service validation binding stay coherent.
    await completePipelineStep({
      runId: latest.id,
      step: "INDEXING",
      status: "PASS",
      message: `검색데이터 ${vectorCount}건을 생성했습니다.`,
      details: {
        draft: true,
        indexGenerationId,
        searchIndexGenerationId: indexGenerationId,
        indexScope: "DRAFT",
        embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
        processedCount: embeddings.processedCount,
        vectorCount,
      },
    });

    await recordProviderAudit({
      action: AuditAction.PROVIDER_PACK_UPDATE,
      entityType: "KnowledgePack",
      entityId: input.packId,
      actorUserId: input.userId,
      metadata: {
        event: "SEARCH_DATA_GENERATION_COMPLETED",
        packId: input.packId,
        versionId: version.id,
        normalizedDocumentId: binding.normalizedDocumentId,
        chunkGenerationId: indexGenerationId,
        searchIndexGenerationId: indexGenerationId,
        chunkCount,
        vectorCount,
      },
    });

    return getSearchDataStatus(input) as Promise<SearchDataStatusResponse>;
  } catch (error) {
    const code = isEmbeddingProviderError(error)
      ? error.code
      : error instanceof PayloadServiceError
        ? error.code
        : "INDEX_BUILD_FAILED";
    let message = "검색데이터 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.";
    if (code === "SEARCH_RUNTIME_UNAVAILABLE") {
      message = "검색 저장소를 사용할 수 없습니다. 관리자에게 문의 바랍니다.";
    } else if (
      code === "EMBEDDING_PROVIDER_NOT_CONFIGURED" ||
      code === "EMBEDDING_PROVIDER_REQUEST_FAILED" ||
      code === "EMBEDDING_MODEL_REVISION_MISMATCH"
    ) {
      message = "검색 모델을 사용할 수 없습니다. 관리자에게 문의 바랍니다.";
    } else if (code === "EMBEDDING_TOKEN_LIMIT_EXCEEDED") {
      message = "일부 검색 단위가 모델 입력 제한을 초과했습니다.";
    }

    await failDraftIndexGeneration({
      versionId: version.id,
      indexGenerationId,
      failureCode: code,
      failureMessage: error instanceof Error ? error.message.slice(0, 300) : null,
    }).catch(() => undefined);

    await recordProviderAudit({
      action: AuditAction.PROVIDER_PACK_UPDATE,
      entityType: "KnowledgePack",
      entityId: input.packId,
      actorUserId: input.userId,
      metadata: {
        event: "SEARCH_DATA_GENERATION_FAILED",
        failureCode: code,
        searchIndexGenerationId: indexGenerationId,
        chunkCount,
      },
    }).catch(() => undefined);

    return { error: "INVALID", message, code };
  }
}

/**
 * Runs retrieval quality evaluation and activates Draft READY generation.
 */
export async function validateSearchData(input: {
  userId: string;
  clientId: string;
  packId: string;
}): Promise<
  | { error: "NOT_FOUND" | "PROFILE_REQUIRED" | "INVALID"; message: string; code?: string }
  | SearchDataStatusResponse
> {
  const status = await getSearchDataStatus(input);
  if ("error" in status) {
    return { error: status.error, message: "팩을 찾을 수 없습니다." };
  }
  if (!status.canValidate && status.state !== "VALIDATION_FAILED") {
    return {
      error: "INVALID",
      message:
        status.state === "NOT_CREATED" || status.state === "CREATE_FAILED"
          ? "검색데이터를 먼저 생성해 주세요."
          : status.message ?? "검색 품질 검증을 실행할 수 없습니다.",
      code: "VALIDATE_NOT_READY",
    };
  }

  const owned = await loadOwnedPack(input);
  if (!owned.ok) return { error: owned.error, message: "팩을 찾을 수 없습니다." };
  const version = owned.pack.versions[0];
  if (!version) {
    return { error: "INVALID", message: "버전 정보가 없습니다.", code: "VERSION_REQUIRED" };
  }

  const latest = await prisma.pipelineRun.findFirst({
    where: { packId: input.packId, triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER },
    orderBy: { startedAt: "desc" },
  });
  const binding = latest ? parseKnowledgeRunBinding(latest.summary) : null;
  if (!latest || !binding?.indexGenerationId) {
    return { error: "INVALID", message: "구조화 Binding이 없습니다.", code: "BINDING_REQUIRED" };
  }
  const indexGenerationId = binding.indexGenerationId;

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_UPDATE,
    entityType: "KnowledgePack",
    entityId: input.packId,
    actorUserId: input.userId,
    metadata: {
      event: "SEARCH_DATA_VALIDATION_STARTED",
      searchIndexGenerationId: indexGenerationId,
    },
  });

  try {
    await completePipelineStep({
      runId: latest.id,
      step: "SEARCH_EVALUATING",
      status: "RUNNING",
      message: "검색 품질을 검증하는 중…",
    });

    const evaluation = await runDoclingRetrievalEvaluation({
      packId: input.packId,
      versionId: version.id,
      indexGenerationId,
    });

    if (evaluation.status === "FAIL" || evaluation.status === "WARNING") {
      await completePipelineStep({
        runId: latest.id,
        step: "SEARCH_EVALUATING",
        status: evaluation.status === "FAIL" ? "FAIL" : "WARNING",
        message:
          evaluation.status === "FAIL"
            ? "검색 품질이 기준을 충족하지 못했습니다."
            : "검색 검증에 보완이 필요합니다.",
        details: evaluation as unknown as Record<string, unknown>,
      });
      await failDraftIndexGeneration({
        versionId: version.id,
        indexGenerationId,
        failureCode: evaluation.failureCode ?? "RETRIEVAL_EVALUATION_FAILED",
      }).catch(() => undefined);
      await recordProviderAudit({
        action: AuditAction.PROVIDER_PACK_UPDATE,
        entityType: "KnowledgePack",
        entityId: input.packId,
        actorUserId: input.userId,
        metadata: {
          event: "SEARCH_DATA_VALIDATION_FAILED",
          failureCode: evaluation.failureCode ?? "RETRIEVAL_EVALUATION_FAILED",
          searchIndexGenerationId: indexGenerationId,
        },
      });
      return getSearchDataStatus(input) as Promise<SearchDataStatusResponse>;
    }

    await activateDraftIndexGeneration({
      versionId: version.id,
      indexGenerationId,
    });

    await completePipelineStep({
      runId: latest.id,
      step: "SEARCH_EVALUATING",
      status: "PASS",
      message: "검색 품질 검증이 완료되었습니다.",
      details: evaluation as unknown as Record<string, unknown>,
    });

    await recordProviderAudit({
      action: AuditAction.PROVIDER_PACK_UPDATE,
      entityType: "KnowledgePack",
      entityId: input.packId,
      actorUserId: input.userId,
      metadata: {
        event: "SEARCH_DATA_VALIDATION_COMPLETED",
        searchIndexGenerationId: indexGenerationId,
      },
    });

    return getSearchDataStatus(input) as Promise<SearchDataStatusResponse>;
  } catch (error) {
    await failDraftIndexGeneration({
      versionId: version.id,
      indexGenerationId,
      failureCode: "RETRIEVAL_EVALUATION_FAILED",
      failureMessage: error instanceof Error ? error.message.slice(0, 300) : null,
    }).catch(() => undefined);
    await recordProviderAudit({
      action: AuditAction.PROVIDER_PACK_UPDATE,
      entityType: "KnowledgePack",
      entityId: input.packId,
      actorUserId: input.userId,
      metadata: {
        event: "SEARCH_DATA_VALIDATION_FAILED",
        failureCode: "RETRIEVAL_EVALUATION_FAILED",
        searchIndexGenerationId: indexGenerationId,
      },
    }).catch(() => undefined);
    return {
      error: "INVALID",
      message: "검색 품질 검증에 실패했습니다. 다시 시도해 주세요.",
      code: "RETRIEVAL_EVALUATION_FAILED",
    };
  }
}
