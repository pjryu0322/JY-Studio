import { AuditAction } from "@prisma/client";
import { LOCAL_E5_EMBEDDING_PROVIDER } from "@/lib/embedding/e5-embedding-constants";
import { recordProviderAudit } from "@/lib/provider-audit";
import { prisma } from "@/lib/prisma";
import { markSearchGenerationFailed } from "@/lib/search-generation/search-generation-service";
import { searchDataStaleSeconds } from "@/lib/search-data/search-data-generation-policy";
import type { ClaimedSearchDataGeneration } from "@/lib/search-data/search-data-generation-types";
import {
  assertProcessJobPreconditions,
  failSearchDataProcessJob,
  runSearchDataEmbeddingAndIndex,
} from "@/lib/search-data/search-data-generation-process";
import {
  isRecoveryConflictError,
  recoverStaleGenerationToPendingTx,
  selectOneStaleEmbeddingGenerationTx,
} from "@/lib/search-data/search-data-generation-worker-recover";

/**
 * Recover one stale EMBEDDING DRAFT generation → PENDING (attempt++).
 * Vector/Embedding cleanup and PENDING publish are one PostgreSQL transaction.
 */
export async function recoverOneStaleSearchDataGeneration(
  staleSeconds: number = searchDataStaleSeconds(),
): Promise<{
  id: string;
  packId: string;
  previousAttempt: number;
  attempt: number;
} | null> {
  const threshold = new Date(Date.now() - staleSeconds * 1000);
  let lockedId: string | null = null;
  let lockedAttempt: number | null = null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const stale = await selectOneStaleEmbeddingGenerationTx(tx, threshold);
      if (!stale) return null;
      lockedId = stale.id;
      lockedAttempt = stale.attempt;
      return recoverStaleGenerationToPendingTx(tx, stale);
    });

    if (!result) return null;

    await recordProviderAudit({
      action: AuditAction.PROVIDER_PACK_UPDATE,
      entityType: "KnowledgePack",
      entityId: result.packId,
      actorUserId: null,
      metadata: {
        event: "SEARCH_DATA_GENERATION_RECOVERED",
        packId: result.packId,
        searchIndexGenerationId: result.id,
        previousAttempt: result.previousAttempt,
        attempt: result.attempt,
        staleSeconds,
      },
    }).catch(() => undefined);

    return result;
  } catch (error) {
    // Competing recover/claim is not a generation failure — do not mark FAILED.
    if (isRecoveryConflictError(error)) {
      return null;
    }
    if (lockedId != null && lockedAttempt != null) {
      await markSearchGenerationFailed(lockedId, {
        failureCode: "SEARCH_DATA_RECOVERY_FAILED",
        failureMessage: "stale recovery transaction failed",
        expectedAttempt: lockedAttempt,
      }).catch(() => undefined);
    }
    return null;
  }
}

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
        AND j."chunkCount" > 0
        AND j.attempt > 0
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
  const ready = await assertProcessJobPreconditions(claimed);
  if (!ready) return;

  try {
    await runSearchDataEmbeddingAndIndex(claimed);
  } catch (error) {
    await failSearchDataProcessJob(claimed, error);
  }
}
