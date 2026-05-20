/**
 * Read-only Timeline/Replay persist apply design report (no DB/Timeline wire).
 */

export type TimelineReplayPersistDesignDecision = "ready_for_schema_design" | "defer" | "blocked";

export type TimelineReplayPersistTarget = "timeline_metadata" | "replay_snapshot" | "diagnostic_log";

export type TimelineReplayPersistFieldSensitivity = "safe" | "internal" | "sensitive" | "forbidden";

export interface TimelineReplayPersistFieldDecision {
  readonly field: string;
  readonly persist: boolean;
  readonly reason: string;
  readonly sensitivity: TimelineReplayPersistFieldSensitivity;
}

export interface TimelineReplayPersistDesignFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface TimelineReplayPersistDesignReport {
  readonly mode: "read_only_persist_design";
  readonly decision: TimelineReplayPersistDesignDecision;
  readonly target: TimelineReplayPersistTarget;
  readonly requiresSchemaChange: boolean;
  readonly requiresMigration: boolean;
  readonly requiresRollbackPlan: boolean;
  readonly persistFields: readonly TimelineReplayPersistFieldDecision[];
  readonly excludedFields: readonly TimelineReplayPersistFieldDecision[];
  readonly findings: readonly TimelineReplayPersistDesignFinding[];
}
