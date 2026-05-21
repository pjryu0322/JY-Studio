/**
 * Evaluate Agent execution record schema/migration PR final approval package (read-only; no schema/migration/DB wire).
 */

import { evaluateAgentExecutionRecordSchemaPrReadiness } from "@/lib/agents/evaluateAgentExecutionRecordSchemaPrReadiness";
import type {
  AgentExecutionRecordSchemaPrApprovalChecklistItem,
  AgentExecutionRecordSchemaPrApprovalDecision,
  AgentExecutionRecordSchemaPrApprovalFinding,
  AgentExecutionRecordSchemaPrApprovalPackageReport,
} from "@/lib/agents/agentExecutionRecordSchemaPrApprovalPackageTypes";
import type { AgentExecutionRecordSchemaPrChecklistItem } from "@/lib/agents/agentExecutionRecordSchemaPrReadinessTypes";
import {
  buildSchemaPrApprovalChecklist,
  detectForbiddenModelDraftInCandidates,
  resolveSchemaPrApprovalDecision,
  shouldReportModelDraftMissing,
} from "@/lib/agents/schemaPrReadinessShared";

const APPROVAL_CHECKLIST_ITEMS = [
  "schema readiness ready",
  "explicit user approval confirmed",
  "model draft available",
  "forbidden fields excluded",
  "migration checklist reviewed",
  "rollback checklist reviewed",
  "retention/access checklist reviewed",
  "separate PR required",
  "no schema modification in this step",
  "no migration creation in this step",
  "no DB write in this step",
] as const;

function finding(
  severity: AgentExecutionRecordSchemaPrApprovalFinding["severity"],
  code: string,
  message: string,
): AgentExecutionRecordSchemaPrApprovalFinding {
  return { severity, code, message };
}

function mapReadinessChecklist(
  items: readonly AgentExecutionRecordSchemaPrChecklistItem[],
): AgentExecutionRecordSchemaPrApprovalChecklistItem[] {
  return items.map((item) => ({
    item: item.item,
    satisfied: item.satisfied,
    reason: item.reason,
  }));
}

function appendApprovalFindings(input: {
  readonly findings: AgentExecutionRecordSchemaPrApprovalFinding[];
  readonly decision: AgentExecutionRecordSchemaPrApprovalDecision;
  readonly readiness: ReturnType<typeof evaluateAgentExecutionRecordSchemaPrReadiness>;
  readonly explicitUserApproval: boolean;
  readonly modelDraft: string;
  readonly forbiddenDraftDetected: boolean;
}): void {
  const { findings, decision, readiness, explicitUserApproval, forbiddenDraftDetected } = input;

  findings.push(
    finding(
      "info",
      "schema_pr_approval_package_read_only",
      "schema PR approval package is read-only; no schema/migration wire",
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
    findings.push(finding("blocking", "schema_pr_approval_blocked", "schema PR approval is blocked"));
    if (readiness.decision === "blocked") {
      findings.push(finding("blocking", "source_readiness_blocked", "source schema PR readiness is blocked"));
    }
    if (
      shouldReportModelDraftMissing({
        decision,
        readinessDecision: readiness.decision,
        modelDraft: input.modelDraft,
        forbiddenDraftDetected,
      })
    ) {
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
        finding("warning", "explicit_schema_pr_approval_missing", "explicit schema PR approval is required"),
      );
    }
    findings.push(
      finding("warning", "schema_pr_approval_deferred", "schema PR approval defers until prerequisites are met"),
    );
    return;
  }

  findings.push(
    finding("info", "explicit_schema_pr_approval_confirmed", "explicit schema PR approval flag is set"),
  );
  findings.push(finding("info", "schema_pr_package_ready", "schema PR approval package is ready for separate PR work"));
}

/** Read-only schema PR approval package — does not modify schema.prisma, create migrations, or write data. */
export function evaluateAgentExecutionRecordSchemaPrApprovalPackage(input?: {
  readonly target?: string;
  readonly explicitUserApproval?: boolean;
}): AgentExecutionRecordSchemaPrApprovalPackageReport {
  const readiness = evaluateAgentExecutionRecordSchemaPrReadiness({
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

  const readinessReady = readiness.decision === "ready_for_schema_pr_plan";
  const approvalChecklist = buildSchemaPrApprovalChecklist(APPROVAL_CHECKLIST_ITEMS, {
    readinessReady,
    explicitUserApproval,
    modelDraftAvailable: shouldExposeDraft && readiness.modelCandidates.length > 0,
    forbiddenFieldsExcluded: readiness.forbiddenFieldChecklist.every((item) => item.satisfied),
    migrationChecklistReviewed: readiness.migrationChecklist.length > 0,
    rollbackChecklistReviewed: readiness.rollbackChecklist.length > 0,
    extraReviewed: [
      {
        item: "retention/access checklist reviewed",
        satisfied: readiness.retentionAccessChecklist.length > 0,
      },
    ],
  });

  const migrationChecklist = mapReadinessChecklist(readiness.migrationChecklist);
  const rollbackChecklist = mapReadinessChecklist(readiness.rollbackChecklist);
  const retentionAccessChecklist = mapReadinessChecklist(readiness.retentionAccessChecklist);
  const forbiddenFieldChecklist = mapReadinessChecklist(readiness.forbiddenFieldChecklist);

  const findings: AgentExecutionRecordSchemaPrApprovalFinding[] = [];
  appendApprovalFindings({
    findings,
    decision,
    readiness,
    explicitUserApproval,
    modelDraft,
    forbiddenDraftDetected,
  });

  return {
    mode: "read_only_agent_execution_record_schema_pr_approval_package",
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
    retentionAccessChecklist,
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
