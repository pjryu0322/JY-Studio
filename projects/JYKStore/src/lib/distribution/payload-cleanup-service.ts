import { prisma } from "@/lib/prisma";
import type { PayloadStorage } from "@/lib/distribution/payload-storage";
import { getConfiguredPayloadStorage } from "@/lib/distribution/payload-storage-factory";
import { logSafeRouteError } from "@/lib/safe-logging";

export async function enqueuePayloadCleanupJob(input: {
  objectKey: string;
  payloadId?: string | null;
  reason: string;
  lastError?: string | null;
}) {
  return prisma.payloadStorageCleanupJob.create({
    data: {
      objectKey: input.objectKey,
      payloadId: input.payloadId ?? null,
      reason: input.reason.slice(0, 500),
      status: "PENDING",
      lastError: input.lastError?.slice(0, 1000) ?? null,
    },
  });
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
    return { ok: true, status: "SUCCEEDED" };
  } catch (error) {
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
