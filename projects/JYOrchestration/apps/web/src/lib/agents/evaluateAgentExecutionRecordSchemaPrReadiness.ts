/**
 * Evaluate Agent execution record schema/migration PR readiness (read-only; no schema/migration/DB wire).
 */

import {
  evaluateAgentExecutionRecordSchemaDecision,
  normalizeAgentExecutionRecordSchemaTarget,
} from "@/lib/agents/evaluateAgentExecutionRecordSchemaDecision";
import type {
  AgentExecutionRecordSchemaDecision,
  AgentExecutionRecordSchemaDecisionReport,
  AgentExecutionRecordSchemaFieldProposal,
} from "@/lib/agents/agentExecutionRecordSchemaDecisionTypes";
import type {
  AgentExecutionRecordSchemaPrChecklistItem,
  AgentExecutionRecordSchemaPrFinding,
  AgentExecutionRecordSchemaPrModelCandidate,
  AgentExecutionRecordSchemaPrReadinessDecision,
  AgentExecutionRecordSchemaPrReadinessReport,
} from "@/lib/agents/agentExecutionRecordSchemaPrReadinessTypes";

const MODEL_CAUTION = "read-only schema draft; do not apply without separate PR approval";

const REQUIRED_FORBIDDEN_FIELDS = [
  "rawPrompt",
  "fullInput",
  "fullOutput",
  "codeDiff",
  "token",
  "apiKey",
  "stackTraceRaw",
] as const;

const MIGRATION_CHECKLIST_ITEMS = [
  "separate PR required",
  "schema owner review required",
  "migration draft required",
  "staging migration rehearsal required",
  "backward compatibility review required",
  "feature flag remains off",
  "write path remains disabled",
] as const;

const ROLLBACK_CHECKLIST_ITEMS = [
  "rollback migration script required",
  "write path can remain disabled",
  "failed migration stops rollout",
  "forbidden field detection stops rollout",
  "data cleanup plan required",
] as const;

const RETENTION_ACCESS_ITEMS = [
  "retention policy required",
  "access control review required",
  "project scoped access required",
  "audit review required",
  "summary-only storage confirmed",
] as const;

function finding(
  severity: AgentExecutionRecordSchemaPrFinding["severity"],
  code: string,
  message: string,
): AgentExecutionRecordSchemaPrFinding {
  return { severity, code, message };
}

function mapSchemaDecisionToPrReadiness(
  schemaDecision: AgentExecutionRecordSchemaDecision,
): AgentExecutionRecordSchemaPrReadinessDecision {
  switch (schemaDecision) {
    case "ready_for_schema_proposal":
      return "ready_for_schema_pr_plan";
    case "defer":
      return "defer";
    case "blocked":
      return "blocked";
    default:
      return "blocked";
  }
}

function resolvePrReadinessDecision(input: {
  readonly schemaDecision: AgentExecutionRecordSchemaDecisionReport;
}): AgentExecutionRecordSchemaPrReadinessDecision {
  let decision = mapSchemaDecisionToPrReadiness(input.schemaDecision.decision);

  if (decision === "ready_for_schema_pr_plan") {
    if (!input.schemaDecision.proposedTableName) {
      decision = "blocked";
    } else if (input.schemaDecision.fieldProposals.length === 0) {
      decision = "blocked";
    } else {
      const excluded = new Set(input.schemaDecision.excludedFields.map((f) => f.field));
      const missingForbidden = REQUIRED_FORBIDDEN_FIELDS.filter((field) => !excluded.has(field));
      if (missingForbidden.length > 0) {
        decision = "blocked";
      }
    }
  }

  return decision;
}

function buildModelDraft(
  modelName: string,
  fieldProposals: readonly AgentExecutionRecordSchemaFieldProposal[],
): string {
  const fieldLines = fieldProposals.map((f) => {
    const optional = f.nullable ? "?" : "";
    return `  ${f.field} ${f.type}${optional}`;
  });

  const indexFields = fieldProposals
    .filter((f) => f.indexed)
    .map((f) => f.field)
    .filter((field) => field !== "recordId");

  const indexLines =
    indexFields.length > 0
      ? indexFields.map((field) => `  @@index([${field}])`).join("\n")
      : "";

  const hasCreatedAt = fieldProposals.some((f) => f.field === "createdAt");

  return [
    `model ${modelName} {`,
    "  id String @id @default(cuid())",
    ...fieldLines,
    ...(hasCreatedAt ? [] : ["  createdAt DateTime @default(now())"]),
    indexLines,
    "}",
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

function buildModelCandidates(input: {
  readonly decision: AgentExecutionRecordSchemaPrReadinessDecision;
  readonly schemaDecision: AgentExecutionRecordSchemaDecisionReport;
}): AgentExecutionRecordSchemaPrModelCandidate[] {
  if (input.decision !== "ready_for_schema_pr_plan" || !input.schemaDecision.proposedTableName) {
    return [];
  }

  return [
    {
      modelName: input.schemaDecision.proposedTableName,
      modelDraft: buildModelDraft(
        input.schemaDecision.proposedTableName,
        input.schemaDecision.fieldProposals,
      ),
      caution: MODEL_CAUTION,
    },
  ];
}

function buildStaticChecklist(
  items: readonly string[],
  satisfied: boolean,
  reasonWhenTrue: string,
  reasonWhenFalse: string,
): AgentExecutionRecordSchemaPrChecklistItem[] {
  return items.map((item) => ({
    item,
    satisfied,
    reason: satisfied ? reasonWhenTrue : reasonWhenFalse,
  }));
}

function buildForbiddenFieldChecklist(
  excludedFields: readonly AgentExecutionRecordSchemaFieldProposal[],
): AgentExecutionRecordSchemaPrChecklistItem[] {
  const excluded = new Set(excludedFields.map((f) => f.field));

  return REQUIRED_FORBIDDEN_FIELDS.map((field) => ({
    item: field,
    satisfied: excluded.has(field),
    reason: excluded.has(field)
      ? `${field} is excluded from schema proposal`
      : `${field} is missing from excluded fields policy`,
  }));
}

function appendPrReadinessFindings(input: {
  readonly findings: AgentExecutionRecordSchemaPrFinding[];
  readonly decision: AgentExecutionRecordSchemaPrReadinessDecision;
  readonly schemaDecision: AgentExecutionRecordSchemaDecisionReport;
  readonly isReady: boolean;
}): void {
  const { findings, decision, schemaDecision } = input;

  findings.push(
    finding("info", "schema_pr_readiness_read_only", "schema PR readiness is read-only; no schema/migration wire"),
  );
  findings.push(finding("info", "no_schema_modification_in_this_step", "schema.prisma is not modified in this step"));
  findings.push(finding("info", "no_migration_created_in_this_step", "migration is not created in this step"));
  findings.push(finding("info", "no_data_write_in_this_step", "DB write is not implemented in this step"));

  if (decision === "blocked") {
    findings.push(finding("blocking", "schema_decision_blocked", "schema decision blocked PR readiness"));
    if (!schemaDecision.proposedTableName) {
      findings.push(finding("blocking", "missing_proposed_table_name", "proposed table name is required"));
    }
    if (schemaDecision.fieldProposals.length === 0) {
      findings.push(finding("blocking", "missing_field_proposals", "field proposals are required"));
    }
    const excluded = new Set(schemaDecision.excludedFields.map((f) => f.field));
    const missing = REQUIRED_FORBIDDEN_FIELDS.filter((field) => !excluded.has(field));
    if (missing.length > 0) {
      findings.push(
        finding(
          "blocking",
          "missing_forbidden_field",
          `missing forbidden excluded fields: ${missing.join(", ")}`,
        ),
      );
    }
    return;
  }

  findings.push(finding("info", "separate_pr_required", "schema/migration requires a separate PR"));
  findings.push(finding("info", "forbidden_fields_excluded", "forbidden fields are excluded from schema proposal"));
  findings.push(finding("info", "summary_only_storage_required", "summary-only storage is required"));

  if (input.isReady) {
    findings.push(finding("info", "schema_model_candidate_generated", "Prisma model draft candidate is generated"));
  }

  findings.push(finding("warning", "migration_required", "migration will be required in a separate PR"));
  findings.push(finding("warning", "retention_policy_required", "retention policy review is required"));
  findings.push(finding("warning", "access_control_review_required", "access control review is required"));
  findings.push(
    finding(
      "warning",
      "write_path_disabled_until_schema_applied",
      "write path remains disabled until schema and migration are applied",
    ),
  );

  if (decision === "defer") {
    findings.push(
      finding("warning", "schema_pr_deferred", "schema PR readiness defers until prerequisites are satisfied"),
    );
  }
}

/** Read-only schema PR readiness — does not modify schema.prisma, create migrations, or write data. */
export function evaluateAgentExecutionRecordSchemaPrReadiness(input?: {
  readonly target?: string;
}): AgentExecutionRecordSchemaPrReadinessReport {
  const target = normalizeAgentExecutionRecordSchemaTarget(input?.target);
  const schemaDecision = evaluateAgentExecutionRecordSchemaDecision({ target });
  const decision = resolvePrReadinessDecision({ schemaDecision });
  const isReady = decision === "ready_for_schema_pr_plan";
  const isBlocked = decision === "blocked";

  const modelCandidates = buildModelCandidates({ decision, schemaDecision });

  const migrationChecklist = buildStaticChecklist(
    MIGRATION_CHECKLIST_ITEMS,
    !isBlocked,
    "migration PR prerequisite documented",
    "migration checklist not applicable while blocked",
  );

  const rollbackChecklist = buildStaticChecklist(
    ROLLBACK_CHECKLIST_ITEMS,
    !isBlocked,
    "rollback plan prerequisite documented",
    "rollback checklist not applicable while blocked",
  );

  const retentionAccessChecklist = buildStaticChecklist(
    RETENTION_ACCESS_ITEMS,
    !isBlocked,
    "retention/access prerequisite documented",
    "retention/access checklist not applicable while blocked",
  );

  const forbiddenFieldChecklist = buildForbiddenFieldChecklist(schemaDecision.excludedFields);

  const findings: AgentExecutionRecordSchemaPrFinding[] = [];
  appendPrReadinessFindings({ findings, decision, schemaDecision, isReady });

  return {
    mode: "read_only_agent_execution_record_schema_pr_readiness",
    decision,
    target,
    sourceSchemaDecision: schemaDecision.decision,
    sourceProposedTableName: schemaDecision.proposedTableName,
    sourceRequiresPrismaSchemaChange: schemaDecision.requiresPrismaSchemaChange,
    sourceRequiresMigration: schemaDecision.requiresMigration,
    modelCandidates,
    migrationChecklist,
    rollbackChecklist,
    retentionAccessChecklist,
    forbiddenFieldChecklist,
    requiresSeparatePr: true,
    modifiesSchemaInThisStep: false,
    createsMigrationInThisStep: false,
    writesDataInThisStep: false,
    findings,
  };
}
