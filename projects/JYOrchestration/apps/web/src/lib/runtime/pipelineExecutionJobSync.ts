/**
 * Pipeline execution job — synchronous enqueue + process helper.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PIPELINE_RESULT_CODE } from "@/lib/runtime/pipelineResultCodes";
import type {
  PipelineExecutionJobPayload,
  PipelineExecutionJobResult,
} from "@/lib/runtime/pipelineExecutionJobTypes";

export async function runPipelineJobSynchronously(
  input: PipelineExecutionJobPayload & { projectId: string }
): Promise<{
  ok: boolean;
  message: string;
  jobId?: string;
  pipelineResult?: PipelineExecutionJobResult;
  code?: string;
}> {
  const { enqueueExecution } = await import("@/lib/service/executionQueue");
  const { processExecutionJobById } = await import("@/lib/service/executionWorker");

  const enq = await enqueueExecution({
    projectId: input.projectId,
    type: "pipeline",
    payload: input as unknown as Prisma.InputJsonValue,
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
    return { ok: false, message: "Pipeline job row missing after process" };
  }

  const data = job.result as { data?: PipelineExecutionJobResult; ok?: boolean; code?: string; message?: string } | null;
  const pipelineResult = data?.data;
  const code =
    pipelineResult?.code ??
    data?.code ??
    (job.status !== "DONE" ? PIPELINE_RESULT_CODE.MERGE_FAILED : undefined);
  const message = pipelineResult?.message ?? data?.message ?? job.error ?? "pipeline finished";

  if (job.status !== "DONE") {
    return { ok: false, message, jobId: enq.jobId, pipelineResult, code };
  }

  const holdOk =
    code === PIPELINE_RESULT_CODE.SCM_HOLD || code === PIPELINE_RESULT_CODE.APPROVAL_WAITING;
  const successCodes = new Set<string>([
    PIPELINE_RESULT_CODE.MERGED,
    PIPELINE_RESULT_CODE.MERGE_PENDING,
    PIPELINE_RESULT_CODE.APPROVAL_WAITING,
  ]);
  const ok = Boolean(
    data?.ok ?? pipelineResult?.ok ?? (successCodes.has(code ?? "") || holdOk)
  );

  return { ok, message, jobId: enq.jobId, pipelineResult, code };
}
