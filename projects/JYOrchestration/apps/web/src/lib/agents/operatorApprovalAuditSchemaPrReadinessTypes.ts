/**
 * Read-only Operator approval/audit schema/migration PR readiness (no schema.prisma/migration/DB wire).
 */

export type OperatorApprovalAuditSchemaPrReadinessDecision =
  | "ready_for_schema_pr_plan"
  | "defer"
  | "blocked";

export interface OperatorApprovalAuditSchemaPrChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface OperatorApprovalAuditSchemaPrFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface OperatorApprovalAuditSchemaPrModelCandidate {
  readonly modelName: string;
  readonly modelDraft: string;
  readonly caution: string;
}

export interface OperatorApprovalAuditSchemaPrReadinessReport {
  readonly mode: "read_only_operator_approval_audit_schema_pr_readiness";
  readonly decision: OperatorApprovalAuditSchemaPrReadinessDecision;
  readonly target: string;

  readonly sourceSchemaDecision: string;
  readonly sourceProposedTableName: string;
  readonly sourceRequiresPrismaSchemaChange: boolean;
  readonly sourceRequiresMigration: boolean;
  readonly sourceFieldProposalCount: number;
  readonly sourceExcludedFieldCount: number;
  readonly sourceForbiddenFieldNames: readonly string[];

  readonly modelCandidates: readonly OperatorApprovalAuditSchemaPrModelCandidate[];
  readonly migrationChecklist: readonly OperatorApprovalAuditSchemaPrChecklistItem[];
  readonly rollbackChecklist: readonly OperatorApprovalAuditSchemaPrChecklistItem[];
  readonly permissionAccessChecklist: readonly OperatorApprovalAuditSchemaPrChecklistItem[];
  readonly auditIntegrityChecklist: readonly OperatorApprovalAuditSchemaPrChecklistItem[];
  readonly forbiddenFieldChecklist: readonly OperatorApprovalAuditSchemaPrChecklistItem[];

  readonly requiresSeparatePr: boolean;
  readonly modifiesSchemaInThisStep: false;
  readonly createsMigrationInThisStep: false;
  readonly writesDataInThisStep: false;

  readonly findings: readonly OperatorApprovalAuditSchemaPrFinding[];
}
