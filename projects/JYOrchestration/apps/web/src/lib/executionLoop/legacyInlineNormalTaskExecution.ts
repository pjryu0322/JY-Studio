/**
 * LEGACY_INLINE_NORMAL_TASK_ONLY
 *
 * Emergency fallback path when `EXECUTION_LOOP_FORCE_INLINE_CURSOR=1`.
 * The full inline cursor / review / SCM / merge implementation still lives in
 * `runExecutionLoop.ts` (marked with LEGACY_INLINE boundaries) until e2e validation
 * allows extraction or removal.
 *
 * ENV_TEST Stage1/Stage2 paths are NOT part of this module — they remain in the
 * sync ENV_TEST branches of `runExecutionLoop.ts`.
 */

export function isLegacyInlineNormalTaskPathActive(): boolean {
  return process.env.EXECUTION_LOOP_FORCE_INLINE_CURSOR === "1";
}

/**
 * TODO(phase5): move inline normal-task block from runExecutionLoop into
 * `runLegacyInlineNormalTaskExecution()` and delete duplicate SCM/review paths.
 */
export const LEGACY_INLINE_REMOVAL_TODOS = [
  "Extract inline cursor invoke block (non–ENV_TEST)",
  "Extract inline git reflection + compare block",
  "Extract inline review/security/scm/merge block",
  "Keep ENV_TEST Stage1/Stage2 blocks in runExecutionLoop only",
] as const;
