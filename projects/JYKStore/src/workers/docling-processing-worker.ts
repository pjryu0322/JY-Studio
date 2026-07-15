import {
  DoclingImportBundleStatus,
  DoclingProcessingJobStatus,
  type DoclingProcessingJob,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { preserveFailedStagingBundle } from "@/lib/docling-import/docling-import-lifecycle-service";
import {
  validateAndNormalizeBundle,
} from "@/lib/docling-import/docling-import-service";
import { isDoclingImportError } from "@/lib/docling-import/docling-import-errors";
import { cleanupExpiredDoclingUploadSessions } from "@/lib/docling-import/docling-upload-session-service";
import { getConfiguredObjectStorage } from "@/lib/object-storage/object-storage-factory";
import { prisma } from "@/lib/prisma";
import { logSafeRouteError } from "@/lib/safe-logging";
import {
  computeDoclingLockExpiresAt,
  computeDoclingRetryDelayMs,
  isDoclingTransientProcessingError,
} from "@/workers/docling-processing-job-claim";
import { runKnowledgePipelineWorkerOnce } from "@/workers/knowledge-pipeline-worker";

type ClaimedJobRow = {
  id: string;
  bundleId: string;
  packId: string;
  versionId: string;
  sessionId: string | null;
  status: DoclingProcessingJobStatus;
  attemptCount: number;
  maxAttempts: number;
};

const POLL_INTERVAL_MS = Number.parseInt(
  process.env.JYKSTORE_DOCLING_WORKER_POLL_MS ?? "2000",
  10,
);
const WORKER_ID = process.env.JYKSTORE_DOCLING_WORKER_ID?.trim() || `docling-worker-${randomUUID()}`;

/**
 * Claim one eligible job with FOR UPDATE SKIP LOCKED.
 * Eligible: PENDING | (RETRY_WAIT AND nextRunAt<=now) | (RUNNING AND lockExpiresAt < now)
 */
export async function claimNextDoclingProcessingJob(
  lockOwner: string = WORKER_ID,
): Promise<ClaimedJobRow | null> {
  const lockExpiresAt = computeDoclingLockExpiresAt();
  const rows = await prisma.$queryRaw<ClaimedJobRow[]>`
    UPDATE "DoclingProcessingJob" AS job
    SET
      "status" = 'RUNNING'::"DoclingProcessingJobStatus",
      "lockedAt" = NOW(),
      "lockExpiresAt" = ${lockExpiresAt},
      "lockOwner" = ${lockOwner},
      "attemptCount" = job."attemptCount" + 1,
      "nextRunAt" = NULL,
      "startedAt" = COALESCE(job."startedAt", NOW()),
      "updatedAt" = NOW()
    WHERE job.id = (
      SELECT j.id
      FROM "DoclingProcessingJob" AS j
      WHERE
        j."status" = 'PENDING'::"DoclingProcessingJobStatus"
        OR (
          j."status" = 'RETRY_WAIT'::"DoclingProcessingJobStatus"
          AND (j."nextRunAt" IS NULL OR j."nextRunAt" <= NOW())
        )
        OR (
          j."status" = 'RUNNING'::"DoclingProcessingJobStatus"
          AND j."lockExpiresAt" IS NOT NULL
          AND j."lockExpiresAt" < NOW()
        )
      ORDER BY j."createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING
      job.id,
      job."bundleId",
      job."packId",
      job."versionId",
      job."sessionId",
      job.status,
      job."attemptCount",
      job."maxAttempts"
  `;
  return rows[0] ?? null;
}

async function markJobRetryOrFailed(input: {
  jobId: string;
  bundleId: string;
  attemptCount: number;
  maxAttempts: number;
  errorCode: string;
  errorMessage: string;
}): Promise<"RETRY_WAIT" | "FAILED"> {
  const delayMs = isDoclingTransientProcessingError(input.errorCode)
    ? computeDoclingRetryDelayMs(input.attemptCount, input.maxAttempts)
    : null;

  if (delayMs == null) {
    await prisma.doclingProcessingJob.update({
      where: { id: input.jobId },
      data: {
        status: DoclingProcessingJobStatus.FAILED,
        lastErrorCode: input.errorCode,
        lastErrorMessage: input.errorMessage.slice(0, 1000),
        completedAt: new Date(),
        lockedAt: null,
        lockExpiresAt: null,
        lockOwner: null,
        nextRunAt: null,
      },
    });
    return "FAILED";
  }

  await prisma.doclingProcessingJob.update({
    where: { id: input.jobId },
    data: {
      status: DoclingProcessingJobStatus.RETRY_WAIT,
      nextRunAt: new Date(Date.now() + delayMs),
      lastErrorCode: input.errorCode,
      lastErrorMessage: input.errorMessage.slice(0, 1000),
      lockedAt: null,
      lockExpiresAt: null,
      lockOwner: null,
      completedAt: null,
    },
  });
  return "RETRY_WAIT";
}

export async function processDoclingProcessingJob(
  job: Pick<
    DoclingProcessingJob,
    "id" | "bundleId" | "packId" | "versionId" | "attemptCount" | "maxAttempts"
  >,
): Promise<{ ok: boolean; status: string }> {
  const storage = getConfiguredObjectStorage();
  const maxAttempts = job.maxAttempts > 0 ? job.maxAttempts : 3;

  try {
    const processed = await validateAndNormalizeBundle(job.bundleId, {
      storage,
      attempt: job.attemptCount > 0 ? job.attemptCount : 1,
    });

    if (processed.status !== DoclingImportBundleStatus.NORMALIZED) {
      await preserveFailedStagingBundle(
        job.bundleId,
        "validation_or_normalization_failed",
      );
      const status = await markJobRetryOrFailed({
        jobId: job.id,
        bundleId: job.bundleId,
        attemptCount: job.attemptCount,
        maxAttempts,
        errorCode: processed.lastErrorCode ?? "DOCLING_VALIDATION_FAILED",
        errorMessage:
          processed.lastErrorMessage?.slice(0, 1000) ??
          "Docling import validation/normalization failed",
      });
      return { ok: false, status };
    }

    // Provider confirm promotes to REVIEW_READY + Active — worker stops at NORMALIZED.
    await prisma.doclingProcessingJob.update({
      where: { id: job.id },
      data: {
        status: DoclingProcessingJobStatus.SUCCEEDED,
        completedAt: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
        lockedAt: null,
        lockExpiresAt: null,
        lockOwner: null,
        nextRunAt: null,
      },
    });
    return { ok: true, status: "SUCCEEDED" };
  } catch (error) {
    const code = isDoclingImportError(error) ? error.code : "DOCLING_PROCESSING_FAILED";
    const message = error instanceof Error ? error.message : "processing failed";
    logSafeRouteError({
      scope: "docling-processing-worker",
      method: "JOB",
      path: "DoclingProcessingJob",
      error: { message: code, jobIdPresent: true },
    });
    try {
      await preserveFailedStagingBundle(job.bundleId, "worker_processing_failed");
    } catch {
      // best-effort
    }
    const status = await markJobRetryOrFailed({
      jobId: job.id,
      bundleId: job.bundleId,
      attemptCount: job.attemptCount,
      maxAttempts,
      errorCode: code,
      errorMessage: message,
    });
    return { ok: false, status };
  }
}

export async function runDoclingProcessingWorkerLoop(options?: {
  once?: boolean;
  pollIntervalMs?: number;
  lockOwner?: string;
}): Promise<void> {
  const pollIntervalMs = options?.pollIntervalMs ?? POLL_INTERVAL_MS;
  const lockOwner = options?.lockOwner ?? WORKER_ID;
  let expireTick = 0;

  while (true) {
    // Lightweight: occasionally abort expired CREATED/UPLOADING multiparts.
    expireTick += 1;
    if (expireTick % 15 === 1) {
      try {
        await cleanupExpiredDoclingUploadSessions({
          storage: getConfiguredObjectStorage(),
          limit: 20,
        });
      } catch {
        // best-effort
      }
    }

    const job = await claimNextDoclingProcessingJob(lockOwner);
    if (job) {
      await processDoclingProcessingJob(job);
    } else {
      // When idle on Docling jobs, drain one knowledge-generation pipeline job.
      const knowledgeDidWork = await runKnowledgePipelineWorkerOnce(lockOwner).catch(
        () => false,
      );
      if (!knowledgeDidWork && options?.once) {
        return;
      }
      if (!knowledgeDidWork) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    }
    if (options?.once) return;
  }
}

async function main() {
  console.info(`[docling-worker] starting owner=${WORKER_ID}`);
  await runDoclingProcessingWorkerLoop();
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  (process.argv[1].includes("docling-processing-worker") ||
    process.env.JYKSTORE_RUN_DOCLING_WORKER === "1");

if (isDirectRun) {
  main().catch((error) => {
    console.error("[docling-worker] fatal", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
