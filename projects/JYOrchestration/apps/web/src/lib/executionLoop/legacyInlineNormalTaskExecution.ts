/**
 * LEGACY_INLINE_NORMAL_TASK_ONLY — emergency fallback (`EXECUTION_LOOP_FORCE_INLINE_CURSOR=1`).
 *
 * Normal tasks: `runLegacyInlineNormalTaskExecution()` (sync worker modules).
 * ENV_TEST Stage1/Stage2 remain in `runExecutionLoop.ts` sync path only.
 */

import { isEnvTestFamilyTaskKind } from "@/lib/execution/envTestTaskKind";
import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";
import type { LoopStepRecord, RunExecutionLoopResult } from "@/lib/executionLoop/runLoopTypes";
import { refreshWorkflowStates } from "@/lib/executionLoop/workflowState";
import {
  runNormalTaskViaRuntimeWorkers,
  type NormalTaskWorkerDispatchResult,
} from "@/lib/runtime/normalTaskWorkerDispatch";

export function isLegacyInlineNormalTaskPathActive(): boolean {
  return process.env.EXECUTION_LOOP_FORCE_INLINE_CURSOR === "1";
}

export type LegacyInlineNormalTaskExecutionContext = {
  readonly projectId: string;
  readonly taskId: string;
  readonly execRunId: string;
  readonly actorUserId: string;
  readonly singleTaskId?: string;
  readonly taskKind?: string | null;
};

export type LegacyInlineNormalTaskExecutionResult =
  | { readonly kind: "return"; readonly result: RunExecutionLoopResult }
  | { readonly kind: "continue_loop"; readonly worker: NormalTaskWorkerDispatchResult };

export function assertLegacyInlineAllowedForTaskKind(taskKind: string | null | undefined): {
  readonly allowed: boolean;
  readonly reason?: string;
} {
  if (isEnvTestFamilyTaskKind(taskKind)) {
    return {
      allowed: false,
      reason: "ENV_TEST must use sync path in runExecutionLoop, not legacy inline module",
    };
  }
  return { allowed: true };
}

/** Map worker dispatch steps into loop step records. */
function mapWorkerStepsToLoopSteps(
  taskId: string,
  worker: NormalTaskWorkerDispatchResult
): LoopStepRecord[] {
  return worker.steps.map((s) => ({
    phase: "worker_step",
    taskId,
    stepPhase: s.phase,
    ok: s.ok,
    code: s.code,
    summary: s.message,
    jobId: s.jobId,
  }));
}

/**
 * Emergency fallback for normal tasks when worker default path is disabled via FORCE_INLINE.
 * Uses the same sync cursor/reflection/pipeline modules as the runtime worker path.
 */
export async function runLegacyInlineNormalTaskExecution(
  ctx: LegacyInlineNormalTaskExecutionContext
): Promise<LegacyInlineNormalTaskExecutionResult> {
  const guard = assertLegacyInlineAllowedForTaskKind(ctx.taskKind);
  if (!guard.allowed) {
    return {
      kind: "return",
      result: {
        ok: false,
        steps: [],
        message: guard.reason ?? "legacy_inline_not_allowed",
      },
    };
  }

  appendTaskProgressLog({
    kind: "warning",
    phase: "legacy_inline_fallback",
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    userId: ctx.actorUserId,
    detail: {
      execRunId: ctx.execRunId,
      note: "EXECUTION_LOOP_FORCE_INLINE_CURSOR=1; using sync worker modules",
    },
  });

  const worker = await runNormalTaskViaRuntimeWorkers({
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    actorUserId: ctx.actorUserId,
    execRunId: ctx.execRunId,
    singleTaskId: ctx.singleTaskId,
  });

  const steps = mapWorkerStepsToLoopSteps(ctx.taskId, worker);
  await refreshWorkflowStates(ctx.projectId);

  if (ctx.singleTaskId) {
    return {
      kind: "return",
      result: { ok: worker.ok, steps, message: worker.message },
    };
  }

  return { kind: "continue_loop", worker };
}

/** Conditions before removing inline block from runExecutionLoop.ts */
export const LEGACY_INLINE_REMOVAL_CONDITIONS = [
  "runtimeWorkerE2E integration tests pass",
  "cursorToPipelineChain + runtimeSelfHealingBridge tests pass",
  "pipelineResumeAfterApproval tests pass",
  "Production e2e: 3+ successful normal-task worker runs without FORCE_INLINE",
] as const;

export const LEGACY_INLINE_REMOVAL_TODOS = [
  "Extract remaining monolithic SCM block from runExecutionLoop (ENV_TEST-only path)",
  "Remove duplicate inline cursor/review code once ENV_TEST paths are isolated",
] as const;
