/**
 * Evaluate Stage 2 integrated closure verdict (read-only; no runtime/routing/write/DB/schema/git/Cursor/GitHub execution).
 */

import {
  evaluateRuntimeChangeFinalApprovalPackage,
  uniqueStrings,
} from "@/lib/agents/evaluateRuntimeChangeFinalApprovalPackage";
import type {
  Stage2IntegratedClosureVerdictChecklistItem,
  Stage2IntegratedClosureVerdictDecision,
  Stage2IntegratedClosureVerdictFinding,
  Stage2IntegratedClosureVerdictReport,
  Stage2NextPhaseRecommendation,
} from "@/lib/agents/stage2IntegratedClosureVerdictTypes";

const RUNTIME_FINAL_APPROVAL_READY = "ready_for_final_runtime_change_approval";

const CLOSURE_CHECKLIST_ITEMS = [
  "runtime final approval package ready",
  "routing shadow reviewed",
  "wire candidate reviewed",
  "operator audit reviewed",
  "final approval confirmed",
  "Stage 2 remains read-only",
] as const;

const NO_RUN_CHECKLIST_ITEMS = [
  "no runtime change",
  "no connector routing change",
  "no write path wire",
  "no adapter wire",
  "no feature flag wire",
  "no DB write",
  "no Prisma call",
  "no schema change",
  "no migration",
  "no pull request creation",
  "no git execution",
  "no Cursor call",
  "no GitHub call",
] as const;

const HANDOFF_CHECKLIST_ITEMS = [
  "schema/migration PR must be separate",
  "connector gateway experiment branch must be separate",
  "write path wire must be separate",
  "feature flag wire must be separate",
  "operator approval/audit persistence must be separate",
  "runtime execution change must be separate",
] as const;

const RISK_CHECKLIST_ITEMS = [
  "Stage1 regression risk acknowledged",
  "rollback risk acknowledged",
  "operator audit risk acknowledged",
  "schema migration risk acknowledged",
  "connector gateway routing risk acknowledged",
  "write path data integrity risk acknowledged",
] as const;

function finding(
  severity: Stage2IntegratedClosureVerdictFinding["severity"],
  code: string,
  message: string,
): Stage2IntegratedClosureVerdictFinding {
  return { severity, code, message };
}

function verifyNoRunPolicy(runtimeFinalApproval: ReturnType<
  typeof evaluateRuntimeChangeFinalApprovalPackage
>): boolean {
  return (
    runtimeFinalApproval.changesRuntimeInThisStep === false &&
    runtimeFinalApproval.changesConnectorRoutingInThisStep === false &&
    runtimeFinalApproval.wiresWritePathInThisStep === false &&
    runtimeFinalApproval.wiresAdapterInThisStep === false &&
    runtimeFinalApproval.wiresFeatureFlagInThisStep === false &&
    runtimeFinalApproval.writesDataInThisStep === false &&
    runtimeFinalApproval.callsPrismaInThisStep === false &&
    runtimeFinalApproval.modifiesSchemaInThisStep === false &&
    runtimeFinalApproval.createsMigrationInThisStep === false &&
    runtimeFinalApproval.executesGitInThisStep === false &&
    runtimeFinalApproval.callsCursorInThisStep === false &&
    runtimeFinalApproval.callsGitHubInThisStep === false &&
    runtimeFinalApproval.sourceWireCandidateSchemaAppliedInRuntime === false &&
    runtimeFinalApproval.sourceWireCandidateMigrationAppliedInRuntime === false &&
    runtimeFinalApproval.sourceRoutingShadowChangesRuntimeRouteInThisStep === false &&
    runtimeFinalApproval.sourceRoutingShadowCallsConnectorInThisStep === false &&
    runtimeFinalApproval.sourceWireCandidateWiresWritePathInThisStep === false
  );
}

function resolveClosureDecision(input: {
  readonly runtimeFinalApprovalDecision: string;
  readonly wireCandidateDecision: string;
  readonly routingShadowDecision: string;
  readonly finalRuntimeApprovalConfirmed: boolean;
  readonly routingShadowReviewConfirmed: boolean;
  readonly wireCandidateReviewConfirmed: boolean;
  readonly operatorAuditReviewConfirmed: boolean;
  readonly noRunPolicySatisfied: boolean;
}): Stage2IntegratedClosureVerdictDecision {
  if (
    input.runtimeFinalApprovalDecision === "blocked" ||
    input.wireCandidateDecision === "blocked" ||
    input.routingShadowDecision === "blocked" ||
    !input.noRunPolicySatisfied
  ) {
    return "blocked";
  }

  if (input.runtimeFinalApprovalDecision !== RUNTIME_FINAL_APPROVAL_READY) {
    return "defer";
  }

  if (!input.finalRuntimeApprovalConfirmed) {
    return "defer";
  }

  if (!input.routingShadowReviewConfirmed) {
    return "defer";
  }

  if (!input.wireCandidateReviewConfirmed) {
    return "defer";
  }

  if (!input.operatorAuditReviewConfirmed) {
    return "defer";
  }

  return "stage2_closure_ready";
}

function buildRecommendedNextPhases(input: {
  readonly decision: Stage2IntegratedClosureVerdictDecision;
  readonly schemaNotApplied: boolean;
  readonly routingNotChanged: boolean;
  readonly writePathNotWired: boolean;
}): Stage2NextPhaseRecommendation[] {
  const phases = new Set<Stage2NextPhaseRecommendation>();

  if (input.decision !== "stage2_closure_ready") {
    phases.add("continue_read_only_hardening");
  }

  if (input.schemaNotApplied) {
    phases.add("prepare_schema_migration_pr");
    phases.add("prepare_operator_audit_schema_pr");
  }

  if (input.routingNotChanged) {
    phases.add("prepare_connector_gateway_experiment_branch");
  }

  if (input.writePathNotWired) {
    phases.add("prepare_runtime_execution_wire_design");
  }

  if (phases.size === 0 || input.decision === "stage2_closure_ready") {
    phases.add("prepare_schema_migration_pr");
    phases.add("prepare_operator_audit_schema_pr");
    phases.add("prepare_connector_gateway_experiment_branch");
    phases.add("prepare_runtime_execution_wire_design");
  }

  return [...phases];
}

function buildChecklist(
  items: readonly string[],
  satisfaction: Record<string, boolean>,
): Stage2IntegratedClosureVerdictChecklistItem[] {
  return items.map((item) => ({
    item,
    satisfied: satisfaction[item] ?? false,
    reason: (satisfaction[item] ?? false)
      ? `${item} satisfied`
      : `${item} not satisfied`,
  }));
}

function buildClosureChecklist(input: {
  readonly runtimeFinalApprovalReady: boolean;
  readonly runtimeFinalApprovalDecision: string;
  readonly routingShadowReviewConfirmed: boolean;
  readonly wireCandidateReviewConfirmed: boolean;
  readonly operatorAuditReviewConfirmed: boolean;
  readonly finalRuntimeApprovalConfirmed: boolean;
  readonly noRunPolicySatisfied: boolean;
}): Stage2IntegratedClosureVerdictChecklistItem[] {
  return buildChecklist(CLOSURE_CHECKLIST_ITEMS, {
    "runtime final approval package ready": input.runtimeFinalApprovalReady,
    "routing shadow reviewed": input.routingShadowReviewConfirmed,
    "wire candidate reviewed": input.wireCandidateReviewConfirmed,
    "operator audit reviewed": input.operatorAuditReviewConfirmed,
    "final approval confirmed": input.finalRuntimeApprovalConfirmed,
    "Stage 2 remains read-only": input.noRunPolicySatisfied,
  }).map((entry) => {
    if (entry.item === "runtime final approval package ready") {
      return {
        ...entry,
        reason: `runtime final approval decision=${input.runtimeFinalApprovalDecision}`,
      };
    }
    return entry;
  });
}

function buildNoRunChecklist(input: {
  readonly runtimeFinalApproval: ReturnType<typeof evaluateRuntimeChangeFinalApprovalPackage>;
}): Stage2IntegratedClosureVerdictChecklistItem[] {
  const r = input.runtimeFinalApproval;
  return buildChecklist(NO_RUN_CHECKLIST_ITEMS, {
    "no runtime change": r.changesRuntimeInThisStep === false,
    "no connector routing change": r.changesConnectorRoutingInThisStep === false,
    "no write path wire": r.wiresWritePathInThisStep === false,
    "no adapter wire": r.wiresAdapterInThisStep === false,
    "no feature flag wire": r.wiresFeatureFlagInThisStep === false,
    "no DB write": r.writesDataInThisStep === false,
    "no Prisma call": r.callsPrismaInThisStep === false,
    "no schema change": r.modifiesSchemaInThisStep === false,
    "no migration": r.createsMigrationInThisStep === false,
    "no pull request creation": true,
    "no git execution": r.executesGitInThisStep === false,
    "no Cursor call": r.callsCursorInThisStep === false,
    "no GitHub call": r.callsGitHubInThisStep === false,
  });
}

function buildHandoffChecklist(): Stage2IntegratedClosureVerdictChecklistItem[] {
  return buildChecklist(HANDOFF_CHECKLIST_ITEMS, {
    "schema/migration PR must be separate": true,
    "connector gateway experiment branch must be separate": true,
    "write path wire must be separate": true,
    "feature flag wire must be separate": true,
    "operator approval/audit persistence must be separate": true,
    "runtime execution change must be separate": true,
  });
}

function buildRiskChecklist(input: {
  readonly requiresStage1Regression: boolean;
  readonly requiresRollbackPlan: boolean;
  readonly operatorAuditReviewConfirmed: boolean;
  readonly schemaMigrationReviewConfirmed: boolean;
  readonly routingShadowReviewConfirmed: boolean;
  readonly wireCandidateReviewConfirmed: boolean;
}): Stage2IntegratedClosureVerdictChecklistItem[] {
  return buildChecklist(RISK_CHECKLIST_ITEMS, {
    "Stage1 regression risk acknowledged": input.requiresStage1Regression,
    "rollback risk acknowledged": input.requiresRollbackPlan,
    "operator audit risk acknowledged": input.operatorAuditReviewConfirmed,
    "schema migration risk acknowledged": input.schemaMigrationReviewConfirmed,
    "connector gateway routing risk acknowledged": input.routingShadowReviewConfirmed,
    "write path data integrity risk acknowledged": input.wireCandidateReviewConfirmed,
  });
}

function appendClosureFindings(input: {
  readonly findings: Stage2IntegratedClosureVerdictFinding[];
  readonly decision: Stage2IntegratedClosureVerdictDecision;
  readonly runtimeFinalApprovalDecision: string;
  readonly routingShadowDecision: string;
  readonly wireCandidateDecision: string;
  readonly finalRuntimeApprovalConfirmed: boolean;
  readonly routingShadowReviewConfirmed: boolean;
  readonly wireCandidateReviewConfirmed: boolean;
  readonly operatorAuditReviewConfirmed: boolean;
  readonly noRunPolicySatisfied: boolean;
}): void {
  const {
    findings,
    decision,
    runtimeFinalApprovalDecision,
    routingShadowDecision,
    wireCandidateDecision,
    finalRuntimeApprovalConfirmed,
    routingShadowReviewConfirmed,
    wireCandidateReviewConfirmed,
    operatorAuditReviewConfirmed,
    noRunPolicySatisfied,
  } = input;

  findings.push(
    finding(
      "info",
      "stage2_integrated_closure_verdict_read_only",
      "Stage 2 integrated closure verdict is read-only; no runtime execution",
    ),
  );
  findings.push(finding("info", "stage2_no_runtime_change", "Stage 2 does not change runtime in this step"));
  findings.push(
    finding("info", "stage2_no_connector_routing_change", "Stage 2 does not change connector routing in this step"),
  );
  findings.push(finding("info", "stage2_no_write_path_wire", "Stage 2 does not wire write path in this step"));
  findings.push(
    finding("info", "stage2_no_schema_migration", "Stage 2 does not apply schema/migration in this step"),
  );
  findings.push(
    finding(
      "info",
      "stage2_handoff_requires_separate_prs",
      "Stage 2 closure hands off to separate PRs/experiment branches for actual changes",
    ),
  );

  if (!noRunPolicySatisfied) {
    findings.push(
      finding("blocking", "stage2_no_run_policy_violated", "Stage 2 no-run policy was violated in upstream reports"),
    );
  }

  if (decision === "blocked") {
    if (runtimeFinalApprovalDecision === "blocked") {
      findings.push(finding("blocking", "runtime_final_approval_blocked", "runtime final approval package is blocked"));
    }
    if (routingShadowDecision === "blocked") {
      findings.push(finding("blocking", "routing_shadow_blocked", "routing shadow is blocked"));
    }
    if (wireCandidateDecision === "blocked") {
      findings.push(finding("blocking", "wire_candidate_blocked", "wire candidate verification is blocked"));
    }
    findings.push(finding("blocking", "stage2_closure_blocked", "Stage 2 integrated closure is blocked"));
    return;
  }

  if (decision === "defer") {
    if (runtimeFinalApprovalDecision !== RUNTIME_FINAL_APPROVAL_READY) {
      findings.push(
        finding("warning", "runtime_final_approval_deferred", "runtime final approval package is deferred"),
      );
    }
    if (!routingShadowReviewConfirmed) {
      findings.push(finding("warning", "routing_shadow_review_missing", "routing shadow review is not confirmed"));
    }
    if (!wireCandidateReviewConfirmed) {
      findings.push(finding("warning", "wire_candidate_review_missing", "wire candidate review is not confirmed"));
    }
    if (!operatorAuditReviewConfirmed) {
      findings.push(finding("warning", "operator_audit_review_missing", "operator audit review is not confirmed"));
    }
    findings.push(finding("warning", "schema_migration_pr_still_required", "schema/migration PR is still required"));
    findings.push(
      finding(
        "warning",
        "connector_gateway_experiment_branch_still_required",
        "connector gateway experiment branch is still required",
      ),
    );
    findings.push(finding("warning", "write_path_wire_still_required", "write path wire is still required"));
    findings.push(finding("warning", "stage2_closure_deferred", "Stage 2 closure defers until prerequisites are met"));
    return;
  }

  findings.push(
    finding("info", "runtime_final_approval_package_ready", "runtime final approval package is ready"),
  );
  findings.push(finding("info", "stage2_closure_ready", "Stage 2 integrated closure is ready"));
}

/** Read-only Stage 2 closure verdict — does not execute runtime, routing, write, or external integrations. */
export function evaluateStage2IntegratedClosureVerdict(input?: {
  readonly finalRuntimeApprovalConfirmed?: boolean;
  readonly routingShadowReviewConfirmed?: boolean;
  readonly wireCandidateReviewConfirmed?: boolean;
  readonly stage1RegressionReviewConfirmed?: boolean;
  readonly rollbackPlanReviewConfirmed?: boolean;
  readonly operatorAuditReviewConfirmed?: boolean;
  readonly explicitShadowApproval?: boolean;
  readonly agentTarget?: string;
  readonly operatorTarget?: string;
  readonly routingTarget?: string;
  readonly routingBoundaryIds?: readonly string[];
  readonly routingConnectorIds?: readonly string[];
  readonly agentExplicitUserApproval?: boolean;
  readonly operatorExplicitUserApproval?: boolean;
  readonly agentSchemaAppliedConfirmed?: boolean;
  readonly operatorSchemaAppliedConfirmed?: boolean;
  readonly agentMigrationAppliedConfirmed?: boolean;
  readonly operatorMigrationAppliedConfirmed?: boolean;
  readonly agentFeatureFlagWireApproved?: boolean;
  readonly operatorFeatureFlagWireApproved?: boolean;
  readonly agentWriteAdapterImplementedConfirmed?: boolean;
  readonly operatorWriteAdapterImplementedConfirmed?: boolean;
  readonly operatorPermissionModelConfirmed?: boolean;
  readonly operatorAuditTrailConfirmed?: boolean;
  readonly schemaMigrationReadinessConfirmed?: boolean;
}): Stage2IntegratedClosureVerdictReport {
  const runtimeFinalApproval = evaluateRuntimeChangeFinalApprovalPackage({
    routingTarget: input?.routingTarget,
    routingBoundaryIds: input?.routingBoundaryIds,
    routingConnectorIds: input?.routingConnectorIds,
    agentTarget: input?.agentTarget,
    operatorTarget: input?.operatorTarget,
    agentExplicitUserApproval: input?.agentExplicitUserApproval,
    operatorExplicitUserApproval: input?.operatorExplicitUserApproval,
    agentSchemaAppliedConfirmed: input?.agentSchemaAppliedConfirmed,
    operatorSchemaAppliedConfirmed: input?.operatorSchemaAppliedConfirmed,
    agentMigrationAppliedConfirmed: input?.agentMigrationAppliedConfirmed,
    operatorMigrationAppliedConfirmed: input?.operatorMigrationAppliedConfirmed,
    agentFeatureFlagWireApproved: input?.agentFeatureFlagWireApproved,
    operatorFeatureFlagWireApproved: input?.operatorFeatureFlagWireApproved,
    agentWriteAdapterImplementedConfirmed: input?.agentWriteAdapterImplementedConfirmed,
    operatorWriteAdapterImplementedConfirmed: input?.operatorWriteAdapterImplementedConfirmed,
    operatorPermissionModelConfirmed: input?.operatorPermissionModelConfirmed,
    operatorAuditTrailConfirmed: input?.operatorAuditTrailConfirmed,
    schemaMigrationReadinessConfirmed: input?.schemaMigrationReadinessConfirmed,
    explicitShadowApproval: input?.explicitShadowApproval,
    finalRuntimeApprovalConfirmed: input?.finalRuntimeApprovalConfirmed,
    routingShadowReviewConfirmed: input?.routingShadowReviewConfirmed,
    wireCandidateReviewConfirmed: input?.wireCandidateReviewConfirmed,
    stage1RegressionReviewConfirmed: input?.stage1RegressionReviewConfirmed,
    rollbackPlanReviewConfirmed: input?.rollbackPlanReviewConfirmed,
    operatorAuditReviewConfirmed: input?.operatorAuditReviewConfirmed,
  });

  const noRunPolicySatisfied = verifyNoRunPolicy(runtimeFinalApproval);

  const decision = resolveClosureDecision({
    runtimeFinalApprovalDecision: runtimeFinalApproval.decision,
    wireCandidateDecision: runtimeFinalApproval.sourceWireCandidateDecision,
    routingShadowDecision: runtimeFinalApproval.sourceRoutingShadowDecision,
    finalRuntimeApprovalConfirmed: runtimeFinalApproval.finalRuntimeApprovalConfirmed,
    routingShadowReviewConfirmed: runtimeFinalApproval.routingShadowReviewConfirmed,
    wireCandidateReviewConfirmed: runtimeFinalApproval.wireCandidateReviewConfirmed,
    operatorAuditReviewConfirmed: runtimeFinalApproval.operatorAuditReviewConfirmed,
    noRunPolicySatisfied,
  });

  const sourceRuntimeBlockingFindingCodes = uniqueStrings([
    ...runtimeFinalApproval.findings
      .filter((f) => f.severity === "blocking")
      .map((f) => f.code),
    ...runtimeFinalApproval.sourceRoutingShadowBlockingFindingCodes,
    ...runtimeFinalApproval.sourceWireCandidateBlockingFindingCodes,
  ]);

  const runtimeFinalApprovalReady =
    runtimeFinalApproval.decision === RUNTIME_FINAL_APPROVAL_READY;

  const closureChecklist = buildClosureChecklist({
    runtimeFinalApprovalReady,
    runtimeFinalApprovalDecision: runtimeFinalApproval.decision,
    routingShadowReviewConfirmed: runtimeFinalApproval.routingShadowReviewConfirmed,
    wireCandidateReviewConfirmed: runtimeFinalApproval.wireCandidateReviewConfirmed,
    operatorAuditReviewConfirmed: runtimeFinalApproval.operatorAuditReviewConfirmed,
    finalRuntimeApprovalConfirmed: runtimeFinalApproval.finalRuntimeApprovalConfirmed,
    noRunPolicySatisfied,
  });

  const noRunChecklist = buildNoRunChecklist({ runtimeFinalApproval });
  const handoffChecklist = buildHandoffChecklist();
  const riskChecklist = buildRiskChecklist({
    requiresStage1Regression: runtimeFinalApproval.sourceRoutingShadowRequiresStage1Regression,
    requiresRollbackPlan: runtimeFinalApproval.sourceRoutingShadowRequiresRollbackPlan,
    operatorAuditReviewConfirmed: runtimeFinalApproval.operatorAuditReviewConfirmed,
    schemaMigrationReviewConfirmed: runtimeFinalApproval.sourceWireCandidateSchemaMigrationReviewConfirmed,
    routingShadowReviewConfirmed: runtimeFinalApproval.routingShadowReviewConfirmed,
    wireCandidateReviewConfirmed: runtimeFinalApproval.wireCandidateReviewConfirmed,
  });

  const recommendedNextPhases = buildRecommendedNextPhases({
    decision,
    schemaNotApplied: !runtimeFinalApproval.sourceWireCandidateSchemaAppliedInRuntime,
    routingNotChanged: runtimeFinalApproval.changesConnectorRoutingInThisStep === false,
    writePathNotWired: runtimeFinalApproval.wiresWritePathInThisStep === false,
  });

  const findings: Stage2IntegratedClosureVerdictFinding[] = [];
  appendClosureFindings({
    findings,
    decision,
    runtimeFinalApprovalDecision: runtimeFinalApproval.decision,
    routingShadowDecision: runtimeFinalApproval.sourceRoutingShadowDecision,
    wireCandidateDecision: runtimeFinalApproval.sourceWireCandidateDecision,
    finalRuntimeApprovalConfirmed: runtimeFinalApproval.finalRuntimeApprovalConfirmed,
    routingShadowReviewConfirmed: runtimeFinalApproval.routingShadowReviewConfirmed,
    wireCandidateReviewConfirmed: runtimeFinalApproval.wireCandidateReviewConfirmed,
    operatorAuditReviewConfirmed: runtimeFinalApproval.operatorAuditReviewConfirmed,
    noRunPolicySatisfied,
  });

  return {
    mode: "read_only_stage2_integrated_closure_verdict",
    decision,
    sourceRuntimeFinalApprovalDecision: runtimeFinalApproval.decision,
    sourceWireCandidateDecision: runtimeFinalApproval.sourceWireCandidateDecision,
    sourceRoutingShadowDecision: runtimeFinalApproval.sourceRoutingShadowDecision,
    sourceSchemaMigrationReadinessDecision: runtimeFinalApproval.sourceWireCandidateSchemaMigrationDecision,
    sourceRuntimeFinalApprovalConfirmed: runtimeFinalApproval.finalRuntimeApprovalConfirmed,
    sourceRoutingShadowReviewConfirmed: runtimeFinalApproval.routingShadowReviewConfirmed,
    sourceWireCandidateReviewConfirmed: runtimeFinalApproval.wireCandidateReviewConfirmed,
    sourceStage1RegressionReviewConfirmed: runtimeFinalApproval.stage1RegressionReviewConfirmed,
    sourceRollbackPlanReviewConfirmed: runtimeFinalApproval.rollbackPlanReviewConfirmed,
    sourceOperatorAuditReviewConfirmed: runtimeFinalApproval.operatorAuditReviewConfirmed,
    sourceRuntimeBlockingFindingCodes,
    sourceWireCandidateBlockingFindingCodes: [...runtimeFinalApproval.sourceWireCandidateBlockingFindingCodes],
    sourceRoutingShadowBlockingFindingCodes: [...runtimeFinalApproval.sourceRoutingShadowBlockingFindingCodes],
    closureChecklist,
    noRunChecklist,
    handoffChecklist,
    riskChecklist,
    recommendedNextPhases,
    closesStage2Only: true,
    executesRuntimeChangeInThisStep: false,
    changesConnectorRoutingInThisStep: false,
    wiresWritePathInThisStep: false,
    wiresAdapterInThisStep: false,
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
