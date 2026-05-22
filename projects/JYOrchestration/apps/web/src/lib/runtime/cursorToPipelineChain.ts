/**
 * Cursor job completion → reflection → pipeline enqueue chain (background path).
 */

import type { Prisma } from "@prisma/client";
import type { ExecuteCursorRunOutcome } from "@/lib/execution/cursorExecutionAdapter";
import { isEnvTestFamilyTaskKind } from "@/lib/execution/envTestTaskKind";
import { confirmCursorGitReflection } from "@/lib/runtime/cursorExecutionReflection";
import { isCursorRunSuccessWithResult } from "@/lib/runtime/cursorExecutionJobPersist";
import type { CursorChainSource } from "@/lib/runtime/cursorExecutionJobTypes";
import { findExistingPipelineJobForExecRun } from "@/lib/runtime/pipelineChainIdempotency";
import { prisma } from "@/lib/prisma";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";
import { appendRuntimeEvent } from "@/lib/runtime/runtimeEventService";
import { refreshWorkflowStates } from "@/lib/executionLoop/workflowState";

export function isRuntimeCursorChainPipelineEnabled(): boolean {
  return process.env.RUNTIME_CURSOR_CHAIN_PIPELINE !== "0";
}

export function shouldProcessChainedPipelineImmediately(): boolean {
  return process.env.RUNTIME_PROCESS_CHAINED_PIPELINE_IMMEDIATELY !== "0";
}

export type CursorToPipelineChainInput = {
  readonly projectId: string;
  readonly taskId: string;
  readonly execRunId: string;
  readonly actorUserId: string;
  readonly cursorOutcome: ExecuteCursorRunOutcome;
  readonly cursorJobId?: string | null;
  readonly source?: CursorChainSource;
  readonly skipPipelineChain?: boolean;
  readonly selfHealingFromExecRunId?: string | null;
};

export type CursorToPipelineChainResult = {
  readonly chained: boolean;
  readonly reason?: string;
  readonly pipelineJobId?: string;
  readonly pipelineProcessed?: boolean;
};

function chainEventDetail(
  input: CursorToPipelineChainInput,
  extra: Record<string, unknown>
): Record<string, unknown> {
  return {
    source: input.source ?? "background",
    cursorJobId: input.cursorJobId ?? null,
    selfHealingFromExecRunId: input.selfHealingFromExecRunId ?? null,
    ...extra,
  };
}

export async function maybeChainCursorJobToPipeline(
  input: CursorToPipelineChainInput
): Promise<CursorToPipelineChainResult> {
  if (input.skipPipelineChain) {
    return { chained: false, reason: "sync_dispatch_skip" };
  }
  if (!isRuntimeCursorChainPipelineEnabled()) {
    return { chained: false, reason: "chain_disabled" };
  }

  if (!isCursorRunSuccessWithResult(input.cursorOutcome)) {
    return { chained: false, reason: "cursor_not_success" };
  }

  const taskRow = await prisma.task.findUnique({
    where: { id: input.taskId },
    select: { taskKind: true },
  });
  if (taskRow && isEnvTestFamilyTaskKind(taskRow.taskKind)) {
    return { chained: false, reason: "env_test_sync_only" };
  }

  const setup = await withExecutionSetupSchemaHealRetry(() =>
    prisma.executionSetup.findUnique({ where: { projectId: input.projectId } })
  );
  if (!setup?.gitRepoUrl?.trim()) {
    return { chained: false, reason: "setup_missing" };
  }

  const existing = await findExistingPipelineJobForExecRun({
    projectId: input.projectId,
    taskId: input.taskId,
    execRunId: input.execRunId,
  });
  if (existing.exists) {
    await appendRuntimeEvent({
      eventType: "CURSOR_PIPELINE_CHAIN_SKIPPED",
      severity: "info",
      projectId: input.projectId,
      taskId: input.taskId,
      execRunId: input.execRunId,
      actorUserId: input.actorUserId,
      workerName: "cursor",
      executionJobId: input.cursorJobId ?? null,
      detail: chainEventDetail(input, {
        reason: existing.reason ?? "pipeline_already_exists",
        existingPipelineJobId: existing.jobId,
        existingStatus: existing.status,
      }),
    });
    return {
      chained: false,
      reason: existing.reason ?? "pipeline_already_exists",
      pipelineJobId: existing.jobId,
    };
  }

  const cr = input.cursorOutcome.result;
  const reflection = await confirmCursorGitReflection({
    execRunId: input.execRunId,
    projectId: input.projectId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
    repoUrl: setup.gitRepoUrl.trim(),
    baseBranch: setup.baseBranch,
    headBranch: cr.branchName,
    cursorResult: cr,
    githubAccessToken: setup.githubAccessToken ?? null,
    executionJobId: input.cursorJobId ?? null,
  });

  if (!reflection.confirmed) {
    await appendRuntimeEvent({
      eventType: "CURSOR_PIPELINE_CHAIN_SKIPPED",
      severity: "warning",
      projectId: input.projectId,
      taskId: input.taskId,
      execRunId: input.execRunId,
      actorUserId: input.actorUserId,
      workerName: "cursor",
      executionJobId: input.cursorJobId ?? null,
      detail: chainEventDetail(input, { reason: reflection.reason }),
    });
    await refreshWorkflowStates(input.projectId);
    return { chained: false, reason: `reflection_not_confirmed:${reflection.reason}` };
  }

  const { enqueueExecution } = await import("@/lib/service/executionQueue");
  const enq = await enqueueExecution({
    projectId: input.projectId,
    type: "pipeline",
    payload: {
      execRunId: input.execRunId,
      taskId: input.taskId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      resumeScmAfterApproval: false,
      chainedFromCursorJobId: input.cursorJobId ?? null,
      chainSource: input.source ?? "background",
      selfHealingFromExecRunId: input.selfHealingFromExecRunId ?? null,
    } as Prisma.InputJsonValue,
  });

  if (!enq.queued) {
    await appendRuntimeEvent({
      eventType: "CURSOR_PIPELINE_CHAIN_SKIPPED",
      severity: "error",
      projectId: input.projectId,
      taskId: input.taskId,
      execRunId: input.execRunId,
      actorUserId: input.actorUserId,
      workerName: "cursor",
      detail: chainEventDetail(input, { reason: enq.reason }),
    });
    return { chained: false, reason: enq.reason };
  }

  let pipelineProcessed = false;
  if (shouldProcessChainedPipelineImmediately()) {
    try {
      const { processExecutionJobById } = await import("@/lib/service/executionWorker");
      await processExecutionJobById(enq.jobId);
      pipelineProcessed = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await appendRuntimeEvent({
        eventType: "CURSOR_PIPELINE_CHAIN_PROCESS_FAILED",
        severity: "error",
        projectId: input.projectId,
        taskId: input.taskId,
        execRunId: input.execRunId,
        actorUserId: input.actorUserId,
        workerName: "cursor",
        detail: chainEventDetail(input, { pipelineJobId: enq.jobId, error: msg }),
      });
      await refreshWorkflowStates(input.projectId);
      return {
        chained: false,
        reason: `pipeline_process_failed:${msg}`,
        pipelineJobId: enq.jobId,
        pipelineProcessed: false,
      };
    }
  }

  await appendRuntimeEvent({
    eventType: "CURSOR_PIPELINE_CHAINED",
    projectId: input.projectId,
    taskId: input.taskId,
    execRunId: input.execRunId,
    actorUserId: input.actorUserId,
    workerName: "cursor",
    executionJobId: input.cursorJobId ?? null,
    detail: chainEventDetail(input, {
      pipelineJobId: enq.jobId,
      pipelineProcessed,
      immediateProcess: shouldProcessChainedPipelineImmediately(),
    }),
  });

  await refreshWorkflowStates(input.projectId);

  return {
    chained: true,
    pipelineJobId: enq.jobId,
    pipelineProcessed,
  };
}
