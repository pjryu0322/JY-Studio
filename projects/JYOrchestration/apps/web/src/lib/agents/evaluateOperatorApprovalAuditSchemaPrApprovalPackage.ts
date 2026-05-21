/**
 * Evaluate Operator approval/audit schema/migration PR final approval package (read-only; no schema/migration/DB wire).
 */

import { evaluateOperatorApprovalAuditSchemaPrReadiness } from "@/lib/agents/evaluateOperatorApprovalAuditSchemaPrReadiness";
import type {
  OperatorApprovalAuditSchemaPrApprovalChecklistItem,
  OperatorApprovalAuditSchemaPrApprovalDecision,
  OperatorApprovalAuditSchemaPrApprovalFinding,
  OperatorApprovalAuditSchemaPrApprovalPackageReport,
} from "@/lib/agents/operatorApprovalAuditSchemaPrApprovalPackageTypes";
import type { OperatorApprovalAuditSchemaPrChecklistItem } from "@/lib/agents/operatorApprovalAuditSchemaPrReadinessTypes";
import {
  detectForbiddenModelDraftInCandidates,
  resolveSchemaPrApprovalDecision,
} from "@/lib/agents/schemaPrReadinessShared";

const APPROVAL_CHECKLIST_ITEMS = [
  "schema readiness ready",
  "explicit user approval confirmed",
  "model draft available",
  "forbidden fields excluded",
  "migration checklist reviewed",
  "rollback checklist reviewed",
  "permission/access checklist reviewed",
  "audit integrity checklist reviewed",
  "separate PR required",
  "no schema modification in this step",
  "no migration creation in this step",
  "no DB write in this step",
] as const;

function finding(
  severity: OperatorApprovalAuditSchemaPrApprovalFinding["severity"],
  code: string,
  message: string,
): OperatorApprovalAuditSchemaPrApprovalFinding {
  return { severity, code, message };
}

function mapReadinessChecklist(
  items: readonly OperatorApprovalAuditSchemaPrChecklistItem[],
): OperatorApprovalAuditSchemaPrApprovalChecklistItem[] {
  return items.map((item) => ({
    item: item.item,
    satisfied: item.satisfied,
    reason: item.reason,
  }));
}

function buildApprovalChecklist(input: {
  readonly readiness: ReturnType<typeof evaluateOperatorApprovalAuditSchemaPrReadiness>;
  readonly explicitUserApproval: boolean;
}): OperatorApprovalAuditSchemaPrApprovalChecklistItem[] {
  const readinessReady = input.readiness.decision === "ready_for_schema_pr_plan";
  const shouldExposeDraft = readinessReady;
  const modelDraftAvailable = shouldExposeDraft && input.readiness.modelCandidates.length > 0;
  const forbiddenExcluded = input.readiness.forbiddenFieldChecklist.every((item) => item.satisfied);

  const satisfaction: Record<string, boolean> = {
    "schema readiness ready": readinessReady,
    "explicit user approval confirmed": input.explicitUserApproval,
    "model draft available": modelDraftAvailable,
    "forbidden fields excluded": forbiddenExcluded,
    "migration checklist reviewed": input.readiness.migrationChecklist.length > 0,
    "rollback checklist reviewed": input.readiness.rollbackChecklist.length > 0,
    "permission/access checklist reviewed": input.readiness.permissionAccessChecklist.length > 0,
    "audit integrity checklist reviewed": input.readiness.auditIntegrityChecklist.length > 0,
    "separate PR required": true,
    "no schema modification in this step": true,
    "no migration creation in this step": true,
    "no DB write in this step": true,
  };

  return APPROVAL_CHECKLIST_ITEMS.map((item) => ({
    item,
    satisfied: satisfaction[item] ?? false,
    reason: (satisfaction[item] ?? false)
      ? `${item} satisfied`
      : `${item} not satisfied`,
  }));
}

function appendApprovalFindings(input: {
  readonly findings: OperatorApprovalAuditSchemaPrApprovalFinding[];
  readonly decision: OperatorApprovalAuditSchemaPrApprovalDecision;
  readonly readiness: ReturnType<typeof evaluateOperatorApprovalAuditSchemaPrReadiness>;
  readonly explicitUserApproval: boolean;
  readonly modelDraft: string;
  readonly forbiddenDraftDetected: boolean;
}): void {
  const { findings, decision, readiness, explicitUserApproval, modelDraft, forbiddenDraftDetected } =
    input;

  findings.push(
    finding(
      "info",
      "operator_schema_pr_approval_package_read_only",
      "operator schema PR approval package is read-only; no schema/migration wire",
    ),
  );
  findings.push(finding("info", "separate_pr_required", "schema/migration requires a separate PR"));
  findings.push(finding("info", "no_schema_modification_in_this_step", "schema.prisma is not modified in this step"));
  findings.push(finding("info", "no_migration_created_in_this_step", "migration is not created in this step"));
  findings.push(finding("info", "no_data_write_in_this_step", "DB write is not implemented in this step"));

  if (forbiddenDraftDetected) {
    findings.push(
      finding(
        "blocking",
        "approval_package_model_draft_contains_forbidden_field",
        "approval package model draft contains forbidden fields",
      ),
    );
  }

  if (decision === "blocked") {
    findings.push(finding("blocking", "operator_schema_pr_approval_blocked", "operator schema PR approval is blocked"));
    if (readiness.decision === "blocked") {
      findings.push(finding("blocking", "source_readiness_blocked", "source schema PR readiness is blocked"));
    }
    if (!modelDraft.trim()) {
      findings.push(finding("blocking", "model_draft_missing", "model draft is missing"));
    }
    if (!readiness.forbiddenFieldChecklist.every((item) => item.satisfied)) {
      findings.push(
        finding("blocking", "forbidden_field_policy_incomplete", "forbidden field policy is incomplete"),
      );
    }
    return;
  }

  if (decision === "defer") {
    if (readiness.decision === "ready_for_schema_pr_plan" && !explicitUserApproval) {
      findings.push(
        finding(
          "warning",
          "explicit_operator_schema_pr_approval_missing",
          "explicit operator schema PR approval is required",
        ),
      );
    }
    findings.push(
      finding("warning", "operator_schema_pr_approval_deferred", "operator schema PR approval defers until prerequisites are met"),
    );
    return;
  }

  findings.push(
    finding("info", "explicit_operator_schema_pr_approval_confirmed", "explicit operator schema PR approval flag is set"),
  );
  findings.push(
    finding("info", "operator_schema_pr_package_ready", "operator schema PR approval package is ready for separate PR work"),
  );
}

/** Read-only operator schema PR approval package — does not modify schema.prisma, create migrations, or write data. */
export function evaluateOperatorApprovalAuditSchemaPrApprovalPackage(input?: {
  readonly target?: string;
  readonly explicitUserApproval?: boolean;
}): OperatorApprovalAuditSchemaPrApprovalPackageReport {
  const readiness = evaluateOperatorApprovalAuditSchemaPrReadiness({
    target: input?.target,
  });
  const explicitUserApproval = input?.explicitUserApproval === true;

  const shouldExposeDraft = readiness.decision === "ready_for_schema_pr_plan";
  const primaryCandidate = shouldExposeDraft ? readiness.modelCandidates[0] : undefined;
  const modelDraft = primaryCandidate?.modelDraft ?? "";
  const modelName = shouldExposeDraft
    ? (primaryCandidate?.modelName ?? readiness.sourceProposedTableName)
    : "";

  const forbiddenDraftDetected = detectForbiddenModelDraftInCandidates({
    modelCandidates: readiness.modelCandidates,
    forbiddenFieldNames: readiness.sourceForbiddenFieldNames,
  });

  const decision = resolveSchemaPrApprovalDecision({
    readinessDecision: readiness.decision,
    explicitUserApproval,
    forbiddenDraftDetected,
  });

  const approvalChecklist = buildApprovalChecklist({ readiness, explicitUserApproval });
  const migrationChecklist = mapReadinessChecklist(readiness.migrationChecklist);
  const rollbackChecklist = mapReadinessChecklist(readiness.rollbackChecklist);
  const permissionAccessChecklist = mapReadinessChecklist(readiness.permissionAccessChecklist);
  const auditIntegrityChecklist = mapReadinessChecklist(readiness.auditIntegrityChecklist);
  const forbiddenFieldChecklist = mapReadinessChecklist(readiness.forbiddenFieldChecklist);

  const findings: OperatorApprovalAuditSchemaPrApprovalFinding[] = [];
  appendApprovalFindings({
    findings,
    decision,
    readiness,
    explicitUserApproval,
    modelDraft,
    forbiddenDraftDetected,
  });

  return {
    mode: "read_only_operator_approval_audit_schema_pr_approval_package",
    decision,
    target: readiness.target,
    sourceReadinessDecision: readiness.decision,
    sourceSchemaDecision: readiness.sourceSchemaDecision,
    sourceProposedTableName: readiness.sourceProposedTableName,
    sourceRequiresPrismaSchemaChange: readiness.sourceRequiresPrismaSchemaChange,
    sourceRequiresMigration: readiness.sourceRequiresMigration,
    sourceFieldProposalCount: readiness.sourceFieldProposalCount,
    sourceExcludedFieldCount: readiness.sourceExcludedFieldCount,
    sourceForbiddenFieldNames: [...readiness.sourceForbiddenFieldNames],
    modelDraft,
    modelName,
    approvalChecklist,
    migrationChecklist,
    rollbackChecklist,
    permissionAccessChecklist,
    auditIntegrityChecklist,
    forbiddenFieldChecklist,
    requiresExplicitUserApproval: true,
    explicitUserApprovalProvided: explicitUserApproval,
    requiresSeparatePr: true,
    modifiesSchemaInThisStep: false,
    createsMigrationInThisStep: false,
    writesDataInThisStep: false,
    findings,
  };
}
