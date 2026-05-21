/**
 * Evaluate Operator approval/audit schema apply decision (read-only; no Prisma/DB/migration wire).
 */

import { evaluateOperatorApprovalAuditDesign } from "@/lib/agents/evaluateOperatorApprovalAuditDesign";
import type {
  OperatorApprovalAuditSchemaDecision,
  OperatorApprovalAuditSchemaDecisionReport,
  OperatorApprovalAuditSchemaFieldProposal,
  OperatorApprovalAuditSchemaFinding,
  OperatorApprovalAuditSchemaTarget,
} from "@/lib/agents/operatorApprovalAuditSchemaDecisionTypes";

const SUMMARY_FIELDS = new Set(["reasonSummary"]);

const REQUIRED_FORBIDDEN_FIELDS = [
  "rawReason",
  "rawPrompt",
  "promptText",
  "fullInput",
  "fullOutput",
  "codeDiff",
  "fileContent",
  "token",
  "secret",
  "password",
  "authorization",
  "apiKey",
  "privateKey",
  "env",
  "personalContact",
  "phoneNumber",
  "emailBody",
] as const;

const INDEXED_FIELDS = new Set([
  "recordId",
  "projectId",
  "runId",
  "taskId",
  "targetType",
  "targetId",
  "actionType",
  "decision",
  "actorId",
  "actorRole",
  "requestedAt",
  "expiresAt",
  "relatedAgentId",
  "relatedCapabilityId",
  "relatedConnectorId",
  "relatedGovernancePolicyId",
  "relatedTimelineEventId",
  "relatedExecutionRecordId",
  "auditEventId",
  "createdAt",
]);

const FIELD_TYPE_MAP: Record<string, { readonly type: string; readonly nullable: boolean }> = {
  recordId: { type: "String", nullable: false },
  schemaVersion: { type: "String", nullable: false },
  projectId: { type: "String", nullable: false },
  runId: { type: "String", nullable: true },
  taskId: { type: "String", nullable: true },
  targetType: { type: "String", nullable: false },
  targetId: { type: "String", nullable: false },
  actionType: { type: "String", nullable: false },
  decision: { type: "String", nullable: false },
  actorId: { type: "String", nullable: false },
  actorRole: { type: "String", nullable: true },
  reasonSummary: { type: "String", nullable: true },
  requestedAt: { type: "DateTime", nullable: false },
  decidedAt: { type: "DateTime", nullable: true },
  expiresAt: { type: "DateTime", nullable: true },
  relatedAgentId: { type: "String", nullable: true },
  relatedCapabilityId: { type: "String", nullable: true },
  relatedConnectorId: { type: "String", nullable: true },
  relatedGovernancePolicyId: { type: "String", nullable: true },
  relatedTimelineEventId: { type: "String", nullable: true },
  relatedExecutionRecordId: { type: "String", nullable: true },
  auditEventId: { type: "String", nullable: true },
  createdAt: { type: "DateTime", nullable: false },
};

const ROLLOUT_PLAN: readonly string[] = [
  "1. schema proposal review only",
  "2. permission model review before migration",
  "3. audit integrity policy review",
  "4. migration draft 별도 PR에서 생성",
  "5. write path behind feature flag",
  "6. staging migration rehearsal",
  "7. retention/access-control review",
  "8. rollback migration plan approval",
  "9. production rollout 별도 승인",
];

const ROLLBACK_PLAN: readonly string[] = [
  "1. migration rollback script 준비",
  "2. approval/audit write path feature flag default off 유지",
  "3. write path 비활성화 가능해야 함",
  "4. failed migration 시 배포 중단",
  "5. audit integrity policy 위반 시 저장 중단",
  "6. raw/forbidden field 유입 감지 시 저장 중단",
  "7. permission model 미승인 시 rollout 중단",
];

const TABLE_BY_TARGET: Record<OperatorApprovalAuditSchemaTarget, string> = {
  operator_approval: "OperatorApproval",
  operator_override: "OperatorOverride",
  audit_event: "OperatorAuditEvent",
  rollback_approval: "OperatorRollbackApproval",
  unknown: "",
};

const ACTIVE_FLAGS = {
  requiresPrismaSchemaChange: true,
  requiresMigration: true,
  requiresRollbackPlan: true,
  requiresBackfillPlan: false,
  requiresRetentionPolicy: true,
  requiresAccessControlReview: true,
  requiresPermissionModel: true,
  requiresAuditIntegrityPolicy: true,
} as const;

const INACTIVE_FLAGS = {
  requiresPrismaSchemaChange: false,
  requiresMigration: false,
  requiresRollbackPlan: false,
  requiresBackfillPlan: false,
  requiresRetentionPolicy: false,
  requiresAccessControlReview: false,
  requiresPermissionModel: false,
  requiresAuditIntegrityPolicy: false,
} as const;

const TARGET_PLAN: Record<
  OperatorApprovalAuditSchemaTarget,
  { readonly decision: OperatorApprovalAuditSchemaDecision }
> = {
  operator_approval: { decision: "ready_for_schema_proposal" },
  audit_event: { decision: "ready_for_schema_proposal" },
  operator_override: { decision: "defer" },
  rollback_approval: { decision: "defer" },
  unknown: { decision: "blocked" },
};

function finding(
  severity: OperatorApprovalAuditSchemaFinding["severity"],
  code: string,
  message: string,
): OperatorApprovalAuditSchemaFinding {
  return { severity, code, message };
}

export function normalizeOperatorApprovalAuditSchemaTarget(
  raw?: string,
): OperatorApprovalAuditSchemaTarget {
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

function normalizeSchemaFieldReason(field: string, reason: string): string {
  if (SUMMARY_FIELDS.has(field) && !reason.toLowerCase().includes("summary")) {
    return `${reason}; summary only`;
  }
  return reason;
}

function toFieldProposal(input: {
  readonly field: string;
  readonly reason: string;
  readonly sensitivity: OperatorApprovalAuditSchemaFieldProposal["sensitivity"];
}): OperatorApprovalAuditSchemaFieldProposal {
  const spec = FIELD_TYPE_MAP[input.field] ?? { type: "String", nullable: true };
  return {
    field: input.field,
    type: spec.type,
    nullable: spec.nullable,
    indexed: INDEXED_FIELDS.has(input.field),
    reason: normalizeSchemaFieldReason(input.field, input.reason),
    sensitivity: input.sensitivity,
  };
}

function toExcludedFieldProposal(input: {
  readonly field: string;
  readonly reason: string;
}): OperatorApprovalAuditSchemaFieldProposal {
  return {
    field: input.field,
    type: "Forbidden",
    nullable: true,
    indexed: false,
    reason: input.reason,
    sensitivity: "forbidden",
  };
}

function uniqueFieldProposals<T extends { readonly field: string }>(fields: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const field of fields) {
    const key = field.field.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(field);
  }
  return out;
}

function buildFieldProposalsFromDesign(
  persistFields: readonly {
    readonly field: string;
    readonly reason: string;
    readonly sensitivity: OperatorApprovalAuditSchemaFieldProposal["sensitivity"];
  }[],
): OperatorApprovalAuditSchemaFieldProposal[] {
  return persistFields.map((f) =>
    toFieldProposal({ field: f.field, reason: f.reason, sensitivity: f.sensitivity }),
  );
}

function buildExcludedFieldProposals(
  excludedFields: readonly {
    readonly field: string;
    readonly reason: string;
    readonly sensitivity: OperatorApprovalAuditSchemaFieldProposal["sensitivity"];
  }[],
): OperatorApprovalAuditSchemaFieldProposal[] {
  return uniqueFieldProposals(
    excludedFields.map((f) => toExcludedFieldProposal({ field: f.field, reason: f.reason })),
  );
}

function appendForbiddenFieldPolicyFindings(
  findings: OperatorApprovalAuditSchemaFinding[],
  excludedFields: readonly OperatorApprovalAuditSchemaFieldProposal[],
): void {
  const present = new Set(excludedFields.map((f) => f.field));
  const missing = REQUIRED_FORBIDDEN_FIELDS.filter((field) => !present.has(field));
  if (missing.length > 0) {
    findings.push(
      finding(
        "blocking",
        "forbidden_field_policy_missing",
        `missing forbidden excluded fields: ${missing.join(", ")}`,
      ),
    );
  } else {
    findings.push(
      finding(
        "info",
        "forbidden_field_policy_enforced",
        "required forbidden fields are excluded from schema proposal",
      ),
    );
  }
}

function appendSchemaFindings(
  findings: OperatorApprovalAuditSchemaFinding[],
  target: OperatorApprovalAuditSchemaTarget,
  decision: OperatorApprovalAuditSchemaDecision,
): void {
  findings.push(
    finding(
      "info",
      "operator_schema_decision_read_only",
      "operator schema decision is read-only; no Prisma/DB wire",
    ),
  );
  findings.push(finding("info", "raw_fields_excluded", "raw reason/prompt/input/output are excluded"));

  if (target === "unknown") {
    findings.push(
      finding("blocking", "unknown_operator_schema_target", "unknown operator schema target is blocked"),
    );
    findings.push(
      finding("info", "operator_schema_target_unknown_no_rollout", "unknown target has no rollout plan"),
    );
    findings.push(
      finding(
        "info",
        "operator_schema_target_unknown_no_migration",
        "unknown target has no migration path",
      ),
    );
    return;
  }

  if (decision === "ready_for_schema_proposal") {
    findings.push(finding("info", "schema_proposal_ready", "schema proposal is ready for review"));
  }

  findings.push(finding("info", "retention_policy_required", "retention policy review is required"));
  findings.push(finding("info", "access_control_review_required", "access control review is required"));
  findings.push(finding("info", "permission_model_required", "permission model review is required"));
  findings.push(finding("info", "audit_integrity_policy_required", "audit integrity policy review is required"));
  findings.push(
    finding("warning", "schema_migration_required", "schema migration will be required in a separate PR"),
  );
  findings.push(
    finding("info", "backfill_plan_not_required_initially", "backfill is not required for initial rollout"),
  );

  if (target === "operator_override") {
    findings.push(
      finding("warning", "operator_override_deferred", "operator override schema defers until policy approval"),
    );
  }

  if (target === "rollback_approval") {
    findings.push(
      finding(
        "warning",
        "rollback_approval_deferred",
        "rollback approval schema defers until rollback target is defined",
      ),
    );
  }
}

/** Read-only operator approval/audit schema decision — does not call Prisma, DB, or migration APIs. */
export function evaluateOperatorApprovalAuditSchemaDecision(input?: {
  readonly target?: OperatorApprovalAuditSchemaTarget | string;
}): OperatorApprovalAuditSchemaDecisionReport {
  const target = normalizeOperatorApprovalAuditSchemaTarget(input?.target);
  const decision = TARGET_PLAN[target]?.decision ?? "blocked";
  const flags = target === "unknown" ? INACTIVE_FLAGS : ACTIVE_FLAGS;

  const design = evaluateOperatorApprovalAuditDesign({ target });
  const findings: OperatorApprovalAuditSchemaFinding[] = [];
  appendSchemaFindings(findings, target, decision);
  const excludedFields = buildExcludedFieldProposals(design.excludedFields);
  appendForbiddenFieldPolicyFindings(findings, excludedFields);

  return {
    mode: "read_only_operator_approval_audit_schema_decision",
    decision,
    target,
    proposedTableName: TABLE_BY_TARGET[target],
    ...flags,
    fieldProposals: buildFieldProposalsFromDesign(design.persistFields),
    excludedFields,
    rolloutPlan: target === "unknown" ? [] : [...ROLLOUT_PLAN],
    rollbackPlan: target === "unknown" ? [] : [...ROLLBACK_PLAN],
    findings,
  };
}
