import { AuditAction, PackStatus, type SearchIndexGeneration } from "@prisma/client";
import { rebuildPackEmbeddings } from "@/lib/chunk-embedding-service";
import {
  DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
  DOCLING_RETRIEVAL_CHUNK_TYPE,
} from "@/lib/docling-knowledge/docling-knowledge-stages";
import { runDoclingRetrievalEvaluation } from "@/lib/docling-knowledge/docling-knowledge-eval";
import { activateDraftIndexGeneration } from "@/lib/docling-knowledge/docling-nd-knowledge-builder";
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
import { markServiceValidationsStaleForVersion } from "@/lib/distribution/mark-service-validations-stale";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { recordProviderAudit } from "@/lib/provider-audit";
import { prisma } from "@/lib/prisma";
import { completePipelineStep } from "@/lib/pipeline-service";
import { createSearchGenerationForPipeline } from "@/lib/search-generation/search-generation-pipeline-sync";
import {
  markSearchGenerationFailed,
  markSearchGenerationIndexing,
} from "@/lib/search-generation/search-generation-service";
import { resolveSearchGenerationEmbeddingDescriptor } from "@/lib/search-generation/search-generation-types";
import { mapSearchDataFailureCode } from "@/lib/search-data/search-data-error";
import {
  buildSearchDataStatusResponse,
  type SearchDataStatusResponse,
} from "@/lib/search-data/search-data-state";

const SEARCH_DATA_LOCK_KEY = (packId: string) => `search-data:${packId}`;

export type SearchDataGenerateAccepted = {
  accepted: true;
  state: "CREATING";
  searchIndexGenerationId: string;
  processedCount: number;
  chunkCount: number;
};

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

function failureResponse(code: string, overrideMessage?: string) {
  const guidance = mapSearchDataFailureCode(code);
  return {
    error: "INVALID" as const,
    message: overrideMessage ?? guidance.message,
    code,
  };
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

  // Include FAILED Local E5 generations so CREATE_FAILED survives refresh.
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
          attempt: isCurrentLocalE5.attempt,
          failureCode: isCurrentLocalE5.failureCode,
          failureMessage: isCurrentLocalE5.failureMessage,
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

/**
 * Enqueues Local E5 Draft SearchIndexGeneration as PENDING (HTTP 202).
 * Embedding runs in search-data-generation-worker.
 */
export async function startSearchDataGeneration(input: {
  userId: string;
  clientId: string;
  packId: string;
}): Promise<
  | { error: "NOT_FOUND" | "PROFILE_REQUIRED" | "INVALID"; message: string; code?: string }
  | SearchDataGenerateAccepted
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
    const descriptor = await resolveSearchGenerationEmbeddingDescriptor();

    const enqueueResult = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${SEARCH_DATA_LOCK_KEY(input.packId)}))`;

      const locked = await tx.searchIndexGeneration.findUnique({
        where: { id: indexGenerationId },
      });

      if (
        locked &&
        locked.embeddingProvider === LOCAL_E5_EMBEDDING_PROVIDER &&
        ["PENDING", "EMBEDDING"].includes(locked.status)
      ) {
        return {
          kind: "already_running" as const,
          generation: locked,
        };
      }

      if (
        locked &&
        locked.embeddingProvider === LOCAL_E5_EMBEDDING_PROVIDER &&
        locked.embeddingDimension === 384 &&
        (locked.status === "READY" || locked.status === "INDEXING")
      ) {
        const vectors = await tx.$queryRaw<Array<{ n: bigint }>>`
          SELECT COUNT(*)::bigint AS n
          FROM "SearchIndexVector"
          WHERE "searchIndexGenerationId" = ${indexGenerationId}
        `;
        const vectorCount = Number(vectors[0]?.n ?? 0);
        if (vectorCount === chunkCount && locked.embeddedCount >= chunkCount && locked.failedCount === 0) {
          return { kind: "already_complete" as const, generation: locked };
        }
      }

      const nextAttempt = (locked?.attempt ?? 0) + 1;

      if (locked) {
        await tx.$executeRaw`
          DELETE FROM "SearchIndexVector" WHERE "searchIndexGenerationId" = ${indexGenerationId}
        `;
        await tx.knowledgeChunkEmbedding.deleteMany({
          where: { searchIndexGenerationId: indexGenerationId },
        });
        await tx.searchIndexGeneration.delete({ where: { id: indexGenerationId } });
      }

      const created = await createSearchGenerationForPipeline({
        id: indexGenerationId,
        packId: input.packId,
        versionId: version.id,
        pipelineRunId: latest.id,
        normalizedDocumentId: binding.normalizedDocumentId,
        fingerprint: binding.fingerprint,
        chunkGenerationId: indexGenerationId,
        descriptor,
        attempt: nextAttempt,
        client: tx,
      });

      // Ensure chunkCount is visible to status polling before worker runs.
      await tx.searchIndexGeneration.update({
        where: { id: created.id },
        data: { chunkCount, embeddedCount: 0, failedCount: 0 },
      });

      await markServiceValidationsStaleForVersion(version.id, tx);

      return { kind: "enqueued" as const, generation: created };
    });

    if (enqueueResult.kind === "already_complete") {
      return getSearchDataStatus(input) as Promise<SearchDataStatusResponse>;
    }

    if (enqueueResult.kind === "already_running") {
      return {
        accepted: true,
        state: "CREATING",
        searchIndexGenerationId: enqueueResult.generation.id,
        processedCount: enqueueResult.generation.embeddedCount,
        chunkCount: enqueueResult.generation.chunkCount || chunkCount,
      };
    }

    await recordProviderAudit({
      action: AuditAction.PROVIDER_PACK_UPDATE,
      entityType: "KnowledgePack",
      entityId: input.packId,
      actorUserId: input.userId,
      metadata: {
        event: "SEARCH_DATA_GENERATION_ENQUEUED",
        packId: input.packId,
        versionId: version.id,
        normalizedDocumentId: binding.normalizedDocumentId,
        chunkGenerationId: indexGenerationId,
        searchIndexGenerationId: indexGenerationId,
        chunkCount,
        attempt: enqueueResult.generation.attempt,
      },
    });

    return {
      accepted: true,
      state: "CREATING",
      searchIndexGenerationId: enqueueResult.generation.id,
      processedCount: 0,
      chunkCount,
    };
  } catch (error) {
    const code = isEmbeddingProviderError(error)
      ? error.code
      : error instanceof PayloadServiceError
        ? error.code
        : "SEARCH_DATA_CLEANUP_FAILED";
    const mapped =
      code === "SEARCH_DATA_CLEANUP_FAILED" ||
      (error instanceof Error &&
        /delete|foreign key|constraint|deadlock|timeout/i.test(error.message))
        ? "SEARCH_DATA_CLEANUP_FAILED"
        : code;
    return failureResponse(mapped);
  }
}

export type ClaimedSearchDataGeneration = {
  id: string;
  packId: string;
  versionId: string;
  pipelineRunId: string;
  attempt: number;
  chunkGenerationId: string;
  normalizedDocumentId: string;
  fingerprint: string;
  chunkCount: number;
};

/**
 * Atomically claim one PENDING Local E5 DRAFT generation (PENDING → EMBEDDING).
 */
export async function claimNextSearchDataGeneration(): Promise<ClaimedSearchDataGeneration | null> {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      packId: string;
      versionId: string;
      pipelineRunId: string;
      attempt: number;
      chunkGenerationId: string;
      normalizedDocumentId: string;
      fingerprint: string;
      chunkCount: number;
    }>
  >`
    UPDATE "SearchIndexGeneration" AS g
    SET
      "status" = 'EMBEDDING'::"SearchIndexGenerationStatus",
      "startedAt" = COALESCE(g."startedAt", NOW()),
      "updatedAt" = NOW()
    WHERE g.id = (
      SELECT j.id
      FROM "SearchIndexGeneration" AS j
      WHERE j."status" = 'PENDING'::"SearchIndexGenerationStatus"
        AND j."scope" = 'DRAFT'::"SearchIndexGenerationScope"
        AND j."embeddingProvider" = ${LOCAL_E5_EMBEDDING_PROVIDER}
      ORDER BY j."createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING
      g.id,
      g."packId",
      g."versionId",
      g."pipelineRunId",
      g.attempt,
      g."chunkGenerationId",
      g."normalizedDocumentId",
      g.fingerprint,
      g."chunkCount"
  `;
  const row = rows[0];
  return row ?? null;
}

/**
 * Worker job: embed + write vectors for a claimed generation attempt.
 */
export async function processSearchDataGenerationJob(
  claimed: ClaimedSearchDataGeneration,
): Promise<void> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId: claimed.packId },
    select: { status: true },
  });
  if (!pack || pack.status !== PackStatus.DRAFT) {
    await markSearchGenerationFailed(claimed.id, {
      failureCode: "PACK_NOT_DRAFT",
      failureMessage: "pack is not DRAFT",
      expectedAttempt: claimed.attempt,
    }).catch(() => undefined);
    return;
  }

  const structureOk = await isDoclingStructurePassed(claimed.packId);
  if (!structureOk) {
    await markSearchGenerationFailed(claimed.id, {
      failureCode: "STRUCTURE_REQUIRED",
      failureMessage: "structure not passed",
      expectedAttempt: claimed.attempt,
    }).catch(() => undefined);
    return;
  }

  try {
    await assertPgvectorRuntimeReady();

    const descriptor = await resolveSearchGenerationEmbeddingDescriptor();
    if (descriptor.embeddingProvider !== LOCAL_E5_EMBEDDING_PROVIDER) {
      throw new EmbeddingProviderError(
        "EMBEDDING_CONFIG_INVALID",
        "Local E5 provider required",
      );
    }
    if (descriptor.embeddingDimension !== 384) {
      throw new EmbeddingProviderError(
        "EMBEDDING_CONFIG_INVALID",
        "dimension must be 384",
      );
    }

    const generation = await prisma.searchIndexGeneration.findUnique({
      where: { id: claimed.id },
    });
    if (!generation || generation.attempt !== claimed.attempt) {
      return;
    }
    if (generation.status !== "EMBEDDING") {
      return;
    }

    await completePipelineStep({
      runId: claimed.pipelineRunId,
      step: "INDEXING",
      status: "RUNNING",
      message: "검색데이터를 생성하는 중…",
      details: {
        draft: true,
        indexGenerationId: claimed.id,
        searchIndexGenerationId: claimed.id,
        attempt: claimed.attempt,
      },
    }).catch(() => undefined);

    const embeddings = await rebuildPackEmbeddings({
      packId: claimed.packId,
      versionId: claimed.versionId,
      force: true,
      chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
      indexGenerationId: claimed.chunkGenerationId,
      searchIndexGenerationId: claimed.id,
      pipelineRunId: claimed.pipelineRunId,
      fingerprint: claimed.fingerprint,
      normalizedDocumentId: claimed.normalizedDocumentId,
      chunkGenerationId: claimed.chunkGenerationId,
      includeInactiveForGeneration: true,
      requirePgvector: true,
      onChunkProcessed: async (processedCount) => {
        await prisma.searchIndexGeneration.updateMany({
          where: {
            id: claimed.id,
            attempt: claimed.attempt,
            status: "EMBEDDING",
          },
          data: { embeddedCount: processedCount },
        });
      },
    });

    if (!embeddings) {
      throw new Error("INDEX_BUILD_FAILED:embedding rebuild returned null");
    }

    const embedded =
      embeddings.createdCount + embeddings.updatedCount + embeddings.skippedCount;

    // Re-check attempt ownership before INDEXING transition.
    const stillOwned = await prisma.searchIndexGeneration.findFirst({
      where: { id: claimed.id, attempt: claimed.attempt, status: "EMBEDDING" },
    });
    if (!stillOwned) return;

    await markSearchGenerationIndexing(
      claimed.id,
      {
        embeddedCount: embedded,
        chunkCount: embeddings.processedCount,
        failedCount: 0,
        expectedAttempt: claimed.attempt,
      },
    );

    const vectorCount = await countVectorsForGeneration(claimed.id);
    const expectedChunks =
      claimed.chunkCount > 0 ? claimed.chunkCount : embeddings.processedCount;
    if (vectorCount !== expectedChunks || embedded < expectedChunks) {
      await markSearchGenerationFailed(claimed.id, {
        failureCode: "VECTOR_COUNT_MISMATCH",
        failureMessage: `vectors=${vectorCount} chunks=${expectedChunks} embedded=${embedded}`,
        expectedAttempt: claimed.attempt,
      });
      await completePipelineStep({
        runId: claimed.pipelineRunId,
        step: "INDEXING",
        status: "FAIL",
        message: "검색데이터 저장이 완료되지 않았습니다.",
        details: { failureCode: "VECTOR_COUNT_MISMATCH", vectorCount, expectedChunks },
      }).catch(() => undefined);
      return;
    }

    await completePipelineStep({
      runId: claimed.pipelineRunId,
      step: "INDEXING",
      status: "PASS",
      message: `검색데이터 ${vectorCount}건을 생성했습니다.`,
      details: {
        draft: true,
        indexGenerationId: claimed.id,
        searchIndexGenerationId: claimed.id,
        indexScope: "DRAFT",
        embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
        processedCount: embeddings.processedCount,
        vectorCount,
        attempt: claimed.attempt,
      },
    });

    await recordProviderAudit({
      action: AuditAction.PROVIDER_PACK_UPDATE,
      entityType: "KnowledgePack",
      entityId: claimed.packId,
      actorUserId: null,
      metadata: {
        event: "SEARCH_DATA_GENERATION_COMPLETED",
        packId: claimed.packId,
        versionId: claimed.versionId,
        searchIndexGenerationId: claimed.id,
        chunkCount: expectedChunks,
        vectorCount,
        attempt: claimed.attempt,
      },
    }).catch(() => undefined);
  } catch (error) {
    const code = isEmbeddingProviderError(error)
      ? error.code
      : error instanceof PayloadServiceError
        ? error.code
        : error instanceof Error && error.message.startsWith("INDEX_BUILD_FAILED")
          ? "INDEX_BUILD_FAILED"
          : "INDEX_BUILD_FAILED";

    await markSearchGenerationFailed(claimed.id, {
      failureCode: code,
      failureMessage: error instanceof Error ? error.message.slice(0, 300) : null,
      expectedAttempt: claimed.attempt,
    }).catch(() => undefined);

    await completePipelineStep({
      runId: claimed.pipelineRunId,
      step: "INDEXING",
      status: "FAIL",
      message: mapSearchDataFailureCode(code).message,
      details: { failureCode: code },
    }).catch(() => undefined);

    await recordProviderAudit({
      action: AuditAction.PROVIDER_PACK_UPDATE,
      entityType: "KnowledgePack",
      entityId: claimed.packId,
      actorUserId: null,
      metadata: {
        event: "SEARCH_DATA_GENERATION_FAILED",
        failureCode: code,
        searchIndexGenerationId: claimed.id,
        attempt: claimed.attempt,
      },
    }).catch(() => undefined);
  }
}

/**
 * Runs retrieval quality evaluation and activates Draft READY generation.
 * Eval FAIL/WARNING keeps Generation INDEXING (VALIDATION_FAILED UI).
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
      // Keep SearchIndexGeneration INDEXING — do not failDraftIndexGeneration.
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
    await completePipelineStep({
      runId: latest.id,
      step: "SEARCH_EVALUATING",
      status: "FAIL",
      message: "검색 품질 검증에 실패했습니다.",
      details: {
        failureCode: "RETRIEVAL_EVALUATION_FAILED",
        message: error instanceof Error ? error.message.slice(0, 300) : null,
      },
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

/** @internal test helper */
export function __testOnlyIsLocalE5Generation(g: SearchIndexGeneration | null): boolean {
  return Boolean(g && g.embeddingProvider === LOCAL_E5_EMBEDDING_PROVIDER);
}
