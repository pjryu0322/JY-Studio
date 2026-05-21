/**
 * Evaluate runtime execution plan package (read-only; no runtime/routing/write/DB/schema/git/Cursor/GitHub execution).
 */

import { evaluateRuntimeExecutionPlanBuilder } from "@/lib/agents/evaluateRuntimeExecutionPlanBuilder";
import type {
  RuntimeExecutionApprovalReadiness,
  RuntimeExecutionDryRunCandidate,
  RuntimeExecutionDryRunCandidateStatus,
  RuntimeExecutionPlanPackageChecklistItem,
  RuntimeExecutionPlanPackageDecision,
  RuntimeExecutionPlanPackageFinding,
  RuntimeExecutionPlanPackageReport,
} from "@/lib/agents/runtimeExecutionPlanPackageTypes";
import type { RuntimeExecutionPlanStepKind } from "@/lib/agents/runtimeExecutionPlanBuilderTypes";

const PLAN_READY = "ready_for_runtime_execution_plan_review";
const HANDOFF_READY = "ready_for_runtime_execution_handoff_design";

type RuntimeExecutionPlanPackageInput = Parameters<typeof evaluateRuntimeExecutionPlanBuilder>[0] & {
  readonly dryRunReviewConfirmed?: boolean;
  readonly approvalGateReviewConfirmed?: boolean;
  readonly safetyChecklistReviewed?: boolean;
};

type ChecklistEntry = {
  readonly item: string;
  readonly satisfied: boolean;
  readonly detail: string;
};

const APPROVAL_READINESS_KEYS = [
  "operatorApprovalReady",
  "rollbackReviewReady",
  "stage1RegressionReady",
  "schemaPrerequisitesReady",
  "connectorExperimentReady",
  "featureFlagWireReady",
  "runtimeWireDesignReady",
] as const;

function finding(
  severity: RuntimeExecutionPlanPackageFinding["severity"],
  code: string,
  message: string,
): RuntimeExecutionPlanPackageFinding {
  return { severity, code, message };
}

function checklistReason(input: ChecklistEntry): string {
  return `${input.item}: ${input.satisfied ? "satisfied" : "not satisfied"} — ${input.detail}`;
}

function mapChecklistEntries(
  entries: readonly ChecklistEntry[],
): RuntimeExecutionPlanPackageChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied,
    reason: checklistReason(entry),
  }));
}

function planStepSatisfied(
  planSteps: ReturnType<typeof evaluateRuntimeExecutionPlanBuilder>["planSteps"],
  kind: RuntimeExecutionPlanStepKind,
): boolean {
  return planSteps.find((s) => s.kind === kind)?.satisfied ?? false;
}

function buildApprovalReadiness(input: {
  readonly planSteps: ReturnType<typeof evaluateRuntimeExecutionPlanBuilder>["planSteps"];
  readonly handoffDecision: string;
}): RuntimeExecutionApprovalReadiness {
  const operatorApprovalReady = planStepSatisfied(input.planSteps, "operator_approval");
  const rollbackReviewReady = planStepSatisfied(input.planSteps, "rollback_plan_check");
  const stage1RegressionReady = planStepSatisfied(input.planSteps, "stage1_regression_check");
  const schemaPrerequisitesReady =
    planStepSatisfied(input.planSteps, "schema_migration_pr_check") &&
    planStepSatisfied(input.planSteps, "operator_audit_schema_pr_check");
  const connectorExperimentReady = planStepSatisfied(input.planSteps, "connector_experiment_branch_check");
  const featureFlagWireReady = planStepSatisfied(input.planSteps, "feature_flag_check");
  const runtimeWireDesignReady =
    planStepSatisfied(input.planSteps, "dry_run_execution_plan") ||
    input.handoffDecision === HANDOFF_READY;

  const readiness: Record<(typeof APPROVAL_READINESS_KEYS)[number], boolean> = {
    operatorApprovalReady,
    rollbackReviewReady,
    stage1RegressionReady,
    schemaPrerequisitesReady,
    connectorExperimentReady,
    featureFlagWireReady,
    runtimeWireDesignReady,
  };

  const missing = APPROVAL_READINESS_KEYS.filter((key) => !readiness[key]);
  const readyCount = APPROVAL_READINESS_KEYS.length - missing.length;

  return {
    operatorApprovalReady,
    rollbackReviewReady,
    stage1RegressionReady,
    schemaPrerequisitesReady,
    connectorExperimentReady,
    featureFlagWireReady,
    runtimeWireDesignReady,
    readyCount,
    totalCount: 7,
    missing,
  };
}

function resolveDryRunStatus(planDecision: string): RuntimeExecutionDryRunCandidateStatus {
  if (planDecision === "blocked") {
    return "dry_run_blocked";
  }
  if (planDecision !== PLAN_READY) {
    return "dry_run_deferred";
  }
  return "dry_run_ready";
}

function buildDryRunCandidate(input: {
  readonly plan: ReturnType<typeof evaluateRuntimeExecutionPlanBuilder>;
  readonly dryRunReviewConfirmed: boolean;
  readonly approvalGateReviewConfirmed: boolean;
  readonly safetyChecklistReviewed: boolean;
}): RuntimeExecutionDryRunCandidate {
  const status = resolveDryRunStatus(input.plan.decision);
  const candidateSteps = input.plan.planSteps.map(
    (step) => `${step.sequence}.${step.kind}: ${step.title}`,
  );

  const blockedReasons: string[] = [];
  if (input.plan.decision === "blocked") {
    blockedReasons.push("source plan blocked");
  }
  if (input.plan.sourceHandoffDecision === "blocked") {
    blockedReasons.push("source handoff blocked");
  }
  if (!input.plan.sourceStage2NoRunPolicySatisfied) {
    blockedReasons.push("no-run policy violation");
  }

  const deferredReasons: string[] = [];
  if (input.plan.decision !== PLAN_READY) {
    deferredReasons.push("source plan not ready");
  }
  if (!input.dryRunReviewConfirmed) {
    deferredReasons.push("dryRunReviewConfirmed=false");
  }
  if (!input.approvalGateReviewConfirmed) {
    deferredReasons.push("approvalGateReviewConfirmed=false");
  }
  if (!input.safetyChecklistReviewed) {
    deferredReasons.push("safetyChecklistReviewed=false");
  }

  return {
    status,
    sourcePlanDecision: input.plan.decision,
    simulatedOnly: true,
    executesRuntimeInThisStep: false,
    changesConnectorRoutingInThisStep: false,
    wiresWritePathInThisStep: false,
    writesDataInThisStep: false,
    callsExternalConnectorInThisStep: false,
    candidateSteps,
    blockedReasons,
    deferredReasons,
  };
}

function resolvePackageDecision(input: {
  readonly planDecision: string;
  readonly dryRunReviewConfirmed: boolean;
  readonly approvalGateReviewConfirmed: boolean;
  readonly safetyChecklistReviewed: boolean;
}): RuntimeExecutionPlanPackageDecision {
  if (input.planDecision === "blocked") {
    return "blocked";
  }

  if (input.planDecision !== PLAN_READY) {
    return "defer";
  }

  if (!input.dryRunReviewConfirmed) {
    return "defer";
  }

  if (!input.approvalGateReviewConfirmed) {
    return "defer";
  }

  if (!input.safetyChecklistReviewed) {
    return "defer";
  }

  return "ready_for_runtime_execution_approval_gate";
}

function buildExecutionPlanChecklist(input: {
  readonly plan: ReturnType<typeof evaluateRuntimeExecutionPlanBuilder>;
}): RuntimeExecutionPlanPackageChecklistItem[] {
  const requiredSatisfied = input.plan.planSteps.filter((s) => s.required).every((s) => s.satisfied);

  return mapChecklistEntries([
    {
      item: "source plan review ready",
      satisfied: input.plan.decision === PLAN_READY,
      detail: `sourcePlanDecision=${input.plan.decision}`,
    },
    {
      item: "source handoff ready",
      satisfied: input.plan.sourceHandoffDecision === HANDOFF_READY,
      detail: `sourceHandoffDecision=${input.plan.sourceHandoffDecision}`,
    },
    {
      item: "source Stage2 closure ready",
      satisfied: input.plan.sourceStage2Decision === "stage2_closure_ready",
      detail: `sourceStage2Decision=${input.plan.sourceStage2Decision}`,
    },
    {
      item: "9 plan steps present",
      satisfied: input.plan.planSteps.length === 9,
      detail: `sourcePlanStepCount=${input.plan.planSteps.length}`,
    },
    {
      item: "all required plan steps satisfied",
      satisfied: requiredSatisfied,
      detail: `requiredPlanStepsSatisfied=${requiredSatisfied}`,
    },
  ]);
}

function buildDryRunChecklist(
  dryRun: RuntimeExecutionDryRunCandidate,
): RuntimeExecutionPlanPackageChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "dry-run candidate generated",
      satisfied: dryRun.candidateSteps.length === 9,
      detail: `candidateSteps.length=${dryRun.candidateSteps.length}`,
    },
    {
      item: "dry-run candidate simulated only",
      satisfied: dryRun.simulatedOnly,
      detail: `simulatedOnly=${dryRun.simulatedOnly}`,
    },
    {
      item: "no runtime execution in dry-run candidate",
      satisfied: dryRun.executesRuntimeInThisStep === false,
      detail: "executesRuntimeInThisStep=false",
    },
    {
      item: "no connector routing change in dry-run candidate",
      satisfied: dryRun.changesConnectorRoutingInThisStep === false,
      detail: "changesConnectorRoutingInThisStep=false",
    },
    {
      item: "no write path wire in dry-run candidate",
      satisfied: dryRun.wiresWritePathInThisStep === false,
      detail: "wiresWritePathInThisStep=false",
    },
    {
      item: "no data write in dry-run candidate",
      satisfied: dryRun.writesDataInThisStep === false,
      detail: "writesDataInThisStep=false",
    },
  ]);
}

function buildApprovalChecklist(input: {
  readonly readiness: RuntimeExecutionApprovalReadiness;
  readonly dryRunReviewConfirmed: boolean;
  readonly approvalGateReviewConfirmed: boolean;
  readonly safetyChecklistReviewed: boolean;
}): RuntimeExecutionPlanPackageChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "operator approval ready",
      satisfied: input.readiness.operatorApprovalReady,
      detail: `operatorApprovalReady=${input.readiness.operatorApprovalReady}`,
    },
    {
      item: "rollback review ready",
      satisfied: input.readiness.rollbackReviewReady,
      detail: `rollbackReviewReady=${input.readiness.rollbackReviewReady}`,
    },
    {
      item: "Stage1 regression ready",
      satisfied: input.readiness.stage1RegressionReady,
      detail: `stage1RegressionReady=${input.readiness.stage1RegressionReady}`,
    },
    {
      item: "schema prerequisites ready",
      satisfied: input.readiness.schemaPrerequisitesReady,
      detail: `schemaPrerequisitesReady=${input.readiness.schemaPrerequisitesReady}`,
    },
    {
      item: "connector experiment ready",
      satisfied: input.readiness.connectorExperimentReady,
      detail: `connectorExperimentReady=${input.readiness.connectorExperimentReady}`,
    },
    {
      item: "feature flag wire ready",
      satisfied: input.readiness.featureFlagWireReady,
      detail: `featureFlagWireReady=${input.readiness.featureFlagWireReady}`,
    },
    {
      item: "runtime wire design ready",
      satisfied: input.readiness.runtimeWireDesignReady,
      detail: `runtimeWireDesignReady=${input.readiness.runtimeWireDesignReady}`,
    },
    {
      item: "dryRunReviewConfirmed",
      satisfied: input.dryRunReviewConfirmed,
      detail: `dryRunReviewConfirmed=${input.dryRunReviewConfirmed}`,
    },
    {
      item: "approvalGateReviewConfirmed",
      satisfied: input.approvalGateReviewConfirmed,
      detail: `approvalGateReviewConfirmed=${input.approvalGateReviewConfirmed}`,
    },
    {
      item: "safetyChecklistReviewed",
      satisfied: input.safetyChecklistReviewed,
      detail: `safetyChecklistReviewed=${input.safetyChecklistReviewed}`,
    },
  ]);
}

function buildSafetyChecklist(): RuntimeExecutionPlanPackageChecklistItem[] {
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

function buildPackageSummary(input: {
  readonly decision: RuntimeExecutionPlanPackageDecision;
  readonly planDecision: string;
  readonly readiness: RuntimeExecutionApprovalReadiness;
}): string {
  if (input.decision === "ready_for_runtime_execution_approval_gate") {
    return (
      `Runtime execution plan package candidate only (${input.readiness.readyCount}/${input.readiness.totalCount} approval readiness). ` +
      "Not actual runtime execution; Stage 3-B approval gate required before any controlled executor."
    );
  }

  if (input.decision === "blocked") {
    return `Runtime execution plan package is blocked (sourcePlanDecision=${input.planDecision}).`;
  }

  return (
    `Runtime execution plan package defers (sourcePlanDecision=${input.planDecision}). ` +
    "Complete dry-run review, approval gate review, and safety checklist review."
  );
}

function appendPackageFindings(input: {
  readonly findings: RuntimeExecutionPlanPackageFinding[];
  readonly decision: RuntimeExecutionPlanPackageDecision;
  readonly planDecision: string;
  readonly readiness: RuntimeExecutionApprovalReadiness;
  readonly dryRunReviewConfirmed: boolean;
  readonly approvalGateReviewConfirmed: boolean;
  readonly safetyChecklistReviewed: boolean;
}): void {
  const { findings, decision, planDecision, readiness } = input;

  findings.push(
    finding(
      "info",
      "runtime_execution_plan_package_read_only",
      "Runtime execution plan package is read-only; no runtime execution",
    ),
  );

  if (decision === "blocked") {
    if (planDecision === "blocked") {
      findings.push(finding("blocking", "source_plan_blocked", "Source plan builder is blocked"));
    }
    findings.push(
      finding("blocking", "runtime_execution_plan_package_blocked", "Runtime execution plan package is blocked"),
    );
    return;
  }

  if (decision === "defer") {
    if (planDecision !== PLAN_READY) {
      findings.push(finding("warning", "source_plan_not_ready", "Source plan is not ready for review"));
    }
    if (!input.dryRunReviewConfirmed) {
      findings.push(finding("warning", "dry_run_review_missing", "Dry-run review is missing"));
    }
    if (!input.approvalGateReviewConfirmed) {
      findings.push(finding("warning", "approval_gate_review_missing", "Approval gate review is missing"));
    }
    if (!input.safetyChecklistReviewed) {
      findings.push(finding("warning", "safety_checklist_review_missing", "Safety checklist review is missing"));
    }
    if (readiness.missing.length > 0) {
      findings.push(
        finding(
          "warning",
          "approval_readiness_incomplete",
          `Approval readiness incomplete: missing=${readiness.missing.join(",")}`,
        ),
      );
    }
    findings.push(
      finding("warning", "runtime_execution_plan_package_deferred", "Runtime execution plan package defers"),
    );
    return;
  }

  findings.push(
    finding("info", "runtime_execution_plan_package_created", "Runtime execution plan package created"),
  );
  findings.push(finding("info", "dry_run_candidate_generated", "Dry-run candidate generated (simulated only)"));
  findings.push(finding("info", "approval_readiness_evaluated", "Approval readiness evaluated"));
  findings.push(
    finding(
      "info",
      "runtime_execution_plan_package_ready_for_approval_gate",
      "Package candidate only; not actual execution permission; Stage 3-B approval gate required",
    ),
  );
  findings.push(
    finding(
      "info",
      "actual_execution_requires_stage_3_b_or_later",
      "Actual execution requires Stage 3-B/3-C or later controlled executor",
    ),
  );
}

/** Read-only runtime execution plan package — does not execute runtime, routing, write, or external integrations. */
export function evaluateRuntimeExecutionPlanPackage(
  input?: RuntimeExecutionPlanPackageInput,
): RuntimeExecutionPlanPackageReport {
  const plan = evaluateRuntimeExecutionPlanBuilder(input);

  const dryRunReviewConfirmed = input?.dryRunReviewConfirmed === true;
  const approvalGateReviewConfirmed = input?.approvalGateReviewConfirmed === true;
  const safetyChecklistReviewed = input?.safetyChecklistReviewed === true;

  const approvalReadiness = buildApprovalReadiness({
    planSteps: plan.planSteps,
    handoffDecision: plan.sourceHandoffDecision,
  });

  const dryRunCandidate = buildDryRunCandidate({
    plan,
    dryRunReviewConfirmed,
    approvalGateReviewConfirmed,
    safetyChecklistReviewed,
  });

  const decision = resolvePackageDecision({
    planDecision: plan.decision,
    dryRunReviewConfirmed,
    approvalGateReviewConfirmed,
    safetyChecklistReviewed,
  });

  const sourceSatisfiedPlanStepCount = plan.planSteps.filter((s) => s.satisfied).length;

  const findings: RuntimeExecutionPlanPackageFinding[] = [];
  appendPackageFindings({
    findings,
    decision,
    planDecision: plan.decision,
    readiness: approvalReadiness,
    dryRunReviewConfirmed,
    approvalGateReviewConfirmed,
    safetyChecklistReviewed,
  });

  return {
    mode: "read_only_runtime_execution_plan_package",
    stage: "stage_3_a",
    decision,
    sourcePlanDecision: plan.decision,
    sourceHandoffDecision: plan.sourceHandoffDecision,
    sourceStage2Decision: plan.sourceStage2Decision,
    sourcePlanFingerprint: plan.planFingerprint,
    sourcePlanStepCount: plan.planSteps.length,
    sourceSatisfiedPlanStepCount,
    packageVersion: 1,
    packageTitle: "Runtime Execution Plan Package (Read-Only)",
    packageSummary: buildPackageSummary({ decision, planDecision: plan.decision, readiness: approvalReadiness }),
    dryRunCandidate,
    approvalReadiness,
    executionPlanChecklist: buildExecutionPlanChecklist({ plan }),
    dryRunChecklist: buildDryRunChecklist(dryRunCandidate),
    approvalChecklist: buildApprovalChecklist({
      readiness: approvalReadiness,
      dryRunReviewConfirmed,
      approvalGateReviewConfirmed,
      safetyChecklistReviewed,
    }),
    safetyChecklist: buildSafetyChecklist(),
    buildsPackageOnly: true,
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
