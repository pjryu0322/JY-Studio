import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateRuntimeExecutionApprovalGate } from "@/lib/agents/evaluateRuntimeExecutionApprovalGate";
import * as packageModule from "@/lib/agents/evaluateRuntimeExecutionPlanPackage";

const CURSOR_BOUNDARY = ["cursor.execution.before"] as const;

function mockPackageReady(): ReturnType<typeof packageModule.evaluateRuntimeExecutionPlanPackage> {
  return {
    mode: "read_only_runtime_execution_plan_package",
    stage: "stage_3_a",
    decision: "ready_for_runtime_execution_approval_gate",
    sourcePlanDecision: "ready_for_runtime_execution_plan_review",
    sourceHandoffDecision: "ready_for_runtime_execution_handoff_design",
    sourceStage2Decision: "stage2_closure_ready",
    sourcePlanFingerprint: "runtime-plan-v1:ready:stage2_closure_ready:satisfied-9:missing-none",
    sourcePlanStepCount: 9,
    sourceSatisfiedPlanStepCount: 9,
    packageVersion: 1,
    packageTitle: "package",
    packageSummary: "ready",
    dryRunCandidate: {
      status: "dry_run_ready",
      sourcePlanDecision: "ready_for_runtime_execution_plan_review",
      simulatedOnly: true,
      executesRuntimeInThisStep: false,
      changesConnectorRoutingInThisStep: false,
      wiresWritePathInThisStep: false,
      writesDataInThisStep: false,
      callsExternalConnectorInThisStep: false,
      candidateSteps: [],
      blockedReasons: [],
      deferredReasons: [],
    },
    approvalReadiness: {
      operatorApprovalReady: true,
      rollbackReviewReady: true,
      stage1RegressionReady: true,
      schemaPrerequisitesReady: true,
      connectorExperimentReady: true,
      featureFlagWireReady: true,
      runtimeWireDesignReady: true,
      readyCount: 7,
      totalCount: 7,
      missing: [],
    },
    executionPlanChecklist: [],
    dryRunChecklist: [],
    approvalChecklist: [],
    safetyChecklist: [],
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
    findings: [],
  };
}

const ALL_GATE_CONFIRMATIONS = {
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
} as const;

describe("multi-agent runtime execution approval gate stage 3-B", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mode is read_only_runtime_execution_approval_gate", () => {
    expect(evaluateRuntimeExecutionApprovalGate().mode).toBe("read_only_runtime_execution_approval_gate");
  });

  it("stage is stage_3_b", () => {
    expect(evaluateRuntimeExecutionApprovalGate().stage).toBe("stage_3_b");
  });

  it("default decision is defer", () => {
    expect(evaluateRuntimeExecutionApprovalGate().decision).toBe("defer");
  });

  it("evaluatesApprovalOnly is true", () => {
    expect(evaluateRuntimeExecutionApprovalGate().evaluatesApprovalOnly).toBe(true);
  });

  it("executesRuntimeInThisStep is false", () => {
    expect(evaluateRuntimeExecutionApprovalGate().executesRuntimeInThisStep).toBe(false);
  });

  it("changesConnectorRoutingInThisStep is false", () => {
    expect(evaluateRuntimeExecutionApprovalGate().changesConnectorRoutingInThisStep).toBe(false);
  });

  it("wiresWritePathInThisStep is false", () => {
    expect(evaluateRuntimeExecutionApprovalGate().wiresWritePathInThisStep).toBe(false);
  });

  it("wiresFeatureFlagInThisStep is false", () => {
    expect(evaluateRuntimeExecutionApprovalGate().wiresFeatureFlagInThisStep).toBe(false);
  });

  it("writesDataInThisStep is false", () => {
    expect(evaluateRuntimeExecutionApprovalGate().writesDataInThisStep).toBe(false);
  });

  it("callsPrismaInThisStep is false", () => {
    expect(evaluateRuntimeExecutionApprovalGate().callsPrismaInThisStep).toBe(false);
  });

  it("modifiesSchemaInThisStep is false", () => {
    expect(evaluateRuntimeExecutionApprovalGate().modifiesSchemaInThisStep).toBe(false);
  });

  it("createsMigrationInThisStep is false", () => {
    expect(evaluateRuntimeExecutionApprovalGate().createsMigrationInThisStep).toBe(false);
  });

  it("createsPullRequestInThisStep is false", () => {
    expect(evaluateRuntimeExecutionApprovalGate().createsPullRequestInThisStep).toBe(false);
  });

  it("executesGitInThisStep is false", () => {
    expect(evaluateRuntimeExecutionApprovalGate().executesGitInThisStep).toBe(false);
  });

  it("callsCursorInThisStep is false", () => {
    expect(evaluateRuntimeExecutionApprovalGate().callsCursorInThisStep).toBe(false);
  });

  it("callsGitHubInThisStep is false", () => {
    expect(evaluateRuntimeExecutionApprovalGate().callsGitHubInThisStep).toBe(false);
  });

  it("source package blocked returns blocked", () => {
    vi.spyOn(packageModule, "evaluateRuntimeExecutionPlanPackage").mockReturnValue({
      ...mockPackageReady(),
      decision: "blocked",
    });

    expect(evaluateRuntimeExecutionApprovalGate(ALL_GATE_CONFIRMATIONS).decision).toBe("blocked");
  });

  it("source package defer returns defer", () => {
    vi.spyOn(packageModule, "evaluateRuntimeExecutionPlanPackage").mockReturnValue({
      ...mockPackageReady(),
      decision: "defer",
    });

    expect(evaluateRuntimeExecutionApprovalGate(ALL_GATE_CONFIRMATIONS).decision).toBe("defer");
  });

  it("source package ready with operatorFinalApprovalConfirmed false returns defer", () => {
    vi.spyOn(packageModule, "evaluateRuntimeExecutionPlanPackage").mockReturnValue(mockPackageReady());

    expect(
      evaluateRuntimeExecutionApprovalGate({
        ...ALL_GATE_CONFIRMATIONS,
        operatorFinalApprovalConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("source package ready with riskAcknowledgementConfirmed false returns defer", () => {
    vi.spyOn(packageModule, "evaluateRuntimeExecutionPlanPackage").mockReturnValue(mockPackageReady());

    expect(
      evaluateRuntimeExecutionApprovalGate({
        ...ALL_GATE_CONFIRMATIONS,
        riskAcknowledgementConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("source package ready with rollbackAcknowledgementConfirmed false returns defer", () => {
    vi.spyOn(packageModule, "evaluateRuntimeExecutionPlanPackage").mockReturnValue(mockPackageReady());

    expect(
      evaluateRuntimeExecutionApprovalGate({
        ...ALL_GATE_CONFIRMATIONS,
        rollbackAcknowledgementConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("source package ready with executionWindowConfirmed false returns defer", () => {
    vi.spyOn(packageModule, "evaluateRuntimeExecutionPlanPackage").mockReturnValue(mockPackageReady());

    expect(
      evaluateRuntimeExecutionApprovalGate({
        ...ALL_GATE_CONFIRMATIONS,
        executionWindowConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("all conditions satisfied returns ready_for_controlled_runtime_wire_candidate", () => {
    vi.spyOn(packageModule, "evaluateRuntimeExecutionPlanPackage").mockReturnValue(mockPackageReady());

    expect(evaluateRuntimeExecutionApprovalGate(ALL_GATE_CONFIRMATIONS).decision).toBe(
      "ready_for_controlled_runtime_wire_candidate",
    );
  });

  it("approvalGateChecklist includes source package ready", () => {
    vi.spyOn(packageModule, "evaluateRuntimeExecutionPlanPackage").mockReturnValue(mockPackageReady());

    expect(
      evaluateRuntimeExecutionApprovalGate(ALL_GATE_CONFIRMATIONS).approvalGateChecklist.some(
        (c) => c.item === "source package ready",
      ),
    ).toBe(true);
  });

  it("riskChecklist includes controlled runtime wire candidate required next", () => {
    expect(
      evaluateRuntimeExecutionApprovalGate().riskChecklist.some(
        (c) => c.item === "controlled runtime wire candidate required next",
      ),
    ).toBe(true);
  });

  it("noRunChecklist items are all satisfied", () => {
    expect(evaluateRuntimeExecutionApprovalGate().noRunChecklist.every((c) => c.satisfied)).toBe(true);
  });

  it("handoffChecklist includes source package fingerprint captured", () => {
    vi.spyOn(packageModule, "evaluateRuntimeExecutionPlanPackage").mockReturnValue(mockPackageReady());

    expect(
      evaluateRuntimeExecutionApprovalGate(ALL_GATE_CONFIRMATIONS).handoffChecklist.some(
        (c) => c.item === "source package fingerprint captured",
      ),
    ).toBe(true);
  });

  it("gateVersion is 1 and gateTitle is set", () => {
    vi.spyOn(packageModule, "evaluateRuntimeExecutionPlanPackage").mockReturnValue(mockPackageReady());

    const report = evaluateRuntimeExecutionApprovalGate(ALL_GATE_CONFIRMATIONS);
    expect(report.gateVersion).toBe(1);
    expect(report.gateTitle).toMatch(/Approval Gate/i);
  });

  it("gateFingerprint is non-empty and deterministic", () => {
    vi.spyOn(packageModule, "evaluateRuntimeExecutionPlanPackage").mockReturnValue(mockPackageReady());

    const report = evaluateRuntimeExecutionApprovalGate(ALL_GATE_CONFIRMATIONS);
    expect(report.gateFingerprint.length).toBeGreaterThan(0);
    expect(report.gateFingerprint).toContain("runtime-approval-gate-v1");
  });

  function mockPackageWithReadinessGap(
    readyCount: number,
    missing: string[],
  ): ReturnType<typeof packageModule.evaluateRuntimeExecutionPlanPackage> {
    const base = mockPackageReady();
    return {
      ...base,
      approvalReadiness: {
        ...base.approvalReadiness,
        readyCount,
        totalCount: 7,
        missing,
      },
    };
  }

  it("source package ready but approval readiness incomplete returns defer", () => {
    vi.spyOn(packageModule, "evaluateRuntimeExecutionPlanPackage").mockReturnValue(
      mockPackageWithReadinessGap(6, ["featureFlagWireReady"]),
    );

    const report = evaluateRuntimeExecutionApprovalGate(ALL_GATE_CONFIRMATIONS);
    expect(report.decision).toBe("defer");
    expect(report.sourceApprovalReadinessComplete).toBe(false);
  });

  it("source_approval_readiness_incomplete finding when readiness incomplete", () => {
    vi.spyOn(packageModule, "evaluateRuntimeExecutionPlanPackage").mockReturnValue(
      mockPackageWithReadinessGap(5, ["featureFlagWireReady", "connectorExperimentReady"]),
    );

    expect(
      evaluateRuntimeExecutionApprovalGate(ALL_GATE_CONFIRMATIONS).findings.some(
        (f) => f.code === "source_approval_readiness_incomplete",
      ),
    ).toBe(true);
  });

  it("ready state sets sourceApprovalReadinessComplete true", () => {
    vi.spyOn(packageModule, "evaluateRuntimeExecutionPlanPackage").mockReturnValue(mockPackageReady());

    expect(evaluateRuntimeExecutionApprovalGate(ALL_GATE_CONFIRMATIONS).sourceApprovalReadinessComplete).toBe(
      true,
    );
  });

  it("ready finding message states not actual execution permission", () => {
    vi.spyOn(packageModule, "evaluateRuntimeExecutionPlanPackage").mockReturnValue(mockPackageReady());

    const readyFinding = evaluateRuntimeExecutionApprovalGate(ALL_GATE_CONFIRMATIONS).findings.find(
      (f) => f.code === "approval_gate_ready_not_execution_permission",
    );
    expect(readyFinding?.message).toMatch(/not actual runtime execution permission/i);
  });

  it("ready finding message states Stage 3-C controlled runtime wire candidate required", () => {
    vi.spyOn(packageModule, "evaluateRuntimeExecutionPlanPackage").mockReturnValue(mockPackageReady());

    const readyFinding = evaluateRuntimeExecutionApprovalGate(ALL_GATE_CONFIRMATIONS).findings.find(
      (f) => f.code === "approval_gate_ready_not_execution_permission",
    );
    expect(readyFinding?.message).toMatch(/Stage 3-C controlled runtime wire candidate required/i);
  });

  it("riskChecklist reflects operator final approval flag", () => {
    vi.spyOn(packageModule, "evaluateRuntimeExecutionPlanPackage").mockReturnValue(mockPackageReady());

    const item = evaluateRuntimeExecutionApprovalGate({
      ...ALL_GATE_CONFIRMATIONS,
      operatorFinalApprovalConfirmed: false,
    }).riskChecklist.find((c) => c.item === "final operator approval captured");
    expect(item?.satisfied).toBe(false);
  });

  describe("integration via real package chain", () => {
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
    } as const;

    it("real upstream chain remains defer because package is not ready yet", () => {
      const report = evaluateRuntimeExecutionApprovalGate(INTEGRATION_INPUT);
      expect(report.sourcePackageDecision).toBe("defer");
      expect(report.decision).toBe("defer");
      expect(report.executesRuntimeInThisStep).toBe(false);
    });
  });
});
