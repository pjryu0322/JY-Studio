import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateRuntimeExecutionHandoffCandidate } from "@/lib/agents/evaluateRuntimeExecutionHandoffCandidate";
import * as stage2Module from "@/lib/agents/evaluateStage2IntegratedClosureVerdict";

const CURSOR_BOUNDARY = ["cursor.execution.before"] as const;

function checklistItem(
  report: ReturnType<typeof evaluateRuntimeExecutionHandoffCandidate>,
  list: "runtimeHandoffChecklist" | "preExecutionSafetyChecklist" | "prerequisiteChecklist",
  item: string,
) {
  return report[list].find((c) => c.item === item);
}

function mockStage2Ready(): ReturnType<typeof stage2Module.evaluateStage2IntegratedClosureVerdict> {
  return {
    mode: "read_only_stage2_integrated_closure_verdict",
    decision: "stage2_closure_ready",
    stage2Scope: "read_only_multi_agent_runtime_foundation",
    stage2ClosureSummary: "ready",
    actualRuntimeChangeAllowedAfterStage2: false,
    requiresSeparateSchemaPr: true,
    requiresSeparateOperatorAuditSchemaPr: true,
    requiresSeparateConnectorExperimentBranch: true,
    requiresSeparateRuntimeExecutionWireDesign: true,
    requiresSeparateFeatureFlagWire: true,
    stage3Candidate: "runtime_execution_handoff_design",
    stage2ExitCriteriaSatisfied: true,
    stage2NoRunPolicySatisfied: true,
    stage2HandoffPlanDocumented: true,
    stage2HandoffReady: true,
    sourceRuntimeFinalApprovalDecision: "ready_for_final_runtime_change_approval",
    sourceWireCandidateDecision: "ready_for_wire_candidate_verification",
    sourceRoutingShadowDecision: "shadow_ready",
    sourceSchemaMigrationReadinessDecision: "ready_for_schema_migration_pr_readiness",
    sourceRuntimeFinalApprovalConfirmed: true,
    sourceRoutingShadowReviewConfirmed: true,
    sourceWireCandidateReviewConfirmed: true,
    sourceStage1RegressionReviewConfirmed: true,
    sourceRollbackPlanReviewConfirmed: true,
    sourceOperatorAuditReviewConfirmed: true,
    sourceRuntimeBlockingFindingCodes: [],
    sourceAggregatedBlockingFindingCodes: [],
    sourceWireCandidateBlockingFindingCodes: [],
    sourceRoutingShadowBlockingFindingCodes: [],
    closureChecklist: [],
    noRunChecklist: [],
    handoffChecklist: [],
    riskChecklist: [],
    recommendedNextPhases: ["prepare_schema_migration_pr"],
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
    findings: [],
  };
}

const ALL_HANDOFF_APPROVALS = {
  schemaPrApproved: true,
  operatorAuditSchemaPrApproved: true,
  connectorExperimentBranchVerified: true,
  runtimeExecutionWireDesignApproved: true,
  featureFlagWireDesignApproved: true,
} as const;

describe("multi-agent runtime execution handoff candidate stage 3-1", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mode is read_only_runtime_execution_handoff_candidate", () => {
    expect(evaluateRuntimeExecutionHandoffCandidate().mode).toBe(
      "read_only_runtime_execution_handoff_candidate",
    );
  });

  it("default decision is defer", () => {
    expect(evaluateRuntimeExecutionHandoffCandidate().decision).toBe("defer");
  });

  it("evaluatesHandoffOnly is true", () => {
    expect(evaluateRuntimeExecutionHandoffCandidate().evaluatesHandoffOnly).toBe(true);
  });

  it("executesRuntimeInThisStep is false", () => {
    expect(evaluateRuntimeExecutionHandoffCandidate().executesRuntimeInThisStep).toBe(false);
  });

  it("changesConnectorRoutingInThisStep is false", () => {
    expect(evaluateRuntimeExecutionHandoffCandidate().changesConnectorRoutingInThisStep).toBe(false);
  });

  it("wiresWritePathInThisStep is false", () => {
    expect(evaluateRuntimeExecutionHandoffCandidate().wiresWritePathInThisStep).toBe(false);
  });

  it("writesDataInThisStep is false", () => {
    expect(evaluateRuntimeExecutionHandoffCandidate().writesDataInThisStep).toBe(false);
  });

  it("callsPrismaInThisStep is false", () => {
    expect(evaluateRuntimeExecutionHandoffCandidate().callsPrismaInThisStep).toBe(false);
  });

  it("modifiesSchemaInThisStep is false", () => {
    expect(evaluateRuntimeExecutionHandoffCandidate().modifiesSchemaInThisStep).toBe(false);
  });

  it("createsMigrationInThisStep is false", () => {
    expect(evaluateRuntimeExecutionHandoffCandidate().createsMigrationInThisStep).toBe(false);
  });

  it("createsPullRequestInThisStep is false", () => {
    expect(evaluateRuntimeExecutionHandoffCandidate().createsPullRequestInThisStep).toBe(false);
  });

  it("executesGitInThisStep is false", () => {
    expect(evaluateRuntimeExecutionHandoffCandidate().executesGitInThisStep).toBe(false);
  });

  it("callsCursorInThisStep is false", () => {
    expect(evaluateRuntimeExecutionHandoffCandidate().callsCursorInThisStep).toBe(false);
  });

  it("callsGitHubInThisStep is false", () => {
    expect(evaluateRuntimeExecutionHandoffCandidate().callsGitHubInThisStep).toBe(false);
  });

  it("Stage 2 blocked source returns blocked", () => {
    vi.spyOn(stage2Module, "evaluateStage2IntegratedClosureVerdict").mockReturnValue({
      ...mockStage2Ready(),
      decision: "blocked",
      stage2HandoffReady: false,
    });

    expect(evaluateRuntimeExecutionHandoffCandidate(ALL_HANDOFF_APPROVALS).decision).toBe("blocked");
  });

  it("Stage 2 defer source returns defer", () => {
    vi.spyOn(stage2Module, "evaluateStage2IntegratedClosureVerdict").mockReturnValue({
      ...mockStage2Ready(),
      decision: "defer",
      stage2HandoffReady: false,
    });

    expect(evaluateRuntimeExecutionHandoffCandidate(ALL_HANDOFF_APPROVALS).decision).toBe("defer");
  });

  it("Stage 2 ready with schemaPrApproved false returns defer", () => {
    vi.spyOn(stage2Module, "evaluateStage2IntegratedClosureVerdict").mockReturnValue(mockStage2Ready());

    expect(
      evaluateRuntimeExecutionHandoffCandidate({
        ...ALL_HANDOFF_APPROVALS,
        schemaPrApproved: false,
      }).decision,
    ).toBe("defer");
  });

  it("Stage 2 ready with connectorExperimentBranchVerified false returns defer", () => {
    vi.spyOn(stage2Module, "evaluateStage2IntegratedClosureVerdict").mockReturnValue(mockStage2Ready());

    expect(
      evaluateRuntimeExecutionHandoffCandidate({
        ...ALL_HANDOFF_APPROVALS,
        connectorExperimentBranchVerified: false,
      }).decision,
    ).toBe("defer");
  });

  it("Stage 2 ready with runtimeExecutionWireDesignApproved false returns defer", () => {
    vi.spyOn(stage2Module, "evaluateStage2IntegratedClosureVerdict").mockReturnValue(mockStage2Ready());

    expect(
      evaluateRuntimeExecutionHandoffCandidate({
        ...ALL_HANDOFF_APPROVALS,
        runtimeExecutionWireDesignApproved: false,
      }).decision,
    ).toBe("defer");
  });

  it("Stage 2 ready with featureFlagWireDesignApproved false returns defer", () => {
    vi.spyOn(stage2Module, "evaluateStage2IntegratedClosureVerdict").mockReturnValue(mockStage2Ready());

    expect(
      evaluateRuntimeExecutionHandoffCandidate({
        ...ALL_HANDOFF_APPROVALS,
        featureFlagWireDesignApproved: false,
      }).decision,
    ).toBe("defer");
  });

  it("all conditions satisfied returns ready_for_runtime_execution_handoff_design", () => {
    vi.spyOn(stage2Module, "evaluateStage2IntegratedClosureVerdict").mockReturnValue(mockStage2Ready());

    const report = evaluateRuntimeExecutionHandoffCandidate(ALL_HANDOFF_APPROVALS);
    expect(report.decision).toBe("ready_for_runtime_execution_handoff_design");
    expect(report.findings.some((f) => f.code === "runtime_execution_handoff_design_ready")).toBe(true);
  });

  it("runtimeHandoffChecklist includes Stage 2 closure ready", () => {
    expect(
      checklistItem(evaluateRuntimeExecutionHandoffCandidate(), "runtimeHandoffChecklist", "Stage 2 closure ready"),
    ).toBeDefined();
  });

  it("preExecutionSafetyChecklist includes no runtime execution in this step", () => {
    expect(
      checklistItem(
        evaluateRuntimeExecutionHandoffCandidate(),
        "preExecutionSafetyChecklist",
        "no runtime execution in this step",
      )?.satisfied,
    ).toBe(true);
  });

  it("prerequisiteChecklist includes operator approval remains required before actual execution", () => {
    expect(
      checklistItem(
        evaluateRuntimeExecutionHandoffCandidate(),
        "prerequisiteChecklist",
        "operator approval remains required before actual execution",
      ),
    ).toBeDefined();
  });

  it("defer state does not include runtime_execution_handoff_design_ready finding", () => {
    expect(
      evaluateRuntimeExecutionHandoffCandidate().findings.some(
        (f) => f.code === "runtime_execution_handoff_design_ready",
      ),
    ).toBe(false);
  });

  it("blocked state includes runtime_handoff_candidate_blocked finding", () => {
    vi.spyOn(stage2Module, "evaluateStage2IntegratedClosureVerdict").mockReturnValue({
      ...mockStage2Ready(),
      decision: "blocked",
    });

    expect(
      evaluateRuntimeExecutionHandoffCandidate(ALL_HANDOFF_APPROVALS).findings.some(
        (f) => f.code === "runtime_handoff_candidate_blocked",
      ),
    ).toBe(true);
  });

  it("Stage 2 no-run violation returns blocked", () => {
    vi.spyOn(stage2Module, "evaluateStage2IntegratedClosureVerdict").mockReturnValue({
      ...mockStage2Ready(),
      stage2NoRunPolicySatisfied: false,
    });

    const report = evaluateRuntimeExecutionHandoffCandidate(ALL_HANDOFF_APPROVALS);
    expect(report.decision).toBe("blocked");
    expect(report.findings.some((f) => f.code === "stage2_no_run_policy_violation")).toBe(true);
  });

  describe("integration via real Stage 2 evaluator", () => {
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
    } as const;

    it("real chain defers until Stage 2 closure and prerequisite approvals are ready", () => {
      const report = evaluateRuntimeExecutionHandoffCandidate(INTEGRATION_INPUT);
      expect(report.decision).toBe("defer");
      expect(report.sourceStage2Decision).toBe("defer");
    });

    it("real chain keeps execution flags false", () => {
      const report = evaluateRuntimeExecutionHandoffCandidate(INTEGRATION_INPUT);
      expect(report.executesRuntimeInThisStep).toBe(false);
      expect(report.callsGitHubInThisStep).toBe(false);
    });
  });
});
