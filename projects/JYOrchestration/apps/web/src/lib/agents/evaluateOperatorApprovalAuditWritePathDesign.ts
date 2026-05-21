/**
 * Evaluate Operator approval/audit write path design (read-only; no Prisma/DB/write wire).
 */

import { evaluateOperatorApprovalAuditSchemaDecision } from "@/lib/agents/evaluateOperatorApprovalAuditSchemaDecision";
import type {
  OperatorApprovalAuditSchemaDecision,
  OperatorApprovalAuditSchemaDecisionReport,
} from "@/lib/agents/operatorApprovalAuditSchemaDecisionTypes";
import type {
  OperatorApprovalAuditWritePathChecklistItem,
  OperatorApprovalAuditWritePathDecision,
  OperatorApprovalAuditWritePathDesignReport,
  OperatorApprovalAuditWritePathFinding,
  OperatorApprovalAuditWritePathTarget,
} from "@/lib/agents/operatorApprovalAuditWritePathDesignTypes";

const FEATURE_FLAG_NAME = "JYO_OPERATOR_APPROVAL_AUDIT_WRITE_PATH";

const PROPOSED_WRITE_ENTRYPOINTS: readonly string[] = [
  "Operator approval decision submit boundary",
  "Operator override decision submit boundary",
  "Audit event collector",
  "Rollback approval decision boundary",
  "Governance enforcement approval boundary",
  "Connector Gateway experiment approval boundary",
];

const PROPOSED_PERMISSION_GUARDS: readonly string[] = [
  "requireOperatorRole",
  "requireApprovalAuthority",
  "requireOverrideAuthority",
  "requireAuditReadWriteAuthority",
  "requireProjectScopedPermission",
];

const PROPOSED_AUDIT_INTEGRITY_GUARDS: readonly string[] = [
  "ensureAuditEventAppendOnly",
  "ensureActorIdentityPresent",
  "ensureDecisionReasonSummaryPresent",
  "ensureTargetReferencePresent",
  "ensureAuditTimestampImmutable",
];

const PROPOSED_SANITIZERS: readonly string[] = [
  "sanitizeReasonSummary",
  "sanitizeActorReference",
  "sanitizeTargetReference",
  "sanitizeApprovalDecisionPayload",
  "sanitizeAuditEventPayload",
];

const FORBIDDEN_FIELD_GUARDS: readonly string[] = [
  "rejectRawReason",
  "rejectRawPrompt",
  "rejectFullInput",
  "rejectFullOutput",
  "rejectCodeDiff",
  "rejectFileContent",
  "rejectTokenSecrets",
  "rejectAuthorizationHeaders",
  "rejectPersonalContact",
  "rejectEmailBody",
];

const ROLLBACK_PLAN: readonly string[] = [
  "feature flag off로 approval/audit write path 비활성화",
  "write adapter no-op 전환",
  "failed approval/audit write는 runtime 실행 상태에 영향 주지 않음",
  "forbidden field 감지 시 저장 중단",
  "permission guard 실패 시 저장 중단",
  "audit integrity guard 실패 시 저장 중단",
  "migration rollback은 별도 schema PR에서 처리",
];

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function finding(
  severity: OperatorApprovalAuditWritePathFinding["severity"],
  code: string,
  message: string,
): OperatorApprovalAuditWritePathFinding {
  return { severity, code, message };
}

export function normalizeOperatorApprovalAuditWritePathTarget(
  raw?: string,
): OperatorApprovalAuditWritePathTarget {
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

function mapSchemaDecisionToWritePathDecision(
  schemaDecision: OperatorApprovalAuditSchemaDecision,
  target: OperatorApprovalAuditWritePathTarget,
): OperatorApprovalAuditWritePathDecision {
  if (target === "unknown" || schemaDecision === "blocked") {
    return "blocked";
  }
  return "defer";
}

function isWritePathBlocked(
  decision: OperatorApprovalAuditWritePathDecision,
  target: OperatorApprovalAuditWritePathTarget,
): boolean {
  return decision === "blocked" || target === "unknown";
}

function buildValidationChecklist(input: {
  readonly schemaDecision: OperatorApprovalAuditSchemaDecision;
  readonly target: OperatorApprovalAuditWritePathTarget;
  readonly isBlocked: boolean;
  readonly proposedPermissionGuards: readonly string[];
  readonly proposedAuditIntegrityGuards: readonly string[];
  readonly proposedSanitizers: readonly string[];
  readonly forbiddenFieldGuards: readonly string[];
  readonly rollbackPlan: readonly string[];
}): OperatorApprovalAuditWritePathChecklistItem[] {
  const schemaProposalExists =
    !input.isBlocked && input.schemaDecision !== "blocked" && input.target !== "unknown";

  return [
    {
      item: "schema proposal exists",
      satisfied: schemaProposalExists,
      reason: schemaProposalExists
        ? "schema decision report is available"
        : "schema proposal blocked or unknown target",
    },
    {
      item: "schema applied",
      satisfied: false,
      reason: "Prisma schema is not applied in this stage",
    },
    {
      item: "migration applied",
      satisfied: false,
      reason: "migration is not applied in this stage",
    },
    {
      item: "feature flag default off",
      satisfied: true,
      reason: "write path feature flag defaults to off",
    },
    {
      item: "permission guard defined",
      satisfied: !input.isBlocked && input.proposedPermissionGuards.length > 0,
      reason: input.isBlocked
        ? "permission guards not applicable while blocked"
        : "permission guards are defined in design report",
    },
    {
      item: "audit integrity guard defined",
      satisfied: !input.isBlocked && input.proposedAuditIntegrityGuards.length > 0,
      reason: input.isBlocked
        ? "audit integrity guards not applicable while blocked"
        : "audit integrity guards are defined in design report",
    },
    {
      item: "forbidden field guard defined",
      satisfied: !input.isBlocked && input.forbiddenFieldGuards.length > 0,
      reason: input.isBlocked
        ? "forbidden field guards not applicable while blocked"
        : "forbidden field guards are defined in design report",
    },
    {
      item: "summary-only sanitizer defined",
      satisfied: !input.isBlocked && input.proposedSanitizers.length > 0,
      reason: input.isBlocked
        ? "sanitizers not applicable while blocked"
        : "summary-only sanitizers are defined in design report",
    },
    {
      item: "write path rollback defined",
      satisfied: !input.isBlocked && input.rollbackPlan.length > 0,
      reason: input.isBlocked
        ? "rollback plan not applicable while blocked"
        : "write path rollback plan is defined",
    },
    {
      item: "operator approval required",
      satisfied: !input.isBlocked,
      reason: input.isBlocked
        ? "operator approval not required while blocked"
        : "operator approval is required before write path wire",
    },
    {
      item: "write adapter implemented",
      satisfied: false,
      reason: "write adapter is not implemented in this stage",
    },
    {
      item: "runtime execution path unchanged",
      satisfied: true,
      reason: "this evaluator does not change runtime execution paths",
    },
    {
      item: "DB write not implemented in this step",
      satisfied: true,
      reason: "this evaluator does not implement DB writes",
    },
  ];
}

function appendWritePathFindings(input: {
  readonly findings: OperatorApprovalAuditWritePathFinding[];
  readonly decision: OperatorApprovalAuditWritePathDecision;
  readonly target: OperatorApprovalAuditWritePathTarget;
  readonly schemaDecision: OperatorApprovalAuditSchemaDecision;
  readonly isBlocked: boolean;
}): void {
  const { findings, decision, target, schemaDecision, isBlocked } = input;

  findings.push(
    finding(
      "info",
      "approval_audit_write_path_design_read_only",
      "approval/audit write path design is read-only; no DB/Prisma wire",
    ),
  );
  findings.push(finding("info", "runtime_path_unchanged", "runtime execution path is unchanged in this step"));
  findings.push(finding("info", "db_write_not_implemented", "DB write is not implemented in this step"));

  if (isBlocked) {
    if (target === "unknown") {
      findings.push(
        finding("blocking", "unknown_approval_audit_write_path_target", "unknown write path target is blocked"),
      );
      findings.push(
        finding(
          "info",
          "approval_audit_write_path_target_unknown_no_feature_flag",
          "feature flag not applicable while blocked",
        ),
      );
      findings.push(
        finding(
          "info",
          "approval_audit_write_path_target_unknown_no_entrypoints",
          "write entrypoints not applicable while blocked",
        ),
      );
      findings.push(
        finding(
          "info",
          "approval_audit_write_path_target_unknown_no_permission_guards",
          "permission guards not applicable while blocked",
        ),
      );
      findings.push(
        finding(
          "info",
          "approval_audit_write_path_target_unknown_no_audit_integrity_guards",
          "audit integrity guards not applicable while blocked",
        ),
      );
      findings.push(
        finding(
          "info",
          "approval_audit_write_path_target_unknown_no_rollback",
          "rollback plan not applicable while blocked",
        ),
      );
    }
    if (schemaDecision === "blocked") {
      findings.push(finding("blocking", "schema_decision_blocked", "schema decision blocked write path design"));
    }
    return;
  }

  findings.push(finding("info", "feature_flag_default_off", "write path feature flag must default to off"));
  findings.push(finding("info", "permission_guard_required", "permission guards are required before write wire"));
  findings.push(
    finding("info", "audit_integrity_guard_required", "audit integrity guards are required before write wire"),
  );
  findings.push(
    finding("info", "forbidden_field_guard_required", "forbidden field guards are required before write wire"),
  );
  findings.push(
    finding("info", "summary_only_sanitizer_required", "summary-only sanitizers are required before write wire"),
  );
  findings.push(
    finding("info", "write_path_rollback_required", "write path rollback plan is required before write wire"),
  );

  findings.push(finding("warning", "schema_not_applied", "Prisma schema is not applied yet"));
  findings.push(finding("warning", "migration_not_applied", "migration is not applied yet"));
  findings.push(
    finding(
      "warning",
      "write_path_deferred_until_schema_applied",
      "write path design defers until schema and migration are applied",
    ),
  );

  if (decision === "defer") {
    if (target === "operator_override") {
      findings.push(
        finding("warning", "operator_override_write_deferred", "operator override write path defers until schema applied"),
      );
    }
    if (target === "rollback_approval") {
      findings.push(
        finding(
          "warning",
          "rollback_approval_write_deferred",
          "rollback approval write path defers until schema applied",
        ),
      );
    }
    if (target === "audit_event") {
      findings.push(
        finding(
          "warning",
          "audit_event_write_deferred",
          "audit event write path defers until schema and migration are applied",
        ),
      );
    }
  }
}

function buildActiveReportFields(): {
  readonly featureFlagName: string;
  readonly proposedWriteEntrypoints: string[];
  readonly proposedPermissionGuards: string[];
  readonly proposedAuditIntegrityGuards: string[];
  readonly proposedSanitizers: string[];
  readonly forbiddenFieldGuards: string[];
  readonly rollbackPlan: string[];
} {
  return {
    featureFlagName: FEATURE_FLAG_NAME,
    proposedWriteEntrypoints: uniqueStrings(PROPOSED_WRITE_ENTRYPOINTS),
    proposedPermissionGuards: uniqueStrings(PROPOSED_PERMISSION_GUARDS),
    proposedAuditIntegrityGuards: uniqueStrings(PROPOSED_AUDIT_INTEGRITY_GUARDS),
    proposedSanitizers: uniqueStrings(PROPOSED_SANITIZERS),
    forbiddenFieldGuards: uniqueStrings(FORBIDDEN_FIELD_GUARDS),
    rollbackPlan: uniqueStrings(ROLLBACK_PLAN),
  };
}

/** Read-only approval/audit write path design — does not call Prisma, DB, or write APIs. */
export function evaluateOperatorApprovalAuditWritePathDesign(input?: {
  readonly target?: OperatorApprovalAuditWritePathTarget | string;
}): OperatorApprovalAuditWritePathDesignReport {
  const target = normalizeOperatorApprovalAuditWritePathTarget(input?.target);
  const schemaDecision: OperatorApprovalAuditSchemaDecisionReport =
    evaluateOperatorApprovalAuditSchemaDecision({ target });
  const decision = mapSchemaDecisionToWritePathDecision(schemaDecision.decision, target);
  const isBlocked = isWritePathBlocked(decision, target);

  const activeFields = isBlocked
    ? {
        featureFlagName: "",
        proposedWriteEntrypoints: [] as string[],
        proposedPermissionGuards: [] as string[],
        proposedAuditIntegrityGuards: [] as string[],
        proposedSanitizers: [] as string[],
        forbiddenFieldGuards: [] as string[],
        rollbackPlan: [] as string[],
      }
    : buildActiveReportFields();

  const findings: OperatorApprovalAuditWritePathFinding[] = [];
  appendWritePathFindings({
    findings,
    decision,
    target,
    schemaDecision: schemaDecision.decision,
    isBlocked,
  });

  return {
    mode: "read_only_operator_approval_audit_write_path_design",
    decision,
    target,
    featureFlagName: activeFields.featureFlagName,
    featureFlagDefault: "off",
    proposedWriteEntrypoints: activeFields.proposedWriteEntrypoints,
    proposedPermissionGuards: activeFields.proposedPermissionGuards,
    proposedAuditIntegrityGuards: activeFields.proposedAuditIntegrityGuards,
    proposedSanitizers: activeFields.proposedSanitizers,
    forbiddenFieldGuards: activeFields.forbiddenFieldGuards,
    validationChecklist: buildValidationChecklist({
      schemaDecision: schemaDecision.decision,
      target,
      isBlocked,
      proposedPermissionGuards: activeFields.proposedPermissionGuards,
      proposedAuditIntegrityGuards: activeFields.proposedAuditIntegrityGuards,
      proposedSanitizers: activeFields.proposedSanitizers,
      forbiddenFieldGuards: activeFields.forbiddenFieldGuards,
      rollbackPlan: activeFields.rollbackPlan,
    }),
    rollbackPlan: activeFields.rollbackPlan,
    requiresSchemaApplied: !isBlocked,
    requiresMigrationApplied: !isBlocked,
    requiresFeatureFlag: !isBlocked,
    requiresPermissionGuard: !isBlocked,
    requiresAuditIntegrityGuard: !isBlocked,
    requiresForbiddenFieldGuard: !isBlocked,
    requiresWritePathRollback: !isBlocked,
    requiresOperatorApproval: !isBlocked,
    sourceSchemaDecision: schemaDecision.decision,
    sourceSchemaTarget: schemaDecision.target,
    sourceProposedTableName: schemaDecision.proposedTableName,
    sourceRequiresPrismaSchemaChange: schemaDecision.requiresPrismaSchemaChange,
    sourceRequiresMigration: schemaDecision.requiresMigration,
    findings,
  };
}
