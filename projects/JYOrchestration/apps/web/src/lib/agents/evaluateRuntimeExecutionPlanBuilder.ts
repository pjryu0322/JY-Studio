/**
 * Evaluate runtime execution plan builder (read-only; no runtime/routing/write/DB/schema/git/Cursor/GitHub execution).
 */

import { evaluateRuntimeExecutionHandoffCandidate } from "@/lib/agents/evaluateRuntimeExecutionHandoffCandidate";
import type {
  RuntimeExecutionPlanBuilderChecklistItem,
  RuntimeExecutionPlanBuilderDecision,
  RuntimeExecutionPlanBuilderFinding,
  RuntimeExecutionPlanBuilderReport,
  RuntimeExecutionPlanStepCandidate,
  RuntimeExecutionPlanStepKind,
} from "@/lib/agents/runtimeExecutionPlanBuilderTypes";

const HANDOFF_READY = "ready_for_runtime_execution_handoff_design";

type RuntimeExecutionPlanBuilderInput = Parameters<typeof evaluateRuntimeExecutionHandoffCandidate>[0] & {
  readonly finalOperatorConfirmationReady?: boolean;
  readonly rollbackPlanReviewed?: boolean;
  readonly stage1RegressionReviewed?: boolean;
};

type ChecklistEntry = {
  readonly item: string;
  readonly satisfied: boolean;
  readonly detail: string;
};

const PLAN_STEP_SPECS: readonly {
  readonly kind: RuntimeExecutionPlanStepKind;
  readonly title: string;
  readonly required: boolean;
}[] = [
  { kind: "operator_approval", title: "Operator approval gate", required: true },
  { kind: "stage1_regression_check", title: "Stage1/ENV_TEST regression check", required: true },
  { kind: "schema_migration_pr_check", title: "Schema migration PR check", required: true },
  { kind: "operator_audit_schema_pr_check", title: "Operator audit schema PR check", required: true },
  { kind: "connector_experiment_branch_check", title: "Connector experiment branch check", required: true },
  { kind: "feature_flag_check", title: "Feature flag wire check", required: true },
  { kind: "dry_run_execution_plan", title: "Dry-run execution plan", required: true },
  { kind: "rollback_plan_check", title: "Rollback plan check", required: true },
  { kind: "final_operator_confirmation", title: "Final operator confirmation", required: true },
];

function finding(
  severity: RuntimeExecutionPlanBuilderFinding["severity"],
  code: string,
  message: string,
): RuntimeExecutionPlanBuilderFinding {
  return { severity, code, message };
}

function checklistReason(input: ChecklistEntry): string {
  return `${input.item}: ${input.satisfied ? "satisfied" : "not satisfied"} — ${input.detail}`;
}

function mapChecklistEntries(
  entries: readonly ChecklistEntry[],
): RuntimeExecutionPlanBuilderChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied,
    reason: checklistReason(entry),
  }));
}

function resolvePlanBuilderDecision(input: {
  readonly handoffDecision: string;
  readonly finalOperatorConfirmationReady: boolean;
  readonly rollbackPlanReviewed: boolean;
  readonly stage1RegressionReviewed: boolean;
}): RuntimeExecutionPlanBuilderDecision {
  if (input.handoffDecision === "blocked") {
    return "blocked";
  }

  if (input.handoffDecision !== HANDOFF_READY) {
    return "defer";
  }

  if (!input.finalOperatorConfirmationReady) {
    return "defer";
  }

  if (!input.rollbackPlanReviewed) {
    return "defer";
  }

  if (!input.stage1RegressionReviewed) {
    return "defer";
  }

  return "ready_for_runtime_execution_plan_review";
}

function buildPlanSteps(input: {
  readonly operatorAuditReviewConfirmed: boolean;
  readonly stage1RegressionReviewed: boolean;
  readonly schemaPrApproved: boolean;
  readonly operatorAuditSchemaPrApproved: boolean;
  readonly connectorExperimentBranchVerified: boolean;
  readonly featureFlagWireDesignApproved: boolean;
  readonly handoffReady: boolean;
  readonly rollbackPlanReviewed: boolean;
  readonly finalOperatorConfirmationReady: boolean;
}): RuntimeExecutionPlanStepCandidate[] {
  const satisfactionByKind: Record<RuntimeExecutionPlanStepKind, boolean> = {
    operator_approval: input.operatorAuditReviewConfirmed,
    stage1_regression_check: input.stage1RegressionReviewed,
    schema_migration_pr_check: input.schemaPrApproved,
    operator_audit_schema_pr_check: input.operatorAuditSchemaPrApproved,
    connector_experiment_branch_check: input.connectorExperimentBranchVerified,
    feature_flag_check: input.featureFlagWireDesignApproved,
    dry_run_execution_plan: input.handoffReady,
    rollback_plan_check: input.rollbackPlanReviewed,
    final_operator_confirmation: input.finalOperatorConfirmationReady,
  };

  const reasonByKind: Record<RuntimeExecutionPlanStepKind, string> = {
    operator_approval: `operatorAuditReviewConfirmed=${input.operatorAuditReviewConfirmed}`,
    stage1_regression_check: `stage1RegressionReviewed=${input.stage1RegressionReviewed}`,
    schema_migration_pr_check: `schemaPrApproved=${input.schemaPrApproved}`,
    operator_audit_schema_pr_check: `operatorAuditSchemaPrApproved=${input.operatorAuditSchemaPrApproved}`,
    connector_experiment_branch_check: `connectorExperimentBranchVerified=${input.connectorExperimentBranchVerified}`,
    feature_flag_check: `featureFlagWireDesignApproved=${input.featureFlagWireDesignApproved}`,
    dry_run_execution_plan: `handoffReady=${input.handoffReady}; dry-run planned only, executesInThisStep=false`,
    rollback_plan_check: `rollbackPlanReviewed=${input.rollbackPlanReviewed}`,
    final_operator_confirmation: `finalOperatorConfirmationReady=${input.finalOperatorConfirmationReady}`,
  };

  return PLAN_STEP_SPECS.map((spec, index) => {
    const satisfied = satisfactionByKind[spec.kind];
    return {
      sequence: index + 1,
      kind: spec.kind,
      title: spec.title,
      required: spec.required,
      satisfied,
      reason: `${spec.kind}: ${reasonByKind[spec.kind]}; executesInThisStep=false`,
      executesInThisStep: false as const,
    };
  });
}

function buildPlanChecklist(input: {
  readonly handoffDecision: string;
  readonly planSteps: readonly RuntimeExecutionPlanStepCandidate[];
  readonly decision: RuntimeExecutionPlanBuilderDecision;
}): RuntimeExecutionPlanBuilderChecklistItem[] {
  const requiredStepsSatisfied = input.planSteps.filter((s) => s.required).every((s) => s.satisfied);

  return mapChecklistEntries([
    {
      item: "handoff candidate ready",
      satisfied: input.handoffDecision === HANDOFF_READY,
      detail: `sourceHandoffDecision=${input.handoffDecision}`,
    },
    {
      item: "plan steps generated",
      satisfied: input.planSteps.length === 9,
      detail: `planSteps.length=${input.planSteps.length}`,
    },
    {
      item: "required plan steps satisfied",
      satisfied: requiredStepsSatisfied,
      detail: `requiredStepsSatisfied=${requiredStepsSatisfied}`,
    },
    {
      item: "plan review ready",
      satisfied: input.decision === "ready_for_runtime_execution_plan_review",
      detail: `decision=${input.decision}`,
    },
  ]);
}

function buildNoRunChecklist(): RuntimeExecutionPlanBuilderChecklistItem[] {
  return mapChecklistEntries([
    { item: "no runtime execution in this step", satisfied: true, detail: "executesRuntimeInThisStep=false" },
    {
      item: "no connector routing change in this step",
      satisfied: true,
      detail: "changesConnectorRoutingInThisStep=false",
    },
    { item: "no write path wire in this step", satisfied: true, detail: "wiresWritePathInThisStep=false" },
    { item: "no feature flag wire in this step", satisfied: true, detail: "wiresFeatureFlagInThisStep=false" },
    { item: "no DB write in this step", satisfied: true, detail: "writesDataInThisStep=false" },
    { item: "no Prisma call in this step", satisfied: true, detail: "callsPrismaInThisStep=false" },
    { item: "no schema change in this step", satisfied: true, detail: "modifiesSchemaInThisStep=false" },
    { item: "no migration in this step", satisfied: true, detail: "createsMigrationInThisStep=false" },
    { item: "no PR creation in this step", satisfied: true, detail: "createsPullRequestInThisStep=false" },
    { item: "no git execution in this step", satisfied: true, detail: "executesGitInThisStep=false" },
    { item: "no Cursor call in this step", satisfied: true, detail: "callsCursorInThisStep=false" },
    { item: "no GitHub call in this step", satisfied: true, detail: "callsGitHubInThisStep=false" },
  ]);
}

function buildPlanSummary(input: {
  readonly decision: RuntimeExecutionPlanBuilderDecision;
  readonly handoffDecision: string;
  readonly satisfiedStepCount: number;
}): string {
  if (input.decision === "ready_for_runtime_execution_plan_review") {
    return (
      `Runtime execution plan candidate is ready for review (${input.satisfiedStepCount}/9 steps satisfied). ` +
      "This is a read-only plan builder; not actual execution permission. Actual execution requires a later runtime executor stage."
    );
  }

  if (input.decision === "blocked") {
    return (
      `Runtime execution plan builder is blocked (handoffDecision=${input.handoffDecision}). ` +
      "Resolve handoff blocking issues before plan review."
    );
  }

  return (
    `Runtime execution plan builder defers (handoffDecision=${input.handoffDecision}, ${input.satisfiedStepCount}/9 steps satisfied). ` +
    "Complete handoff prerequisites and plan review inputs before plan review."
  );
}

function appendPlanBuilderFindings(input: {
  readonly findings: RuntimeExecutionPlanBuilderFinding[];
  readonly decision: RuntimeExecutionPlanBuilderDecision;
  readonly handoffDecision: string;
  readonly finalOperatorConfirmationReady: boolean;
  readonly rollbackPlanReviewed: boolean;
  readonly stage1RegressionReviewed: boolean;
}): void {
  const { findings, decision, handoffDecision } = input;

  findings.push(
    finding(
      "info",
      "runtime_execution_plan_builder_read_only",
      "Runtime execution plan builder is read-only; no runtime execution",
    ),
  );
  findings.push(
    finding(
      "info",
      "no_runtime_execution_in_plan_builder",
      "This step does not execute runtime, routing, write path, or external integrations",
    ),
  );

  if (decision === "blocked") {
    if (handoffDecision === "blocked") {
      findings.push(finding("blocking", "handoff_candidate_blocked", "Handoff candidate is blocked"));
    }
    findings.push(
      finding("blocking", "runtime_execution_plan_builder_blocked", "Runtime execution plan builder is blocked"),
    );
    return;
  }

  if (decision === "defer") {
    if (handoffDecision !== HANDOFF_READY) {
      findings.push(finding("warning", "handoff_candidate_not_ready", "Handoff candidate is not ready"));
    }
    if (!input.finalOperatorConfirmationReady) {
      findings.push(
        finding("warning", "final_operator_confirmation_missing", "Final operator confirmation is missing"),
      );
    }
    if (!input.rollbackPlanReviewed) {
      findings.push(finding("warning", "rollback_plan_review_missing", "Rollback plan review is missing"));
    }
    if (!input.stage1RegressionReviewed) {
      findings.push(finding("warning", "stage1_regression_review_missing", "Stage1 regression review is missing"));
    }
    findings.push(
      finding("warning", "runtime_execution_plan_builder_deferred", "Runtime execution plan builder defers"),
    );
    return;
  }

  findings.push(
    finding(
      "info",
      "runtime_execution_plan_candidate_created",
      "Runtime execution plan candidate created for review; design candidate only, not actual execution permission",
    ),
  );
  findings.push(
    finding(
      "info",
      "actual_execution_requires_later_runtime_executor",
      "Actual execution requires a later runtime executor stage with operator approval; no execution in this plan builder",
    ),
  );
}

/** Read-only runtime execution plan builder — does not execute runtime, routing, write, or external integrations. */
export function evaluateRuntimeExecutionPlanBuilder(
  input?: RuntimeExecutionPlanBuilderInput,
): RuntimeExecutionPlanBuilderReport {
  const handoff = evaluateRuntimeExecutionHandoffCandidate(input);

  const finalOperatorConfirmationReady = input?.finalOperatorConfirmationReady === true;
  const rollbackPlanReviewed = input?.rollbackPlanReviewed === true;
  const stage1RegressionReviewed = input?.stage1RegressionReviewed === true;
  const operatorAuditReviewConfirmed = input?.operatorAuditReviewConfirmed === true;
  const schemaPrApproved = input?.schemaPrApproved === true;
  const operatorAuditSchemaPrApproved = input?.operatorAuditSchemaPrApproved === true;
  const connectorExperimentBranchVerified = input?.connectorExperimentBranchVerified === true;
  const featureFlagWireDesignApproved = input?.featureFlagWireDesignApproved === true;

  const decision = resolvePlanBuilderDecision({
    handoffDecision: handoff.decision,
    finalOperatorConfirmationReady,
    rollbackPlanReviewed,
    stage1RegressionReviewed,
  });

  const planSteps = buildPlanSteps({
    operatorAuditReviewConfirmed,
    stage1RegressionReviewed,
    schemaPrApproved,
    operatorAuditSchemaPrApproved,
    connectorExperimentBranchVerified,
    featureFlagWireDesignApproved,
    handoffReady: handoff.decision === HANDOFF_READY,
    rollbackPlanReviewed,
    finalOperatorConfirmationReady,
  });

  const satisfiedStepCount = planSteps.filter((s) => s.satisfied).length;
  const planChecklist = buildPlanChecklist({
    handoffDecision: handoff.decision,
    planSteps,
    decision,
  });

  const findings: RuntimeExecutionPlanBuilderFinding[] = [];
  appendPlanBuilderFindings({
    findings,
    decision,
    handoffDecision: handoff.decision,
    finalOperatorConfirmationReady,
    rollbackPlanReviewed,
    stage1RegressionReviewed,
  });

  const planCandidateId = `runtime-execution-plan-candidate-v1-${handoff.sourceStage2Decision}`;

  return {
    mode: "read_only_runtime_execution_plan_builder",
    decision,
    sourceHandoffDecision: handoff.decision,
    sourceStage2Decision: handoff.sourceStage2Decision,
    sourceStage2NoRunPolicySatisfied: handoff.sourceStage2NoRunPolicySatisfied,
    sourceStage2ExitCriteriaSatisfied: handoff.sourceStage2ExitCriteriaSatisfied,
    sourceStage2HandoffReady: handoff.sourceStage2HandoffReady,
    planCandidateId,
    planVersion: 1,
    planTitle: "Runtime Execution Plan Candidate (Read-Only)",
    planSummary: buildPlanSummary({ decision, handoffDecision: handoff.decision, satisfiedStepCount }),
    planSteps,
    planChecklist,
    noRunChecklist: buildNoRunChecklist(),
    buildsPlanOnly: true,
    executesPlanInThisStep: false,
    executesRuntimeInThisStep: false,
    changesConnectorRoutingInThisStep: false,
    wiresWritePathInThisStep: false,
    wiresFeatureFlagInThisStep: false,
    writesDataInThisStep: false,
    callsPrismaInThisStep: false,
    modifiesSchemaInThisStep: false,
    createsMigrationInThisStep: false,
    createsPullRequestInThisStep: false,
    executesGitInThisStep: false,
    callsCursorInThisStep: false,
    callsGitHubInThisStep: false,
    findings,
  };
}
