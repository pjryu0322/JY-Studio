export type PreviewActionSourceV1 =
  | "integration_prepare_button"
  | "preview_button"
  | "diagnostic_preview";

export type CompletedCodeTaskPreviewNoticeActionSourceV1 =
  | "integration_prepare_button"
  | "preview_button"
  | "diagnostic";

const COMPLETED_CODETASK_PREVIEW_TIMELINE_ACTIONS = new Set([
  "completed_codetask_integration_started",
  "completed_codetask_preview_build_started",
  "completed_codetask_integration_completed",
  "completed_codetask_preview_ready",
  "completed_codetask_internal_preview_ready",
  "completed_codetask_external_preview_ready",
  "completed_codetask_preview_fallback",
]);

export function isCompletedCodeTaskPreviewTimelineAction(action: string): boolean {
  return COMPLETED_CODETASK_PREVIEW_TIMELINE_ACTIONS.has(String(action ?? "").trim());
}

export function shouldSuppressCompletedCodeTaskPreviewUserNotice(input: {
  readonly actionSource: CompletedCodeTaskPreviewNoticeActionSourceV1;
  readonly integratedReady: boolean;
  readonly action?: string | null;
}): boolean {
  if (input.actionSource === "integration_prepare_button") return true;
  if (input.integratedReady) return true;
  if (input.action && isCompletedCodeTaskPreviewTimelineAction(input.action)) {
    return input.actionSource === "integration_prepare_button";
  }
  return false;
}

/** @deprecated use shouldSuppressCompletedCodeTaskPreviewUserNotice */
export function shouldIgnoreCompletedCodeTaskPreviewNoticeForIntegrationAction(input: {
  readonly actionSource: PreviewActionSourceV1;
  readonly integratedReady: boolean;
  readonly action?: string | null;
}): boolean {
  const source: CompletedCodeTaskPreviewNoticeActionSourceV1 =
    input.actionSource === "diagnostic_preview" ? "diagnostic" : input.actionSource;
  return shouldSuppressCompletedCodeTaskPreviewUserNotice({
    actionSource: source,
    integratedReady: input.integratedReady,
    action: input.action,
  });
}

export const COMPLETED_CODETASK_PREVIEW_NOTICE_SUPPRESSED_LOG_ACTION =
  "completed_codetask_preview_notice_suppressed_for_integration_action";
