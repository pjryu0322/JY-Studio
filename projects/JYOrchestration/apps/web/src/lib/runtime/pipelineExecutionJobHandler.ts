/**
 * Pipeline execution job worker handler (review → security → SCM → merge).
 */

import type { ExecutionJob } from "@prisma/client";
import { haltTaskForTeamRuntimeApproval } from "@/lib/ai-team-runtime/approvalHalt";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";
import { refreshWorkflowStates } from "@/lib/executionLoop/workflowState";
import { prisma } from "@/lib/prisma";
import type { ExecutionWorkerStructuredResult } from "@/lib/runtime/executionWorkerStructuredResult";
import {
  isPipelinePhaseContext,
  resolvePipelinePhaseContext,
} from "@/lib/runtime/pipelineExecutionJobContext";
import {
  parsePipelineExecutionJobPayload,
  type PipelineExecutionJobResult,
} from "@/lib/runtime/pipelineExecutionJobTypes";
import {
  runMergePhase,
  runReviewerPhase,
  runScmPhase,
  runSecurityPhase,
} from "@/lib/runtime/pipelineExecutionPhases";
import { appendRuntimeEvent } from "@/lib/runtime/runtimeEventService";
import { PIPELINE_RESULT_CODE } from "@/lib/runtime/pipelineResultCodes";
import { maybeEnqueueSelfHealingFromReviewFailure } from "@/lib/runtime/runtimeSelfHealingBridge";

export async function handlePipelineExecutionJob(job: ExecutionJob): Promise<ExecutionWorkerStructuredResult> {
  const payload = parsePipelineExecutionJobPayload(job.payload);
  if (!payload) {
    return {
      ok: false,
      code: PIPELINE_RESULT_CODE.INVALID_PIPELINE_PAYLOAD,
      message: "Pipeline job payload must include execRunId, taskId, projectId, actorUserId",
    };
  }

  if (payload.projectId !== job.projectId) {
    return {
      ok: false,
      code: PIPELINE_RESULT_CODE.PROJECT_MISMATCH,
      message: "Job projectId does not match payload",
    };
  }

  await appendRuntimeEvent({
    eventType: "PIPELINE_STARTED",
    projectId: payload.projectId,
    taskId: payload.taskId,
    execRunId: payload.execRunId,
    actorUserId: payload.actorUserId,
    workerName: "pipeline",
    executionJobId: job.id,
  });

  const resolved = await resolvePipelinePhaseContext(job, payload);
  if (!isPipelinePhaseContext(resolved)) {
    return resolved;
  }
  const phaseCtx = resolved;

  if (!payload.resumeScmAfterApproval) {
    const review = await runReviewerPhase(phaseCtx);
    if (!review.ok) {
      await maybeEnqueueSelfHealingFromReviewFailure({
        projectId: payload.projectId,
        taskId: payload.taskId,
        execRunId: payload.execRunId,
        actorUserId: payload.actorUserId,
        reviewReason: review.message,
      });
      await prisma.task.update({
        where: { id: payload.taskId },
        data: {
          executionWorkflowStatus: EXECUTION_WORKFLOW.REVIEW_REJECTED,
          lastEvalResult: "review_rejected",
          lastEvalSummary: review.message,
        },
      });
      await refreshWorkflowStates(payload.projectId);
      const reviewCode =
        review.code === PIPELINE_RESULT_CODE.REVIEW_REJECTED ||
        review.code === PIPELINE_RESULT_CODE.REVIEWER_NOT_CONFIGURED ||
        review.code === PIPELINE_RESULT_CODE.REVIEW_EXCEPTION
          ? review.code
          : PIPELINE_RESULT_CODE.REVIEW_REJECTED;
      const result: PipelineExecutionJobResult = {
        ok: false,
        code: reviewCode,
        message: review.message,
        reviewerVerdict: review.verdict,
      };
      return { ok: false, code: result.code, message: result.message, data: result };
    }

    const security = await runSecurityPhase(phaseCtx, review.evalPack.reviewerSteps);
    if (!security.ok) {
      await prisma.task.update({
        where: { id: payload.taskId },
        data: {
          executionWorkflowStatus:
            security.code === "SECURITY_FAILED"
              ? EXECUTION_WORKFLOW.SECURITY_FAILED
              : EXECUTION_WORKFLOW.REVIEW_REJECTED,
          lastEvalSummary: security.message,
        },
      });
      await refreshWorkflowStates(payload.projectId);
      return { ok: false, code: security.code, message: security.message };
    }

    if (phaseCtx.requireApprovalBeforeApply) {
      await haltTaskForTeamRuntimeApproval({ execRunId: payload.execRunId, taskId: payload.taskId });
      await refreshWorkflowStates(payload.projectId);
      const result: PipelineExecutionJobResult = {
        ok: true,
        code: "APPROVAL_WAITING",
        message: "사용자 승인 대기",
        reviewerVerdict: "done",
      };
      return { ok: true, code: result.code, message: result.message, data: result };
    }

    await prisma.task.update({
      where: { id: payload.taskId },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.REVIEW_APPROVED,
        lastEvalResult: "review_approved",
        lastEvalSummary: review.evalPack.result.reason,
      },
    });
  }

  const execRun = await prisma.taskExecutionRun.findUnique({
    where: { id: payload.execRunId },
    select: { evaluationReason: true },
  });
  const reviewerSummary = execRun?.evaluationReason ?? "approved";

  const scm = await runScmPhase(phaseCtx, {
    reviewerVerdict: "done",
    reviewerSummary,
  });
  if (!scm.ok) {
    await prisma.task.update({
      where: { id: payload.taskId },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.MERGE_PENDING,
        lastEvalSummary: scm.message,
      },
    });
    await refreshWorkflowStates(payload.projectId);
    const result: PipelineExecutionJobResult = {
      ok: false,
      code: scm.code,
      message: scm.message,
      reviewerVerdict: "done",
    };
    return {
      ok: scm.hold === true,
      code: scm.code,
      message: scm.message,
      data: result,
    };
  }

  await prisma.task.update({
    where: { id: payload.taskId },
    data: { executionWorkflowStatus: EXECUTION_WORKFLOW.MERGE_PENDING },
  });

  const merge = await runMergePhase(phaseCtx, { evalReason: scm.evalReason });
  await refreshWorkflowStates(payload.projectId);

  if (!merge.ok) {
    const result: PipelineExecutionJobResult = {
      ok: false,
      code: merge.code,
      message: merge.message,
      reviewerVerdict: "done",
    };
    return { ok: false, code: result.code, message: result.message, data: result };
  }

  await appendRuntimeEvent({
    eventType: "PIPELINE_COMPLETED",
    projectId: payload.projectId,
    taskId: payload.taskId,
    execRunId: payload.execRunId,
    actorUserId: payload.actorUserId,
    workerName: "pipeline",
    executionJobId: job.id,
    detail: { merged: merge.merged },
  });

  const result: PipelineExecutionJobResult = {
    ok: true,
    code: merge.merged ? PIPELINE_RESULT_CODE.MERGED : PIPELINE_RESULT_CODE.MERGE_PENDING,
    message: merge.merged ? "Merged to main" : merge.message,
    reviewerVerdict: "done",
    merged: merge.merged,
  };
  return { ok: true, code: result.code, message: result.message, data: result };
}
