/**
 * Evaluate Agent execution record persist design (read-only; no DB/Timeline/Audit wire).
 */

import type {
  AgentExecutionRecordDesignDecision,
  AgentExecutionRecordDesignFinding,
  AgentExecutionRecordDesignReport,
  AgentExecutionRecordFieldDecision,
  AgentExecutionRecordFieldSensitivity,
  AgentExecutionRecordTarget,
} from "@/lib/agents/agentExecutionRecordDesignTypes";

const PERSIST_FIELD_SPECS: readonly {
  readonly field: string;
  readonly sensitivity: AgentExecutionRecordFieldSensitivity;
  readonly reason: string;
}[] = [
  { field: "recordId", sensitivity: "safe", reason: "execution record primary key" },
  { field: "schemaVersion", sensitivity: "safe", reason: "schema version for migration tracking" },
  { field: "registryVersion", sensitivity: "safe", reason: "agent registry version for compatibility" },
  { field: "projectId", sensitivity: "internal", reason: "project scope key" },
  { field: "conversationId", sensitivity: "internal", reason: "conversation scope key" },
  { field: "runId", sensitivity: "internal", reason: "run scope key" },
  { field: "taskId", sensitivity: "internal", reason: "task scope key" },
  { field: "agentId", sensitivity: "internal", reason: "dispatch agent identity" },
  { field: "agentType", sensitivity: "internal", reason: "agent type for diagnostics" },
  { field: "capabilityId", sensitivity: "internal", reason: "capability binding trace" },
  { field: "executionStatus", sensitivity: "safe", reason: "execution lifecycle status" },
  { field: "startedAt", sensitivity: "safe", reason: "execution start timestamp" },
  { field: "endedAt", sensitivity: "safe", reason: "execution end timestamp" },
  { field: "durationMs", sensitivity: "safe", reason: "execution duration in milliseconds" },
  { field: "inputSummary", sensitivity: "internal", reason: "truncated input summary only" },
  { field: "outputSummary", sensitivity: "internal", reason: "truncated output summary only" },
  { field: "errorSummary", sensitivity: "internal", reason: "truncated error summary only" },
  { field: "connectorSummary", sensitivity: "internal", reason: "connector invocation summary only" },
  { field: "governanceSummary", sensitivity: "internal", reason: "governance dry-run summary only" },
  { field: "operatorApprovalId", sensitivity: "internal", reason: "operator approval reference id" },
  { field: "timelineEventId", sensitivity: "internal", reason: "timeline event link id" },
  { field: "auditEventId", sensitivity: "internal", reason: "audit event link id" },
  { field: "createdAt", sensitivity: "safe", reason: "record creation timestamp" },
] as const;

const POLICY_EXCLUDED_FIELDS: readonly AgentExecutionRecordFieldDecision[] = [
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
  { field: "stackTraceRaw", persist: false, reason: "policy: raw stack trace excluded", sensitivity: "forbidden" },
];

function finding(
  severity: AgentExecutionRecordDesignFinding["severity"],
  code: string,
  message: string,
): AgentExecutionRecordDesignFinding {
  return { severity, code, message };
}

function buildPersistFields(): AgentExecutionRecordFieldDecision[] {
  return PERSIST_FIELD_SPECS.map((spec) => ({
    field: spec.field,
    persist: true,
    reason: spec.reason,
    sensitivity: spec.sensitivity,
  }));
}

const TARGET_PLAN: Record<
  AgentExecutionRecordTarget,
  {
    readonly decision: AgentExecutionRecordDesignDecision;
    readonly info?: { readonly code: string; readonly message: string };
    readonly linkRequired: boolean;
  }
> = {
  execution_record: {
    decision: "ready_for_schema_design",
    info: {
      code: "ready_for_schema_design",
      message: "execution_record target is valid for schema design review",
    },
    linkRequired: true,
  },
  timeline_event_link: {
    decision: "defer",
    info: {
      code: "defer_timeline_event_link",
      message: "timeline_event_link defers until Timeline storage structure is approved",
    },
    linkRequired: false,
  },
  audit_trail_link: {
    decision: "defer",
    info: {
      code: "defer_audit_trail_link",
      message: "audit_trail_link defers until operator approval/audit design is linked",
    },
    linkRequired: false,
  },
};

/** Read-only execution record design — does not call DB, Timeline, or Audit storage APIs. */
export function evaluateAgentExecutionRecordDesign(input?: {
  readonly target?: AgentExecutionRecordTarget;
}): AgentExecutionRecordDesignReport {
  const findings: AgentExecutionRecordDesignFinding[] = [];
  const target = input?.target ?? "execution_record";
  const plan = TARGET_PLAN[target] ?? TARGET_PLAN.execution_record;

  if (plan.info) {
    findings.push(finding("info", plan.info.code, plan.info.message));
  }

  return {
    mode: "read_only_agent_execution_record_design",
    decision: plan.decision,
    target,
    requiresSchemaChange: true,
    requiresMigration: true,
    requiresRollbackPlan: true,
    requiresAuditLink: plan.linkRequired,
    requiresTimelineLink: plan.linkRequired,
    persistFields: buildPersistFields(),
    excludedFields: [...POLICY_EXCLUDED_FIELDS],
    findings,
  };
}
