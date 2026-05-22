/**
 * Pipeline job idempotency for cursor → pipeline chain (per execRunId).
 */

import { parsePipelineExecutionJobPayload } from "@/lib/runtime/pipelineExecutionJobTypes";
import { prisma } from "@/lib/prisma";

const ACTIVE_PIPELINE_STATUSES = ["PENDING", "RUNNING", "DONE"] as const;

export function isRuntimeAllowRechainAfterPipelineFailed(): boolean {
  return process.env.RUNTIME_ALLOW_RECHAIN_AFTER_PIPELINE_FAILED === "1";
}

export async function findExistingPipelineJobForExecRun(input: {
  readonly projectId: string;
  readonly taskId: string;
  readonly execRunId: string;
}): Promise<{
  readonly exists: boolean;
  readonly jobId?: string;
  readonly status?: string;
  readonly reason?: string;
}> {
  const rows = await prisma.executionJob.findMany({
    where: {
      projectId: input.projectId,
      type: "pipeline",
      status: { in: [...ACTIVE_PIPELINE_STATUSES, "FAILED"] },
    },
    orderBy: { createdAt: "desc" },
    take: 48,
    select: { id: true, status: true, payload: true, createdAt: true },
  });

  for (const row of rows) {
    const payload = parsePipelineExecutionJobPayload(row.payload);
    if (!payload) continue;
    if (payload.execRunId !== input.execRunId || payload.taskId !== input.taskId) continue;

    if (row.status === "FAILED") {
      if (isRuntimeAllowRechainAfterPipelineFailed()) {
        continue;
      }
      return {
        exists: true,
        jobId: row.id,
        status: row.status,
        reason: "pipeline_failed_blocks_rechain",
      };
    }

    if ((ACTIVE_PIPELINE_STATUSES as readonly string[]).includes(row.status)) {
      return {
        exists: true,
        jobId: row.id,
        status: row.status,
        reason: "pipeline_already_exists",
      };
    }
  }

  return { exists: false };
}
