/**
 * Read-only Operator approval/audit schema/migration PR final approval package (no schema/migration/DB wire).
 */

export type OperatorApprovalAuditSchemaPrApprovalDecision =
  | "ready_for_explicit_schema_pr_approval"
  | "defer"
  | "blocked";

export interface OperatorApprovalAuditSchemaPrApprovalChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface OperatorApprovalAuditSchemaPrApprovalFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface OperatorApprovalAuditSchemaPrApprovalPackageReport {
  readonly mode: "read_only_operator_approval_audit_schema_pr_approval_package";
  readonly decision: OperatorApprovalAuditSchemaPrApprovalDecision;
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

  readonly approvalChecklist: readonly OperatorApprovalAuditSchemaPrApprovalChecklistItem[];
  readonly migrationChecklist: readonly OperatorApprovalAuditSchemaPrApprovalChecklistItem[];
  readonly rollbackChecklist: readonly OperatorApprovalAuditSchemaPrApprovalChecklistItem[];
  readonly permissionAccessChecklist: readonly OperatorApprovalAuditSchemaPrApprovalChecklistItem[];
  readonly auditIntegrityChecklist: readonly OperatorApprovalAuditSchemaPrApprovalChecklistItem[];
  readonly forbiddenFieldChecklist: readonly OperatorApprovalAuditSchemaPrApprovalChecklistItem[];

  readonly requiresExplicitUserApproval: boolean;
  readonly explicitUserApprovalProvided: boolean;
  readonly requiresSeparatePr: boolean;
  readonly modifiesSchemaInThisStep: false;
  readonly createsMigrationInThisStep: false;
  readonly writesDataInThisStep: false;

  readonly findings: readonly OperatorApprovalAuditSchemaPrApprovalFinding[];
}
