/**
 * Evaluate Operator approval/audit schema/migration PR readiness (read-only; no schema/migration/DB wire).
 */

import {
  evaluateOperatorApprovalAuditSchemaDecision,
  normalizeOperatorApprovalAuditSchemaTarget,
} from "@/lib/agents/evaluateOperatorApprovalAuditSchemaDecision";
import type {
  OperatorApprovalAuditSchemaDecision,
  OperatorApprovalAuditSchemaDecisionReport,
  OperatorApprovalAuditSchemaFieldProposal,
} from "@/lib/agents/operatorApprovalAuditSchemaDecisionTypes";
import type {
  OperatorApprovalAuditSchemaPrChecklistItem,
  OperatorApprovalAuditSchemaPrFinding,
  OperatorApprovalAuditSchemaPrModelCandidate,
  OperatorApprovalAuditSchemaPrReadinessDecision,
  OperatorApprovalAuditSchemaPrReadinessReport,
} from "@/lib/agents/operatorApprovalAuditSchemaPrReadinessTypes";
import {
  buildSchemaPrForbiddenFieldChecklist,
  buildSchemaPrModelDraft,
  buildSchemaPrStaticChecklist,
  modelDraftContainsForbiddenFields,
} from "@/lib/agents/schemaPrReadinessShared";

const MODEL_CAUTION = "read-only schema draft; do not apply without separate PR approval";

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

const FORBIDDEN_IN_MODEL_DRAFT = [...REQUIRED_FORBIDDEN_FIELDS] as const;

const REQUIRED_PERMISSION_FIELDS = ["actorId", "actorRole", "decision", "actionType"] as const;

const REQUIRED_AUDIT_INTEGRITY_FIELDS = [
  "auditEventId",
  "actorId",
  "targetType",
  "targetId",
  "reasonSummary",
  "createdAt",
] as const;

const MIGRATION_CHECKLIST_ITEMS = [
  "separate PR required",
  "schema owner review required",
  "permission model review required",
  "audit integrity review required",
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
  "permission guard failure stops write",
  "audit integrity guard failure stops write",
  "data cleanup plan required",
] as const;

const PERMISSION_ACCESS_ITEMS = [
  "operator role required",
  "approval authority required",
  "override authority reviewed",
  "audit read/write authority reviewed",
  "project scoped permission required",
] as const;

const AUDIT_INTEGRITY_ITEMS = [
  "audit event append-only policy required",
  "actor identity required",
  "target reference required",
  "decision reason summary required",
  "audit timestamp immutable",
] as const;

function finding(
  severity: OperatorApprovalAuditSchemaPrFinding["severity"],
  code: string,
  message: string,
): OperatorApprovalAuditSchemaPrFinding {
  return { severity, code, message };
}

export function modelDraftContainsForbiddenField(modelDraft: string): boolean {
  return modelDraftContainsForbiddenFields(modelDraft, FORBIDDEN_IN_MODEL_DRAFT);
}

function mapSchemaDecisionToPrReadiness(
  schemaDecision: OperatorApprovalAuditSchemaDecision,
): OperatorApprovalAuditSchemaPrReadinessDecision {
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

function fieldProposalsInclude(
  fieldProposals: readonly OperatorApprovalAuditSchemaFieldProposal[],
  requiredFields: readonly string[],
): boolean {
  const present = new Set(fieldProposals.map((f) => f.field));
  return requiredFields.every((field) => present.has(field));
}

function resolvePrReadinessDecision(input: {
  readonly schemaDecision: OperatorApprovalAuditSchemaDecisionReport;
  readonly modelCandidates: readonly OperatorApprovalAuditSchemaPrModelCandidate[];
}): OperatorApprovalAuditSchemaPrReadinessDecision {
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
      } else if (!fieldProposalsInclude(input.schemaDecision.fieldProposals, REQUIRED_PERMISSION_FIELDS)) {
        decision = "blocked";
      } else if (
        !fieldProposalsInclude(input.schemaDecision.fieldProposals, REQUIRED_AUDIT_INTEGRITY_FIELDS)
      ) {
        decision = "blocked";
      }
    }
    for (const candidate of input.modelCandidates) {
      if (modelDraftContainsForbiddenField(candidate.modelDraft)) {
        decision = "blocked";
        break;
      }
    }
  }

  return decision;
}

function buildModelCandidates(input: {
  readonly schemaDecision: OperatorApprovalAuditSchemaDecisionReport;
}): OperatorApprovalAuditSchemaPrModelCandidate[] {
  if (!input.schemaDecision.proposedTableName || input.schemaDecision.fieldProposals.length === 0) {
    return [];
  }

  const modelDraft = buildSchemaPrModelDraft(
    input.schemaDecision.proposedTableName,
    input.schemaDecision.fieldProposals,
  );

  return [
    {
      modelName: input.schemaDecision.proposedTableName,
      modelDraft,
      caution: MODEL_CAUTION,
    },
  ];
}

function appendPrReadinessFindings(input: {
  readonly findings: OperatorApprovalAuditSchemaPrFinding[];
  readonly decision: OperatorApprovalAuditSchemaPrReadinessDecision;
  readonly schemaDecision: OperatorApprovalAuditSchemaDecisionReport;
  readonly isReady: boolean;
  readonly modelCandidates: readonly OperatorApprovalAuditSchemaPrModelCandidate[];
}): void {
  const { findings, decision, schemaDecision } = input;

  findings.push(
    finding(
      "info",
      "operator_schema_pr_readiness_read_only",
      "operator schema PR readiness is read-only; no schema/migration wire",
    ),
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
    const missingForbidden = REQUIRED_FORBIDDEN_FIELDS.filter((field) => !excluded.has(field));
    if (missingForbidden.length > 0) {
      findings.push(
        finding(
          "blocking",
          "missing_forbidden_field",
          `missing forbidden excluded fields: ${missing.join(", ")}`,
        ),
      );
    }
    if (!fieldProposalsInclude(schemaDecision.fieldProposals, REQUIRED_PERMISSION_FIELDS)) {
      findings.push(finding("blocking", "missing_permission_field", "permission guard fields are missing"));
    }
    if (!fieldProposalsInclude(schemaDecision.fieldProposals, REQUIRED_AUDIT_INTEGRITY_FIELDS)) {
      findings.push(
        finding("blocking", "missing_audit_integrity_field", "audit integrity fields are missing"),
      );
    }
    if (input.modelCandidates.some((c) => modelDraftContainsForbiddenField(c.modelDraft))) {
      findings.push(
        finding("blocking", "model_candidate_contains_forbidden_field", "model draft contains forbidden fields"),
      );
    }
    return;
  }

  findings.push(finding("info", "separate_pr_required", "schema/migration requires a separate PR"));
  findings.push(finding("info", "forbidden_fields_excluded", "forbidden fields are excluded from schema proposal"));
  findings.push(
    finding("info", "permission_access_review_required", "permission/access review is required before migration"),
  );
  findings.push(
    finding("info", "audit_integrity_review_required", "audit integrity review is required before migration"),
  );
  findings.push(finding("info", "summary_only_storage_required", "summary-only storage is required"));

  if (input.isReady) {
    findings.push(finding("info", "schema_model_candidate_generated", "Prisma model draft candidate is generated"));
  }

  findings.push(finding("warning", "migration_required", "migration will be required in a separate PR"));
  findings.push(finding("warning", "permission_model_required", "permission model review is required"));
  findings.push(finding("warning", "audit_integrity_policy_required", "audit integrity policy review is required"));
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

/** Read-only operator schema PR readiness — does not modify schema.prisma, create migrations, or write data. */
export function evaluateOperatorApprovalAuditSchemaPrReadiness(input?: {
  readonly target?: string;
}): OperatorApprovalAuditSchemaPrReadinessReport {
  const target = normalizeOperatorApprovalAuditSchemaTarget(input?.target);
  const schemaDecision = evaluateOperatorApprovalAuditSchemaDecision({ target });

  const preliminaryCandidates = buildModelCandidates({ schemaDecision });
  const decision = resolvePrReadinessDecision({ schemaDecision, modelCandidates: preliminaryCandidates });
  const isReady = decision === "ready_for_schema_pr_plan";
  const isBlocked = decision === "blocked";

  const modelCandidates = isReady ? preliminaryCandidates : [];

  const migrationChecklist = buildSchemaPrStaticChecklist(
    MIGRATION_CHECKLIST_ITEMS,
    !isBlocked,
    "migration PR prerequisite documented",
    "migration checklist not applicable while blocked",
  );

  const rollbackChecklist = buildSchemaPrStaticChecklist(
    ROLLBACK_CHECKLIST_ITEMS,
    !isBlocked,
    "rollback plan prerequisite documented",
    "rollback checklist not applicable while blocked",
  );

  const permissionAccessChecklist = buildSchemaPrStaticChecklist(
    PERMISSION_ACCESS_ITEMS,
    !isBlocked,
    "permission/access prerequisite documented",
    "permission/access checklist not applicable while blocked",
  );

  const auditIntegrityChecklist = buildSchemaPrStaticChecklist(
    AUDIT_INTEGRITY_ITEMS,
    !isBlocked,
    "audit integrity prerequisite documented",
    "audit integrity checklist not applicable while blocked",
  );

  const forbiddenFieldChecklist = buildSchemaPrForbiddenFieldChecklist(
    schemaDecision.excludedFields,
    REQUIRED_FORBIDDEN_FIELDS,
  ) as OperatorApprovalAuditSchemaPrChecklistItem[];
  const sourceForbiddenFieldNames = REQUIRED_FORBIDDEN_FIELDS.filter((field) =>
    schemaDecision.excludedFields.some((f) => f.field === field),
  );

  const findings: OperatorApprovalAuditSchemaPrFinding[] = [];
  appendPrReadinessFindings({
    findings,
    decision,
    schemaDecision,
    isReady,
    modelCandidates: isReady ? modelCandidates : preliminaryCandidates,
  });

  return {
    mode: "read_only_operator_approval_audit_schema_pr_readiness",
    decision,
    target,
    sourceSchemaDecision: schemaDecision.decision,
    sourceProposedTableName: schemaDecision.proposedTableName,
    sourceRequiresPrismaSchemaChange: schemaDecision.requiresPrismaSchemaChange,
    sourceRequiresMigration: schemaDecision.requiresMigration,
    sourceFieldProposalCount: schemaDecision.fieldProposals.length,
    sourceExcludedFieldCount: schemaDecision.excludedFields.length,
    sourceForbiddenFieldNames,
    modelCandidates,
    migrationChecklist,
    rollbackChecklist,
    permissionAccessChecklist,
    auditIntegrityChecklist,
    forbiddenFieldChecklist,
    requiresSeparatePr: true,
    modifiesSchemaInThisStep: false,
    createsMigrationInThisStep: false,
    writesDataInThisStep: false,
    findings,
  };
}
