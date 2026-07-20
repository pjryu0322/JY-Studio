/**
 * Transaction body for startSearchDataGeneration enqueue (orchestration only).
 */
import type { KnowledgeRunBinding } from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import type { SearchGenerationEmbeddingDescriptor } from "@/lib/search-generation/search-generation-types";
import { SEARCH_DATA_LOCK_KEY } from "@/lib/search-data/search-data-generation-types";
import {
  assertDraftScopeForRegenerate,
  isActivelyRunningLockedGeneration,
  isAlreadyCompleteCandidate,
  isCompleteVectorMatch,
  isScaffoldReuseCandidate,
} from "@/lib/search-data/search-data-generation-enqueue-tx-policy";
import {
  countVectorsForGenerationTx,
  createEnqueuedGenerationTx,
  deleteDraftGenerationArtifactsTx,
  reuseScaffoldGenerationTx,
} from "@/lib/search-data/search-data-generation-enqueue-tx-writes";
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

  if (isActivelyRunningLockedGeneration(locked) && locked) {
    return { kind: "already_running", generation: locked };
  }

  if (isAlreadyCompleteCandidate(locked, forceRegenerate) && locked) {
    const vectorCount = await countVectorsForGenerationTx(tx, indexGenerationId);
    if (isCompleteVectorMatch({ locked, vectorCount, chunkCount })) {
      return { kind: "already_complete", generation: locked };
    }
  }

  assertDraftScopeForRegenerate(locked);

  if (isScaffoldReuseCandidate(locked, forceRegenerate) && locked) {
    const generation = await reuseScaffoldGenerationTx({
      tx,
      versionId,
      latestPipelineRunId,
      binding,
      indexGenerationId,
      chunkCount,
    });
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
    await deleteDraftGenerationArtifactsTx(tx, indexGenerationId);
  }

  const created = await createEnqueuedGenerationTx({
    tx,
    packId,
    versionId,
    latestPipelineRunId,
    binding,
    indexGenerationId,
    chunkCount,
    descriptor,
    attempt: nextAttempt,
  });

  return {
    kind: "enqueued",
    generation: created,
    forceRegenerate,
    scaffoldReused: false,
    previousAttempt,
  };
}
