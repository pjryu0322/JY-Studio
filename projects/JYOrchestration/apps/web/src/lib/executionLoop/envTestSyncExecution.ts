/**
 * ENV_TEST Stage1/Stage2 sync execution — boundary type for future extraction from runExecutionLoop.
 *
 * Implementation remains in `runExecutionLoop.ts` (`LEGACY_INLINE_NORMAL_TASK_ONLY_START` block).
 * Normal-task legacy fallback uses `legacyInlineNormalTaskExecution.ts` instead.
 */

export type EnvTestSyncExecutionContext = {
  readonly projectId: string;
  readonly projectName: string;
  readonly taskId: string;
  readonly actorUserId: string;
  readonly execRunId: string;
  readonly branchName: string;
  readonly taskKind: string;
  readonly singleTaskId?: string;
};

/** Marker comment target in runExecutionLoop for ENV_TEST-only sync path. */
export const ENV_TEST_SYNC_PATH_MARKER = "LEGACY_INLINE_NORMAL_TASK_ONLY_START — ENV_TEST sync path";
