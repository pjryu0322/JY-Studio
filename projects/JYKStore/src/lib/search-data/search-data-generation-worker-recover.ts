/**
 * Stale EMBEDDING → PENDING recovery transaction helpers.
 */
import { LOCAL_E5_EMBEDDING_PROVIDER } from "@/lib/embedding/e5-embedding-constants";
import { deleteSearchDataGenerationArtifactsTx } from "@/lib/search-data/search-data-generation-artifacts";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export type StaleRecoveryCandidate = {
  id: string;
  packId: string;
  attempt: number;
};

export async function selectOneStaleEmbeddingGenerationTx(
  tx: Tx,
  threshold: Date,
): Promise<StaleRecoveryCandidate | null> {
  const staleRows = await tx.$queryRaw<StaleRecoveryCandidate[]>`
    SELECT
      g.id,
      g."packId",
      g.attempt
    FROM "SearchIndexGeneration" AS g
    WHERE g."status" = 'EMBEDDING'::"SearchIndexGenerationStatus"
      AND g."scope" = 'DRAFT'::"SearchIndexGenerationScope"
      AND g."embeddingProvider" = ${LOCAL_E5_EMBEDDING_PROVIDER}
      AND g."updatedAt" < ${threshold}
    ORDER BY g."updatedAt" ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  `;
  return staleRows[0] ?? null;
}

export async function recoverStaleGenerationToPendingTx(
  tx: Tx,
  stale: StaleRecoveryCandidate,
): Promise<{
  id: string;
  packId: string;
  previousAttempt: number;
  attempt: number;
}> {
  await deleteSearchDataGenerationArtifactsTx(tx, stale.id);

  const updated = await tx.searchIndexGeneration.updateMany({
    where: {
      id: stale.id,
      status: "EMBEDDING",
      scope: "DRAFT",
      attempt: stale.attempt,
    },
    data: {
      status: "PENDING",
      attempt: { increment: 1 },
      embeddedCount: 0,
      failedCount: 0,
      failureCode: null,
      failureMessage: null,
      startedAt: null,
    },
  });
  if (updated.count !== 1) {
    throw new Error("SEARCH_DATA_RECOVERY_CONFLICT");
  }

  return {
    id: stale.id,
    packId: stale.packId,
    previousAttempt: stale.attempt,
    attempt: stale.attempt + 1,
  };
}

export function isRecoveryConflictError(error: unknown): boolean {
  return error instanceof Error && error.message === "SEARCH_DATA_RECOVERY_CONFLICT";
}
