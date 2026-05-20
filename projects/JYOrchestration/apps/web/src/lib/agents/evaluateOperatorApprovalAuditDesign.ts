/**
 * Evaluate Operator approval / override / audit design (read-only; no approval/audit storage wire).
 */

import { uniqueFieldDecisions } from "@/lib/agents/agentFieldDecisionUtils";
import type {
  OperatorApprovalAuditDesignDecision,
  OperatorApprovalAuditDesignFinding,
  OperatorApprovalAuditDesignReport,
  OperatorApprovalAuditFieldDecision,
  OperatorApprovalAuditFieldSensitivity,
  OperatorApprovalAuditTarget,
} from "@/lib/agents/operatorApprovalAuditDesignTypes";

const PERSIST_FIELD_SPECS: readonly {
  readonly field: string;
  readonly sensitivity: OperatorApprovalAuditFieldSensitivity;
  readonly reason: string;
}[] = [
  { field: "recordId", sensitivity: "safe", reason: "approval/audit record primary key" },
  { field: "schemaVersion", sensitivity: "safe", reason: "schema version for migration tracking" },
  { field: "projectId", sensitivity: "internal", reason: "project scope key" },
  { field: "runId", sensitivity: "internal", reason: "run scope key" },
  { field: "taskId", sensitivity: "internal", reason: "task scope key" },
  { field: "targetType", sensitivity: "internal", reason: "approval target type" },
  { field: "targetId", sensitivity: "internal", reason: "approval target id" },
  { field: "actionType", sensitivity: "safe", reason: "requested action type" },
  { field: "decision", sensitivity: "safe", reason: "approval decision outcome" },
  { field: "actorId", sensitivity: "internal", reason: "operator actor id (internal identifier only)" },
  { field: "actorRole", sensitivity: "internal", reason: "operator role for authorization trace" },
  {
    field: "reasonSummary",
    sensitivity: "internal",
    reason: "truncated reason summary only (summary-only policy)",
  },
  { field: "requestedAt", sensitivity: "safe", reason: "approval request timestamp" },
  { field: "decidedAt", sensitivity: "safe", reason: "approval decision timestamp" },
  { field: "expiresAt", sensitivity: "safe", reason: "approval expiry timestamp" },
  { field: "relatedAgentId", sensitivity: "internal", reason: "related agent id" },
  { field: "relatedCapabilityId", sensitivity: "internal", reason: "related capability id" },
  { field: "relatedConnectorId", sensitivity: "internal", reason: "related connector id" },
  { field: "relatedGovernancePolicyId", sensitivity: "internal", reason: "related governance policy id" },
  { field: "relatedTimelineEventId", sensitivity: "internal", reason: "related timeline event id" },
  { field: "relatedExecutionRecordId", sensitivity: "internal", reason: "related execution record id" },
  { field: "auditEventId", sensitivity: "internal", reason: "linked audit event id" },
  { field: "createdAt", sensitivity: "safe", reason: "record creation timestamp" },
] as const;

const POLICY_EXCLUDED_FIELDS: readonly OperatorApprovalAuditFieldDecision[] = [
  { field: "rawReason", persist: false, reason: "policy: raw reason excluded", sensitivity: "forbidden" },
  { field: "rawPrompt", persist: false, reason: "policy: raw prompt excluded", sensitivity: "forbidden" },
  { field: "promptText", persist: false, reason: "policy: prompt text excluded", sensitivity: "forbidden" },
  { field: "fullInput", persist: false, reason: "policy: full input excluded", sensitivity: "forbidden" },
  { field: "fullOutput", persist: false, reason: "policy: full output excluded", sensitivity: "forbidden" },
  { field: "codeDiff", persist: false, reason: "policy: code diff excluded", sensitivity: "forbidden" },
  { field: "fileContent", persist: false, reason: "policy: file content excluded", sensitivity: "forbidden" },
  { field: "token", persist: false, reason: "policy: token excluded", sensitivity: "forbidden" },
  { field: "secret", persist: false, reason: "policy: secret excluded", sensitivity: "forbidden" },
  { field: "password", persist: false, reason: "policy: password excluded", sensitivity: "forbidden" },
  { field: "authorization", persist: false, reason: "policy: authorization excluded", sensitivity: "forbidden" },
  { field: "apiKey", persist: false, reason: "policy: api key excluded", sensitivity: "forbidden" },
  { field: "privateKey", persist: false, reason: "policy: private key excluded", sensitivity: "forbidden" },
  { field: "env", persist: false, reason: "policy: env vars excluded", sensitivity: "forbidden" },
  {
    field: "personalContact",
    persist: false,
    reason: "policy: personal contact excluded",
    sensitivity: "forbidden",
  },
];

function finding(
  severity: OperatorApprovalAuditDesignFinding["severity"],
  code: string,
  message: string,
): OperatorApprovalAuditDesignFinding {
  return { severity, code, message };
}

export function normalizeOperatorApprovalAuditTarget(raw?: string): OperatorApprovalAuditTarget {
  if (
    raw === "operator_approval" ||
    raw === "operator_override" ||
    raw === "audit_event" ||
    raw === "rollback_approval" ||
    raw === "unknown"
  ) {
    return raw;
  }
  return raw ? "unknown" : "operator_approval";
}

const TARGET_PLAN: Record<
  OperatorApprovalAuditTarget,
  {
    readonly decision: OperatorApprovalAuditDesignDecision;
    readonly info?: { readonly code: string; readonly message: string };
    readonly requiresSchemaChange: boolean;
    readonly requiresMigration: boolean;
    readonly requiresRollbackPlan: boolean;
    readonly requiresActorIdentity: boolean;
    readonly requiresReason: boolean;
    readonly requiresAuditTrail: boolean;
  }
> = {
  operator_approval: {
    decision: "ready_for_schema_design",
    info: {
      code: "ready_for_operator_approval_schema",
      message: "operator_approval target is valid for schema design review",
    },
    requiresSchemaChange: true,
    requiresMigration: true,
    requiresRollbackPlan: true,
    requiresActorIdentity: true,
    requiresReason: true,
    requiresAuditTrail: true,
  },
  operator_override: {
    decision: "defer",
    info: {
      code: "defer_operator_override",
      message: "operator_override defers until policy approval and authority model are defined",
    },
    requiresSchemaChange: true,
    requiresMigration: true,
    requiresRollbackPlan: true,
    requiresActorIdentity: true,
    requiresReason: true,
    requiresAuditTrail: true,
  },
  audit_event: {
    decision: "ready_for_schema_design",
    info: {
      code: "ready_for_audit_event_schema",
      message: "audit_event target is valid for audit event schema design review",
    },
    requiresSchemaChange: true,
    requiresMigration: true,
    requiresRollbackPlan: true,
    requiresActorIdentity: true,
    requiresReason: true,
    requiresAuditTrail: true,
  },
  rollback_approval: {
    decision: "defer",
    info: {
      code: "defer_rollback_approval",
      message: "rollback_approval defers until rollback target and policy are defined",
    },
    requiresSchemaChange: true,
    requiresMigration: true,
    requiresRollbackPlan: true,
    requiresActorIdentity: true,
    requiresReason: true,
    requiresAuditTrail: true,
  },
  unknown: {
    decision: "blocked",
    requiresSchemaChange: false,
    requiresMigration: false,
    requiresRollbackPlan: false,
    requiresActorIdentity: false,
    requiresReason: false,
    requiresAuditTrail: false,
  },
};

function buildPersistFields(): OperatorApprovalAuditFieldDecision[] {
  return uniqueFieldDecisions(
    PERSIST_FIELD_SPECS.map((spec) => ({
      field: spec.field,
      persist: true,
      reason: spec.reason,
      sensitivity: spec.sensitivity,
    })),
  );
}

/** Read-only approval/audit design — does not perform approval, override, or audit storage. */
export function evaluateOperatorApprovalAuditDesign(input?: {
  readonly target?: OperatorApprovalAuditTarget | string;
}): OperatorApprovalAuditDesignReport {
  const findings: OperatorApprovalAuditDesignFinding[] = [];
  const target = normalizeOperatorApprovalAuditTarget(input?.target);
  const plan = TARGET_PLAN[target];

  if (target === "unknown") {
    findings.push(
      finding(
        "blocking",
        "unknown_operator_approval_audit_target",
        `unknown operator approval/audit target: ${String(input?.target ?? "")}`,
      ),
    );
  } else if (plan.info) {
    findings.push(finding("info", plan.info.code, plan.info.message));
  }

  return {
    mode: "read_only_operator_approval_audit_design",
    decision: plan.decision,
    target,
    requiresSchemaChange: plan.requiresSchemaChange,
    requiresMigration: plan.requiresMigration,
    requiresRollbackPlan: plan.requiresRollbackPlan,
    requiresActorIdentity: plan.requiresActorIdentity,
    requiresReason: plan.requiresReason,
    requiresAuditTrail: plan.requiresAuditTrail,
    persistFields: buildPersistFields(),
    excludedFields: uniqueFieldDecisions(POLICY_EXCLUDED_FIELDS),
    findings,
  };
}
