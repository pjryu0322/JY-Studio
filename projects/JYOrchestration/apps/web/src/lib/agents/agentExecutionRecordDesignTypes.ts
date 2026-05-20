/**
 * Read-only Agent execution record persist design (no DB/Timeline/Audit wire).
 */

export type AgentExecutionRecordDesignDecision = "ready_for_schema_design" | "defer" | "blocked";

export type AgentExecutionRecordTarget =
  | "execution_record"
  | "timeline_event_link"
  | "audit_trail_link";

export type AgentExecutionRecordFieldSensitivity = "safe" | "internal" | "sensitive" | "forbidden";

export interface AgentExecutionRecordFieldDecision {
  readonly field: string;
  readonly persist: boolean;
  readonly reason: string;
  readonly sensitivity: AgentExecutionRecordFieldSensitivity;
}

export interface AgentExecutionRecordDesignFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface AgentExecutionRecordDesignReport {
  readonly mode: "read_only_agent_execution_record_design";
  readonly decision: AgentExecutionRecordDesignDecision;
  readonly target: AgentExecutionRecordTarget;
  readonly requiresSchemaChange: boolean;
  readonly requiresMigration: boolean;
  readonly requiresRollbackPlan: boolean;
  readonly requiresAuditLink: boolean;
  readonly requiresTimelineLink: boolean;
  readonly persistFields: readonly AgentExecutionRecordFieldDecision[];
  readonly excludedFields: readonly AgentExecutionRecordFieldDecision[];
  readonly findings: readonly AgentExecutionRecordDesignFinding[];
}
