/**
 * Read-only Agent execution record schema apply decision (no Prisma/DB/migration wire).
 */

export type AgentExecutionRecordSchemaDecision = "ready_for_schema_proposal" | "defer" | "blocked";

export type AgentExecutionRecordSchemaTarget =
  | "agent_execution_record"
  | "timeline_event_link"
  | "audit_trail_link"
  | "unknown";

export interface AgentExecutionRecordSchemaFieldProposal {
  readonly field: string;
  readonly type: string;
  readonly nullable: boolean;
  readonly indexed: boolean;
  readonly reason: string;
  readonly sensitivity: "safe" | "internal" | "sensitive" | "forbidden";
}

export interface AgentExecutionRecordSchemaFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface AgentExecutionRecordSchemaDecisionReport {
  readonly mode: "read_only_agent_execution_record_schema_decision";
  readonly decision: AgentExecutionRecordSchemaDecision;
  readonly target: AgentExecutionRecordSchemaTarget;
  readonly proposedTableName: string;
  readonly requiresPrismaSchemaChange: boolean;
  readonly requiresMigration: boolean;
  readonly requiresRollbackPlan: boolean;
  readonly requiresBackfillPlan: boolean;
  readonly requiresRetentionPolicy: boolean;
  readonly requiresAccessControlReview: boolean;
  readonly fieldProposals: readonly AgentExecutionRecordSchemaFieldProposal[];
  readonly excludedFields: readonly AgentExecutionRecordSchemaFieldProposal[];
  readonly rolloutPlan: readonly string[];
  readonly rollbackPlan: readonly string[];
  readonly findings: readonly AgentExecutionRecordSchemaFinding[];
}
