import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateRuntimeExecutionPlanBuilder } from "@/lib/agents/evaluateRuntimeExecutionPlanBuilder";
import * as handoffModule from "@/lib/agents/evaluateRuntimeExecutionHandoffCandidate";

const CURSOR_BOUNDARY = ["cursor.execution.before"] as const;

function mockHandoffReady(): ReturnType<typeof handoffModule.evaluateRuntimeExecutionHandoffCandidate> {
  return {
    mode: "read_only_runtime_execution_handoff_candidate",
    decision: "ready_for_runtime_execution_handoff_design",
    sourceStage2Decision: "stage2_closure_ready",
    sourceStage2Scope: "read_only_multi_agent_runtime_foundation",
    sourceStage2ClosureSummary: "ready",
    sourceStage2NoRunPolicySatisfied: true,
    sourceStage2ExitCriteriaSatisfied: true,
    sourceStage2HandoffReady: true,
    sourceStage2RecommendedNextPhases: ["prepare_schema_migration_pr"],
    sourceStage2AggregatedBlockingFindingCodes: [],
    sourceStage2NoRunBlocking: false,
    sourceStage2PrerequisiteDeferred: false,
    requiresSchemaPrBeforeRuntime: true,
    requiresOperatorAuditSchemaPrBeforeRuntime: true,
    requiresConnectorExperimentBranchBeforeRuntime: true,
    requiresRuntimeExecutionWireDesignBeforeRuntime: true,
    requiresFeatureFlagWireBeforeRuntime: true,
    runtimeHandoffChecklist: [],
    preExecutionSafetyChecklist: [],
    prerequisitePolicyChecklist: [],
    prerequisiteApprovalChecklist: [],
    prerequisiteChecklist: [],
    evaluatesHandoffOnly: true,
    executesRuntimeInThisStep: false,
    changesConnectorRoutingInThisStep: false,
    wiresWritePathInThisStep: false,
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

const ALL_PLAN_REVIEW_INPUT = {
  schemaPrApproved: true,
  operatorAuditSchemaPrApproved: true,
  connectorExperimentBranchVerified: true,
  runtimeExecutionWireDesignApproved: true,
  featureFlagWireDesignApproved: true,
  finalOperatorConfirmationReady: true,
  rollbackPlanReviewed: true,
  stage1RegressionReviewed: true,
  operatorAuditReviewConfirmed: true,
} as const;

describe("multi-agent runtime execution plan builder stage 3-2", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mode is read_only_runtime_execution_plan_builder", () => {
    expect(evaluateRuntimeExecutionPlanBuilder().mode).toBe("read_only_runtime_execution_plan_builder");
  });

  it("default decision is defer", () => {
    expect(evaluateRuntimeExecutionPlanBuilder().decision).toBe("defer");
  });

  it("buildsPlanOnly is true", () => {
    expect(evaluateRuntimeExecutionPlanBuilder().buildsPlanOnly).toBe(true);
  });

  it("executesPlanInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanBuilder().executesPlanInThisStep).toBe(false);
  });

  it("executesRuntimeInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanBuilder().executesRuntimeInThisStep).toBe(false);
  });

  it("changesConnectorRoutingInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanBuilder().changesConnectorRoutingInThisStep).toBe(false);
  });

  it("wiresWritePathInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanBuilder().wiresWritePathInThisStep).toBe(false);
  });

  it("wiresFeatureFlagInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanBuilder().wiresFeatureFlagInThisStep).toBe(false);
  });

  it("writesDataInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanBuilder().writesDataInThisStep).toBe(false);
  });

  it("callsPrismaInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanBuilder().callsPrismaInThisStep).toBe(false);
  });

  it("modifiesSchemaInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanBuilder().modifiesSchemaInThisStep).toBe(false);
  });

  it("createsMigrationInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanBuilder().createsMigrationInThisStep).toBe(false);
  });

  it("createsPullRequestInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanBuilder().createsPullRequestInThisStep).toBe(false);
  });

  it("executesGitInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanBuilder().executesGitInThisStep).toBe(false);
  });

  it("callsCursorInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanBuilder().callsCursorInThisStep).toBe(false);
  });

  it("callsGitHubInThisStep is false", () => {
    expect(evaluateRuntimeExecutionPlanBuilder().callsGitHubInThisStep).toBe(false);
  });

  it("handoff blocked source returns blocked", () => {
    vi.spyOn(handoffModule, "evaluateRuntimeExecutionHandoffCandidate").mockReturnValue({
      ...mockHandoffReady(),
      decision: "blocked",
    });

    expect(evaluateRuntimeExecutionPlanBuilder(ALL_PLAN_REVIEW_INPUT).decision).toBe("blocked");
  });

  it("handoff defer source returns defer", () => {
    vi.spyOn(handoffModule, "evaluateRuntimeExecutionHandoffCandidate").mockReturnValue({
      ...mockHandoffReady(),
      decision: "defer",
    });

    expect(evaluateRuntimeExecutionPlanBuilder(ALL_PLAN_REVIEW_INPUT).decision).toBe("defer");
  });

  it("handoff ready with finalOperatorConfirmationReady false returns defer", () => {
    vi.spyOn(handoffModule, "evaluateRuntimeExecutionHandoffCandidate").mockReturnValue(mockHandoffReady());

    expect(
      evaluateRuntimeExecutionPlanBuilder({
        ...ALL_PLAN_REVIEW_INPUT,
        finalOperatorConfirmationReady: false,
      }).decision,
    ).toBe("defer");
  });

  it("handoff ready with rollbackPlanReviewed false returns defer", () => {
    vi.spyOn(handoffModule, "evaluateRuntimeExecutionHandoffCandidate").mockReturnValue(mockHandoffReady());

    expect(
      evaluateRuntimeExecutionPlanBuilder({
        ...ALL_PLAN_REVIEW_INPUT,
        rollbackPlanReviewed: false,
      }).decision,
    ).toBe("defer");
  });

  it("handoff ready with stage1RegressionReviewed false returns defer", () => {
    vi.spyOn(handoffModule, "evaluateRuntimeExecutionHandoffCandidate").mockReturnValue(mockHandoffReady());

    expect(
      evaluateRuntimeExecutionPlanBuilder({
        ...ALL_PLAN_REVIEW_INPUT,
        stage1RegressionReviewed: false,
      }).decision,
    ).toBe("defer");
  });

  it("all conditions satisfied returns ready_for_runtime_execution_plan_review", () => {
    vi.spyOn(handoffModule, "evaluateRuntimeExecutionHandoffCandidate").mockReturnValue(mockHandoffReady());

    const report = evaluateRuntimeExecutionPlanBuilder(ALL_PLAN_REVIEW_INPUT);
    expect(report.decision).toBe("ready_for_runtime_execution_plan_review");
    expect(report.planVersion).toBe(1);
  });

  it("planSteps has 9 entries", () => {
    const report = evaluateRuntimeExecutionPlanBuilder();
    expect(report.planSteps).toHaveLength(9);
  });

  it("planSteps sequence runs from 1 to 9", () => {
    const report = evaluateRuntimeExecutionPlanBuilder();
    expect(report.planSteps.map((s) => s.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("all planSteps executesInThisStep are false", () => {
    const report = evaluateRuntimeExecutionPlanBuilder();
    expect(report.planSteps.every((s) => s.executesInThisStep === false)).toBe(true);
  });

  it("noRunChecklist items are all satisfied", () => {
    const report = evaluateRuntimeExecutionPlanBuilder();
    expect(report.noRunChecklist.every((c) => c.satisfied)).toBe(true);
  });

  it("ready state includes runtime_execution_plan_candidate_created finding", () => {
    vi.spyOn(handoffModule, "evaluateRuntimeExecutionHandoffCandidate").mockReturnValue(mockHandoffReady());

    expect(
      evaluateRuntimeExecutionPlanBuilder(ALL_PLAN_REVIEW_INPUT).findings.some(
        (f) => f.code === "runtime_execution_plan_candidate_created",
      ),
    ).toBe(true);
  });

  it("ready finding message states not actual execution permission", () => {
    vi.spyOn(handoffModule, "evaluateRuntimeExecutionHandoffCandidate").mockReturnValue(mockHandoffReady());

    const readyFinding = evaluateRuntimeExecutionPlanBuilder(ALL_PLAN_REVIEW_INPUT).findings.find(
      (f) => f.code === "runtime_execution_plan_candidate_created",
    );
    expect(readyFinding?.message).toMatch(/not actual execution permission/i);
    expect(readyFinding?.message).toMatch(/design candidate only/i);
  });

  it("defer state excludes runtime_execution_plan_candidate_created finding", () => {
    expect(
      evaluateRuntimeExecutionPlanBuilder().findings.some(
        (f) => f.code === "runtime_execution_plan_candidate_created",
      ),
    ).toBe(false);
  });

  it("blocked state includes runtime_execution_plan_builder_blocked finding", () => {
    vi.spyOn(handoffModule, "evaluateRuntimeExecutionHandoffCandidate").mockReturnValue({
      ...mockHandoffReady(),
      decision: "blocked",
    });

    expect(
      evaluateRuntimeExecutionPlanBuilder(ALL_PLAN_REVIEW_INPUT).findings.some(
        (f) => f.code === "runtime_execution_plan_builder_blocked",
      ),
    ).toBe(true);
  });

  describe("integration via real handoff evaluator", () => {
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
    } as const;

    it("real chain remains defer because handoff candidate is not ready yet", () => {
      const report = evaluateRuntimeExecutionPlanBuilder(INTEGRATION_INPUT);
      expect(report.sourceHandoffDecision).toBe("defer");
      expect(report.decision).toBe("defer");
      expect(report.executesRuntimeInThisStep).toBe(false);
    });

    it("real chain still builds nine plan step candidates", () => {
      const report = evaluateRuntimeExecutionPlanBuilder(INTEGRATION_INPUT);
      expect(report.planSteps).toHaveLength(9);
      expect(report.planSteps.every((s) => s.executesInThisStep === false)).toBe(true);
    });
  });
});
