import {
  DoclingImportBundleStatus,
  DoclingProcessingJobStatus,
  type DoclingProcessingJob,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  finalizePreviousBundleStorage,
  preserveFailedStagingBundle,
  promoteDoclingStagingBundle,
} from "@/lib/docling-import/docling-import-lifecycle-service";
import {
  validateAndNormalizeBundle,
} from "@/lib/docling-import/docling-import-service";
import { isDoclingImportError } from "@/lib/docling-import/docling-import-errors";
import { getConfiguredObjectStorage } from "@/lib/object-storage/object-storage-factory";
import { prisma } from "@/lib/prisma";
import { logSafeRouteError } from "@/lib/safe-logging";

type ClaimedJobRow = {
  id: string;
  bundleId: string;
  packId: string;
  versionId: string;
  sessionId: string | null;
  status: DoclingProcessingJobStatus;
  attemptCount: number;
};

const POLL_INTERVAL_MS = Number.parseInt(
  process.env.JYKSTORE_DOCLING_WORKER_POLL_MS ?? "2000",
  10,
);
const WORKER_ID = process.env.JYKSTORE_DOCLING_WORKER_ID?.trim() || `docling-worker-${randomUUID()}`;

/**
 * Claim one PENDING job with FOR UPDATE SKIP LOCKED.
 */
export async function claimNextDoclingProcessingJob(
  lockOwner: string = WORKER_ID,
): Promise<ClaimedJobRow | null> {
  const rows = await prisma.$queryRaw<ClaimedJobRow[]>`
    UPDATE "DoclingProcessingJob" AS job
    SET
      "status" = 'RUNNING'::"DoclingProcessingJobStatus",
      "lockedAt" = NOW(),
      "lockOwner" = ${lockOwner},
      "attemptCount" = job."attemptCount" + 1,
      "startedAt" = COALESCE(job."startedAt", NOW()),
      "updatedAt" = NOW()
    WHERE job.id = (
      SELECT j.id
      FROM "DoclingProcessingJob" AS j
      WHERE j."status" = 'PENDING'::"DoclingProcessingJobStatus"
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
      job."attemptCount"
  `;
  return rows[0] ?? null;
}

export async function processDoclingProcessingJob(
  job: Pick<DoclingProcessingJob, "id" | "bundleId" | "packId" | "versionId" | "attemptCount">,
): Promise<{ ok: boolean; status: string }> {
  const storage = getConfiguredObjectStorage();

  try {
    const processed = await validateAndNormalizeBundle(job.bundleId, {
      storage,
      attempt: job.attemptCount > 0 ? job.attemptCount : 1,
    });

    if (processed.status !== DoclingImportBundleStatus.REVIEW_READY) {
      await preserveFailedStagingBundle(
        job.bundleId,
        "validation_or_normalization_failed",
      );
      await prisma.doclingProcessingJob.update({
        where: { id: job.id },
        data: {
          status: DoclingProcessingJobStatus.FAILED,
          lastErrorCode: processed.lastErrorCode ?? "DOCLING_VALIDATION_FAILED",
          lastErrorMessage:
            processed.lastErrorMessage?.slice(0, 1000) ??
            "Docling import validation/normalization failed",
          completedAt: new Date(),
          lockedAt: null,
          lockOwner: null,
        },
      });
      return { ok: false, status: "FAILED" };
    }

    const { replacedBundleId } = await promoteDoclingStagingBundle({
      packId: job.packId,
      versionId: job.versionId,
      stagingBundleId: job.bundleId,
    });

    if (replacedBundleId) {
      const previous = await prisma.doclingImportBundle.findUnique({
        where: { id: replacedBundleId },
        include: {
          files: true,
          normalizedDocuments: true,
        },
      });
      if (previous) {
        await finalizePreviousBundleStorage(previous, storage);
      }
    }

    await prisma.doclingProcessingJob.update({
      where: { id: job.id },
      data: {
        status: DoclingProcessingJobStatus.SUCCEEDED,
        completedAt: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
        lockedAt: null,
        lockOwner: null,
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
    await prisma.doclingProcessingJob.update({
      where: { id: job.id },
      data: {
        status: DoclingProcessingJobStatus.FAILED,
        lastErrorCode: code,
        lastErrorMessage: message.slice(0, 1000),
        completedAt: new Date(),
        lockedAt: null,
        lockOwner: null,
      },
    });
    return { ok: false, status: "FAILED" };
  }
}

export async function runDoclingProcessingWorkerLoop(options?: {
  once?: boolean;
  pollIntervalMs?: number;
  lockOwner?: string;
}): Promise<void> {
  const pollIntervalMs = options?.pollIntervalMs ?? POLL_INTERVAL_MS;
  const lockOwner = options?.lockOwner ?? WORKER_ID;

  // Keep looping until process exit / once mode.
  while (true) {
    const job = await claimNextDoclingProcessingJob(lockOwner);
    if (job) {
      await processDoclingProcessingJob(job);
    } else if (options?.once) {
      return;
    } else {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
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
