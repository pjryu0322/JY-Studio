/**
 * Read-only Operator approval / override / audit design (no approval engine or DB wire).
 */

export type OperatorApprovalAuditDesignDecision = "ready_for_schema_design" | "defer" | "blocked";

export type OperatorApprovalAuditTarget =
  | "operator_approval"
  | "operator_override"
  | "audit_event"
  | "rollback_approval"
  | "unknown";

export type OperatorApprovalAuditFieldSensitivity = "safe" | "internal" | "sensitive" | "forbidden";

export interface OperatorApprovalAuditFieldDecision {
  readonly field: string;
  readonly persist: boolean;
  readonly reason: string;
  readonly sensitivity: OperatorApprovalAuditFieldSensitivity;
}

export interface OperatorApprovalAuditDesignFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface OperatorApprovalAuditDesignReport {
  readonly mode: "read_only_operator_approval_audit_design";
  readonly decision: OperatorApprovalAuditDesignDecision;
  readonly target: OperatorApprovalAuditTarget;
  readonly requiresSchemaChange: boolean;
  readonly requiresMigration: boolean;
  readonly requiresRollbackPlan: boolean;
  readonly requiresActorIdentity: boolean;
  readonly requiresReason: boolean;
  readonly requiresAuditTrail: boolean;
  readonly persistFields: readonly OperatorApprovalAuditFieldDecision[];
  readonly excludedFields: readonly OperatorApprovalAuditFieldDecision[];
  readonly findings: readonly OperatorApprovalAuditDesignFinding[];
}
