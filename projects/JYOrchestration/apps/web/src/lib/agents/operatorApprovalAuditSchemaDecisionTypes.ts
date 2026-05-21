/**
 * Read-only Operator approval/audit schema apply decision (no Prisma/DB/migration wire).
 */

export type OperatorApprovalAuditSchemaDecision = "ready_for_schema_proposal" | "defer" | "blocked";

export type OperatorApprovalAuditSchemaTarget =
  | "operator_approval"
  | "operator_override"
  | "audit_event"
  | "rollback_approval"
  | "unknown";

export interface OperatorApprovalAuditSchemaFieldProposal {
  readonly field: string;
  readonly type: string;
  readonly nullable: boolean;
  readonly indexed: boolean;
  readonly reason: string;
  readonly sensitivity: "safe" | "internal" | "sensitive" | "forbidden";
}

export interface OperatorApprovalAuditSchemaFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface OperatorApprovalAuditSchemaDecisionReport {
  readonly mode: "read_only_operator_approval_audit_schema_decision";
  readonly decision: OperatorApprovalAuditSchemaDecision;
  readonly target: OperatorApprovalAuditSchemaTarget;
  readonly proposedTableName: string;
  readonly requiresPrismaSchemaChange: boolean;
  readonly requiresMigration: boolean;
  readonly requiresRollbackPlan: boolean;
  readonly requiresBackfillPlan: boolean;
  readonly requiresRetentionPolicy: boolean;
  readonly requiresAccessControlReview: boolean;
  readonly requiresPermissionModel: boolean;
  readonly requiresAuditIntegrityPolicy: boolean;
  readonly fieldProposals: readonly OperatorApprovalAuditSchemaFieldProposal[];
  readonly excludedFields: readonly OperatorApprovalAuditSchemaFieldProposal[];
  readonly rolloutPlan: readonly string[];
  readonly rollbackPlan: readonly string[];
  readonly findings: readonly OperatorApprovalAuditSchemaFinding[];
}
