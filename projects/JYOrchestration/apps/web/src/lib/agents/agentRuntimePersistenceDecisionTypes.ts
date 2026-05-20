/**
 * Read-only persistence apply decision report (no DB/Timeline/Replay wire).
 */

export type AgentRuntimePersistenceDecision = "ready_for_design" | "defer" | "blocked";

export type AgentRuntimePersistenceTarget =
  | "timeline_metadata"
  | "replay_snapshot"
  | "diagnostic_log";

export interface AgentRuntimePersistenceDecisionFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface AgentRuntimePersistenceDecisionReport {
  readonly mode: "read_only_decision";
  readonly decision: AgentRuntimePersistenceDecision;
  readonly recommendedTargets: readonly AgentRuntimePersistenceTarget[];
  readonly requiresSchemaChange: boolean;
  readonly requiresMigration: boolean;
  readonly findings: readonly AgentRuntimePersistenceDecisionFinding[];
  readonly candidateValid: boolean;
}
