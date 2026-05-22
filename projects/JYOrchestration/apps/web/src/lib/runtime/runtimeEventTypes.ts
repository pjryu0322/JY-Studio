/**
 * Standardized AI Team Runtime event types (read-only taxonomy).
 */

export const RUNTIME_EVENT_TYPES = [
  "RUNTIME_STARTED",
  "CURSOR_STARTED",
  "CURSOR_COMPLETED",
  "CURSOR_FAILED",
  "REVIEW_STARTED",
  "REVIEW_FAILED",
  "REVIEW_APPROVED",
  "SECURITY_STARTED",
  "SECURITY_COMPLETED",
  "SECURITY_APPROVED",
  "SECURITY_FAILED",
  "SCM_STARTED",
  "SCM_APPROVED",
  "SCM_HOLD",
  "SCM_FAILED",
  "MERGE_COMPLETED",
  "MERGE_FAILED",
  "SELF_HEALING_SKIPPED",
  "PIPELINE_STARTED",
  "PIPELINE_COMPLETED",
  "AUTO_HEALING_TRIGGERED",
  "RUNTIME_DEFERRED",
] as const;

export type RuntimeEventType = (typeof RUNTIME_EVENT_TYPES)[number];

export type RuntimeEventSeverity = "info" | "warning" | "error";
