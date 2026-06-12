/**
 * P3-M70 Phase 1 — legacy Quick Run runtime usage classification (no runtime behavior).
 * @see jyo_p3_m70_retire_legacy_quick_run_runtime_step_by_step.md
 */

export const LEGACY_RUNTIME_CLASS = {
  legacy_runtime_source_of_truth_candidate: "legacy_runtime_source_of_truth_candidate",
  legacy_runtime_projection_only: "legacy_runtime_projection_only",
  legacy_runtime_audit_only: "legacy_runtime_audit_only",
  legacy_runtime_deprecated: "legacy_runtime_deprecated",
} as const;

export type LegacyRuntimeClass = (typeof LEGACY_RUNTIME_CLASS)[keyof typeof LEGACY_RUNTIME_CLASS];

/** File/module → classification for retirement tracking */
export const LEGACY_QUICK_RUN_RUNTIME_USAGE_MAP: Readonly<
  Record<string, LegacyRuntimeClass>
> = {
  "serverQuickRunContinuationService.ts": LEGACY_RUNTIME_CLASS.legacy_runtime_deprecated,
  "implementationDbQueuedExecutionUnitDispatch.ts": LEGACY_RUNTIME_CLASS.legacy_runtime_projection_only,
  "implementationIntegrationLegacyPipelineAdapter.ts": LEGACY_RUNTIME_CLASS.legacy_runtime_deprecated,
  "dispatchQuickRunContinuationOnServer.ts": LEGACY_RUNTIME_CLASS.legacy_runtime_audit_only,
  "implementationQuickRunQueue.ts": LEGACY_RUNTIME_CLASS.legacy_runtime_projection_only,
  "quickRunContinuationAfterGithubVerify.ts": LEGACY_RUNTIME_CLASS.legacy_runtime_deprecated,
  "implementationExecutionSummary.ts": LEGACY_RUNTIME_CLASS.legacy_runtime_projection_only,
  "completedCodeTaskIntegrationSelector.ts": LEGACY_RUNTIME_CLASS.legacy_runtime_projection_only,
  "implementationPreviewReadiness.ts": LEGACY_RUNTIME_CLASS.legacy_runtime_projection_only,
  "implementationSelectedCodeTaskSequence.ts": LEGACY_RUNTIME_CLASS.legacy_runtime_deprecated,
  "implementationRuntimeQueueModel.ts": LEGACY_RUNTIME_CLASS.legacy_runtime_deprecated,
  "findNextRunnableCodeTaskIdInSelection": LEGACY_RUNTIME_CLASS.legacy_runtime_deprecated,
  "job.selectedCodeTaskIds": LEGACY_RUNTIME_CLASS.legacy_runtime_deprecated,
  "dbBundle.currentRun": LEGACY_RUNTIME_CLASS.legacy_runtime_audit_only,
  "workItemCount": LEGACY_RUNTIME_CLASS.legacy_runtime_audit_only,
  "toast/polling": LEGACY_RUNTIME_CLASS.legacy_runtime_audit_only,
  "quick_run_queued_fallback_dispatch_requested": LEGACY_RUNTIME_CLASS.legacy_runtime_deprecated,
};
