/**
 * Cursor execution job — synchronous enqueue + process helper.
 */

import type { Prisma } from "@prisma/client";
import type { ExecuteCursorRunOutcome } from "@/lib/execution/cursorExecutionAdapter";
import { prisma } from "@/lib/prisma";
import type { CursorExecutionJobPayload, CursorExecutionJobResult } from "@/lib/runtime/cursorExecutionJobTypes";

export async function runCursorJobSynchronously(
  input: CursorExecutionJobPayload & { projectId: string }
): Promise<{
  ok: boolean;
  cursorOutcome?: ExecuteCursorRunOutcome;
  message: string;
  jobId?: string;
}> {
  const { enqueueExecution } = await import("@/lib/service/executionQueue");
  const { processExecutionJobById } = await import("@/lib/service/executionWorker");

  const enq = await enqueueExecution({
    projectId: input.projectId,
    type: "cursor",
    payload: {
      ...input,
      syncDispatch: true,
      chainSource: "normal",
    } as unknown as Prisma.InputJsonValue,
  });
  if (!enq.queued) {
    return { ok: false, message: enq.reason };
  }

  await processExecutionJobById(enq.jobId);
  const job = await prisma.executionJob.findUnique({
    where: { id: enq.jobId },
    select: { status: true, result: true, error: true },
  });
  if (!job) {
    return { ok: false, message: "Cursor job row missing after process" };
  }
  if (job.status !== "DONE") {
    return { ok: false, message: job.error ?? "Cursor job failed", jobId: enq.jobId };
  }
  const data = job.result as { data?: CursorExecutionJobResult } | null;
  const cursorOutcome = data?.data?.cursorOutcome;
  return { ok: true, cursorOutcome, message: "ok", jobId: enq.jobId };
}
