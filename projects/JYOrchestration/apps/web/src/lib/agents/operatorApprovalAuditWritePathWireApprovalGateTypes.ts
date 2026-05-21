/**
 * Read-only Operator approval/audit write path wire approval gate (no Prisma/DB/write wire).
 */

export type OperatorApprovalAuditWritePathWireApprovalDecision =
  | "ready_for_write_path_wire_approval"
  | "defer"
  | "blocked";

export interface OperatorApprovalAuditWritePathWireApprovalChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface OperatorApprovalAuditWritePathWireApprovalFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface OperatorApprovalAuditWritePathWireApprovalGateReport {
  readonly mode: "read_only_operator_approval_audit_write_path_wire_approval_gate";
  readonly decision: OperatorApprovalAuditWritePathWireApprovalDecision;

  readonly sourceWritePathDecision: string;
  readonly sourceSchemaApprovalDecision: string;
  readonly sourceSchemaApprovalTarget: string;
  readonly schemaApprovalReferenceOnly: boolean;
  readonly sourceWritePathTarget: string;
  readonly sourceSchemaApprovalMode: string;
  readonly sourcePermissionChecklistItemCount: number;
  readonly sourceAuditChecklistItemCount: number;
  readonly target: string;

  readonly explicitUserApprovalProvided: boolean;
  readonly schemaAppliedConfirmed: boolean;
  readonly migrationAppliedConfirmed: boolean;
  readonly featureFlagWireApproved: boolean;
  readonly writeAdapterImplementedConfirmed: boolean;
  readonly permissionModelConfirmed: boolean;
  readonly auditTrailConfirmed: boolean;

  readonly sourceWritePathFeatureFlagName: string;
  readonly sourceWritePathRollbackPlan: readonly string[];
  readonly sourceSchemaApprovalRollbackItemCount: number;
  readonly sourceSchemaApprovalMigrationItemCount: number;
  readonly sourceBlockingFindingCodes: readonly string[];

  readonly approvalChecklist: readonly OperatorApprovalAuditWritePathWireApprovalChecklistItem[];
  readonly runtimeChecklist: readonly OperatorApprovalAuditWritePathWireApprovalChecklistItem[];
  readonly rollbackChecklist: readonly OperatorApprovalAuditWritePathWireApprovalChecklistItem[];
  readonly permissionChecklist: readonly OperatorApprovalAuditWritePathWireApprovalChecklistItem[];
  readonly auditChecklist: readonly OperatorApprovalAuditWritePathWireApprovalChecklistItem[];

  readonly requiresExplicitUserApproval: true;
  readonly requiresSchemaApplied: true;
  readonly requiresMigrationApplied: true;
  readonly requiresFeatureFlagWireApproval: true;
  readonly requiresWriteAdapterImplemented: true;
  readonly requiresPermissionModelConfirmed: true;
  readonly requiresAuditTrailConfirmed: true;

  readonly wiresWritePathInThisStep: false;
  readonly writesDataInThisStep: false;
  readonly callsPrismaInThisStep: false;
  readonly modifiesSchemaInThisStep: false;
  readonly createsMigrationInThisStep: false;

  readonly findings: readonly OperatorApprovalAuditWritePathWireApprovalFinding[];
}
