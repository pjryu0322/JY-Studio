/**
 * Evaluate Stage 4 integrated closure verdict (read-only; no runtime/routing/execution path/DB/git changes).
 */

import { checklistCounts } from "@/lib/agents/agentFieldDecisionUtils";
import { evaluateRuntimeWireExperimentReviewPackage } from "@/lib/agents/evaluateRuntimeWireExperimentReviewPackage";
import type {
  Stage4IntegratedClosureChecklistItem,
  Stage4IntegratedClosureFinding,
  Stage4IntegratedClosureVerdictDecision,
  Stage4IntegratedClosureVerdictReport,
} from "@/lib/agents/stage4IntegratedClosureVerdictTypes";

const REVIEW_PACKAGE_READY = "ready_for_stage4_closure_verdict";
const CLOSURE_VERSION = "stage_4_f_v1" as const;
const CLOSURE_TITLE = "Stage 4 Integrated Closure Verdict (Read-Only)";

const RECOMMENDED_NEXT_ACTIONS = [
  "prepare_connector_gateway_experiment_branch_followup",
  "prepare_agent_execution_record_schema_pr_followup",
  "prepare_operator_approval_audit_schema_pr_followup",
  "prepare_runtime_execution_write_path_design_followup",
  "continue_stage5_runtime_execution_design_after_separate_approvals",
] as const;

const SEPARATED_WORK_ITEMS = [
  "actual_git_branch_creation",
  "actual_connector_gateway_routing_change",
  "actual_feature_flag_wire",
  "actual_agent_execution_record_schema_migration",
  "actual_operator_approval_audit_schema_migration",
  "actual_runtime_execution_write_path_wire",
] as const;

type Stage4IntegratedClosureVerdictInput = Parameters<typeof evaluateRuntimeWireExperimentReviewPackage>[0] & {
  readonly stage4ReadOnlyScopeConfirmed?: boolean;
  readonly stage4NoRuntimeExecutionConfirmed?: boolean;
  readonly stage4NoRoutingChangeConfirmed?: boolean;
  readonly stage4NoDbSchemaChangeConfirmed?: boolean;
  readonly stage4HandoffPlanConfirmed?: boolean;
};

type ChecklistEntry = {
  readonly item: string;
  readonly satisfied: boolean;
  readonly detail: string;
};

function resolveClosureConfirmationFlags(input?: Stage4IntegratedClosureVerdictInput) {
  return {
    stage4ReadOnlyScopeConfirmed: input?.stage4ReadOnlyScopeConfirmed === true,
    stage4NoRuntimeExecutionConfirmed: input?.stage4NoRuntimeExecutionConfirmed === true,
    stage4NoRoutingChangeConfirmed: input?.stage4NoRoutingChangeConfirmed === true,
    stage4NoDbSchemaChangeConfirmed: input?.stage4NoDbSchemaChangeConfirmed === true,
    stage4HandoffPlanConfirmed: input?.stage4HandoffPlanConfirmed === true,
  };
}

function finding(
  severity: Stage4IntegratedClosureFinding["severity"],
  code: string,
  message: string,
): Stage4IntegratedClosureFinding {
  return { severity, code, message };
}

function checklistReason(input: ChecklistEntry): string {
  return `${input.item}: ${input.satisfied ? "satisfied" : "not satisfied"} — ${input.detail}`;
}

function mapChecklistEntries(entries: readonly ChecklistEntry[]): Stage4IntegratedClosureChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied,
    reason: checklistReason(entry),
  }));
}

/** Deterministic Stage 4-F closure fingerprint. */
export function buildStage4IntegratedClosureFingerprint(input: {
  readonly sourceReviewPackageDecision: string;
  readonly sourceReviewPackageFingerprint: string;
  readonly sourceNoRunChecklistCount: number;
  readonly sourceNoRunChecklistSatisfiedCount: number;
  readonly stage4ReadOnlyScopeConfirmed: boolean;
  readonly stage4NoRuntimeExecutionConfirmed: boolean;
  readonly stage4NoRoutingChangeConfirmed: boolean;
  readonly stage4NoDbSchemaChangeConfirmed: boolean;
  readonly stage4HandoffPlanConfirmed: boolean;
}): string {
  return [
    "stage4-integrated-closure-v1",
    input.sourceReviewPackageDecision,
    input.sourceReviewPackageFingerprint,
    `norun-${input.sourceNoRunChecklistCount}-${input.sourceNoRunChecklistSatisfiedCount}`,
    `scope-${input.stage4ReadOnlyScopeConfirmed}`,
    `runtime-${input.stage4NoRuntimeExecutionConfirmed}`,
    `routing-${input.stage4NoRoutingChangeConfirmed}`,
    `db-${input.stage4NoDbSchemaChangeConfirmed}`,
    `handoff-${input.stage4HandoffPlanConfirmed}`,
  ].join(":");
}

export type Stage4IntegratedClosureVerdictDecisionInput = {
  readonly sourceReviewPackageDecision: string;
  readonly sourceNoRunChecklistCount: number;
  readonly sourceNoRunChecklistSatisfiedCount: number;
  readonly stage4ReadOnlyScopeConfirmed: boolean;
  readonly stage4NoRuntimeExecutionConfirmed: boolean;
  readonly stage4NoRoutingChangeConfirmed: boolean;
  readonly stage4NoDbSchemaChangeConfirmed: boolean;
  readonly stage4HandoffPlanConfirmed: boolean;
};

/** Pure decision helper for Stage 4 integrated closure verdict. */
export function resolveStage4IntegratedClosureVerdictDecision(
  input: Stage4IntegratedClosureVerdictDecisionInput,
): Stage4IntegratedClosureVerdictDecision {
  if (input.sourceReviewPackageDecision === "blocked") {
    return "blocked";
  }

  if (input.sourceReviewPackageDecision !== REVIEW_PACKAGE_READY) {
    return "defer";
  }

  if (input.sourceNoRunChecklistSatisfiedCount !== input.sourceNoRunChecklistCount) {
    return "blocked";
  }

  const closureConfirmationsSatisfied =
    input.stage4ReadOnlyScopeConfirmed &&
    input.stage4NoRuntimeExecutionConfirmed &&
    input.stage4NoRoutingChangeConfirmed &&
    input.stage4NoDbSchemaChangeConfirmed &&
    input.stage4HandoffPlanConfirmed;

  if (!closureConfirmationsSatisfied) {
    return "defer";
  }

  return "stage4_closure_ready";
}

function buildClosureSummary(decision: Stage4IntegratedClosureVerdictDecision): string {
  if (decision === "blocked") {
    return "Stage 4 integrated closure is blocked; source review package or no-run policy failed.";
  }

  if (decision === "defer") {
    return "Stage 4 integrated closure defers; closure confirmations are incomplete.";
  }

  return "Stage 4 read-only design and review packages meet closure criteria. This is not runtime execution permission.";
}

function buildClosureChecklist(input: {
  readonly reviewPackage: ReturnType<typeof evaluateRuntimeWireExperimentReviewPackage>;
  readonly stage4ReadOnlyScopeConfirmed: boolean;
  readonly stage4NoRuntimeExecutionConfirmed: boolean;
  readonly stage4NoRoutingChangeConfirmed: boolean;
  readonly stage4NoDbSchemaChangeConfirmed: boolean;
  readonly stage4HandoffPlanConfirmed: boolean;
}): Stage4IntegratedClosureChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "source review package ready",
      satisfied: input.reviewPackage.decision === REVIEW_PACKAGE_READY,
      detail: `sourceReviewPackageDecision=${input.reviewPackage.decision}`,
    },
    {
      item: "stage4ReadOnlyScopeConfirmed",
      satisfied: input.stage4ReadOnlyScopeConfirmed,
      detail: `stage4ReadOnlyScopeConfirmed=${input.stage4ReadOnlyScopeConfirmed}`,
    },
    {
      item: "stage4NoRuntimeExecutionConfirmed",
      satisfied: input.stage4NoRuntimeExecutionConfirmed,
      detail: `stage4NoRuntimeExecutionConfirmed=${input.stage4NoRuntimeExecutionConfirmed}`,
    },
    {
      item: "stage4NoRoutingChangeConfirmed",
      satisfied: input.stage4NoRoutingChangeConfirmed,
      detail: `stage4NoRoutingChangeConfirmed=${input.stage4NoRoutingChangeConfirmed}`,
    },
    {
      item: "stage4NoDbSchemaChangeConfirmed",
      satisfied: input.stage4NoDbSchemaChangeConfirmed,
      detail: `stage4NoDbSchemaChangeConfirmed=${input.stage4NoDbSchemaChangeConfirmed}`,
    },
    {
      item: "stage4HandoffPlanConfirmed",
      satisfied: input.stage4HandoffPlanConfirmed,
      detail: `stage4HandoffPlanConfirmed=${input.stage4HandoffPlanConfirmed}`,
    },
  ]);
}

function buildNoRunChecklist(): Stage4IntegratedClosureChecklistItem[] {
  return mapChecklistEntries([
    { item: "executesRuntimeInThisStep=false", satisfied: true, detail: "executesRuntimeInThisStep=false" },
    {
      item: "changesExecutionPathInThisStep=false",
      satisfied: true,
      detail: "changesExecutionPathInThisStep=false",
    },
    {
      item: "changesConnectorRoutingInThisStep=false",
      satisfied: true,
      detail: "changesConnectorRoutingInThisStep=false",
    },
    { item: "callsConnectorInThisStep=false", satisfied: true, detail: "callsConnectorInThisStep=false" },
    { item: "callsCursorInThisStep=false", satisfied: true, detail: "callsCursorInThisStep=false" },
    { item: "callsGitHubInThisStep=false", satisfied: true, detail: "callsGitHubInThisStep=false" },
    { item: "createsPullRequestInThisStep=false", satisfied: true, detail: "createsPullRequestInThisStep=false" },
    { item: "executesGitInThisStep=false", satisfied: true, detail: "executesGitInThisStep=false" },
    { item: "createsBranchInThisStep=false", satisfied: true, detail: "createsBranchInThisStep=false" },
    { item: "wiresWritePathInThisStep=false", satisfied: true, detail: "wiresWritePathInThisStep=false" },
    { item: "wiresFeatureFlagInThisStep=false", satisfied: true, detail: "wiresFeatureFlagInThisStep=false" },
    { item: "writesDataInThisStep=false", satisfied: true, detail: "writesDataInThisStep=false" },
    { item: "callsPrismaInThisStep=false", satisfied: true, detail: "callsPrismaInThisStep=false" },
    { item: "modifiesSchemaInThisStep=false", satisfied: true, detail: "modifiesSchemaInThisStep=false" },
    { item: "createsMigrationInThisStep=false", satisfied: true, detail: "createsMigrationInThisStep=false" },
  ]);
}

function buildHandoffChecklist(): Stage4IntegratedClosureChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "prepare_connector_gateway_experiment_branch_followup",
      satisfied: true,
      detail: "Follow-up only; not executed in Stage 4-F",
    },
    {
      item: "prepare_agent_execution_record_schema_pr_followup",
      satisfied: true,
      detail: "Follow-up only; not executed in Stage 4-F",
    },
    {
      item: "prepare_operator_approval_audit_schema_pr_followup",
      satisfied: true,
      detail: "Follow-up only; not executed in Stage 4-F",
    },
    {
      item: "prepare_runtime_execution_write_path_design_followup",
      satisfied: true,
      detail: "Follow-up only; not executed in Stage 4-F",
    },
    {
      item: "prepare_feature_flag_wire_followup",
      satisfied: true,
      detail: "Follow-up only; not executed in Stage 4-F",
    },
  ]);
}

function buildRiskChecklist(): Stage4IntegratedClosureChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "runtime execution remains disabled in this step",
      satisfied: true,
      detail: "executesRuntimeInThisStep=false",
    },
    {
      item: "connector routing remains unchanged in this step",
      satisfied: true,
      detail: "changesConnectorRoutingInThisStep=false",
    },
    {
      item: "schema and migration remain unchanged in this step",
      satisfied: true,
      detail: "modifiesSchemaInThisStep=false; createsMigrationInThisStep=false",
    },
    {
      item: "git and branch execution remain disabled in this step",
      satisfied: true,
      detail: "executesGitInThisStep=false; createsBranchInThisStep=false",
    },
    {
      item: "feature flag wire remains disabled in this step",
      satisfied: true,
      detail: "wiresFeatureFlagInThisStep=false",
    },
  ]);
}

const STAGE4_INTEGRATED_CLOSURE_NO_RUN_REPORT = {
  executesRuntimeInThisStep: false,
  changesExecutionPathInThisStep: false,
  changesConnectorRoutingInThisStep: false,
  callsConnectorInThisStep: false,
  callsCursorInThisStep: false,
  callsGitHubInThisStep: false,
  createsPullRequestInThisStep: false,
  executesGitInThisStep: false,
  createsBranchInThisStep: false,
  wiresWritePathInThisStep: false,
  wiresFeatureFlagInThisStep: false,
  writesDataInThisStep: false,
  callsPrismaInThisStep: false,
  modifiesSchemaInThisStep: false,
  createsMigrationInThisStep: false,
} as const;

function appendStage4IntegratedClosureFindings(input: {
  readonly findings: Stage4IntegratedClosureFinding[];
  readonly decision: Stage4IntegratedClosureVerdictDecision;
  readonly reviewPackage: ReturnType<typeof evaluateRuntimeWireExperimentReviewPackage>;
  readonly stage4ReadOnlyScopeConfirmed: boolean;
  readonly stage4NoRuntimeExecutionConfirmed: boolean;
  readonly stage4NoRoutingChangeConfirmed: boolean;
  readonly stage4NoDbSchemaChangeConfirmed: boolean;
  readonly stage4HandoffPlanConfirmed: boolean;
}): void {
  const { findings, decision, reviewPackage } = input;

  findings.push(
    finding(
      "info",
      "stage4_integrated_closure_verdict_read_only",
      "Stage 4 integrated closure verdict is read-only; no runtime change",
    ),
  );
  findings.push(
    finding("info", "stage4_integrated_closure_verdict_created", "Stage 4 integrated closure verdict created"),
  );

  if (decision === "blocked") {
    if (reviewPackage.decision === "blocked") {
      findings.push(finding("blocking", "source_review_package_blocked", "Source review package is blocked"));
    }
    if (reviewPackage.noRunChecklistSatisfiedCount !== reviewPackage.noRunChecklistCount) {
      findings.push(
        finding("blocking", "stage4_closure_source_no_run_violation", "Source review package no-run checklist is not satisfied"),
      );
    }
    findings.push(finding("blocking", "stage4_integrated_closure_blocked", "Stage 4 integrated closure is blocked"));
    return;
  }

  if (decision === "defer") {
    if (reviewPackage.decision !== REVIEW_PACKAGE_READY) {
      findings.push(finding("warning", "source_review_package_not_ready", "Source review package is not ready"));
    }
    if (!input.stage4ReadOnlyScopeConfirmed) {
      findings.push(
        finding("warning", "stage4_read_only_scope_confirmation_missing", "Stage 4 read-only scope confirmation is missing"),
      );
    }
    if (!input.stage4NoRuntimeExecutionConfirmed) {
      findings.push(
        finding(
          "warning",
          "stage4_no_runtime_execution_confirmation_missing",
          "Stage 4 no-runtime-execution confirmation is missing",
        ),
      );
    }
    if (!input.stage4NoRoutingChangeConfirmed) {
      findings.push(
        finding("warning", "stage4_no_routing_change_confirmation_missing", "Stage 4 no-routing-change confirmation is missing"),
      );
    }
    if (!input.stage4NoDbSchemaChangeConfirmed) {
      findings.push(
        finding(
          "warning",
          "stage4_no_db_schema_change_confirmation_missing",
          "Stage 4 no-DB-schema-change confirmation is missing",
        ),
      );
    }
    if (!input.stage4HandoffPlanConfirmed) {
      findings.push(
        finding("warning", "stage4_handoff_plan_confirmation_missing", "Stage 4 handoff plan confirmation is missing"),
      );
    }
    findings.push(finding("warning", "stage4_integrated_closure_deferred", "Stage 4 integrated closure defers"));
    return;
  }

  findings.push(finding("info", "stage4_integrated_closure_ready", "Stage 4 integrated closure is ready"));
  findings.push(
    finding(
      "info",
      "stage4_closure_ready_not_runtime_permission",
      "Stage 4 closure ready is not runtime execution permission",
    ),
  );
}

/** Read-only Stage 4 integrated closure verdict — does not change runtime or routing. */
export function evaluateStage4IntegratedClosureVerdict(
  input?: Stage4IntegratedClosureVerdictInput,
): Stage4IntegratedClosureVerdictReport {
  const reviewPackage = evaluateRuntimeWireExperimentReviewPackage(input);
  const flags = resolveClosureConfirmationFlags(input);

  const decision = resolveStage4IntegratedClosureVerdictDecision({
    sourceReviewPackageDecision: reviewPackage.decision,
    sourceNoRunChecklistCount: reviewPackage.noRunChecklistCount,
    sourceNoRunChecklistSatisfiedCount: reviewPackage.noRunChecklistSatisfiedCount,
    ...flags,
  });

  const closureFingerprint = buildStage4IntegratedClosureFingerprint({
    sourceReviewPackageDecision: reviewPackage.decision,
    sourceReviewPackageFingerprint: reviewPackage.reviewFingerprint,
    sourceNoRunChecklistCount: reviewPackage.noRunChecklistCount,
    sourceNoRunChecklistSatisfiedCount: reviewPackage.noRunChecklistSatisfiedCount,
    ...flags,
  });

  const findings: Stage4IntegratedClosureFinding[] = [];
  appendStage4IntegratedClosureFindings({
    findings,
    decision,
    reviewPackage,
    ...flags,
  });

  const noRunChecklist = buildNoRunChecklist();
  const noRunCounts = checklistCounts(noRunChecklist);

  return {
    mode: "read_only_stage4_integrated_closure_verdict",
    stage: "stage_4_f",
    decision,
    sourceReviewPackageDecision: reviewPackage.decision,
    sourceReviewPackageFingerprint: reviewPackage.reviewFingerprint,
    sourceReviewPackageSummary: reviewPackage.reviewPackageSummary,
    sourceNoRunChecklistCount: reviewPackage.noRunChecklistCount,
    sourceNoRunChecklistSatisfiedCount: reviewPackage.noRunChecklistSatisfiedCount,
    sourceFindingCodes: reviewPackage.findings.map((f) => f.code),
    closureVersion: CLOSURE_VERSION,
    closureTitle: CLOSURE_TITLE,
    closureSummary: buildClosureSummary(decision),
    closureFingerprint,
    ...flags,
    closureChecklist: buildClosureChecklist({ reviewPackage, ...flags }),
    noRunChecklist,
    handoffChecklist: buildHandoffChecklist(),
    riskChecklist: buildRiskChecklist(),
    noRunChecklistCount: noRunCounts.count,
    noRunChecklistSatisfiedCount: noRunCounts.satisfiedCount,
    recommendedNextActions: [...RECOMMENDED_NEXT_ACTIONS],
    separatedWorkItems: [...SEPARATED_WORK_ITEMS],
    ...STAGE4_INTEGRATED_CLOSURE_NO_RUN_REPORT,
    findings,
  };
}
