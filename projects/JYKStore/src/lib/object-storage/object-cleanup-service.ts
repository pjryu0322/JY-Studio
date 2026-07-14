import { prisma } from "@/lib/prisma";
import type { PayloadStorageCompat } from "@/lib/object-storage/object-storage";
import { getConfiguredObjectStorage } from "@/lib/object-storage/object-storage-factory";
import { logSafeRouteError } from "@/lib/safe-logging";

function isObjectAlreadyMissing(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as {
    name?: string;
    Code?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const code = e.Code ?? e.code ?? e.name ?? "";
  if (
    code === "NoSuchKey" ||
    code === "NotFound" ||
    code === "NoSuchBucket" ||
    String(code).includes("NotFound")
  ) {
    return true;
  }
  if (e.$metadata?.httpStatusCode === 404) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /not\s*found|nosuchkey|404/i.test(message);
}

export async function enqueueObjectCleanupJob(input: {
  objectKey: string;
  artifactId?: string | null;
  /** @deprecated Use artifactId */
  payloadId?: string | null;
  doclingBundleId?: string | null;
  knowledgePackFileId?: string | null;
  reason: string;
  lastError?: string | null;
}) {
  return prisma.objectStorageCleanupJob.create({
    data: {
      objectKey: input.objectKey,
      artifactId: input.artifactId ?? input.payloadId ?? null,
      doclingBundleId: input.doclingBundleId ?? null,
      knowledgePackFileId: input.knowledgePackFileId ?? null,
      reason: input.reason.slice(0, 500),
      status: "PENDING",
      lastError: input.lastError?.slice(0, 1000) ?? null,
    },
  });
}

/** @deprecated Prefer enqueueObjectCleanupJob. */
export const enqueuePayloadCleanupJob = enqueueObjectCleanupJob;

async function maybeSyncDoclingBundle(doclingBundleId: string | null | undefined) {
  if (!doclingBundleId) return;
  const { syncDoclingBundleStorageAfterCleanup } = await import(
    "@/lib/docling-import/docling-import-lifecycle-service"
  );
  await syncDoclingBundleStorageAfterCleanup(doclingBundleId);
}

export async function processObjectCleanupJob(
  jobId: string,
  storage?: PayloadStorageCompat,
): Promise<{ ok: boolean; status: string }> {
  const job = await prisma.objectStorageCleanupJob.findUnique({ where: { id: jobId } });
  if (!job) {
    return { ok: false, status: "NOT_FOUND" };
  }
  if (job.status === "SUCCEEDED") {
    await maybeSyncDoclingBundle(job.doclingBundleId);
    return { ok: true, status: "SUCCEEDED" };
  }

  const store = storage ?? getConfiguredObjectStorage();
  try {
    await store.delete({ objectKey: job.objectKey });
    await prisma.objectStorageCleanupJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCEEDED",
        attemptCount: { increment: 1 },
        completedAt: new Date(),
        lastError: null,
      },
    });
    await maybeSyncDoclingBundle(job.doclingBundleId);
    return { ok: true, status: "SUCCEEDED" };
  } catch (error) {
    if (isObjectAlreadyMissing(error)) {
      await prisma.objectStorageCleanupJob.update({
        where: { id: job.id },
        data: {
          status: "SUCCEEDED",
          attemptCount: { increment: 1 },
          completedAt: new Date(),
          lastError: null,
        },
      });
      await maybeSyncDoclingBundle(job.doclingBundleId);
      return { ok: true, status: "SUCCEEDED" };
    }

    const message = error instanceof Error ? error.message : "cleanup failed";
    logSafeRouteError({
      scope: "payload-cleanup",
      method: "DELETE",
      path: "object-storage",
      error: { message: "Object cleanup failed", objectKeyPresent: true },
    });
    await prisma.objectStorageCleanupJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        attemptCount: { increment: 1 },
        lastError: message.slice(0, 1000),
      },
    });
    await maybeSyncDoclingBundle(job.doclingBundleId);
    return { ok: false, status: "FAILED" };
  }
}

/** @deprecated Prefer processObjectCleanupJob. */
export const processPayloadCleanupJob = processObjectCleanupJob;

export async function retryPendingObjectCleanupJobs(
  limit = 20,
  storage?: PayloadStorageCompat,
) {
  const jobs = await prisma.objectStorageCleanupJob.findMany({
    where: { status: { in: ["PENDING", "FAILED"] } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  const results = [];
  for (const job of jobs) {
    results.push(await processObjectCleanupJob(job.id, storage));
  }
  return results;
}

/** @deprecated Prefer retryPendingObjectCleanupJobs. */
export const retryPendingPayloadCleanupJobs = retryPendingObjectCleanupJobs;
