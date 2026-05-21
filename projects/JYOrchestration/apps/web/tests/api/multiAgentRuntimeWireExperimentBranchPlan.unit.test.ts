import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRuntimeWireExperimentBranchManualCommands,
  buildRuntimeWireExperimentBranchName,
  buildRuntimeWireFeatureFlagName,
  evaluateRuntimeWireExperimentBranchPlan,
  resolveRuntimeWireExperimentBranchPlanDecision,
  runtimeWireManualCommandCautionsValid,
} from "@/lib/agents/evaluateRuntimeWireExperimentBranchPlan";
import * as wireCandidateModule from "@/lib/agents/evaluateControlledRuntimeWireCandidate";

const CURSOR_BOUNDARY = ["cursor.execution.before"] as const;
const EXPECTED_BRANCH = buildRuntimeWireExperimentBranchName();

function mockWireCandidateReady(): ReturnType<typeof wireCandidateModule.evaluateControlledRuntimeWireCandidate> {
  return {
    mode: "read_only_controlled_runtime_wire_candidate",
    stage: "stage_3_c",
    decision: "ready_for_runtime_wire_experiment_branch",
    sourceApprovalGateDecision: "ready_for_controlled_runtime_wire_candidate",
    sourcePackageDecision: "ready_for_runtime_execution_approval_gate",
    sourcePlanDecision: "ready_for_runtime_execution_plan_review",
    sourcePlanFingerprint: "runtime-plan-v1:fp",
    sourceApprovalGateFingerprint: "runtime-approval-gate-v1:fp",
    candidateVersion: 1,
    candidateTitle: "candidate",
    candidateSummary: "ready",
    candidateFingerprint: "controlled-wire-candidate-v1:ready:fp",
    wireCandidates: [
      { sequence: 1, kind: "agent_execution_record_write_path", title: "a", target: "agent_execution_record", required: true, satisfied: true, reason: "ok", wiresInThisStep: false, executesInThisStep: false },
      { sequence: 2, kind: "operator_approval_audit_write_path", title: "b", target: "operator_approval", required: true, satisfied: true, reason: "ok", wiresInThisStep: false, executesInThisStep: false },
      { sequence: 3, kind: "connector_gateway_shadow_routing", title: "c", target: "connector_gateway", required: true, satisfied: false, reason: "ok", wiresInThisStep: false, executesInThisStep: false },
      { sequence: 4, kind: "feature_flag_wire", title: "d", target: "feature_flag", required: true, satisfied: true, reason: "ok", wiresInThisStep: false, executesInThisStep: false },
      { sequence: 5, kind: "runtime_execution_boundary", title: "e", target: "runtime_execution_boundary", required: true, satisfied: true, reason: "ok", wiresInThisStep: false, executesInThisStep: false },
    ],
    candidateChecklist: [],
    safetyChecklist: [],
    handoffChecklist: [],
    buildsWireCandidateOnly: true,
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

function spyWireCandidateReady() {
  return vi
    .spyOn(wireCandidateModule, "evaluateControlledRuntimeWireCandidate")
    .mockReturnValue(mockWireCandidateReady());
}

const ALL_BRANCH_PLAN_CONFIRMATIONS = {
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
  manualBranchPlanReviewConfirmed: true,
  branchNamingPolicyConfirmed: true,
  rollbackPlanConfirmed: true,
} as const;

describe("multi-agent runtime wire experiment branch plan stage 4-A", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mode is read_only_runtime_wire_experiment_branch_plan", () => {
    expect(evaluateRuntimeWireExperimentBranchPlan().mode).toBe(
      "read_only_runtime_wire_experiment_branch_plan",
    );
  });

  it("stage is stage_4_a", () => {
    expect(evaluateRuntimeWireExperimentBranchPlan().stage).toBe("stage_4_a");
  });

  it("default decision is defer", () => {
    expect(evaluateRuntimeWireExperimentBranchPlan().decision).toBe("defer");
  });

  it("createsBranchInThisStep is false", () => {
    expect(evaluateRuntimeWireExperimentBranchPlan().createsBranchInThisStep).toBe(false);
  });

  it("executesGitInThisStep is false", () => {
    expect(evaluateRuntimeWireExperimentBranchPlan().executesGitInThisStep).toBe(false);
  });

  it("createsPullRequestInThisStep is false", () => {
    expect(evaluateRuntimeWireExperimentBranchPlan().createsPullRequestInThisStep).toBe(false);
  });

  it("changesConnectorRoutingInThisStep is false", () => {
    expect(evaluateRuntimeWireExperimentBranchPlan().changesConnectorRoutingInThisStep).toBe(false);
  });

  it("executesRuntimeInThisStep is false", () => {
    expect(evaluateRuntimeWireExperimentBranchPlan().executesRuntimeInThisStep).toBe(false);
  });

  it("wiresWritePathInThisStep is false", () => {
    expect(evaluateRuntimeWireExperimentBranchPlan().wiresWritePathInThisStep).toBe(false);
  });

  it("wiresFeatureFlagInThisStep is false", () => {
    expect(evaluateRuntimeWireExperimentBranchPlan().wiresFeatureFlagInThisStep).toBe(false);
  });

  it("writesDataInThisStep is false", () => {
    expect(evaluateRuntimeWireExperimentBranchPlan().writesDataInThisStep).toBe(false);
  });

  it("callsPrismaInThisStep is false", () => {
    expect(evaluateRuntimeWireExperimentBranchPlan().callsPrismaInThisStep).toBe(false);
  });

  it("modifiesSchemaInThisStep is false", () => {
    expect(evaluateRuntimeWireExperimentBranchPlan().modifiesSchemaInThisStep).toBe(false);
  });

  it("createsMigrationInThisStep is false", () => {
    expect(evaluateRuntimeWireExperimentBranchPlan().createsMigrationInThisStep).toBe(false);
  });

  it("callsCursorInThisStep is false", () => {
    expect(evaluateRuntimeWireExperimentBranchPlan().callsCursorInThisStep).toBe(false);
  });

  it("callsGitHubInThisStep is false", () => {
    expect(evaluateRuntimeWireExperimentBranchPlan().callsGitHubInThisStep).toBe(false);
  });

  it("source wire candidate blocked returns blocked", () => {
    vi.spyOn(wireCandidateModule, "evaluateControlledRuntimeWireCandidate").mockReturnValue({
      ...mockWireCandidateReady(),
      decision: "blocked",
    });

    expect(evaluateRuntimeWireExperimentBranchPlan(ALL_BRANCH_PLAN_CONFIRMATIONS).decision).toBe("blocked");
  });

  it("source wire candidate defer returns defer", () => {
    vi.spyOn(wireCandidateModule, "evaluateControlledRuntimeWireCandidate").mockReturnValue({
      ...mockWireCandidateReady(),
      decision: "defer",
    });

    expect(evaluateRuntimeWireExperimentBranchPlan(ALL_BRANCH_PLAN_CONFIRMATIONS).decision).toBe("defer");
  });

  it("source wire candidate ready with manualBranchPlanReviewConfirmed false returns defer", () => {
    spyWireCandidateReady();

    expect(
      evaluateRuntimeWireExperimentBranchPlan({
        ...ALL_BRANCH_PLAN_CONFIRMATIONS,
        manualBranchPlanReviewConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("source wire candidate ready with branchNamingPolicyConfirmed false returns defer", () => {
    spyWireCandidateReady();

    expect(
      evaluateRuntimeWireExperimentBranchPlan({
        ...ALL_BRANCH_PLAN_CONFIRMATIONS,
        branchNamingPolicyConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("source wire candidate ready with rollbackPlanConfirmed false returns defer", () => {
    spyWireCandidateReady();

    expect(
      evaluateRuntimeWireExperimentBranchPlan({
        ...ALL_BRANCH_PLAN_CONFIRMATIONS,
        rollbackPlanConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("all conditions satisfied returns ready_for_manual_branch_creation_approval", () => {
    spyWireCandidateReady();

    expect(evaluateRuntimeWireExperimentBranchPlan(ALL_BRANCH_PLAN_CONFIRMATIONS).decision).toBe(
      "ready_for_manual_branch_creation_approval",
    );
  });

  it("recommendedBranchName is experiment/runtime-wire-controlled-candidate", () => {
    spyWireCandidateReady();

    expect(evaluateRuntimeWireExperimentBranchPlan(ALL_BRANCH_PLAN_CONFIRMATIONS).recommendedBranchName).toBe(
      buildRuntimeWireExperimentBranchName(),
    );
    expect(buildRuntimeWireExperimentBranchName()).toBe("experiment/runtime-wire-controlled-candidate");
  });

  it("recommendedFeatureFlagName is JYO_RUNTIME_WIRE_EXPERIMENT", () => {
    spyWireCandidateReady();

    expect(evaluateRuntimeWireExperimentBranchPlan(ALL_BRANCH_PLAN_CONFIRMATIONS).recommendedFeatureFlagName).toBe(
      buildRuntimeWireFeatureFlagName(),
    );
    expect(buildRuntimeWireFeatureFlagName()).toBe("JYO_RUNTIME_WIRE_EXPERIMENT");
  });

  it("manualCommandCandidates has four items", () => {
    spyWireCandidateReady();

    expect(evaluateRuntimeWireExperimentBranchPlan(ALL_BRANCH_PLAN_CONFIRMATIONS).manualCommandCandidates).toHaveLength(
      4,
    );
  });

  it("all manualCommandCandidates have executesInThisStep false", () => {
    spyWireCandidateReady();

    expect(
      evaluateRuntimeWireExperimentBranchPlan(ALL_BRANCH_PLAN_CONFIRMATIONS).manualCommandCandidates.every(
        (c) => c.executesInThisStep === false,
      ),
    ).toBe(true);
  });

  it("manualCommandCandidates caution states manual execution only", () => {
    spyWireCandidateReady();

    const commands = evaluateRuntimeWireExperimentBranchPlan(ALL_BRANCH_PLAN_CONFIRMATIONS).manualCommandCandidates;
    expect(commands.every((c) => c.caution.match(/Manual execution only/i))).toBe(true);
    expect(commands.every((c) => c.caution.match(/does not execute git/i))).toBe(true);
  });

  it("regressionSuites includes multiAgent and Phase4 regression", () => {
    spyWireCandidateReady();

    const suites = evaluateRuntimeWireExperimentBranchPlan(ALL_BRANCH_PLAN_CONFIRMATIONS).regressionSuites;
    expect(suites.some((s) => s.includes("multiAgent"))).toBe(true);
    expect(suites.some((s) => s.includes("requirementsOrchestrationPhase4Product"))).toBe(true);
  });

  it("branchSafetyChecklist includes branch name safety item", () => {
    spyWireCandidateReady();

    expect(
      evaluateRuntimeWireExperimentBranchPlan(ALL_BRANCH_PLAN_CONFIRMATIONS).branchSafetyChecklist.some(
        (c) => c.item === "branch name is not main or master",
      ),
    ).toBe(true);
  });

  it("rollbackChecklist includes rollback plan confirmed", () => {
    spyWireCandidateReady();

    expect(
      evaluateRuntimeWireExperimentBranchPlan(ALL_BRANCH_PLAN_CONFIRMATIONS).rollbackChecklist.some(
        (c) => c.item === "rollback plan confirmed",
      ),
    ).toBe(true);
  });

  it("handoffChecklist includes manual branch creation only after explicit approval", () => {
    expect(
      evaluateRuntimeWireExperimentBranchPlan().handoffChecklist.some(
        (c) => c.item === "manual branch creation only after explicit approval",
      ),
    ).toBe(true);
  });

  it("ready finding includes read-only branch plan info", () => {
    spyWireCandidateReady();

    expect(
      evaluateRuntimeWireExperimentBranchPlan(ALL_BRANCH_PLAN_CONFIRMATIONS).findings.some(
        (f) => f.code === "branch_plan_ready_for_manual_approval",
      ),
    ).toBe(true);
  });

  it("planFingerprint is non-empty", () => {
    spyWireCandidateReady();

    expect(evaluateRuntimeWireExperimentBranchPlan(ALL_BRANCH_PLAN_CONFIRMATIONS).planFingerprint.length).toBeGreaterThan(
      0,
    );
  });

  describe("Stage 4-A source trace and caution hardening", () => {
    it("sourceCandidateKinds matches source wireCandidates kinds", () => {
      spyWireCandidateReady();
      const report = evaluateRuntimeWireExperimentBranchPlan(ALL_BRANCH_PLAN_CONFIRMATIONS);
      expect(report.sourceCandidateKinds).toEqual(
        mockWireCandidateReady().wireCandidates.map((c) => c.kind),
      );
    });

    it("sourceWireCandidateCount matches wireCandidates length", () => {
      spyWireCandidateReady();
      const report = evaluateRuntimeWireExperimentBranchPlan(ALL_BRANCH_PLAN_CONFIRMATIONS);
      expect(report.sourceWireCandidateCount).toBe(mockWireCandidateReady().wireCandidates.length);
    });

    it("sourceWireCandidateSatisfiedCount matches satisfied=true count", () => {
      spyWireCandidateReady();
      const report = evaluateRuntimeWireExperimentBranchPlan(ALL_BRANCH_PLAN_CONFIRMATIONS);
      const expected = mockWireCandidateReady().wireCandidates.filter((c) => c.satisfied).length;
      expect(report.sourceWireCandidateSatisfiedCount).toBe(expected);
    });

    it("sourceWireCandidateUnsatisfiedCount matches satisfied=false count", () => {
      spyWireCandidateReady();
      const report = evaluateRuntimeWireExperimentBranchPlan(ALL_BRANCH_PLAN_CONFIRMATIONS);
      const expected = mockWireCandidateReady().wireCandidates.filter((c) => !c.satisfied).length;
      expect(report.sourceWireCandidateUnsatisfiedCount).toBe(expected);
    });

    it("sourceNoRunFlags are all false", () => {
      spyWireCandidateReady();
      const flags = evaluateRuntimeWireExperimentBranchPlan(ALL_BRANCH_PLAN_CONFIRMATIONS).sourceNoRunFlags;
      expect(Object.values(flags).every((v) => v === false)).toBe(true);
    });

    it("manualCommandCandidates cautions are non-empty", () => {
      spyWireCandidateReady();
      const commands = evaluateRuntimeWireExperimentBranchPlan(ALL_BRANCH_PLAN_CONFIRMATIONS).manualCommandCandidates;
      expect(commands.every((c) => c.caution.trim().length > 0)).toBe(true);
    });

    it("returns blocked when manual command caution is missing via pure decision helper", () => {
      const invalidCommands = buildRuntimeWireExperimentBranchManualCommands(EXPECTED_BRANCH, "");
      expect(runtimeWireManualCommandCautionsValid(invalidCommands)).toBe(false);
      expect(
        resolveRuntimeWireExperimentBranchPlanDecision({
          wireCandidateDecision: "ready_for_runtime_wire_experiment_branch",
          manualBranchPlanReviewConfirmed: true,
          branchNamingPolicyConfirmed: true,
          rollbackPlanConfirmed: true,
          manualCommandCautionsValid: false,
        }),
      ).toBe("blocked");
    });

    it("branch_name_safety_checked finding is present", () => {
      spyWireCandidateReady();
      expect(
        evaluateRuntimeWireExperimentBranchPlan(ALL_BRANCH_PLAN_CONFIRMATIONS).findings.some(
          (f) => f.code === "branch_name_safety_checked",
        ),
      ).toBe(true);
    });

    it("feature_flag_name_safety_checked finding is present", () => {
      spyWireCandidateReady();
      expect(
        evaluateRuntimeWireExperimentBranchPlan(ALL_BRANCH_PLAN_CONFIRMATIONS).findings.some(
          (f) => f.code === "feature_flag_name_safety_checked",
        ),
      ).toBe(true);
    });

    it("manual_command_candidates_require_explicit_approval finding is present", () => {
      spyWireCandidateReady();
      expect(
        evaluateRuntimeWireExperimentBranchPlan(ALL_BRANCH_PLAN_CONFIRMATIONS).findings.some(
          (f) => f.code === "manual_command_candidates_require_explicit_approval",
        ),
      ).toBe(true);
    });
  });

  describe("integration via real wire candidate chain", () => {
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
      manualBranchPlanReviewConfirmed: true,
      branchNamingPolicyConfirmed: true,
      rollbackPlanConfirmed: true,
    } as const;

    it("real upstream chain remains defer because wire candidate is not ready yet", () => {
      const report = evaluateRuntimeWireExperimentBranchPlan(INTEGRATION_INPUT);
      expect(report.sourceWireCandidateDecision).toBe("defer");
      expect(report.decision).toBe("defer");
      expect(report.executesGitInThisStep).toBe(false);
      expect(report.createsBranchInThisStep).toBe(false);
    });
  });
});
