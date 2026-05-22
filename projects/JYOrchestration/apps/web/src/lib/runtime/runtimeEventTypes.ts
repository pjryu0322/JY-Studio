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
  "SECURITY_FAILED",
  "SCM_STARTED",
  "MERGE_COMPLETED",
  "MERGE_FAILED",
  "PIPELINE_STARTED",
  "PIPELINE_COMPLETED",
  "AUTO_HEALING_TRIGGERED",
  "RUNTIME_DEFERRED",
] as const;

export type RuntimeEventType = (typeof RUNTIME_EVENT_TYPES)[number];

export type RuntimeEventSeverity = "info" | "warning" | "error";
