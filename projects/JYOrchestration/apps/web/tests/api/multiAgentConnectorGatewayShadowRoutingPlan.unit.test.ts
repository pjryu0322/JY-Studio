import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateConnectorGatewayShadowRoutingPlan } from "@/lib/agents/evaluateConnectorGatewayShadowRoutingPlan";
import { buildRuntimeWireExperimentBranchName } from "@/lib/agents/evaluateRuntimeWireExperimentBranchPlan";
import * as manualVerificationModule from "@/lib/agents/evaluateRuntimeWireManualBranchVerification";
import type { RuntimeWireManualBranchVerificationReport } from "@/lib/agents/runtimeWireManualBranchVerificationTypes";

const EXPECTED_BRANCH = buildRuntimeWireExperimentBranchName();

const SOURCE_NO_RUN_FLAGS = {
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
} as const;

function mockManualVerification(
  overrides: Partial<RuntimeWireManualBranchVerificationReport> = {},
): RuntimeWireManualBranchVerificationReport {
  return {
    mode: "read_only_runtime_wire_manual_branch_verification",
    stage: "stage_4_b",
    decision: "manual_branch_verified",
    sourceBranchPlanDecision: "ready_for_manual_branch_creation_approval",
    sourcePlanFingerprint: "plan-fp",
    expectedBranchName: EXPECTED_BRANCH,
    actualBranchName: EXPECTED_BRANCH,
    branchMatches: true,
    sourceRecommendedBranchName: EXPECTED_BRANCH,
    sourceRecommendedFeatureFlagName: "JYO_RUNTIME_WIRE_EXPERIMENT",
    sourceManualCommandCount: 4,
    sourceRegressionSuiteCount: 2,
    sourceBranchPlanFindingCodes: ["runtime_wire_experiment_branch_plan_read_only"],
    sourceBranchPlanNoRunFlags: SOURCE_NO_RUN_FLAGS,
    explicitManualExecutionConfirmed: true,
    regressionResultsProvided: true,
    regressionPassed: true,
    rollbackRequired: false,
    sanitizedRegressionResults: [],
    verificationChecklist: [],
    regressionChecklist: [],
    rollbackChecklist: [],
    noRunChecklist: [],
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
    findings: [
      { severity: "info", code: "manual_branch_verified", message: "verified" },
      { severity: "info", code: "runtime_wire_manual_branch_verification_read_only", message: "read-only" },
    ],
    ...overrides,
  };
}

function spyManualVerification(overrides: Partial<RuntimeWireManualBranchVerificationReport> = {}) {
  return vi
    .spyOn(manualVerificationModule, "evaluateRuntimeWireManualBranchVerification")
    .mockReturnValue(mockManualVerification(overrides));
}

const ALL_SHADOW_CONFIRMATIONS = {
  shadowRoutingReviewConfirmed: true,
  connectorGatewayShadowModeConfirmed: true,
  stage1RegressionReviewedForShadowRouting: true,
  rollbackPlanReviewedForShadowRouting: true,
} as const;

describe("multi-agent connector gateway shadow routing plan stage 4-C", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mode is read_only_connector_gateway_shadow_routing_plan", () => {
    expect(evaluateConnectorGatewayShadowRoutingPlan().mode).toBe(
      "read_only_connector_gateway_shadow_routing_plan",
    );
  });

  it("stage is stage_4_c", () => {
    expect(evaluateConnectorGatewayShadowRoutingPlan().stage).toBe("stage_4_c");
  });

  it("default decision is defer", () => {
    expect(evaluateConnectorGatewayShadowRoutingPlan().decision).toBe("defer");
  });

  it("source manual verification blocked yields blocked", () => {
    spyManualVerification({ decision: "blocked" });
    expect(evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS).decision).toBe("blocked");
  });

  it("source manual verification defer yields defer", () => {
    spyManualVerification({ decision: "defer" });
    expect(evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS).decision).toBe("defer");
  });

  it("verified but shadowRoutingReviewConfirmed=false yields defer", () => {
    spyManualVerification();
    expect(
      evaluateConnectorGatewayShadowRoutingPlan({
        ...ALL_SHADOW_CONFIRMATIONS,
        shadowRoutingReviewConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("connectorGatewayShadowModeConfirmed=false yields defer", () => {
    spyManualVerification();
    expect(
      evaluateConnectorGatewayShadowRoutingPlan({
        ...ALL_SHADOW_CONFIRMATIONS,
        connectorGatewayShadowModeConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("stage1RegressionReviewedForShadowRouting=false yields defer", () => {
    spyManualVerification();
    expect(
      evaluateConnectorGatewayShadowRoutingPlan({
        ...ALL_SHADOW_CONFIRMATIONS,
        stage1RegressionReviewedForShadowRouting: false,
      }).decision,
    ).toBe("defer");
  });

  it("rollbackPlanReviewedForShadowRouting=false yields defer", () => {
    spyManualVerification();
    expect(
      evaluateConnectorGatewayShadowRoutingPlan({
        ...ALL_SHADOW_CONFIRMATIONS,
        rollbackPlanReviewedForShadowRouting: false,
      }).decision,
    ).toBe("defer");
  });

  it("source rollbackRequired=true yields blocked", () => {
    spyManualVerification({ rollbackRequired: true, decision: "manual_branch_verified" });
    expect(evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS).decision).toBe("blocked");
  });

  it("all conditions satisfied yields ready_for_shadow_routing_review", () => {
    spyManualVerification();
    expect(evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS).decision).toBe(
      "ready_for_shadow_routing_review",
    );
  });

  it("ready state keeps changesConnectorRoutingInThisStep false", () => {
    spyManualVerification();
    expect(evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS).changesConnectorRoutingInThisStep).toBe(
      false,
    );
  });

  it("ready state keeps callsConnectorInThisStep false", () => {
    spyManualVerification();
    expect(evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS).callsConnectorInThisStep).toBe(false);
  });

  it("ready state keeps callsCursorInThisStep false", () => {
    spyManualVerification();
    expect(evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS).callsCursorInThisStep).toBe(false);
  });

  it("ready state keeps callsGitHubInThisStep false", () => {
    spyManualVerification();
    expect(evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS).callsGitHubInThisStep).toBe(false);
  });

  it("ready state keeps wiresFeatureFlagInThisStep false", () => {
    spyManualVerification();
    expect(evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS).wiresFeatureFlagInThisStep).toBe(false);
  });

  it("routeCandidateCount is 3", () => {
    spyManualVerification();
    expect(evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS).routeCandidateCount).toBe(3);
  });

  it("routeCandidateSatisfiedCount is 3", () => {
    spyManualVerification();
    expect(evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS).routeCandidateSatisfiedCount).toBe(3);
  });

  it("all shadowRouteCandidates have executesInThisStep false", () => {
    spyManualVerification();
    const report = evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS);
    expect(report.shadowRouteCandidates.every((c) => c.executesInThisStep === false)).toBe(true);
  });

  it("all shadowRouteCandidates have changesRoutingInThisStep false", () => {
    spyManualVerification();
    const report = evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS);
    expect(report.shadowRouteCandidates.every((c) => c.changesRoutingInThisStep === false)).toBe(true);
  });

  it("cursor route candidate exists", () => {
    spyManualVerification();
    expect(
      evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS).shadowRouteCandidates.some(
        (c) => c.routeName === "cursor.execution.shadow",
      ),
    ).toBe(true);
  });

  it("github route candidate exists", () => {
    spyManualVerification();
    expect(
      evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS).shadowRouteCandidates.some(
        (c) => c.routeName === "github.pr.shadow",
      ),
    ).toBe(true);
  });

  it("internal observe route candidate exists", () => {
    spyManualVerification();
    expect(
      evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS).shadowRouteCandidates.some(
        (c) => c.routeName === "runtime.audit.observe",
      ),
    ).toBe(true);
  });

  it("featureFlagName has JYO_ prefix", () => {
    spyManualVerification();
    expect(evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS).featureFlagName.startsWith("JYO_")).toBe(
      true,
    );
  });

  it("featureFlagDefault is off", () => {
    spyManualVerification();
    expect(evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS).featureFlagDefault).toBe("off");
  });

  it("featureFlagEnabledInThisStep is false", () => {
    spyManualVerification();
    expect(evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS).featureFlagEnabledInThisStep).toBe(false);
  });

  it("sourceFindingCodes includes source manual verification finding codes", () => {
    spyManualVerification();
    const report = evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS);
    expect(report.sourceFindingCodes).toContain("manual_branch_verified");
    expect(report.sourceFindingCodes).toContain("runtime_wire_manual_branch_verification_read_only");
  });

  it("noRunChecklist exists", () => {
    spyManualVerification();
    expect(evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS).noRunChecklist.length).toBeGreaterThan(0);
  });

  it("noRunChecklist items are all satisfied", () => {
    spyManualVerification();
    const checklist = evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS).noRunChecklist;
    expect(checklist.every((item) => item.satisfied === true)).toBe(true);
  });

  it("ready state includes shadow_route_candidates_generated finding", () => {
    spyManualVerification();
    expect(
      evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS).findings.some(
        (f) => f.code === "shadow_route_candidates_generated",
      ),
    ).toBe(true);
  });

  it("defer includes shadow_routing_plan_deferred finding", () => {
    spyManualVerification({ decision: "defer" });
    expect(
      evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS).findings.some(
        (f) => f.code === "shadow_routing_plan_deferred",
      ),
    ).toBe(true);
  });

  it("blocked includes shadow_routing_plan_blocked finding", () => {
    spyManualVerification({ decision: "blocked" });
    expect(
      evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS).findings.some(
        (f) => f.code === "shadow_routing_plan_blocked",
      ),
    ).toBe(true);
  });

  it("ready includes shadow_routing_plan_ready finding", () => {
    spyManualVerification();
    expect(
      evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS).findings.some(
        (f) => f.code === "shadow_routing_plan_ready",
      ),
    ).toBe(true);
  });

  it("ready includes ready_for_shadow_routing_review_not_routing_permission finding", () => {
    spyManualVerification();
    expect(
      evaluateConnectorGatewayShadowRoutingPlan(ALL_SHADOW_CONFIRMATIONS).findings.some(
        (f) => f.code === "ready_for_shadow_routing_review_not_routing_permission",
      ),
    ).toBe(true);
  });
});
