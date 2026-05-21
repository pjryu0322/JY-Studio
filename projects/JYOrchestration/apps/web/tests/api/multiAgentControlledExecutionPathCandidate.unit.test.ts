import { afterEach, describe, expect, it, vi } from "vitest";
import {
  evaluateControlledExecutionPathCandidate,
  resolveControlledExecutionPathCandidateDecision,
} from "@/lib/agents/evaluateControlledExecutionPathCandidate";
import {
  buildRuntimeWireExperimentBranchName,
  buildRuntimeWireFeatureFlagName,
} from "@/lib/agents/evaluateRuntimeWireExperimentBranchPlan";
import * as shadowPlanModule from "@/lib/agents/evaluateConnectorGatewayShadowRoutingPlan";
import type { ConnectorGatewayShadowRoutingPlanReport } from "@/lib/agents/connectorGatewayShadowRoutingPlanTypes";

const EXPECTED_BRANCH = buildRuntimeWireExperimentBranchName();
const FEATURE_FLAG_NAME = buildRuntimeWireFeatureFlagName();

const SHADOW_ROUTE_CANDIDATES = [
  {
    sequence: 1,
    routeName: "cursor.execution.shadow",
    sourcePath: "cursor.execution.current",
    shadowPath: "connectorGateway.cursor.execution.shadow",
    connectorId: "cursor",
    mode: "shadow_compare" as const,
    executesInThisStep: false as const,
    changesRoutingInThisStep: false as const,
    reason: "cursor shadow",
  },
  {
    sequence: 2,
    routeName: "github.pr.shadow",
    sourcePath: "github.pr.current",
    shadowPath: "connectorGateway.github.pr.shadow",
    connectorId: "github",
    mode: "shadow_compare" as const,
    executesInThisStep: false as const,
    changesRoutingInThisStep: false as const,
    reason: "github shadow",
  },
  {
    sequence: 3,
    routeName: "runtime.audit.observe",
    sourcePath: "runtime.audit.current",
    shadowPath: "connectorGateway.runtime.audit.observe",
    connectorId: "internal",
    mode: "observe_only" as const,
    executesInThisStep: false as const,
    changesRoutingInThisStep: false as const,
    reason: "internal observe",
  },
];

function mockShadowPlanReady(
  overrides: Partial<ConnectorGatewayShadowRoutingPlanReport> = {},
): ConnectorGatewayShadowRoutingPlanReport {
  const noRunChecklist = [
    { item: "executesRuntimeInThisStep=false", satisfied: true, reason: "ok" },
    { item: "changesConnectorRoutingInThisStep=false", satisfied: true, reason: "ok" },
  ];

  return {
    mode: "read_only_connector_gateway_shadow_routing_plan",
    stage: "stage_4_c",
    decision: "ready_for_shadow_routing_review",
    sourceManualBranchDecision: "manual_branch_verified",
    sourceExpectedBranchName: "experiment/runtime-wire-controlled-candidate",
    sourceActualBranchName: "experiment/runtime-wire-controlled-candidate",
    sourceBranchMatches: true,
    sourceRegressionPassed: true,
    sourceRollbackRequired: false,
    sourceFindingCodes: [
      "connector_gateway_shadow_routing_plan_read_only",
      "shadow_route_candidates_generated",
    ],
    sourceManualVerificationExpectedBranchName: EXPECTED_BRANCH,
    sourceManualVerificationActualBranchName: EXPECTED_BRANCH,
    sourceManualVerificationRegressionResultsProvided: true,
    sourceManualVerificationExplicitApproval: true,
    sourceManualVerificationNoRunChecklistCount: 2,
    sourceManualVerificationNoRunChecklistSatisfiedCount: 2,
    featureFlagName: FEATURE_FLAG_NAME,
    featureFlagDefault: "off",
    featureFlagEnabledInThisStep: false,
    shadowRouteCandidates: SHADOW_ROUTE_CANDIDATES,
    routeCandidateCount: 3,
    routeCandidateSatisfiedCount: 3,
    shadowRoutingChecklist: [],
    safetyChecklist: [],
    rollbackChecklist: [],
    noRunChecklist,
    noRunChecklistCount: noRunChecklist.length,
    noRunChecklistSatisfiedCount: noRunChecklist.length,
    executesRuntimeInThisStep: false,
    changesConnectorRoutingInThisStep: false,
    callsConnectorInThisStep: false,
    callsCursorInThisStep: false,
    callsGitHubInThisStep: false,
    createsPullRequestInThisStep: false,
    executesGitInThisStep: false,
    createsBranchInThisStep: false,
    wiresWritePathInThisStep: false,
    wiresFeatureFlagInThisStep: false,
    writesDataInThisStep: false,
    callsPrismaInThisStep: false,
    modifiesSchemaInThisStep: false,
    createsMigrationInThisStep: false,
    findings: [
      { severity: "info", code: "connector_gateway_shadow_routing_plan_read_only", message: "read-only" },
      { severity: "info", code: "shadow_route_candidates_generated", message: "generated" },
      { severity: "info", code: "shadow_routing_plan_ready", message: "ready" },
    ],
    ...overrides,
  };
}

function spyShadowPlanReady(overrides: Partial<ConnectorGatewayShadowRoutingPlanReport> = {}) {
  return vi
    .spyOn(shadowPlanModule, "evaluateConnectorGatewayShadowRoutingPlan")
    .mockReturnValue(mockShadowPlanReady(overrides));
}

const ALL_EXECUTION_PATH_CONFIRMATIONS = {
  executionPathReviewConfirmed: true,
  shadowRoutingReviewConfirmedForExecutionPath: true,
  rollbackReviewConfirmedForExecutionPath: true,
  featureFlagPlanConfirmedForExecutionPath: true,
} as const;

function evaluateReadyExecutionPathReport() {
  spyShadowPlanReady();
  return evaluateControlledExecutionPathCandidate(ALL_EXECUTION_PATH_CONFIRMATIONS);
}

describe("multi-agent controlled execution path candidate stage 4-D", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("resolveControlledExecutionPathCandidateDecision", () => {
    it("returns blocked when source shadow routing is blocked", () => {
      expect(
        resolveControlledExecutionPathCandidateDecision({
          shadowRoutingDecision: "blocked",
          sourceNoRunChecklistCount: 2,
          sourceNoRunChecklistSatisfiedCount: 2,
          ...ALL_EXECUTION_PATH_CONFIRMATIONS,
        }),
      ).toBe("blocked");
    });

    it("returns blocked when source no-run checklist counts mismatch", () => {
      expect(
        resolveControlledExecutionPathCandidateDecision({
          shadowRoutingDecision: "ready_for_shadow_routing_review",
          sourceNoRunChecklistCount: 2,
          sourceNoRunChecklistSatisfiedCount: 1,
          ...ALL_EXECUTION_PATH_CONFIRMATIONS,
        }),
      ).toBe("blocked");
    });

    it("returns ready when shadow routing ready and all execution path confirmations satisfied", () => {
      expect(
        resolveControlledExecutionPathCandidateDecision({
          shadowRoutingDecision: "ready_for_shadow_routing_review",
          sourceNoRunChecklistCount: 2,
          sourceNoRunChecklistSatisfiedCount: 2,
          ...ALL_EXECUTION_PATH_CONFIRMATIONS,
        }),
      ).toBe("ready_for_execution_path_review");
    });
  });

  it("mode is read_only_controlled_execution_path_candidate", () => {
    expect(evaluateControlledExecutionPathCandidate().mode).toBe("read_only_controlled_execution_path_candidate");
  });

  it("stage is stage_4_d", () => {
    expect(evaluateControlledExecutionPathCandidate().stage).toBe("stage_4_d");
  });

  it("default decision is defer", () => {
    expect(evaluateControlledExecutionPathCandidate().decision).toBe("defer");
  });

  it("source shadow routing blocked yields blocked", () => {
    spyShadowPlanReady({ decision: "blocked" });
    expect(evaluateControlledExecutionPathCandidate(ALL_EXECUTION_PATH_CONFIRMATIONS).decision).toBe("blocked");
  });

  it("source shadow routing defer yields defer", () => {
    spyShadowPlanReady({ decision: "defer" });
    expect(evaluateControlledExecutionPathCandidate(ALL_EXECUTION_PATH_CONFIRMATIONS).decision).toBe("defer");
  });

  it("source no-run checklist mismatch yields blocked", () => {
    spyShadowPlanReady({ noRunChecklistCount: 2, noRunChecklistSatisfiedCount: 1 });
    expect(evaluateControlledExecutionPathCandidate(ALL_EXECUTION_PATH_CONFIRMATIONS).decision).toBe("blocked");
  });

  it("executionPathReviewConfirmed=false yields defer", () => {
    spyShadowPlanReady();
    expect(
      evaluateControlledExecutionPathCandidate({
        ...ALL_EXECUTION_PATH_CONFIRMATIONS,
        executionPathReviewConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("shadowRoutingReviewConfirmedForExecutionPath=false yields defer", () => {
    spyShadowPlanReady();
    expect(
      evaluateControlledExecutionPathCandidate({
        ...ALL_EXECUTION_PATH_CONFIRMATIONS,
        shadowRoutingReviewConfirmedForExecutionPath: false,
      }).decision,
    ).toBe("defer");
  });

  it("rollbackReviewConfirmedForExecutionPath=false yields defer", () => {
    spyShadowPlanReady();
    expect(
      evaluateControlledExecutionPathCandidate({
        ...ALL_EXECUTION_PATH_CONFIRMATIONS,
        rollbackReviewConfirmedForExecutionPath: false,
      }).decision,
    ).toBe("defer");
  });

  it("featureFlagPlanConfirmedForExecutionPath=false yields defer", () => {
    spyShadowPlanReady();
    expect(
      evaluateControlledExecutionPathCandidate({
        ...ALL_EXECUTION_PATH_CONFIRMATIONS,
        featureFlagPlanConfirmedForExecutionPath: false,
      }).decision,
    ).toBe("defer");
  });

  it("all conditions satisfied yields ready_for_execution_path_review", () => {
    expect(evaluateReadyExecutionPathReport().decision).toBe("ready_for_execution_path_review");
  });

  it("ready state keeps executesRuntimeInThisStep false", () => {
    expect(evaluateReadyExecutionPathReport().executesRuntimeInThisStep).toBe(false);
  });

  it("ready state keeps changesExecutionPathInThisStep false", () => {
    expect(evaluateReadyExecutionPathReport().changesExecutionPathInThisStep).toBe(false);
  });

  it("ready state keeps changesConnectorRoutingInThisStep false", () => {
    expect(evaluateReadyExecutionPathReport().changesConnectorRoutingInThisStep).toBe(false);
  });

  it("ready state keeps callsConnectorInThisStep false", () => {
    expect(evaluateReadyExecutionPathReport().callsConnectorInThisStep).toBe(false);
  });

  it("ready state keeps callsCursorInThisStep false", () => {
    expect(evaluateReadyExecutionPathReport().callsCursorInThisStep).toBe(false);
  });

  it("ready state keeps callsGitHubInThisStep false", () => {
    expect(evaluateReadyExecutionPathReport().callsGitHubInThisStep).toBe(false);
  });

  it("ready state keeps wiresFeatureFlagInThisStep false", () => {
    expect(evaluateReadyExecutionPathReport().wiresFeatureFlagInThisStep).toBe(false);
  });

  it("executionPathCandidateCount matches source route count", () => {
    const report = evaluateReadyExecutionPathReport();
    expect(report.executionPathCandidateCount).toBe(report.sourceRouteCandidateCount);
    expect(report.executionPathCandidateCount).toBe(3);
  });

  it("executionPathCandidateSatisfiedCount matches executionPathCandidateCount", () => {
    const report = evaluateReadyExecutionPathReport();
    expect(report.executionPathCandidateSatisfiedCount).toBe(report.executionPathCandidateCount);
  });

  it("all execution path candidates have executesInThisStep false", () => {
    expect(evaluateReadyExecutionPathReport().executionPathCandidates.every((c) => c.executesInThisStep === false)).toBe(
      true,
    );
  });

  it("all execution path candidates have changesExecutionPathInThisStep false", () => {
    expect(
      evaluateReadyExecutionPathReport().executionPathCandidates.every((c) => c.changesExecutionPathInThisStep === false),
    ).toBe(true);
  });

  it("all execution path candidates have changesRoutingInThisStep false", () => {
    expect(
      evaluateReadyExecutionPathReport().executionPathCandidates.every((c) => c.changesRoutingInThisStep === false),
    ).toBe(true);
  });

  it("cursor execution path candidate exists", () => {
    expect(
      evaluateReadyExecutionPathReport().executionPathCandidates.some((c) => c.connectorId === "cursor"),
    ).toBe(true);
  });

  it("github execution path candidate exists", () => {
    expect(
      evaluateReadyExecutionPathReport().executionPathCandidates.some((c) => c.connectorId === "github"),
    ).toBe(true);
  });

  it("internal observe execution path candidate exists", () => {
    expect(
      evaluateReadyExecutionPathReport().executionPathCandidates.some((c) => c.connectorId === "internal"),
    ).toBe(true);
  });

  it("shadow_compare route maps to controlled_candidate mode", () => {
    const cursor = evaluateReadyExecutionPathReport().executionPathCandidates.find((c) => c.connectorId === "cursor");
    expect(cursor?.mode).toBe("controlled_candidate");
  });

  it("observe_only route stays observe_only mode", () => {
    const internal = evaluateReadyExecutionPathReport().executionPathCandidates.find((c) => c.connectorId === "internal");
    expect(internal?.mode).toBe("observe_only");
  });

  it("sourceFeatureFlagName has JYO_ prefix", () => {
    expect(evaluateReadyExecutionPathReport().sourceFeatureFlagName.startsWith("JYO_")).toBe(true);
  });

  it("sourceFeatureFlagDefault is off", () => {
    expect(evaluateReadyExecutionPathReport().sourceFeatureFlagDefault).toBe("off");
  });

  it("sourceFindingCodes includes connector_gateway_shadow_routing_plan_read_only", () => {
    expect(evaluateReadyExecutionPathReport().sourceFindingCodes).toContain(
      "connector_gateway_shadow_routing_plan_read_only",
    );
  });

  it("ready includes controlled_execution_path_candidate_ready finding", () => {
    expect(
      evaluateReadyExecutionPathReport().findings.some((f) => f.code === "controlled_execution_path_candidate_ready"),
    ).toBe(true);
  });

  it("ready includes ready_for_execution_path_review_not_execution_permission finding", () => {
    expect(
      evaluateReadyExecutionPathReport().findings.some(
        (f) => f.code === "ready_for_execution_path_review_not_execution_permission",
      ),
    ).toBe(true);
  });

  it("defer includes controlled_execution_path_candidate_deferred finding", () => {
    spyShadowPlanReady({ decision: "defer" });
    expect(
      evaluateControlledExecutionPathCandidate(ALL_EXECUTION_PATH_CONFIRMATIONS).findings.some(
        (f) => f.code === "controlled_execution_path_candidate_deferred",
      ),
    ).toBe(true);
  });

  it("blocked includes controlled_execution_path_candidate_blocked finding", () => {
    spyShadowPlanReady({ decision: "blocked" });
    expect(
      evaluateControlledExecutionPathCandidate(ALL_EXECUTION_PATH_CONFIRMATIONS).findings.some(
        (f) => f.code === "controlled_execution_path_candidate_blocked",
      ),
    ).toBe(true);
  });

  it("noRunChecklist items are all satisfied", () => {
    const checklist = evaluateReadyExecutionPathReport().noRunChecklist;
    expect(checklist.length).toBeGreaterThan(0);
    expect(checklist.every((item) => item.satisfied === true)).toBe(true);
  });

  describe("Stage 4-D hardening", () => {
    it("noRunChecklistCount matches noRunChecklist length", () => {
      const report = evaluateReadyExecutionPathReport();
      expect(report.noRunChecklistCount).toBe(report.noRunChecklist.length);
    });

    it("noRunChecklistSatisfiedCount matches satisfied item count", () => {
      const report = evaluateReadyExecutionPathReport();
      expect(report.noRunChecklistSatisfiedCount).toBe(
        report.noRunChecklist.filter((item) => item.satisfied).length,
      );
    });

    it("noRunChecklistSatisfiedCount equals noRunChecklistCount", () => {
      const report = evaluateReadyExecutionPathReport();
      expect(report.noRunChecklistSatisfiedCount).toBe(report.noRunChecklistCount);
    });

    it("sourceShadowRoutingFindingCodes includes shadow_route_candidates_generated", () => {
      expect(evaluateReadyExecutionPathReport().sourceShadowRoutingFindingCodes).toContain(
        "shadow_route_candidates_generated",
      );
    });

    it("sourceShadowRoutingNoRunChecklistCount equals sourceNoRunChecklistCount", () => {
      const report = evaluateReadyExecutionPathReport();
      expect(report.sourceShadowRoutingNoRunChecklistCount).toBe(report.sourceNoRunChecklistCount);
    });

    it("sourceShadowRoutingNoRunChecklistSatisfiedCount equals sourceNoRunChecklistSatisfiedCount", () => {
      const report = evaluateReadyExecutionPathReport();
      expect(report.sourceShadowRoutingNoRunChecklistSatisfiedCount).toBe(report.sourceNoRunChecklistSatisfiedCount);
    });

    it("sourceShadowRoutingRouteCandidateCount equals sourceRouteCandidateCount", () => {
      const report = evaluateReadyExecutionPathReport();
      expect(report.sourceShadowRoutingRouteCandidateCount).toBe(report.sourceRouteCandidateCount);
    });

    it("sourceShadowRoutingRouteCandidateSatisfiedCount equals sourceRouteCandidateSatisfiedCount", () => {
      const report = evaluateReadyExecutionPathReport();
      expect(report.sourceShadowRoutingRouteCandidateSatisfiedCount).toBe(report.sourceRouteCandidateSatisfiedCount);
    });
  });
});
