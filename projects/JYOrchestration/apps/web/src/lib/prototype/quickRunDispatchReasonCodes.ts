export const QUICK_RUN_DISPATCH_REASON = {
  execution_record_missing: "execution_record_missing",
  execution_record_upsert_failed: "execution_record_upsert_failed",
  execution_record_lookup_failed: "execution_record_lookup_failed",
  queue_item_missing: "queue_item_missing",
  cursor_launch_failed: "cursor_launch_failed",
  dispatch_failed_retryable: "dispatch_failed_retryable",
  already_in_flight: "already_in_flight",
} as const;

export type QuickRunDispatchReasonCode =
  (typeof QUICK_RUN_DISPATCH_REASON)[keyof typeof QUICK_RUN_DISPATCH_REASON];
