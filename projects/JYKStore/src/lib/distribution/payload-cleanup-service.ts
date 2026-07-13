import { prisma } from "@/lib/prisma";
import type { PayloadStorage } from "@/lib/distribution/payload-storage";
import { getConfiguredPayloadStorage } from "@/lib/distribution/payload-storage-factory";
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

export async function enqueuePayloadCleanupJob(input: {
  objectKey: string;
  payloadId?: string | null;
  doclingBundleId?: string | null;
  knowledgePackFileId?: string | null;
  reason: string;
  lastError?: string | null;
}) {
  return prisma.payloadStorageCleanupJob.create({
    data: {
      objectKey: input.objectKey,
      payloadId: input.payloadId ?? null,
      doclingBundleId: input.doclingBundleId ?? null,
      knowledgePackFileId: input.knowledgePackFileId ?? null,
      reason: input.reason.slice(0, 500),
      status: "PENDING",
      lastError: input.lastError?.slice(0, 1000) ?? null,
    },
  });
}

async function maybeSyncDoclingBundle(doclingBundleId: string | null | undefined) {
  if (!doclingBundleId) return;
  const { syncDoclingBundleStorageAfterCleanup } = await import(
    "@/lib/docling-import/docling-import-lifecycle-service"
  );
  await syncDoclingBundleStorageAfterCleanup(doclingBundleId);
}

export async function processPayloadCleanupJob(
  jobId: string,
  storage?: PayloadStorage,
): Promise<{ ok: boolean; status: string }> {
  const job = await prisma.payloadStorageCleanupJob.findUnique({ where: { id: jobId } });
  if (!job) {
    return { ok: false, status: "NOT_FOUND" };
  }
  if (job.status === "SUCCEEDED") {
    await maybeSyncDoclingBundle(job.doclingBundleId);
    return { ok: true, status: "SUCCEEDED" };
  }

  const store = storage ?? getConfiguredPayloadStorage();
  try {
    await store.delete({ objectKey: job.objectKey });
    await prisma.payloadStorageCleanupJob.update({
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
      await prisma.payloadStorageCleanupJob.update({
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
    await prisma.payloadStorageCleanupJob.update({
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

export async function retryPendingPayloadCleanupJobs(limit = 20, storage?: PayloadStorage) {
  const jobs = await prisma.payloadStorageCleanupJob.findMany({
    where: { status: { in: ["PENDING", "FAILED"] } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  const results = [];
  for (const job of jobs) {
    results.push(await processPayloadCleanupJob(job.id, storage));
  }
  return results;
}
