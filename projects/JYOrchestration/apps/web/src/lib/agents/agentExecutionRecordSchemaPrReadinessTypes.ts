/**
 * Read-only Agent execution record schema/migration PR readiness (no schema.prisma/migration/DB wire).
 */

export type AgentExecutionRecordSchemaPrReadinessDecision =
  | "ready_for_schema_pr_plan"
  | "defer"
  | "blocked";

export interface AgentExecutionRecordSchemaPrChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface AgentExecutionRecordSchemaPrFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface AgentExecutionRecordSchemaPrModelCandidate {
  readonly modelName: string;
  readonly modelDraft: string;
  readonly caution: string;
}

export interface AgentExecutionRecordSchemaPrReadinessReport {
  readonly mode: "read_only_agent_execution_record_schema_pr_readiness";
  readonly decision: AgentExecutionRecordSchemaPrReadinessDecision;
  readonly target: string;

  readonly sourceSchemaDecision: string;
  readonly sourceProposedTableName: string;
  readonly sourceRequiresPrismaSchemaChange: boolean;
  readonly sourceRequiresMigration: boolean;
  readonly sourceFieldProposalCount: number;
  readonly sourceExcludedFieldCount: number;
  readonly sourceForbiddenFieldNames: readonly string[];

  readonly modelCandidates: readonly AgentExecutionRecordSchemaPrModelCandidate[];
  readonly migrationChecklist: readonly AgentExecutionRecordSchemaPrChecklistItem[];
  readonly rollbackChecklist: readonly AgentExecutionRecordSchemaPrChecklistItem[];
  readonly retentionAccessChecklist: readonly AgentExecutionRecordSchemaPrChecklistItem[];
  readonly forbiddenFieldChecklist: readonly AgentExecutionRecordSchemaPrChecklistItem[];

  readonly requiresSeparatePr: boolean;
  readonly modifiesSchemaInThisStep: false;
  readonly createsMigrationInThisStep: false;
  readonly writesDataInThisStep: false;

  readonly findings: readonly AgentExecutionRecordSchemaPrFinding[];
}
