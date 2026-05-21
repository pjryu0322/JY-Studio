import { afterEach, describe, expect, it, vi } from "vitest";
import {
  evaluateRuntimeWireManualBranchVerification,
  sanitizeRuntimeWireRegressionResults,
} from "@/lib/agents/evaluateRuntimeWireManualBranchVerification";
import { buildRuntimeWireExperimentBranchName } from "@/lib/agents/evaluateRuntimeWireExperimentBranchPlan";
import * as branchPlanModule from "@/lib/agents/evaluateRuntimeWireExperimentBranchPlan";

const EXPECTED_BRANCH = buildRuntimeWireExperimentBranchName();

function mockBranchPlanReady(): ReturnType<typeof branchPlanModule.evaluateRuntimeWireExperimentBranchPlan> {
  return {
    mode: "read_only_runtime_wire_experiment_branch_plan",
    stage: "stage_4_a",
    decision: "ready_for_manual_branch_creation_approval",
    sourceWireCandidateDecision: "ready_for_runtime_wire_experiment_branch",
    sourceApprovalGateDecision: "ready_for_controlled_runtime_wire_candidate",
    sourceApprovalGateFingerprint: "gate-fp",
    sourceCandidateFingerprint: "candidate-fp",
    sourceCandidateKinds: [],
    sourceWireCandidateCount: 5,
    sourceWireCandidateSatisfiedCount: 5,
    sourceWireCandidateUnsatisfiedCount: 0,
    sourceNoRunFlags: {
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
    },
    planVersion: 1,
    planTitle: "plan",
    planSummary: "ready",
    planFingerprint: "plan-fp",
    recommendedBranchName: EXPECTED_BRANCH,
    recommendedFeatureFlagName: "JYO_RUNTIME_WIRE_EXPERIMENT",
    manualCommandCandidates: [],
    regressionSuites: [],
    branchSafetyChecklist: [],
    rollbackChecklist: [],
    handoffChecklist: [],
    createsBranchInThisStep: false,
    executesGitInThisStep: false,
    createsPullRequestInThisStep: false,
    changesConnectorRoutingInThisStep: false,
    executesRuntimeInThisStep: false,
    wiresWritePathInThisStep: false,
    wiresFeatureFlagInThisStep: false,
    writesDataInThisStep: false,
    callsPrismaInThisStep: false,
    modifiesSchemaInThisStep: false,
    createsMigrationInThisStep: false,
    callsCursorInThisStep: false,
    callsGitHubInThisStep: false,
    findings: [],
  };
}

function spyBranchPlanReady() {
  return vi
    .spyOn(branchPlanModule, "evaluateRuntimeWireExperimentBranchPlan")
    .mockReturnValue(mockBranchPlanReady());
}

const PASSED_REGRESSION = [
  { suite: "tests/api/multiAgent", passed: true, summary: "all passed" },
] as const;

const ALL_VERIFICATION_INPUT = {
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
  explicitManualExecutionConfirmed: true,
  actualBranchName: EXPECTED_BRANCH,
  regressionResults: [...PASSED_REGRESSION],
} as const;

describe("multi-agent runtime wire manual branch verification stage 4-B", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mode is read_only_runtime_wire_manual_branch_verification", () => {
    expect(evaluateRuntimeWireManualBranchVerification().mode).toBe(
      "read_only_runtime_wire_manual_branch_verification",
    );
  });

  it("stage is stage_4_b", () => {
    expect(evaluateRuntimeWireManualBranchVerification().stage).toBe("stage_4_b");
  });

  it("default decision is defer", () => {
    expect(evaluateRuntimeWireManualBranchVerification().decision).toBe("defer");
  });

  it("createsBranchInThisStep is false", () => {
    expect(evaluateRuntimeWireManualBranchVerification().createsBranchInThisStep).toBe(false);
  });

  it("executesGitInThisStep is false", () => {
    expect(evaluateRuntimeWireManualBranchVerification().executesGitInThisStep).toBe(false);
  });

  it("createsPullRequestInThisStep is false", () => {
    expect(evaluateRuntimeWireManualBranchVerification().createsPullRequestInThisStep).toBe(false);
  });

  it("changesConnectorRoutingInThisStep is false", () => {
    expect(evaluateRuntimeWireManualBranchVerification().changesConnectorRoutingInThisStep).toBe(false);
  });

  it("executesRuntimeInThisStep is false", () => {
    expect(evaluateRuntimeWireManualBranchVerification().executesRuntimeInThisStep).toBe(false);
  });

  it("wiresWritePathInThisStep is false", () => {
    expect(evaluateRuntimeWireManualBranchVerification().wiresWritePathInThisStep).toBe(false);
  });

  it("wiresFeatureFlagInThisStep is false", () => {
    expect(evaluateRuntimeWireManualBranchVerification().wiresFeatureFlagInThisStep).toBe(false);
  });

  it("writesDataInThisStep is false", () => {
    expect(evaluateRuntimeWireManualBranchVerification().writesDataInThisStep).toBe(false);
  });

  it("callsPrismaInThisStep is false", () => {
    expect(evaluateRuntimeWireManualBranchVerification().callsPrismaInThisStep).toBe(false);
  });

  it("modifiesSchemaInThisStep is false", () => {
    expect(evaluateRuntimeWireManualBranchVerification().modifiesSchemaInThisStep).toBe(false);
  });

  it("createsMigrationInThisStep is false", () => {
    expect(evaluateRuntimeWireManualBranchVerification().createsMigrationInThisStep).toBe(false);
  });

  it("callsCursorInThisStep is false", () => {
    expect(evaluateRuntimeWireManualBranchVerification().callsCursorInThisStep).toBe(false);
  });

  it("callsGitHubInThisStep is false", () => {
    expect(evaluateRuntimeWireManualBranchVerification().callsGitHubInThisStep).toBe(false);
  });

  it("source branch plan blocked returns blocked", () => {
    vi.spyOn(branchPlanModule, "evaluateRuntimeWireExperimentBranchPlan").mockReturnValue({
      ...mockBranchPlanReady(),
      decision: "blocked",
    });

    expect(evaluateRuntimeWireManualBranchVerification(ALL_VERIFICATION_INPUT).decision).toBe("blocked");
  });

  it("source branch plan defer returns defer", () => {
    vi.spyOn(branchPlanModule, "evaluateRuntimeWireExperimentBranchPlan").mockReturnValue({
      ...mockBranchPlanReady(),
      decision: "defer",
    });

    expect(evaluateRuntimeWireManualBranchVerification(ALL_VERIFICATION_INPUT).decision).toBe("defer");
  });

  it("source plan ready with explicitManualExecutionConfirmed false returns defer", () => {
    spyBranchPlanReady();

    expect(
      evaluateRuntimeWireManualBranchVerification({
        ...ALL_VERIFICATION_INPUT,
        explicitManualExecutionConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("returns defer when actualBranchName is missing", () => {
    spyBranchPlanReady();

    expect(
      evaluateRuntimeWireManualBranchVerification({
        ...ALL_VERIFICATION_INPUT,
        actualBranchName: "",
      }).decision,
    ).toBe("defer");
  });

  it("returns blocked when actualBranchName differs from expected", () => {
    spyBranchPlanReady();

    const report = evaluateRuntimeWireManualBranchVerification({
      ...ALL_VERIFICATION_INPUT,
      actualBranchName: "experiment/wrong-branch",
    });
    expect(report.decision).toBe("blocked");
    expect(report.branchMatches).toBe(false);
  });

  it("returns defer when regressionResults is undefined", () => {
    spyBranchPlanReady();

    expect(
      evaluateRuntimeWireManualBranchVerification({
        ...ALL_VERIFICATION_INPUT,
        regressionResults: undefined,
      }).decision,
    ).toBe("defer");
  });

  it("returns defer when regressionResults is empty", () => {
    spyBranchPlanReady();

    expect(
      evaluateRuntimeWireManualBranchVerification({
        ...ALL_VERIFICATION_INPUT,
        regressionResults: [],
      }).decision,
    ).toBe("defer");
  });

  it("returns blocked when regressionResults contain failure", () => {
    spyBranchPlanReady();

    expect(
      evaluateRuntimeWireManualBranchVerification({
        ...ALL_VERIFICATION_INPUT,
        regressionResults: [{ suite: "multiAgent", passed: false, summary: "failed" }],
      }).decision,
    ).toBe("blocked");
  });

  it("sets rollbackRequired true when regression failed", () => {
    spyBranchPlanReady();

    expect(
      evaluateRuntimeWireManualBranchVerification({
        ...ALL_VERIFICATION_INPUT,
        regressionResults: [{ suite: "multiAgent", passed: false, summary: "failed" }],
      }).rollbackRequired,
    ).toBe(true);
  });

  it("returns manual_branch_verified when all conditions satisfied", () => {
    spyBranchPlanReady();

    expect(evaluateRuntimeWireManualBranchVerification(ALL_VERIFICATION_INPUT).decision).toBe(
      "manual_branch_verified",
    );
  });

  it("sets branchMatches true when names align", () => {
    spyBranchPlanReady();

    expect(evaluateRuntimeWireManualBranchVerification(ALL_VERIFICATION_INPUT).branchMatches).toBe(true);
  });

  describe("sanitizeRuntimeWireRegressionResults", () => {
    it("does not mutate the input array", () => {
      const input = [{ suite: "  a  ", passed: true, summary: "  ok  " }];
      const copy = [...input];
      sanitizeRuntimeWireRegressionResults(input);
      expect(input).toEqual(copy);
    });

    it("trims suite and summary", () => {
      const result = sanitizeRuntimeWireRegressionResults([
        { suite: "  tests/api/multiAgent  ", passed: true, summary: "  passed  " },
      ]);
      expect(result[0]?.suite).toBe("tests/api/multiAgent");
      expect(result[0]?.summary).toBe("passed");
    });

    it("maps empty suite to unknown", () => {
      const result = sanitizeRuntimeWireRegressionResults([{ suite: "   ", passed: true, summary: "ok" }]);
      expect(result[0]?.suite).toBe("unknown");
    });

    it("maps empty summary to no summary", () => {
      const result = sanitizeRuntimeWireRegressionResults([{ suite: "multiAgent", passed: true, summary: "  " }]);
      expect(result[0]?.summary).toBe("no summary");
    });

    it("prefers failed entry for duplicate suite", () => {
      const result = sanitizeRuntimeWireRegressionResults([
        { suite: "multiAgent", passed: true, summary: "pass first" },
        { suite: "multiAgent", passed: false, summary: "fail second" },
      ]);
      expect(result).toHaveLength(1);
      expect(result[0]?.passed).toBe(false);
      expect(result[0]?.summary).toBe("fail second");
    });

    it("uses last entry when duplicate suite has no failure", () => {
      const result = sanitizeRuntimeWireRegressionResults([
        { suite: "multiAgent", passed: true, summary: "first" },
        { suite: "multiAgent", passed: true, summary: "last" },
      ]);
      expect(result[0]?.summary).toBe("last");
    });
  });

  it("verificationChecklist includes manual execution confirmation", () => {
    spyBranchPlanReady();
    expect(
      evaluateRuntimeWireManualBranchVerification(ALL_VERIFICATION_INPUT).verificationChecklist.some(
        (c) => c.item === "manual execution confirmation",
      ),
    ).toBe(true);
  });

  it("regressionChecklist includes regression results provided", () => {
    spyBranchPlanReady();
    expect(
      evaluateRuntimeWireManualBranchVerification(ALL_VERIFICATION_INPUT).regressionChecklist.some(
        (c) => c.item === "regression results provided",
      ),
    ).toBe(true);
  });

  it("rollbackChecklist includes rollbackRequired", () => {
    spyBranchPlanReady();
    expect(
      evaluateRuntimeWireManualBranchVerification(ALL_VERIFICATION_INPUT).rollbackChecklist.some(
        (c) => c.item === "rollbackRequired",
      ),
    ).toBe(true);
  });

  it("noRunChecklist exists with satisfied items", () => {
    expect(evaluateRuntimeWireManualBranchVerification().noRunChecklist.length).toBeGreaterThan(0);
    expect(evaluateRuntimeWireManualBranchVerification().noRunChecklist.every((c) => c.satisfied)).toBe(true);
  });

  it("findings include manual_branch_verification_read_only", () => {
    expect(
      evaluateRuntimeWireManualBranchVerification().findings.some(
        (f) => f.code === "manual_branch_verification_read_only",
      ),
    ).toBe(true);
  });

  it("mismatch adds manual_branch_name_mismatch finding", () => {
    spyBranchPlanReady();
    expect(
      evaluateRuntimeWireManualBranchVerification({
        ...ALL_VERIFICATION_INPUT,
        actualBranchName: "wrong",
      }).findings.some((f) => f.code === "manual_branch_name_mismatch"),
    ).toBe(true);
  });

  it("success adds manual_branch_verified finding", () => {
    spyBranchPlanReady();
    expect(
      evaluateRuntimeWireManualBranchVerification(ALL_VERIFICATION_INPUT).findings.some(
        (f) => f.code === "manual_branch_verified",
      ),
    ).toBe(true);
  });
});
