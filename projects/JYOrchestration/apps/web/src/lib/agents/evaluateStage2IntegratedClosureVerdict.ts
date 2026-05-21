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
  Stage2Stage3Candidate,
} from "@/lib/agents/stage2IntegratedClosureVerdictTypes";

const RUNTIME_FINAL_APPROVAL_READY = "ready_for_final_runtime_change_approval";

const NEXT_PHASE_ORDER: readonly Stage2NextPhaseRecommendation[] = [
  "continue_read_only_hardening",
  "prepare_schema_migration_pr",
  "prepare_operator_audit_schema_pr",
  "prepare_connector_gateway_experiment_branch",
  "prepare_runtime_execution_wire_design",
];

function finding(
  severity: Stage2IntegratedClosureVerdictFinding["severity"],
  code: string,
  message: string,
): Stage2IntegratedClosureVerdictFinding {
  return { severity, code, message };
}

type ChecklistEntry = {
  readonly item: string;
  readonly satisfied: boolean;
  readonly detail: string;
};

function checklistReason(input: ChecklistEntry): string {
  return `${input.item}: ${input.satisfied ? "satisfied" : "not satisfied"} — ${input.detail}`;
}

function mapChecklistEntries(
  entries: readonly ChecklistEntry[],
): Stage2IntegratedClosureVerdictChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied,
    reason: checklistReason(entry),
  }));
}

function checklistAllSatisfied(
  checklist: readonly Stage2IntegratedClosureVerdictChecklistItem[],
): boolean {
  return checklist.every((entry) => entry.satisfied);
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

function resolveStage3Candidate(decision: Stage2IntegratedClosureVerdictDecision): Stage2Stage3Candidate {
  return decision === "stage2_closure_ready"
    ? "runtime_execution_handoff_design"
    : "schema_pr_preparation";
}

function buildRecommendedNextPhases(input: {
  readonly decision: Stage2IntegratedClosureVerdictDecision;
  readonly schemaNotApplied: boolean;
  readonly routingNotChanged: boolean;
  readonly writePathNotWired: boolean;
}): Stage2NextPhaseRecommendation[] {
  const include = new Set<Stage2NextPhaseRecommendation>();

  if (input.decision !== "stage2_closure_ready") {
    include.add("continue_read_only_hardening");
  }

  if (input.schemaNotApplied) {
    include.add("prepare_schema_migration_pr");
    include.add("prepare_operator_audit_schema_pr");
  }

  if (input.routingNotChanged) {
    include.add("prepare_connector_gateway_experiment_branch");
  }

  if (input.writePathNotWired) {
    include.add("prepare_runtime_execution_wire_design");
  }

  if (input.decision === "stage2_closure_ready") {
    include.add("prepare_schema_migration_pr");
    include.add("prepare_operator_audit_schema_pr");
    include.add("prepare_connector_gateway_experiment_branch");
    include.add("prepare_runtime_execution_wire_design");
  }

  return NEXT_PHASE_ORDER.filter((phase) => include.has(phase));
}

function buildStage2ClosureSummary(input: {
  readonly decision: Stage2IntegratedClosureVerdictDecision;
  readonly noRunPolicySatisfied: boolean;
  readonly recommendedNextPhases: readonly Stage2NextPhaseRecommendation[];
}): string {
  if (input.decision === "stage2_closure_ready") {
    return (
      "Stage 2 read-only multi-agent runtime foundation is ready for closure. " +
      "Actual runtime, connector routing, write path, feature flag, DB, Prisma, schema, migration, git, Cursor, and GitHub changes remain out of scope and require separate PRs or explicit operator approval. " +
      `Recommended next phases: ${input.recommendedNextPhases.join(", ")}.`
    );
  }

  if (input.decision === "blocked") {
    return (
      "Stage 2 integrated closure is blocked. Resolve blocking findings in runtime final approval, routing shadow, or wire candidate verification before closure. " +
      `No-run policy satisfied=${input.noRunPolicySatisfied}.`
    );
  }

  return (
    "Stage 2 integrated closure defers until runtime final approval, reviews, and read-only hardening prerequisites are met. " +
    `Recommended next phases: ${input.recommendedNextPhases.join(", ")}.`
  );
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
  const entries: { item: string; satisfied: boolean; detail: string }[] = [
    {
      item: "runtime final approval package ready",
      satisfied: input.runtimeFinalApprovalReady,
      detail: `runtime final approval decision=${input.runtimeFinalApprovalDecision}`,
    },
    {
      item: "routing shadow reviewed",
      satisfied: input.routingShadowReviewConfirmed,
      detail: `routingShadowReviewConfirmed=${input.routingShadowReviewConfirmed}`,
    },
    {
      item: "wire candidate reviewed",
      satisfied: input.wireCandidateReviewConfirmed,
      detail: `wireCandidateReviewConfirmed=${input.wireCandidateReviewConfirmed}`,
    },
    {
      item: "operator audit reviewed",
      satisfied: input.operatorAuditReviewConfirmed,
      detail: `operatorAuditReviewConfirmed=${input.operatorAuditReviewConfirmed}`,
    },
    {
      item: "final approval confirmed",
      satisfied: input.finalRuntimeApprovalConfirmed,
      detail: `finalRuntimeApprovalConfirmed=${input.finalRuntimeApprovalConfirmed}`,
    },
    {
      item: "Stage 2 remains read-only",
      satisfied: input.noRunPolicySatisfied,
      detail: `noRunPolicySatisfied=${input.noRunPolicySatisfied}; Stage 2 no-run foundation only`,
    },
  ];

  return mapChecklistEntries(entries);
}

function buildNoRunChecklist(input: {
  readonly runtimeFinalApproval: ReturnType<typeof evaluateRuntimeChangeFinalApprovalPackage>;
  readonly noRunPolicySatisfied: boolean;
}): Stage2IntegratedClosureVerdictChecklistItem[] {
  const r = input.runtimeFinalApproval;

  const flagDetail = (label: string, value: boolean): string =>
    `${label}=${value}; Stage 2 no-run policy; no actual execution in this step`;

  const entries: ChecklistEntry[] = [
    {
      item: "no runtime change",
      satisfied: r.changesRuntimeInThisStep === false,
      detail: flagDetail("changesRuntimeInThisStep", r.changesRuntimeInThisStep === false),
    },
    {
      item: "no connector routing change",
      satisfied: r.changesConnectorRoutingInThisStep === false,
      detail: flagDetail("changesConnectorRoutingInThisStep", r.changesConnectorRoutingInThisStep === false),
    },
    {
      item: "no write path wire",
      satisfied: r.wiresWritePathInThisStep === false,
      detail: flagDetail("wiresWritePathInThisStep", r.wiresWritePathInThisStep === false),
    },
    {
      item: "no adapter wire",
      satisfied: r.wiresAdapterInThisStep === false,
      detail: flagDetail("wiresAdapterInThisStep", r.wiresAdapterInThisStep === false),
    },
    {
      item: "no feature flag wire",
      satisfied: r.wiresFeatureFlagInThisStep === false,
      detail: flagDetail("wiresFeatureFlagInThisStep", r.wiresFeatureFlagInThisStep === false),
    },
    {
      item: "no DB write",
      satisfied: r.writesDataInThisStep === false,
      detail: flagDetail("writesDataInThisStep", r.writesDataInThisStep === false),
    },
    {
      item: "no Prisma call",
      satisfied: r.callsPrismaInThisStep === false,
      detail: flagDetail("callsPrismaInThisStep", r.callsPrismaInThisStep === false),
    },
    {
      item: "no schema change",
      satisfied: r.modifiesSchemaInThisStep === false,
      detail: flagDetail("modifiesSchemaInThisStep", r.modifiesSchemaInThisStep === false),
    },
    {
      item: "no migration",
      satisfied: r.createsMigrationInThisStep === false,
      detail: flagDetail("createsMigrationInThisStep", r.createsMigrationInThisStep === false),
    },
    {
      item: "no pull request creation",
      satisfied: true,
      detail: "no PR created in this step; separate PR required after Stage 2",
    },
    {
      item: "no git execution",
      satisfied: r.executesGitInThisStep === false,
      detail: flagDetail("executesGitInThisStep", r.executesGitInThisStep === false),
    },
    {
      item: "no Cursor call",
      satisfied: r.callsCursorInThisStep === false,
      detail: flagDetail("callsCursorInThisStep", r.callsCursorInThisStep === false),
    },
    {
      item: "no GitHub call",
      satisfied: r.callsGitHubInThisStep === false,
      detail: flagDetail("callsGitHubInThisStep", r.callsGitHubInThisStep === false),
    },
  ];

  return entries.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied && input.noRunPolicySatisfied,
    reason: checklistReason({
      ...entry,
      detail: `${entry.detail}; aggregate noRunPolicySatisfied=${input.noRunPolicySatisfied}`,
    }),
  }));
}

function buildHandoffChecklist(): Stage2IntegratedClosureVerdictChecklistItem[] {
  const entries: ChecklistEntry[] = [
    {
      item: "schema/migration PR must be separate",
      satisfied: true,
      detail: "requires separate schema/migration PR; not performed in Stage 2 closure step",
    },
    {
      item: "connector gateway experiment branch must be separate",
      satisfied: true,
      detail: "requires separate connector gateway experiment branch; not created in this step",
    },
    {
      item: "write path wire must be separate",
      satisfied: true,
      detail: "requires separate write path wire approval; not wired in this step",
    },
    {
      item: "feature flag wire must be separate",
      satisfied: true,
      detail: "requires separate feature flag wire PR; not wired in this step",
    },
    {
      item: "operator approval/audit persistence must be separate",
      satisfied: true,
      detail: "requires separate operator approval/audit persistence work; deferred after Stage 2",
    },
    {
      item: "runtime execution change must be separate",
      satisfied: true,
      detail: "requires separate runtime execution change stage; not executed in Stage 2",
    },
  ];

  return mapChecklistEntries(entries);
}

function buildRiskChecklist(input: {
  readonly requiresStage1Regression: boolean;
  readonly stage1RegressionReviewConfirmed: boolean;
  readonly requiresRollbackPlan: boolean;
  readonly rollbackPlanReviewConfirmed: boolean;
  readonly operatorAuditReviewConfirmed: boolean;
  readonly schemaMigrationReviewConfirmed: boolean;
  readonly routingShadowReviewConfirmed: boolean;
  readonly wireCandidateReviewConfirmed: boolean;
}): Stage2IntegratedClosureVerdictChecklistItem[] {
  const stage1Satisfied =
    !input.requiresStage1Regression || input.stage1RegressionReviewConfirmed;
  const rollbackSatisfied = !input.requiresRollbackPlan || input.rollbackPlanReviewConfirmed;

  const entries: ChecklistEntry[] = [
    {
      item: "Stage1 regression risk acknowledged",
      satisfied: stage1Satisfied,
      detail: input.requiresStage1Regression
        ? `risk required=true; stage1RegressionReviewConfirmed=${input.stage1RegressionReviewConfirmed}; deferred to post-Stage-2 if required`
        : `risk not required; stage1RegressionReviewConfirmed=${input.stage1RegressionReviewConfirmed}`,
    },
    {
      item: "rollback risk acknowledged",
      satisfied: rollbackSatisfied,
      detail: `risk required=${input.requiresRollbackPlan}; rollbackPlanReviewConfirmed=${input.rollbackPlanReviewConfirmed}`,
    },
    {
      item: "operator audit risk acknowledged",
      satisfied: input.operatorAuditReviewConfirmed,
      detail: `risk source=operator audit; operatorAuditReviewConfirmed=${input.operatorAuditReviewConfirmed}`,
    },
    {
      item: "schema migration risk acknowledged",
      satisfied: input.schemaMigrationReviewConfirmed,
      detail: `risk source=schema migration readiness; schemaMigrationReviewConfirmed=${input.schemaMigrationReviewConfirmed}`,
    },
    {
      item: "connector gateway routing risk acknowledged",
      satisfied: input.routingShadowReviewConfirmed,
      detail: `risk source=routing shadow; routingShadowReviewConfirmed=${input.routingShadowReviewConfirmed}`,
    },
    {
      item: "write path data integrity risk acknowledged",
      satisfied: input.wireCandidateReviewConfirmed,
      detail: `risk source=write path candidate; wireCandidateReviewConfirmed=${input.wireCandidateReviewConfirmed}`,
    },
  ];

  return mapChecklistEntries(entries);
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
    findings.push(
      finding(
        "blocking",
        "stage2_closure_requires_blocking_issue_resolution",
        "Stage 2 closure requires blocking issue resolution before proceeding",
      ),
    );
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
    findings.push(
      finding(
        "warning",
        "stage2_closure_requires_additional_read_only_hardening",
        "Stage 2 closure requires additional read-only hardening before closure",
      ),
    );
    return;
  }

  findings.push(
    finding("info", "runtime_final_approval_package_ready", "runtime final approval package is ready"),
  );
  findings.push(finding("info", "stage2_closure_ready", "Stage 2 integrated closure is ready"));
  findings.push(
    finding("info", "stage2_read_only_foundation_complete", "Stage 2 read-only multi-agent runtime foundation is complete"),
  );
  findings.push(
    finding(
      "info",
      "actual_runtime_change_requires_stage3_or_separate_pr",
      "actual runtime change requires Stage 3 or a separate PR; not allowed immediately after Stage 2",
    ),
  );
  findings.push(
    finding(
      "info",
      "schema_migration_requires_separate_pr",
      "schema/migration changes require a separate PR after Stage 2 closure",
    ),
  );
  findings.push(
    finding(
      "info",
      "connector_gateway_routing_requires_experiment_branch",
      "connector gateway routing changes require a separate experiment branch",
    ),
  );
  findings.push(
    finding(
      "info",
      "write_path_wire_requires_separate_approval",
      "write path wire requires separate operator approval after Stage 2",
    ),
  );
  findings.push(
    finding(
      "info",
      "feature_flag_wire_requires_separate_approval",
      "feature flag wire requires separate approval after Stage 2",
    ),
  );
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

  const noRunChecklist = buildNoRunChecklist({ runtimeFinalApproval, noRunPolicySatisfied });
  const handoffChecklist = buildHandoffChecklist();
  const riskChecklist = buildRiskChecklist({
    requiresStage1Regression: runtimeFinalApproval.sourceRoutingShadowRequiresStage1Regression,
    requiresRollbackPlan: runtimeFinalApproval.sourceRoutingShadowRequiresRollbackPlan,
    stage1RegressionReviewConfirmed: runtimeFinalApproval.stage1RegressionReviewConfirmed,
    rollbackPlanReviewConfirmed: runtimeFinalApproval.rollbackPlanReviewConfirmed,
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

  const stage2ExitCriteriaSatisfied = checklistAllSatisfied(closureChecklist);
  const stage2HandoffReady = checklistAllSatisfied(handoffChecklist);

  const stage2ClosureSummary = buildStage2ClosureSummary({
    decision,
    noRunPolicySatisfied,
    recommendedNextPhases,
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
    stage2Scope: "read_only_multi_agent_runtime_foundation",
    stage2ClosureSummary,
    actualRuntimeChangeAllowedAfterStage2: false,
    requiresSeparateSchemaPr: true,
    requiresSeparateOperatorAuditSchemaPr: true,
    requiresSeparateConnectorExperimentBranch: true,
    requiresSeparateRuntimeExecutionWireDesign: true,
    requiresSeparateFeatureFlagWire: true,
    stage3Candidate: resolveStage3Candidate(decision),
    stage2ExitCriteriaSatisfied,
    stage2NoRunPolicySatisfied: noRunPolicySatisfied && noRunChecklist.every((c) => c.satisfied),
    stage2HandoffReady,
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
