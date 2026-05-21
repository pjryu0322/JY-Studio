import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateRuntimeExecutionPlanPackage } from "@/lib/agents/evaluateRuntimeExecutionPlanPackage";
import * as planModule from "@/lib/agents/evaluateRuntimeExecutionPlanBuilder";

const CURSOR_BOUNDARY = ["cursor.execution.before"] as const;

function mockPlanReady(): ReturnType<typeof planModule.evaluateRuntimeExecutionPlanBuilder> {
  const planSteps = [
    "operator_approval",
    "stage1_regression_check",
    "schema_migration_pr_check",
    "operator_audit_schema_pr_check",
    "connector_experiment_branch_check",
    "feature_flag_check",
    "dry_run_execution_plan",
    "rollback_plan_check",
    "final_operator_confirmation",
  ].map((kind, index) => ({
    sequence: index + 1,
    kind,
    title: kind,
    required: true,
    satisfied: true,
    reason: `${kind}: satisfied`,
    executesInThisStep: false as const,
  }));

  return {
    mode: "read_only_runtime_execution_plan_builder",
    decision: "ready_for_runtime_execution_plan_review",
    sourceHandoffDecision: "ready_for_runtime_execution_handoff_design",
    sourceStage2Decision: "stage2_closure_ready",
    sourceStage2NoRunPolicySatisfied: true,
    sourceStage2ExitCriteriaSatisfied: true,
    sourceStage2HandoffReady: true,
    planCandidateId: "runtime-execution-plan-candidate-v1",
    planFingerprint: "runtime-plan-v1:ready:stage2_closure_ready:satisfied-9:missing-none",
    planVersion: 1,
    planTitle: "plan",
    planSummary: "ready",
    planSteps,
    planChecklist: [],
    noRunChecklist: [],
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
    findings: [],
  };
}

const ALL_PACKAGE_REVIEW_INPUT = {
  schemaPrApproved: true,
  operatorAuditSchemaPrApproved: true,
  connectorExperimentBranchVerified: true,
  runtimeExecutionWireDesignApproved: true,
  featureFlagWireDesignApproved: true,
  finalOperatorConfirmationReady: true,
  rollbackPlanReviewed: true,
  stage1RegressionReviewed: true,
  operatorApprovalConfirmed: true,
  operatorAuditReviewConfirmed: true,
  dryRunReviewConfirmed: true,
  approvalGateReviewConfirmed: true,
  safetyChecklistReviewed: true,
} as const;

describe("multi-agent runtime execution plan package stage 3-A", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mode is read_only_runtime_execution_plan_package", () => {
    expect(evaluateRuntimeExecutionPlanPackage().mode).toBe("read_only_runtime_execution_plan_package");
  });

  it("stage is stage_3_a", () => {
    expect(evaluateRuntimeExecutionPlanPackage().stage).toBe("stage_3_a");
  });

  it("default decision is defer", () => {
    expect(evaluateRuntimeExecutionPlanPackage().decision).toBe("defer");
  });

  it("buildsPackageOnly is true", () => {
    expect(evaluateRuntimeExecutionPlanPackage().buildsPackageOnly).toBe(true);
  });

  it("executesPlanInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanPackage().executesPlanInThisStep).toBe(false);
  });

  it("executesRuntimeInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanPackage().executesRuntimeInThisStep).toBe(false);
  });

  it("changesConnectorRoutingInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanPackage().changesConnectorRoutingInThisStep).toBe(false);
  });

  it("wiresWritePathInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanPackage().wiresWritePathInThisStep).toBe(false);
  });

  it("wiresFeatureFlagInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanPackage().wiresFeatureFlagInThisStep).toBe(false);
  });

  it("writesDataInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanPackage().writesDataInThisStep).toBe(false);
  });

  it("callsPrismaInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanPackage().callsPrismaInThisStep).toBe(false);
  });

  it("modifiesSchemaInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanPackage().modifiesSchemaInThisStep).toBe(false);
  });

  it("createsMigrationInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanPackage().createsMigrationInThisStep).toBe(false);
  });

  it("createsPullRequestInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanPackage().createsPullRequestInThisStep).toBe(false);
  });

  it("executesGitInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanPackage().executesGitInThisStep).toBe(false);
  });

  it("callsCursorInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanPackage().callsCursorInThisStep).toBe(false);
  });

  it("callsGitHubInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanPackage().callsGitHubInThisStep).toBe(false);
  });

  it("source plan blocked returns blocked", () => {
    vi.spyOn(planModule, "evaluateRuntimeExecutionPlanBuilder").mockReturnValue({
      ...mockPlanReady(),
      decision: "blocked",
    });

    expect(evaluateRuntimeExecutionPlanPackage(ALL_PACKAGE_REVIEW_INPUT).decision).toBe("blocked");
  });

  it("source plan defer returns defer", () => {
    vi.spyOn(planModule, "evaluateRuntimeExecutionPlanBuilder").mockReturnValue({
      ...mockPlanReady(),
      decision: "defer",
    });

    expect(evaluateRuntimeExecutionPlanPackage(ALL_PACKAGE_REVIEW_INPUT).decision).toBe("defer");
  });

  it("source plan ready with dryRunReviewConfirmed false returns defer", () => {
    vi.spyOn(planModule, "evaluateRuntimeExecutionPlanBuilder").mockReturnValue(mockPlanReady());

    expect(
      evaluateRuntimeExecutionPlanPackage({
        ...ALL_PACKAGE_REVIEW_INPUT,
        dryRunReviewConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("source plan ready with approvalGateReviewConfirmed false returns defer", () => {
    vi.spyOn(planModule, "evaluateRuntimeExecutionPlanBuilder").mockReturnValue(mockPlanReady());

    expect(
      evaluateRuntimeExecutionPlanPackage({
        ...ALL_PACKAGE_REVIEW_INPUT,
        approvalGateReviewConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("source plan ready with safetyChecklistReviewed false returns defer", () => {
    vi.spyOn(planModule, "evaluateRuntimeExecutionPlanBuilder").mockReturnValue(mockPlanReady());

    expect(
      evaluateRuntimeExecutionPlanPackage({
        ...ALL_PACKAGE_REVIEW_INPUT,
        safetyChecklistReviewed: false,
      }).decision,
    ).toBe("defer");
  });

  it("all conditions satisfied returns ready_for_runtime_execution_approval_gate", () => {
    vi.spyOn(planModule, "evaluateRuntimeExecutionPlanBuilder").mockReturnValue(mockPlanReady());

    const report = evaluateRuntimeExecutionPlanPackage(ALL_PACKAGE_REVIEW_INPUT);
    expect(report.decision).toBe("ready_for_runtime_execution_approval_gate");
    expect(report.packageVersion).toBe(1);
  });

  it("dryRunCandidate simulatedOnly is true", () => {
    expect(evaluateRuntimeExecutionPlanPackage().dryRunCandidate.simulatedOnly).toBe(true);
  });

  it("dryRunCandidate executesRuntimeInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanPackage().dryRunCandidate.executesRuntimeInThisStep).toBe(false);
  });

  it("dryRunCandidate status is dry_run_deferred when plan defers", () => {
    vi.spyOn(planModule, "evaluateRuntimeExecutionPlanBuilder").mockReturnValue({
      ...mockPlanReady(),
      decision: "defer",
    });

    expect(evaluateRuntimeExecutionPlanPackage(ALL_PACKAGE_REVIEW_INPUT).dryRunCandidate.status).toBe(
      "dry_run_deferred",
    );
  });

  it("dryRunCandidate status is dry_run_blocked when plan blocked", () => {
    vi.spyOn(planModule, "evaluateRuntimeExecutionPlanBuilder").mockReturnValue({
      ...mockPlanReady(),
      decision: "blocked",
    });

    expect(evaluateRuntimeExecutionPlanPackage(ALL_PACKAGE_REVIEW_INPUT).dryRunCandidate.status).toBe(
      "dry_run_blocked",
    );
  });

  it("dryRunCandidate status is dry_run_ready when plan ready", () => {
    vi.spyOn(planModule, "evaluateRuntimeExecutionPlanBuilder").mockReturnValue(mockPlanReady());

    expect(evaluateRuntimeExecutionPlanPackage(ALL_PACKAGE_REVIEW_INPUT).dryRunCandidate.status).toBe(
      "dry_run_ready",
    );
  });

  it("approvalReadiness totalCount is 7", () => {
    expect(evaluateRuntimeExecutionPlanPackage().approvalReadiness.totalCount).toBe(7);
  });

  it("approvalReadiness readyCount is accurate when all ready", () => {
    vi.spyOn(planModule, "evaluateRuntimeExecutionPlanBuilder").mockReturnValue(mockPlanReady());

    expect(evaluateRuntimeExecutionPlanPackage(ALL_PACKAGE_REVIEW_INPUT).approvalReadiness.readyCount).toBe(7);
    expect(evaluateRuntimeExecutionPlanPackage(ALL_PACKAGE_REVIEW_INPUT).approvalReadiness.missing).toEqual([]);
  });

  it("approvalReadiness missing is deterministic when schema step unsatisfied", () => {
    vi.spyOn(planModule, "evaluateRuntimeExecutionPlanBuilder").mockReturnValue({
      ...mockPlanReady(),
      planSteps: mockPlanReady().planSteps.map((s) =>
        s.kind === "schema_migration_pr_check" ? { ...s, satisfied: false } : s,
      ),
    });

    const missing = evaluateRuntimeExecutionPlanPackage(ALL_PACKAGE_REVIEW_INPUT).approvalReadiness.missing;
    expect(missing).toContain("schemaPrerequisitesReady");
  });

  it("executionPlanChecklist includes source plan review ready", () => {
    expect(
      evaluateRuntimeExecutionPlanPackage().executionPlanChecklist.some(
        (c) => c.item === "source plan review ready",
      ),
    ).toBe(true);
  });

  it("dryRunChecklist includes dry-run candidate simulated only", () => {
    expect(
      evaluateRuntimeExecutionPlanPackage().dryRunChecklist.some(
        (c) => c.item === "dry-run candidate simulated only",
      ),
    ).toBe(true);
  });

  it("approvalChecklist includes dryRunReviewConfirmed", () => {
    expect(
      evaluateRuntimeExecutionPlanPackage().approvalChecklist.some((c) => c.item === "dryRunReviewConfirmed"),
    ).toBe(true);
  });

  it("safetyChecklist items are all satisfied", () => {
    expect(evaluateRuntimeExecutionPlanPackage().safetyChecklist.every((c) => c.satisfied)).toBe(true);
  });

  it("ready finding message states not actual execution permission", () => {
    vi.spyOn(planModule, "evaluateRuntimeExecutionPlanBuilder").mockReturnValue(mockPlanReady());

    const readyFinding = evaluateRuntimeExecutionPlanPackage(ALL_PACKAGE_REVIEW_INPUT).findings.find(
      (f) => f.code === "runtime_execution_plan_package_ready_for_approval_gate",
    );
    expect(readyFinding?.message).toMatch(/not actual execution permission/i);
    expect(readyFinding?.message).toMatch(/package candidate only/i);
  });

  it("ready finding message states Stage 3-B approval gate required", () => {
    vi.spyOn(planModule, "evaluateRuntimeExecutionPlanBuilder").mockReturnValue(mockPlanReady());

    const readyFinding = evaluateRuntimeExecutionPlanPackage(ALL_PACKAGE_REVIEW_INPUT).findings.find(
      (f) => f.code === "runtime_execution_plan_package_ready_for_approval_gate",
    );
    expect(readyFinding?.message).toMatch(/Stage 3-B approval gate required/i);
  });

  it("defer state excludes runtime_execution_plan_package_ready finding", () => {
    expect(
      evaluateRuntimeExecutionPlanPackage().findings.some(
        (f) => f.code === "runtime_execution_plan_package_ready_for_approval_gate",
      ),
    ).toBe(false);
  });

  it("blocked state includes runtime_execution_plan_package_blocked finding", () => {
    vi.spyOn(planModule, "evaluateRuntimeExecutionPlanBuilder").mockReturnValue({
      ...mockPlanReady(),
      decision: "blocked",
    });

    expect(
      evaluateRuntimeExecutionPlanPackage(ALL_PACKAGE_REVIEW_INPUT).findings.some(
        (f) => f.code === "runtime_execution_plan_package_blocked",
      ),
    ).toBe(true);
  });

  describe("integration via real plan builder chain", () => {
    const INTEGRATION_INPUT = {
      explicitShadowApproval: true,
      finalRuntimeApprovalConfirmed: true,
      routingShadowReviewConfirmed: true,
      wireCandidateReviewConfirmed: true,
      stage1RegressionReviewConfirmed: true,
      rollbackPlanReviewConfirmed: true,
      operatorAuditReviewConfirmed: true,
      schemaMigrationReadinessConfirmed: true,
      agentExplicitUserApproval: true,
      operatorExplicitUserApproval: true,
      agentSchemaAppliedConfirmed: true,
      operatorSchemaAppliedConfirmed: true,
      agentMigrationAppliedConfirmed: true,
      operatorMigrationAppliedConfirmed: true,
      agentFeatureFlagWireApproved: true,
      operatorFeatureFlagWireApproved: true,
      agentWriteAdapterImplementedConfirmed: true,
      operatorWriteAdapterImplementedConfirmed: true,
      operatorPermissionModelConfirmed: true,
      operatorAuditTrailConfirmed: true,
      routingTarget: "cursor_only",
      routingBoundaryIds: [...CURSOR_BOUNDARY],
      routingConnectorIds: ["cursor"],
      agentTarget: "agent_execution_record",
      operatorTarget: "operator_approval",
      schemaPrApproved: true,
      operatorAuditSchemaPrApproved: true,
      connectorExperimentBranchVerified: true,
      runtimeExecutionWireDesignApproved: true,
      featureFlagWireDesignApproved: true,
      finalOperatorConfirmationReady: true,
      rollbackPlanReviewed: true,
      stage1RegressionReviewed: true,
      operatorApprovalConfirmed: true,
      dryRunReviewConfirmed: true,
      approvalGateReviewConfirmed: true,
      safetyChecklistReviewed: true,
    } as const;

    it("real upstream chain remains defer because plan builder is not ready yet", () => {
      const report = evaluateRuntimeExecutionPlanPackage(INTEGRATION_INPUT);
      expect(report.sourcePlanDecision).toBe("defer");
      expect(report.decision).toBe("defer");
      expect(report.executesRuntimeInThisStep).toBe(false);
    });

    it("real chain still exposes dryRunCandidate with nine candidate steps", () => {
      const report = evaluateRuntimeExecutionPlanPackage(INTEGRATION_INPUT);
      expect(report.dryRunCandidate.candidateSteps).toHaveLength(9);
      expect(report.dryRunCandidate.simulatedOnly).toBe(true);
    });
  });
});
