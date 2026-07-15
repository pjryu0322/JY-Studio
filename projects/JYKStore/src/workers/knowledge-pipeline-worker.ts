import { randomUUID } from "node:crypto";
import { executeDoclingKnowledgePipeline } from "@/lib/docling-knowledge/docling-knowledge-pipeline-service";
import { logSafeRouteError } from "@/lib/safe-logging";
import {
  claimNextKnowledgePipelineRun,
  knowledgePipelineLockOwner,
  recoverStaleKnowledgePipelineRuns,
} from "@/workers/knowledge-pipeline-job-claim";

const POLL_INTERVAL_MS = Number.parseInt(
  process.env.JYKSTORE_KNOWLEDGE_WORKER_POLL_MS ?? "2000",
  10,
);

export async function processClaimedKnowledgePipelineRun(input: {
  runId: string;
  packId: string;
  binding: Parameters<typeof executeDoclingKnowledgePipeline>[0]["binding"];
  lockOwner: string;
}): Promise<void> {
  try {
    await executeDoclingKnowledgePipeline({
      runId: input.runId,
      packId: input.packId,
      binding: input.binding,
      lockOwner: input.lockOwner,
    });
  } catch (error) {
    logSafeRouteError({
      scope: "knowledge-pipeline-worker",
      method: "JOB",
      path: "PipelineRun",
      error: {
        message: error instanceof Error ? error.message.slice(0, 200) : "failed",
        runIdPresent: true,
      },
    });
    throw error;
  }
}

export async function runKnowledgePipelineWorkerOnce(
  lockOwner?: string,
): Promise<boolean> {
  const owner = lockOwner ?? knowledgePipelineLockOwner();
  await recoverStaleKnowledgePipelineRuns(5).catch(() => 0);
  const claimed = await claimNextKnowledgePipelineRun(owner);
  if (!claimed) return false;
  await processClaimedKnowledgePipelineRun({ ...claimed, lockOwner: owner });
  return true;
}

export async function runKnowledgePipelineWorkerLoop(options?: {
  once?: boolean;
  pollIntervalMs?: number;
  lockOwner?: string;
}): Promise<void> {
  const pollIntervalMs = options?.pollIntervalMs ?? POLL_INTERVAL_MS;
  const lockOwner =
    options?.lockOwner ??
    (process.env.JYKSTORE_KNOWLEDGE_WORKER_ID?.trim() ||
      `knowledge-worker-${randomUUID()}`);

  while (true) {
    const did = await runKnowledgePipelineWorkerOnce(lockOwner);
    if (options?.once) return;
    if (!did) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }
}
