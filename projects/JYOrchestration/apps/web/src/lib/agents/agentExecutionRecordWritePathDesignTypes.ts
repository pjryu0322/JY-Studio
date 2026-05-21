/**
 * Read-only Agent execution record write path design (no Prisma/DB/write wire).
 */

export type AgentExecutionRecordWritePathDecision =
  | "ready_for_write_path_design"
  | "defer"
  | "blocked";

export type AgentExecutionRecordWritePathTarget =
  | "agent_execution_record"
  | "timeline_event_link"
  | "audit_trail_link"
  | "unknown";

export interface AgentExecutionRecordWritePathChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface AgentExecutionRecordWritePathFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface AgentExecutionRecordWritePathDesignReport {
  readonly mode: "read_only_agent_execution_record_write_path_design";
  readonly decision: AgentExecutionRecordWritePathDecision;
  readonly target: AgentExecutionRecordWritePathTarget;

  readonly featureFlagName: string;
  readonly featureFlagDefault: "off";
  readonly proposedWriteEntrypoints: readonly string[];
  readonly proposedSanitizers: readonly string[];
  readonly forbiddenFieldGuards: readonly string[];
  readonly validationChecklist: readonly AgentExecutionRecordWritePathChecklistItem[];
  readonly rollbackPlan: readonly string[];

  readonly requiresSchemaApplied: boolean;
  readonly requiresMigrationApplied: boolean;
  readonly requiresFeatureFlag: boolean;
  readonly requiresForbiddenFieldGuard: boolean;
  readonly requiresWritePathRollback: boolean;
  readonly requiresOperatorApproval: boolean;

  readonly findings: readonly AgentExecutionRecordWritePathFinding[];
}
