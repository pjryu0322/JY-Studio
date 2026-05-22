/**
 * LEGACY_INLINE_NORMAL_TASK_ONLY
 *
 * Emergency fallback when `EXECUTION_LOOP_FORCE_INLINE_CURSOR=1`.
 * Inline cursor / review / SCM / merge still lives in `runExecutionLoop.ts` between
 * `LEGACY_INLINE_NORMAL_TASK_ONLY_START` and `LEGACY_INLINE_NORMAL_TASK_ONLY_END`.
 *
 * ENV_TEST Stage1/Stage2 are NOT in this module.
 */

export function isLegacyInlineNormalTaskPathActive(): boolean {
  return process.env.EXECUTION_LOOP_FORCE_INLINE_CURSOR === "1";
}

/** Context for the inline block in `runExecutionLoop.ts` (extract target). */
export type LegacyInlineNormalTaskExecutionContext = {
  readonly projectId: string;
  readonly taskId: string;
  readonly execRunId: string;
  readonly actorUserId: string;
};

/** Conditions before removing inline block from runExecutionLoop.ts */
export const LEGACY_INLINE_REMOVAL_CONDITIONS = [
  "normalTaskRuntimeWorkerFlow integration tests pass",
  "cursorToPipelineChain + runtimeSelfHealingBridge tests pass",
  "pipelineResumeAfterApproval tests pass",
  "Production e2e: 3+ successful normal-task worker runs without FORCE_INLINE",
] as const;

export const LEGACY_INLINE_REMOVAL_TODOS = [
  "Extract inline cursor invoke block (non–ENV_TEST)",
  "Extract inline git reflection + compare block",
  "Extract inline review/security/scm/merge block",
  "Keep ENV_TEST Stage1/Stage2 blocks in runExecutionLoop only",
] as const;
