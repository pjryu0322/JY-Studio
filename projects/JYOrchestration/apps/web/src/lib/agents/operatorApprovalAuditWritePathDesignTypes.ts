/**
 * Read-only Operator approval/audit write path design (no Prisma/DB/write wire).
 */

export type OperatorApprovalAuditWritePathDecision =
  | "ready_for_write_path_design"
  | "defer"
  | "blocked";

export type OperatorApprovalAuditWritePathTarget =
  | "operator_approval"
  | "operator_override"
  | "audit_event"
  | "rollback_approval"
  | "unknown";

export interface OperatorApprovalAuditWritePathChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface OperatorApprovalAuditWritePathFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface OperatorApprovalAuditWritePathDesignReport {
  readonly mode: "read_only_operator_approval_audit_write_path_design";
  readonly decision: OperatorApprovalAuditWritePathDecision;
  readonly target: OperatorApprovalAuditWritePathTarget;

  readonly featureFlagName: string;
  readonly featureFlagDefault: "off";
  readonly proposedWriteEntrypoints: readonly string[];
  readonly proposedPermissionGuards: readonly string[];
  readonly proposedAuditIntegrityGuards: readonly string[];
  readonly proposedSanitizers: readonly string[];
  readonly forbiddenFieldGuards: readonly string[];
  readonly validationChecklist: readonly OperatorApprovalAuditWritePathChecklistItem[];
  readonly rollbackPlan: readonly string[];

  readonly requiresSchemaApplied: boolean;
  readonly requiresMigrationApplied: boolean;
  readonly requiresFeatureFlag: boolean;
  readonly requiresPermissionGuard: boolean;
  readonly requiresAuditIntegrityGuard: boolean;
  readonly requiresForbiddenFieldGuard: boolean;
  readonly requiresWritePathRollback: boolean;
  readonly requiresOperatorApproval: boolean;

  readonly sourceSchemaDecision: string;
  readonly sourceSchemaTarget: string;
  readonly sourceProposedTableName: string;
  readonly sourceRequiresPrismaSchemaChange: boolean;
  readonly sourceRequiresMigration: boolean;

  readonly findings: readonly OperatorApprovalAuditWritePathFinding[];
}
