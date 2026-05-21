/**
 * Read-only Agent execution record schema/migration PR final approval package (no schema/migration/DB wire).
 */

export type AgentExecutionRecordSchemaPrApprovalDecision =
  | "ready_for_explicit_schema_pr_approval"
  | "defer"
  | "blocked";

export interface AgentExecutionRecordSchemaPrApprovalChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface AgentExecutionRecordSchemaPrApprovalFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface AgentExecutionRecordSchemaPrApprovalPackageReport {
  readonly mode: "read_only_agent_execution_record_schema_pr_approval_package";
  readonly decision: AgentExecutionRecordSchemaPrApprovalDecision;
  readonly target: string;

  readonly sourceReadinessDecision: string;
  readonly sourceSchemaDecision: string;
  readonly sourceProposedTableName: string;
  readonly sourceRequiresPrismaSchemaChange: boolean;
  readonly sourceRequiresMigration: boolean;
  readonly sourceFieldProposalCount: number;
  readonly sourceExcludedFieldCount: number;
  readonly sourceForbiddenFieldNames: readonly string[];

  readonly modelDraft: string;
  readonly modelName: string;
  readonly approvalChecklist: readonly AgentExecutionRecordSchemaPrApprovalChecklistItem[];
  readonly migrationChecklist: readonly AgentExecutionRecordSchemaPrApprovalChecklistItem[];
  readonly rollbackChecklist: readonly AgentExecutionRecordSchemaPrApprovalChecklistItem[];
  readonly retentionAccessChecklist: readonly AgentExecutionRecordSchemaPrApprovalChecklistItem[];
  readonly forbiddenFieldChecklist: readonly AgentExecutionRecordSchemaPrApprovalChecklistItem[];

  readonly requiresExplicitUserApproval: boolean;
  readonly requiresSeparatePr: boolean;
  readonly modifiesSchemaInThisStep: false;
  readonly createsMigrationInThisStep: false;
  readonly writesDataInThisStep: false;

  readonly findings: readonly AgentExecutionRecordSchemaPrApprovalFinding[];
}
