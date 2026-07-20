/**
 * Transaction body for startSearchDataGeneration enqueue.
 */
import { LOCAL_E5_EMBEDDING_PROVIDER } from "@/lib/embedding/e5-embedding-constants";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import { markServiceValidationsStaleForVersion } from "@/lib/distribution/mark-service-validations-stale";
import { createSearchGenerationForPipeline } from "@/lib/search-generation/search-generation-pipeline-sync";
import type { KnowledgeRunBinding } from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import type { SearchGenerationEmbeddingDescriptor } from "@/lib/search-generation/search-generation-types";
import { SEARCH_DATA_LOCK_KEY } from "@/lib/search-data/search-data-generation-types";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export type EnqueueTxResult =
  | {
      kind: "already_running";
      generation: {
        id: string;
        embeddedCount: number;
        chunkCount: number;
      };
    }
  | {
      kind: "already_complete";
      generation: { id: string };
    }
  | {
      kind: "enqueued";
      generation: { id: string; attempt: number };
      forceRegenerate: boolean;
      scaffoldReused: boolean;
      previousAttempt: number;
    };

export async function runSearchDataEnqueueTransaction(input: {
  tx: Tx;
  packId: string;
  versionId: string;
  latestPipelineRunId: string;
  binding: KnowledgeRunBinding;
  indexGenerationId: string;
  chunkCount: number;
  forceRegenerate: boolean;
  descriptor: SearchGenerationEmbeddingDescriptor;
}): Promise<EnqueueTxResult> {
  const {
    tx,
    packId,
    versionId,
    latestPipelineRunId,
    binding,
    indexGenerationId,
    chunkCount,
    forceRegenerate,
    descriptor,
  } = input;

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${SEARCH_DATA_LOCK_KEY(packId)}))`;

  const locked = await tx.searchIndexGeneration.findUnique({
    where: { id: indexGenerationId },
  });

  // Scaffold (PENDING/attempt=0) is NOT running — user must enqueue first.
  const isActivelyRunning =
    locked?.scope === "DRAFT" &&
    locked.embeddingProvider === LOCAL_E5_EMBEDDING_PROVIDER &&
    (locked.status === "EMBEDDING" ||
      (locked.status === "PENDING" && locked.attempt > 0));

  if (isActivelyRunning && locked) {
    return { kind: "already_running", generation: locked };
  }

  if (
    !forceRegenerate &&
    locked &&
    locked.scope === "DRAFT" &&
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
      return { kind: "already_complete", generation: locked };
    }
  }

  // forceRegenerate=true (or incomplete/FAILED): clean DRAFT only, never PRODUCTION.
  if (locked && locked.scope !== "DRAFT") {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_TRANSITION_CONFLICT",
      "PRODUCTION 검색 세대는 재생성할 수 없습니다.",
      409,
    );
  }

  // First enqueue: reuse structure scaffold row (PENDING / attempt=0 → attempt=1).
  if (
    locked &&
    locked.scope === "DRAFT" &&
    locked.status === "PENDING" &&
    locked.attempt === 0 &&
    !forceRegenerate
  ) {
    const updated = await tx.searchIndexGeneration.updateMany({
      where: {
        id: indexGenerationId,
        scope: "DRAFT",
        status: "PENDING",
        attempt: 0,
        chunkGenerationId: indexGenerationId,
        pipelineRunId: latestPipelineRunId,
        normalizedDocumentId: binding.normalizedDocumentId,
        fingerprint: binding.fingerprint,
      },
      data: {
        attempt: 1,
        chunkCount,
        embeddedCount: 0,
        failedCount: 0,
        failureCode: null,
        failureMessage: null,
        startedAt: null,
      },
    });
    if (updated.count !== 1) {
      throw new PayloadServiceError(
        "SEARCH_GENERATION_TRANSITION_CONFLICT",
        "검색데이터 생성 상태가 변경되었습니다. 화면을 새로고침해 주세요.",
        409,
      );
    }
    const generation = await tx.searchIndexGeneration.findUniqueOrThrow({
      where: { id: indexGenerationId },
    });
    await markServiceValidationsStaleForVersion(versionId, tx);
    return {
      kind: "enqueued",
      generation,
      forceRegenerate: false,
      scaffoldReused: true,
      previousAttempt: 0,
    };
  }

  const previousAttempt = locked?.attempt ?? 0;
  const nextAttempt = previousAttempt + 1;

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
    packId,
    versionId,
    pipelineRunId: latestPipelineRunId,
    normalizedDocumentId: binding.normalizedDocumentId,
    fingerprint: binding.fingerprint,
    chunkGenerationId: indexGenerationId,
    descriptor,
    attempt: nextAttempt,
    client: tx,
  });

  await tx.searchIndexGeneration.update({
    where: { id: created.id },
    data: {
      chunkCount,
      embeddedCount: 0,
      failedCount: 0,
      failureCode: null,
      failureMessage: null,
    },
  });

  await markServiceValidationsStaleForVersion(versionId, tx);

  return {
    kind: "enqueued",
    generation: created,
    forceRegenerate,
    scaffoldReused: false,
    previousAttempt,
  };
}
