import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateControlledRuntimeWireCandidate } from "@/lib/agents/evaluateControlledRuntimeWireCandidate";
import * as gateModule from "@/lib/agents/evaluateRuntimeExecutionApprovalGate";

const CURSOR_BOUNDARY = ["cursor.execution.before"] as const;

function mockGateReady(): ReturnType<typeof gateModule.evaluateRuntimeExecutionApprovalGate> {
  return {
    mode: "read_only_runtime_execution_approval_gate",
    stage: "stage_3_b",
    decision: "ready_for_controlled_runtime_wire_candidate",
    gateVersion: 1,
    gateTitle: "gate",
    gateSummary: "ready",
    gateFingerprint: "runtime-approval-gate-v1:ready_for_runtime_execution_approval_gate:fp:operator-true:risk-true:rollback-true:window-true",
    sourcePackageDecision: "ready_for_runtime_execution_approval_gate",
    sourcePlanDecision: "ready_for_runtime_execution_plan_review",
    sourceHandoffDecision: "ready_for_runtime_execution_handoff_design",
    sourceStage2Decision: "stage2_closure_ready",
    sourcePlanFingerprint: "runtime-plan-v1:fp",
    sourceApprovalReadinessReadyCount: 7,
    sourceApprovalReadinessTotalCount: 7,
    sourceApprovalReadinessMissing: [],
    sourceApprovalReadinessComplete: true,
    operatorFinalApprovalConfirmed: true,
    riskAcknowledgementConfirmed: true,
    rollbackAcknowledgementConfirmed: true,
    executionWindowConfirmed: true,
    approvalGateChecklist: [],
    riskChecklist: [],
    noRunChecklist: [],
    handoffChecklist: [],
    evaluatesApprovalOnly: true,
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

const ALL_CANDIDATE_CONFIRMATIONS = {
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
  operatorFinalApprovalConfirmed: true,
  riskAcknowledgementConfirmed: true,
  rollbackAcknowledgementConfirmed: true,
  executionWindowConfirmed: true,
  controlledWireCandidateReviewConfirmed: true,
  runtimeWireExperimentBranchRequired: true,
  featureFlagWirePlanConfirmed: true,
} as const;

describe("multi-agent controlled runtime wire candidate stage 3-C", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mode is read_only_controlled_runtime_wire_candidate", () => {
    expect(evaluateControlledRuntimeWireCandidate().mode).toBe("read_only_controlled_runtime_wire_candidate");
  });

  it("stage is stage_3_c", () => {
    expect(evaluateControlledRuntimeWireCandidate().stage).toBe("stage_3_c");
  });

  it("default decision is defer", () => {
    expect(evaluateControlledRuntimeWireCandidate().decision).toBe("defer");
  });

  it("buildsWireCandidateOnly is true", () => {
    expect(evaluateControlledRuntimeWireCandidate().buildsWireCandidateOnly).toBe(true);
  });

  it("executesRuntimeInThisStep is false", () => {
    expect(evaluateControlledRuntimeWireCandidate().executesRuntimeInThisStep).toBe(false);
  });

  it("changesConnectorRoutingInThisStep is false", () => {
    expect(evaluateControlledRuntimeWireCandidate().changesConnectorRoutingInThisStep).toBe(false);
  });

  it("wiresWritePathInThisStep is false", () => {
    expect(evaluateControlledRuntimeWireCandidate().wiresWritePathInThisStep).toBe(false);
  });

  it("wiresFeatureFlagInThisStep is false", () => {
    expect(evaluateControlledRuntimeWireCandidate().wiresFeatureFlagInThisStep).toBe(false);
  });

  it("writesDataInThisStep is false", () => {
    expect(evaluateControlledRuntimeWireCandidate().writesDataInThisStep).toBe(false);
  });

  it("callsPrismaInThisStep is false", () => {
    expect(evaluateControlledRuntimeWireCandidate().callsPrismaInThisStep).toBe(false);
  });

  it("modifiesSchemaInThisStep is false", () => {
    expect(evaluateControlledRuntimeWireCandidate().modifiesSchemaInThisStep).toBe(false);
  });

  it("createsMigrationInThisStep is false", () => {
    expect(evaluateControlledRuntimeWireCandidate().createsMigrationInThisStep).toBe(false);
  });

  it("createsPullRequestInThisStep is false", () => {
    expect(evaluateControlledRuntimeWireCandidate().createsPullRequestInThisStep).toBe(false);
  });

  it("executesGitInThisStep is false", () => {
    expect(evaluateControlledRuntimeWireCandidate().executesGitInThisStep).toBe(false);
  });

  it("callsCursorInThisStep is false", () => {
    expect(evaluateControlledRuntimeWireCandidate().callsCursorInThisStep).toBe(false);
  });

  it("callsGitHubInThisStep is false", () => {
    expect(evaluateControlledRuntimeWireCandidate().callsGitHubInThisStep).toBe(false);
  });

  it("source approval gate blocked returns blocked", () => {
    vi.spyOn(gateModule, "evaluateRuntimeExecutionApprovalGate").mockReturnValue({
      ...mockGateReady(),
      decision: "blocked",
    });

    expect(evaluateControlledRuntimeWireCandidate(ALL_CANDIDATE_CONFIRMATIONS).decision).toBe("blocked");
  });

  it("source approval gate defer returns defer", () => {
    vi.spyOn(gateModule, "evaluateRuntimeExecutionApprovalGate").mockReturnValue({
      ...mockGateReady(),
      decision: "defer",
    });

    expect(evaluateControlledRuntimeWireCandidate(ALL_CANDIDATE_CONFIRMATIONS).decision).toBe("defer");
  });

  it("source approval gate ready with controlledWireCandidateReviewConfirmed false returns defer", () => {
    vi.spyOn(gateModule, "evaluateRuntimeExecutionApprovalGate").mockReturnValue(mockGateReady());

    expect(
      evaluateControlledRuntimeWireCandidate({
        ...ALL_CANDIDATE_CONFIRMATIONS,
        controlledWireCandidateReviewConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("source approval gate ready with runtimeWireExperimentBranchRequired false returns defer", () => {
    vi.spyOn(gateModule, "evaluateRuntimeExecutionApprovalGate").mockReturnValue(mockGateReady());

    expect(
      evaluateControlledRuntimeWireCandidate({
        ...ALL_CANDIDATE_CONFIRMATIONS,
        runtimeWireExperimentBranchRequired: false,
      }).decision,
    ).toBe("defer");
  });

  it("source approval gate ready with featureFlagWirePlanConfirmed false returns defer", () => {
    vi.spyOn(gateModule, "evaluateRuntimeExecutionApprovalGate").mockReturnValue(mockGateReady());

    expect(
      evaluateControlledRuntimeWireCandidate({
        ...ALL_CANDIDATE_CONFIRMATIONS,
        featureFlagWirePlanConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("all conditions satisfied returns ready_for_runtime_wire_experiment_branch", () => {
    vi.spyOn(gateModule, "evaluateRuntimeExecutionApprovalGate").mockReturnValue(mockGateReady());

    expect(evaluateControlledRuntimeWireCandidate(ALL_CANDIDATE_CONFIRMATIONS).decision).toBe(
      "ready_for_runtime_wire_experiment_branch",
    );
  });

  it("wireCandidates has five items", () => {
    vi.spyOn(gateModule, "evaluateRuntimeExecutionApprovalGate").mockReturnValue(mockGateReady());

    expect(evaluateControlledRuntimeWireCandidate(ALL_CANDIDATE_CONFIRMATIONS).wireCandidates).toHaveLength(5);
  });

  it("all wireCandidates have wiresInThisStep false", () => {
    vi.spyOn(gateModule, "evaluateRuntimeExecutionApprovalGate").mockReturnValue(mockGateReady());

    expect(
      evaluateControlledRuntimeWireCandidate(ALL_CANDIDATE_CONFIRMATIONS).wireCandidates.every(
        (c) => c.wiresInThisStep === false,
      ),
    ).toBe(true);
  });

  it("all wireCandidates have executesInThisStep false", () => {
    vi.spyOn(gateModule, "evaluateRuntimeExecutionApprovalGate").mockReturnValue(mockGateReady());

    expect(
      evaluateControlledRuntimeWireCandidate(ALL_CANDIDATE_CONFIRMATIONS).wireCandidates.every(
        (c) => c.executesInThisStep === false,
      ),
    ).toBe(true);
  });

  it("candidateChecklist includes source approval gate ready", () => {
    vi.spyOn(gateModule, "evaluateRuntimeExecutionApprovalGate").mockReturnValue(mockGateReady());

    expect(
      evaluateControlledRuntimeWireCandidate(ALL_CANDIDATE_CONFIRMATIONS).candidateChecklist.some(
        (c) => c.item === "source approval gate ready",
      ),
    ).toBe(true);
  });

  it("safetyChecklist items are all satisfied", () => {
    expect(evaluateControlledRuntimeWireCandidate().safetyChecklist.every((c) => c.satisfied)).toBe(true);
  });

  it("handoffChecklist includes Stage 4-A runtime wire experiment branch required", () => {
    expect(
      evaluateControlledRuntimeWireCandidate().handoffChecklist.some(
        (c) => c.item === "Stage 4-A runtime wire experiment branch required",
      ),
    ).toBe(true);
  });

  it("ready finding message states actual wire requires Stage 4 or later", () => {
    vi.spyOn(gateModule, "evaluateRuntimeExecutionApprovalGate").mockReturnValue(mockGateReady());

    const readyFinding = evaluateControlledRuntimeWireCandidate(ALL_CANDIDATE_CONFIRMATIONS).findings.find(
      (f) => f.code === "actual_wire_requires_stage_4_or_later",
    );
    expect(readyFinding?.message).toMatch(/Stage 4/i);
  });

  it("wire candidate reasons include no actual wire and Stage 4", () => {
    vi.spyOn(gateModule, "evaluateRuntimeExecutionApprovalGate").mockReturnValue(mockGateReady());

    const report = evaluateControlledRuntimeWireCandidate(ALL_CANDIDATE_CONFIRMATIONS);
    for (const candidate of report.wireCandidates) {
      expect(candidate.reason).toMatch(/no actual wire/i);
      expect(candidate.reason).toMatch(/Stage 4 experiment\/approval/i);
    }
  });

  describe("integration via real approval gate chain", () => {
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
      operatorFinalApprovalConfirmed: true,
      riskAcknowledgementConfirmed: true,
      rollbackAcknowledgementConfirmed: true,
      executionWindowConfirmed: true,
      controlledWireCandidateReviewConfirmed: true,
      runtimeWireExperimentBranchRequired: true,
      featureFlagWirePlanConfirmed: true,
    } as const;

    it("real upstream chain remains defer because approval gate is not ready yet", () => {
      const report = evaluateControlledRuntimeWireCandidate(INTEGRATION_INPUT);
      expect(report.sourceApprovalGateDecision).toBe("defer");
      expect(report.decision).toBe("defer");
      expect(report.executesRuntimeInThisStep).toBe(false);
    });
  });
});
