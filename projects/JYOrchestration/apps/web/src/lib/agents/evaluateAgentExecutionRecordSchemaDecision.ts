/**
 * Evaluate Agent execution record schema apply decision (read-only; no Prisma/DB/migration wire).
 */

import type { AgentExecutionRecordTarget } from "@/lib/agents/agentExecutionRecordDesignTypes";
import { evaluateAgentExecutionRecordDesign } from "@/lib/agents/evaluateAgentExecutionRecordDesign";
import type {
  AgentExecutionRecordSchemaDecision,
  AgentExecutionRecordSchemaDecisionReport,
  AgentExecutionRecordSchemaFieldProposal,
  AgentExecutionRecordSchemaFinding,
  AgentExecutionRecordSchemaTarget,
} from "@/lib/agents/agentExecutionRecordSchemaDecisionTypes";

const INDEXED_FIELDS = new Set([
  "recordId",
  "projectId",
  "conversationId",
  "runId",
  "taskId",
  "agentId",
  "agentType",
  "capabilityId",
  "executionStatus",
  "startedAt",
  "operatorApprovalId",
  "timelineEventId",
  "auditEventId",
  "createdAt",
]);

const FIELD_TYPE_MAP: Record<string, { readonly type: string; readonly nullable: boolean }> = {
  recordId: { type: "String", nullable: false },
  schemaVersion: { type: "String", nullable: false },
  registryVersion: { type: "String", nullable: false },
  projectId: { type: "String", nullable: false },
  conversationId: { type: "String", nullable: true },
  runId: { type: "String", nullable: true },
  taskId: { type: "String", nullable: true },
  agentId: { type: "String", nullable: false },
  agentType: { type: "String", nullable: false },
  capabilityId: { type: "String", nullable: false },
  executionStatus: { type: "String", nullable: false },
  startedAt: { type: "DateTime", nullable: true },
  endedAt: { type: "DateTime", nullable: true },
  durationMs: { type: "Int", nullable: true },
  inputSummary: { type: "String", nullable: true },
  outputSummary: { type: "String", nullable: true },
  errorSummary: { type: "String", nullable: true },
  connectorSummary: { type: "Json", nullable: true },
  governanceSummary: { type: "Json", nullable: true },
  operatorApprovalId: { type: "String", nullable: true },
  timelineEventId: { type: "String", nullable: true },
  auditEventId: { type: "String", nullable: true },
  createdAt: { type: "DateTime", nullable: false },
};

const EXTRA_FORBIDDEN_FIELDS: readonly { readonly field: string; readonly reason: string }[] = [
  { field: "personalContact", reason: "policy: personal contact excluded from schema" },
  { field: "phoneNumber", reason: "policy: phone number excluded from schema" },
  { field: "emailBody", reason: "policy: email body excluded from schema" },
];

const ROLLOUT_PLAN: readonly string[] = [
  "1. schema proposal review only",
  "2. migration draft 별도 PR에서 생성",
  "3. read-only write path behind feature flag",
  "4. staging migration rehearsal",
  "5. retention/access-control review",
  "6. rollback migration plan approval",
  "7. production rollout 별도 승인",
];

const ROLLBACK_PLAN: readonly string[] = [
  "1. migration rollback script 준비",
  "2. feature flag default off 유지",
  "3. write path 비활성화 가능해야 함",
  "4. failed migration 시 배포 중단",
  "5. data retention policy 위반 시 저장 중단",
  "6. raw/forbidden field 유입 감지 시 저장 중단",
];

const TABLE_BY_TARGET: Record<AgentExecutionRecordSchemaTarget, string> = {
  agent_execution_record: "AgentExecutionRecord",
  timeline_event_link: "AgentExecutionTimelineLink",
  audit_trail_link: "AgentExecutionAuditLink",
  unknown: "",
};

const TARGET_PLAN: Record<
  AgentExecutionRecordSchemaTarget,
  {
    readonly decision: AgentExecutionRecordSchemaDecision;
    readonly requiresPrismaSchemaChange: boolean;
    readonly requiresMigration: boolean;
    readonly requiresRollbackPlan: boolean;
    readonly requiresBackfillPlan: boolean;
    readonly requiresRetentionPolicy: boolean;
    readonly requiresAccessControlReview: boolean;
  }
> = {
  agent_execution_record: {
    decision: "ready_for_schema_proposal",
    requiresPrismaSchemaChange: true,
    requiresMigration: true,
    requiresRollbackPlan: true,
    requiresBackfillPlan: false,
    requiresRetentionPolicy: true,
    requiresAccessControlReview: true,
  },
  timeline_event_link: {
    decision: "defer",
    requiresPrismaSchemaChange: true,
    requiresMigration: true,
    requiresRollbackPlan: true,
    requiresBackfillPlan: false,
    requiresRetentionPolicy: true,
    requiresAccessControlReview: true,
  },
  audit_trail_link: {
    decision: "defer",
    requiresPrismaSchemaChange: true,
    requiresMigration: true,
    requiresRollbackPlan: true,
    requiresBackfillPlan: false,
    requiresRetentionPolicy: true,
    requiresAccessControlReview: true,
  },
  unknown: {
    decision: "blocked",
    requiresPrismaSchemaChange: false,
    requiresMigration: false,
    requiresRollbackPlan: false,
    requiresBackfillPlan: false,
    requiresRetentionPolicy: false,
    requiresAccessControlReview: false,
  },
};

function finding(
  severity: AgentExecutionRecordSchemaFinding["severity"],
  code: string,
  message: string,
): AgentExecutionRecordSchemaFinding {
  return { severity, code, message };
}

export function normalizeAgentExecutionRecordSchemaTarget(
  raw?: string,
): AgentExecutionRecordSchemaTarget {
  if (
    raw === "agent_execution_record" ||
    raw === "timeline_event_link" ||
    raw === "audit_trail_link" ||
    raw === "unknown"
  ) {
    return raw;
  }
  return raw ? "unknown" : "agent_execution_record";
}

function mapSchemaTargetToDesignTarget(
  target: AgentExecutionRecordSchemaTarget,
): AgentExecutionRecordTarget {
  switch (target) {
    case "agent_execution_record":
      return "execution_record";
    case "timeline_event_link":
      return "timeline_event_link";
    case "audit_trail_link":
      return "audit_trail_link";
    default:
      return "unknown";
  }
}

function toFieldProposal(input: {
  readonly field: string;
  readonly reason: string;
  readonly sensitivity: AgentExecutionRecordSchemaFieldProposal["sensitivity"];
  readonly persist: boolean;
}): AgentExecutionRecordSchemaFieldProposal {
  const spec = FIELD_TYPE_MAP[input.field] ?? { type: "String", nullable: true };
  return {
    field: input.field,
    type: spec.type,
    nullable: spec.nullable,
    indexed: INDEXED_FIELDS.has(input.field),
    reason: input.reason,
    sensitivity: input.sensitivity,
  };
}

function buildFieldProposalsFromDesign(
  persistFields: readonly { readonly field: string; readonly reason: string; readonly sensitivity: AgentExecutionRecordSchemaFieldProposal["sensitivity"] }[],
): AgentExecutionRecordSchemaFieldProposal[] {
  return persistFields.map((f) =>
    toFieldProposal({ field: f.field, reason: f.reason, sensitivity: f.sensitivity, persist: true }),
  );
}

function buildExcludedFieldProposals(
  excludedFields: readonly { readonly field: string; readonly reason: string; readonly sensitivity: AgentExecutionRecordSchemaFieldProposal["sensitivity"] }[],
): AgentExecutionRecordSchemaFieldProposal[] {
  const byField = new Map<string, AgentExecutionRecordSchemaFieldProposal>();
  for (const f of excludedFields) {
    byField.set(f.field.toLowerCase(), toFieldProposal({ ...f, persist: false }));
  }
  for (const extra of EXTRA_FORBIDDEN_FIELDS) {
    const key = extra.field.toLowerCase();
    if (!byField.has(key)) {
      byField.set(
        key,
        toFieldProposal({
          field: extra.field,
          reason: extra.reason,
          sensitivity: "forbidden",
          persist: false,
        }),
      );
    }
  }
  return [...byField.values()];
}

function appendSchemaFindings(
  findings: AgentExecutionRecordSchemaFinding[],
  target: AgentExecutionRecordSchemaTarget,
  decision: AgentExecutionRecordSchemaDecision,
): void {
  findings.push(
    finding("info", "schema_decision_read_only", "schema decision is read-only; no Prisma/DB wire"),
  );

  if (target === "unknown") {
    findings.push(finding("blocking", "unknown_schema_target", "unknown schema target is blocked"));
    return;
  }

  if (decision === "ready_for_schema_proposal") {
    findings.push(finding("info", "schema_proposal_ready", "schema proposal is ready for review"));
  }

  findings.push(finding("info", "raw_fields_excluded", "raw prompt/input/output and secrets are excluded"));
  findings.push(finding("info", "forbidden_field_policy_required", "forbidden field policy is enforced"));
  findings.push(finding("info", "retention_policy_required", "retention policy review is required"));
  findings.push(finding("info", "access_control_review_required", "access control review is required"));
  findings.push(
    finding("warning", "schema_migration_required", "schema migration will be required in a separate PR"),
  );
  findings.push(
    finding("info", "backfill_plan_not_required_initially", "backfill is not required for initial rollout"),
  );

  if (target === "timeline_event_link") {
    findings.push(
      finding(
        "warning",
        "timeline_link_deferred",
        "timeline link schema defers until Timeline structure is approved",
      ),
    );
  }

  if (target === "audit_trail_link") {
    findings.push(
      finding("warning", "audit_link_deferred", "audit link schema defers until audit design is linked"),
    );
  }
}

/** Read-only schema decision — does not call Prisma, DB, or migration APIs. */
export function evaluateAgentExecutionRecordSchemaDecision(input?: {
  readonly target?: AgentExecutionRecordSchemaTarget | string;
}): AgentExecutionRecordSchemaDecisionReport {
  const target = normalizeAgentExecutionRecordSchemaTarget(input?.target);
  const plan = TARGET_PLAN[target];
  const design = evaluateAgentExecutionRecordDesign({
    target: mapSchemaTargetToDesignTarget(target),
  });

  const findings: AgentExecutionRecordSchemaFinding[] = [];
  appendSchemaFindings(findings, target, plan.decision);
  const excludedFields = buildExcludedFieldProposals(design.excludedFields);

  return {
    mode: "read_only_agent_execution_record_schema_decision",
    decision: plan.decision,
    target,
    proposedTableName: TABLE_BY_TARGET[target],
    requiresPrismaSchemaChange: plan.requiresPrismaSchemaChange,
    requiresMigration: plan.requiresMigration,
    requiresRollbackPlan: plan.requiresRollbackPlan,
    requiresBackfillPlan: plan.requiresBackfillPlan,
    requiresRetentionPolicy: plan.requiresRetentionPolicy,
    requiresAccessControlReview: plan.requiresAccessControlReview,
    fieldProposals: buildFieldProposalsFromDesign(design.persistFields),
    excludedFields,
    rolloutPlan: target === "unknown" ? [] : [...ROLLOUT_PLAN],
    rollbackPlan: target === "unknown" ? [] : [...ROLLBACK_PLAN],
    findings,
  };
}
