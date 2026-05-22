/**
 * Resume SCM/Merge via pipeline worker after team runtime approval.
 */

import { pipelineMessageForCode } from "@/lib/runtime/pipelineResultCodes";
import { runPipelineJobSynchronously } from "@/lib/runtime/pipelineExecutionJobSync";
import { appendRuntimeEvent } from "@/lib/runtime/runtimeEventService";
import { refreshWorkflowStates } from "@/lib/executionLoop/workflowState";

export type PipelineResumeAfterApprovalInput = {
  readonly projectId: string;
  readonly taskId: string;
  readonly execRunId: string;
  readonly actorUserId: string;
};

export type PipelineResumeAfterApprovalResult = {
  readonly ok: boolean;
  readonly message: string;
  readonly pipelineJobId?: string;
  readonly code?: string;
};

export async function resumePipelineAfterApprovalViaWorker(
  input: PipelineResumeAfterApprovalInput
): Promise<PipelineResumeAfterApprovalResult> {
  await appendRuntimeEvent({
    eventType: "PIPELINE_STARTED",
    projectId: input.projectId,
    taskId: input.taskId,
    execRunId: input.execRunId,
    actorUserId: input.actorUserId,
    workerName: "pipeline",
    detail: { resumeScmAfterApproval: true },
  });

  const pipelineRun = await runPipelineJobSynchronously({
    projectId: input.projectId,
    execRunId: input.execRunId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
    resumeScmAfterApproval: true,
  });

  await refreshWorkflowStates(input.projectId);

  const code = pipelineRun.code ?? pipelineRun.pipelineResult?.code;
  const message = pipelineMessageForCode(code, pipelineRun.message);

  return {
    ok: pipelineRun.ok,
    message,
    pipelineJobId: pipelineRun.jobId,
    code,
  };
}
