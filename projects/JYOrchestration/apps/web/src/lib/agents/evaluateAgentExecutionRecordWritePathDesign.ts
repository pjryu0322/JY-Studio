/**
 * Evaluate Agent execution record write path design (read-only; no Prisma/DB/write wire).
 */

import { evaluateAgentExecutionRecordSchemaDecision } from "@/lib/agents/evaluateAgentExecutionRecordSchemaDecision";
import type { AgentExecutionRecordSchemaDecision } from "@/lib/agents/agentExecutionRecordSchemaDecisionTypes";
import type {
  AgentExecutionRecordWritePathChecklistItem,
  AgentExecutionRecordWritePathDecision,
  AgentExecutionRecordWritePathDesignReport,
  AgentExecutionRecordWritePathFinding,
  AgentExecutionRecordWritePathTarget,
} from "@/lib/agents/agentExecutionRecordWritePathDesignTypes";

const FEATURE_FLAG_NAME = "JYO_AGENT_EXECUTION_RECORD_WRITE_PATH";

const PROPOSED_WRITE_ENTRYPOINTS: readonly string[] = [
  "Agent runtime completion handler",
  "Harness dry-run promotion boundary",
  "Connector execution result collector",
  "Governance decision result collector",
  "Timeline replay persistence boundary",
];

const PROPOSED_SANITIZERS: readonly string[] = [
  "sanitizeAgentExecutionRecordInput",
  "sanitizeAgentExecutionRecordOutput",
  "sanitizeAgentExecutionRecordError",
  "summarizeConnectorExecutionResult",
  "summarizeGovernanceDecision",
];

const FORBIDDEN_FIELD_GUARDS: readonly string[] = [
  "rejectRawPrompt",
  "rejectFullInput",
  "rejectFullOutput",
  "rejectCodeDiff",
  "rejectFileContent",
  "rejectTokenSecrets",
  "rejectAuthorizationHeaders",
  "rejectStackTraceRaw",
];

const ROLLBACK_PLAN: readonly string[] = [
  "feature flag off로 write path 비활성화",
  "write adapter no-op 전환",
  "failed write는 runtime 성공/실패 상태에 영향 주지 않음",
  "forbidden field 감지 시 저장 중단",
  "migration rollback은 별도 schema PR에서 처리",
];

function finding(
  severity: AgentExecutionRecordWritePathFinding["severity"],
  code: string,
  message: string,
): AgentExecutionRecordWritePathFinding {
  return { severity, code, message };
}

export function normalizeAgentExecutionRecordWritePathTarget(
  raw?: string,
): AgentExecutionRecordWritePathTarget {
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

function mapSchemaDecisionToWritePathDecision(
  schemaDecision: AgentExecutionRecordSchemaDecision,
  target: AgentExecutionRecordWritePathTarget,
): AgentExecutionRecordWritePathDecision {
  if (target === "unknown" || schemaDecision === "blocked") {
    return "blocked";
  }
  return "defer";
}

function buildValidationChecklist(input: {
  readonly schemaDecision: AgentExecutionRecordSchemaDecision;
  readonly target: AgentExecutionRecordWritePathTarget;
}): AgentExecutionRecordWritePathChecklistItem[] {
  const schemaProposalExists = input.schemaDecision !== "blocked" && input.target !== "unknown";

  return [
    {
      item: "schema proposal exists",
      satisfied: schemaProposalExists,
      reason: schemaProposalExists
        ? "schema decision report is available"
        : "schema proposal blocked or unknown target",
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
      item: "forbidden field guard defined",
      satisfied: FORBIDDEN_FIELD_GUARDS.length > 0,
      reason: "forbidden field guards are defined in design report",
    },
    {
      item: "summary-only sanitizer defined",
      satisfied: PROPOSED_SANITIZERS.length > 0,
      reason: "summary-only sanitizers are defined in design report",
    },
    {
      item: "write path rollback defined",
      satisfied: ROLLBACK_PLAN.length > 0,
      reason: "write path rollback plan is defined",
    },
    {
      item: "operator approval required",
      satisfied: true,
      reason: "operator approval is required before write path wire",
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
  readonly findings: AgentExecutionRecordWritePathFinding[];
  readonly decision: AgentExecutionRecordWritePathDecision;
  readonly target: AgentExecutionRecordWritePathTarget;
  readonly schemaDecision: AgentExecutionRecordSchemaDecision;
}): void {
  const { findings, decision, target, schemaDecision } = input;

  findings.push(
    finding("info", "write_path_design_read_only", "write path design is read-only; no DB/Prisma wire"),
  );
  findings.push(finding("info", "feature_flag_default_off", "write path feature flag must default to off"));
  findings.push(
    finding("info", "forbidden_field_guard_required", "forbidden field guards are required before write wire"),
  );
  findings.push(
    finding("info", "summary_only_sanitizer_required", "summary-only sanitizers are required before write wire"),
  );
  findings.push(
    finding("info", "write_path_rollback_required", "write path rollback plan is required before write wire"),
  );
  findings.push(finding("info", "runtime_path_unchanged", "runtime execution path is unchanged in this step"));
  findings.push(finding("info", "db_write_not_implemented", "DB write is not implemented in this step"));

  if (target === "unknown") {
    findings.push(finding("blocking", "unknown_write_path_target", "unknown write path target is blocked"));
    return;
  }

  if (schemaDecision === "blocked") {
    findings.push(finding("blocking", "schema_decision_blocked", "schema decision blocked write path design"));
    return;
  }

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
    if (target === "timeline_event_link") {
      findings.push(
        finding("warning", "timeline_link_write_deferred", "timeline link write path defers until schema applied"),
      );
    }
    if (target === "audit_trail_link") {
      findings.push(
        finding("warning", "audit_link_write_deferred", "audit trail link write path defers until schema applied"),
      );
    }
  }
}

/** Read-only write path design — does not call Prisma, DB, or write APIs. */
export function evaluateAgentExecutionRecordWritePathDesign(input?: {
  readonly target?: AgentExecutionRecordWritePathTarget | string;
}): AgentExecutionRecordWritePathDesignReport {
  const target = normalizeAgentExecutionRecordWritePathTarget(input?.target);
  const schemaDecision = evaluateAgentExecutionRecordSchemaDecision({ target });
  const decision = mapSchemaDecisionToWritePathDecision(schemaDecision.decision, target);

  const findings: AgentExecutionRecordWritePathFinding[] = [];
  appendWritePathFindings({ findings, decision, target, schemaDecision: schemaDecision.decision });

  return {
    mode: "read_only_agent_execution_record_write_path_design",
    decision,
    target,
    featureFlagName: FEATURE_FLAG_NAME,
    featureFlagDefault: "off",
    proposedWriteEntrypoints: [...PROPOSED_WRITE_ENTRYPOINTS],
    proposedSanitizers: [...PROPOSED_SANITIZERS],
    forbiddenFieldGuards: [...FORBIDDEN_FIELD_GUARDS],
    validationChecklist: buildValidationChecklist({
      schemaDecision: schemaDecision.decision,
      target,
    }),
    rollbackPlan: [...ROLLBACK_PLAN],
    requiresSchemaApplied: true,
    requiresMigrationApplied: true,
    requiresFeatureFlag: true,
    requiresForbiddenFieldGuard: true,
    requiresWritePathRollback: true,
    requiresOperatorApproval: true,
    findings,
  };
}
