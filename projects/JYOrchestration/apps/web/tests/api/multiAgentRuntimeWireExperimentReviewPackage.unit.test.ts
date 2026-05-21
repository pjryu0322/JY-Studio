import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRuntimeWireExperimentReviewFingerprint,
  evaluateRuntimeWireExperimentReviewPackage,
  resolveRuntimeWireExperimentReviewPackageDecision,
} from "@/lib/agents/evaluateRuntimeWireExperimentReviewPackage";
import { buildRuntimeWireFeatureFlagName } from "@/lib/agents/evaluateRuntimeWireExperimentBranchPlan";
import * as controlledCandidateModule from "@/lib/agents/evaluateControlledExecutionPathCandidate";
import type { ControlledExecutionPathCandidateReport } from "@/lib/agents/controlledExecutionPathCandidateTypes";

const FEATURE_FLAG_NAME = buildRuntimeWireFeatureFlagName();

const EXECUTION_PATH_CANDIDATES = [
  {
    sequence: 1,
    candidateId: "controlled-cursor-1",
    sourceRouteName: "cursor.execution.shadow",
    proposedExecutionPath: "connectorGateway.cursor.execution.shadow",
    currentExecutionPath: "cursor.execution.current",
    connectorId: "cursor",
    mode: "controlled_candidate" as const,
    executesInThisStep: false as const,
    changesExecutionPathInThisStep: false as const,
    changesRoutingInThisStep: false as const,
    reason: "cursor",
  },
  {
    sequence: 2,
    candidateId: "controlled-github-2",
    sourceRouteName: "github.pr.shadow",
    proposedExecutionPath: "connectorGateway.github.pr.shadow",
    currentExecutionPath: "github.pr.current",
    connectorId: "github",
    mode: "controlled_candidate" as const,
    executesInThisStep: false as const,
    changesExecutionPathInThisStep: false as const,
    changesRoutingInThisStep: false as const,
    reason: "github",
  },
  {
    sequence: 3,
    candidateId: "controlled-internal-3",
    sourceRouteName: "runtime.audit.observe",
    proposedExecutionPath: "connectorGateway.runtime.audit.observe",
    currentExecutionPath: "runtime.audit.current",
    connectorId: "internal",
    mode: "observe_only" as const,
    executesInThisStep: false as const,
    changesExecutionPathInThisStep: false as const,
    changesRoutingInThisStep: false as const,
    reason: "internal",
  },
];

function mockControlledCandidateReady(
  overrides: Partial<ControlledExecutionPathCandidateReport> = {},
): ControlledExecutionPathCandidateReport {
  const noRunChecklist = [
    { item: "executesRuntimeInThisStep=false", satisfied: true, reason: "ok" },
    { item: "changesExecutionPathInThisStep=false", satisfied: true, reason: "ok" },
  ];

  return {
    mode: "read_only_controlled_execution_path_candidate",
    stage: "stage_4_d",
    decision: "ready_for_execution_path_review",
    sourceShadowRoutingDecision: "ready_for_shadow_routing_review",
    sourceFeatureFlagName: FEATURE_FLAG_NAME,
    sourceFeatureFlagDefault: "off",
    sourceRouteCandidateCount: 3,
    sourceRouteCandidateSatisfiedCount: 3,
    sourceNoRunChecklistCount: 2,
    sourceNoRunChecklistSatisfiedCount: 2,
    sourceFindingCodes: [
      "connector_gateway_shadow_routing_plan_read_only",
      "controlled_execution_path_candidate_read_only",
    ],
    sourceShadowRoutingFindingCodes: [
      "connector_gateway_shadow_routing_plan_read_only",
      "shadow_route_candidates_generated",
    ],
    sourceShadowRoutingNoRunChecklistCount: 2,
    sourceShadowRoutingNoRunChecklistSatisfiedCount: 2,
    sourceShadowRoutingRouteCandidateCount: 3,
    sourceShadowRoutingRouteCandidateSatisfiedCount: 3,
    executionPathCandidates: EXECUTION_PATH_CANDIDATES,
    executionPathCandidateCount: 3,
    executionPathCandidateSatisfiedCount: 3,
    executionPathReviewConfirmed: true,
    shadowRoutingReviewConfirmedForExecutionPath: true,
    rollbackReviewConfirmedForExecutionPath: true,
    featureFlagPlanConfirmedForExecutionPath: true,
    candidateChecklist: [],
    safetyChecklist: [],
    rollbackChecklist: [],
    handoffChecklist: [],
    noRunChecklist,
    noRunChecklistCount: noRunChecklist.length,
    noRunChecklistSatisfiedCount: noRunChecklist.length,
    executesRuntimeInThisStep: false,
    changesExecutionPathInThisStep: false,
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
      { severity: "info", code: "controlled_execution_path_candidate_read_only", message: "read-only" },
      { severity: "info", code: "execution_path_candidates_generated", message: "generated" },
      { severity: "info", code: "controlled_execution_path_candidate_ready", message: "ready" },
    ],
    ...overrides,
  };
}

function spyControlledCandidateReady(overrides: Partial<ControlledExecutionPathCandidateReport> = {}) {
  return vi
    .spyOn(controlledCandidateModule, "evaluateControlledExecutionPathCandidate")
    .mockReturnValue(mockControlledCandidateReady(overrides));
}

const ALL_PACKAGE_REVIEWS = {
  runtimeWireReviewConfirmed: true,
  connectorGatewayReviewConfirmed: true,
  executionPathReviewConfirmedForPackage: true,
  featureFlagReviewConfirmedForPackage: true,
  rollbackReviewConfirmedForPackage: true,
  operatorFinalReviewConfirmed: true,
} as const;

function evaluateReadyReviewPackage() {
  spyControlledCandidateReady();
  return evaluateRuntimeWireExperimentReviewPackage(ALL_PACKAGE_REVIEWS);
}

function fingerprintInputFromFlags(flags: typeof ALL_PACKAGE_REVIEWS) {
  return {
    sourceDecision: "ready_for_execution_path_review" as const,
    sourceExecutionPathCandidateCount: 3,
    sourceExecutionPathCandidateSatisfiedCount: 3,
    sourceNoRunChecklistCount: 2,
    sourceNoRunChecklistSatisfiedCount: 2,
    runtimeWireReviewConfirmed: flags.runtimeWireReviewConfirmed,
    connectorGatewayReviewConfirmed: flags.connectorGatewayReviewConfirmed,
    executionPathReviewConfirmedForPackage: flags.executionPathReviewConfirmedForPackage,
    featureFlagReviewConfirmedForPackage: flags.featureFlagReviewConfirmedForPackage,
    rollbackReviewConfirmedForPackage: flags.rollbackReviewConfirmedForPackage,
    operatorFinalReviewConfirmed: flags.operatorFinalReviewConfirmed,
  };
}

describe("multi-agent runtime wire experiment review package stage 4-E", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("resolveRuntimeWireExperimentReviewPackageDecision", () => {
    it("returns blocked when source controlled execution path is blocked", () => {
      expect(
        resolveRuntimeWireExperimentReviewPackageDecision({
          controlledExecutionPathDecision: "blocked",
          sourceNoRunChecklistCount: 2,
          sourceNoRunChecklistSatisfiedCount: 2,
          ...ALL_PACKAGE_REVIEWS,
        }),
      ).toBe("blocked");
    });

    it("returns blocked when source no-run checklist counts mismatch", () => {
      expect(
        resolveRuntimeWireExperimentReviewPackageDecision({
          controlledExecutionPathDecision: "ready_for_execution_path_review",
          sourceNoRunChecklistCount: 2,
          sourceNoRunChecklistSatisfiedCount: 1,
          ...ALL_PACKAGE_REVIEWS,
        }),
      ).toBe("blocked");
    });

    it("returns ready when execution path ready and all package reviews satisfied", () => {
      expect(
        resolveRuntimeWireExperimentReviewPackageDecision({
          controlledExecutionPathDecision: "ready_for_execution_path_review",
          sourceNoRunChecklistCount: 2,
          sourceNoRunChecklistSatisfiedCount: 2,
          ...ALL_PACKAGE_REVIEWS,
        }),
      ).toBe("ready_for_stage4_closure_verdict");
    });
  });

  it("mode is read_only_runtime_wire_experiment_review_package", () => {
    expect(evaluateRuntimeWireExperimentReviewPackage().mode).toBe(
      "read_only_runtime_wire_experiment_review_package",
    );
  });

  it("stage is stage_4_e", () => {
    expect(evaluateRuntimeWireExperimentReviewPackage().stage).toBe("stage_4_e");
  });

  it("default decision is defer", () => {
    expect(evaluateRuntimeWireExperimentReviewPackage().decision).toBe("defer");
  });

  it("source controlled execution path blocked yields blocked", () => {
    spyControlledCandidateReady({ decision: "blocked" });
    expect(evaluateRuntimeWireExperimentReviewPackage(ALL_PACKAGE_REVIEWS).decision).toBe("blocked");
  });

  it("source controlled execution path defer yields defer", () => {
    spyControlledCandidateReady({ decision: "defer" });
    expect(evaluateRuntimeWireExperimentReviewPackage(ALL_PACKAGE_REVIEWS).decision).toBe("defer");
  });

  it("source no-run checklist mismatch yields blocked", () => {
    spyControlledCandidateReady({ noRunChecklistCount: 2, noRunChecklistSatisfiedCount: 1 });
    expect(evaluateRuntimeWireExperimentReviewPackage(ALL_PACKAGE_REVIEWS).decision).toBe("blocked");
  });

  it("runtimeWireReviewConfirmed=false yields defer", () => {
    spyControlledCandidateReady();
    expect(
      evaluateRuntimeWireExperimentReviewPackage({ ...ALL_PACKAGE_REVIEWS, runtimeWireReviewConfirmed: false })
        .decision,
    ).toBe("defer");
  });

  it("connectorGatewayReviewConfirmed=false yields defer", () => {
    spyControlledCandidateReady();
    expect(
      evaluateRuntimeWireExperimentReviewPackage({ ...ALL_PACKAGE_REVIEWS, connectorGatewayReviewConfirmed: false })
        .decision,
    ).toBe("defer");
  });

  it("executionPathReviewConfirmedForPackage=false yields defer", () => {
    spyControlledCandidateReady();
    expect(
      evaluateRuntimeWireExperimentReviewPackage({
        ...ALL_PACKAGE_REVIEWS,
        executionPathReviewConfirmedForPackage: false,
      }).decision,
    ).toBe("defer");
  });

  it("featureFlagReviewConfirmedForPackage=false yields defer", () => {
    spyControlledCandidateReady();
    expect(
      evaluateRuntimeWireExperimentReviewPackage({ ...ALL_PACKAGE_REVIEWS, featureFlagReviewConfirmedForPackage: false })
        .decision,
    ).toBe("defer");
  });

  it("rollbackReviewConfirmedForPackage=false yields defer", () => {
    spyControlledCandidateReady();
    expect(
      evaluateRuntimeWireExperimentReviewPackage({ ...ALL_PACKAGE_REVIEWS, rollbackReviewConfirmedForPackage: false })
        .decision,
    ).toBe("defer");
  });

  it("operatorFinalReviewConfirmed=false yields defer", () => {
    spyControlledCandidateReady();
    expect(
      evaluateRuntimeWireExperimentReviewPackage({ ...ALL_PACKAGE_REVIEWS, operatorFinalReviewConfirmed: false })
        .decision,
    ).toBe("defer");
  });

  it("all conditions satisfied yields ready_for_stage4_closure_verdict", () => {
    expect(evaluateReadyReviewPackage().decision).toBe("ready_for_stage4_closure_verdict");
  });

  it("ready state keeps executesRuntimeInThisStep false", () => {
    expect(evaluateReadyReviewPackage().executesRuntimeInThisStep).toBe(false);
  });

  it("ready state keeps changesExecutionPathInThisStep false", () => {
    expect(evaluateReadyReviewPackage().changesExecutionPathInThisStep).toBe(false);
  });

  it("ready state keeps changesConnectorRoutingInThisStep false", () => {
    expect(evaluateReadyReviewPackage().changesConnectorRoutingInThisStep).toBe(false);
  });

  it("ready state keeps callsConnectorInThisStep false", () => {
    expect(evaluateReadyReviewPackage().callsConnectorInThisStep).toBe(false);
  });

  it("ready state keeps callsCursorInThisStep false", () => {
    expect(evaluateReadyReviewPackage().callsCursorInThisStep).toBe(false);
  });

  it("ready state keeps callsGitHubInThisStep false", () => {
    expect(evaluateReadyReviewPackage().callsGitHubInThisStep).toBe(false);
  });

  it("ready state keeps createsPullRequestInThisStep false", () => {
    expect(evaluateReadyReviewPackage().createsPullRequestInThisStep).toBe(false);
  });

  it("ready state keeps executesGitInThisStep false", () => {
    expect(evaluateReadyReviewPackage().executesGitInThisStep).toBe(false);
  });

  it("ready state keeps createsBranchInThisStep false", () => {
    expect(evaluateReadyReviewPackage().createsBranchInThisStep).toBe(false);
  });

  it("ready state keeps wiresFeatureFlagInThisStep false", () => {
    expect(evaluateReadyReviewPackage().wiresFeatureFlagInThisStep).toBe(false);
  });

  it("ready state keeps writesDataInThisStep false", () => {
    expect(evaluateReadyReviewPackage().writesDataInThisStep).toBe(false);
  });

  it("ready state keeps callsPrismaInThisStep false", () => {
    expect(evaluateReadyReviewPackage().callsPrismaInThisStep).toBe(false);
  });

  it("ready state keeps modifiesSchemaInThisStep false", () => {
    expect(evaluateReadyReviewPackage().modifiesSchemaInThisStep).toBe(false);
  });

  it("ready state keeps createsMigrationInThisStep false", () => {
    expect(evaluateReadyReviewPackage().createsMigrationInThisStep).toBe(false);
  });

  it("noRunChecklistCount matches noRunChecklist length", () => {
    const report = evaluateReadyReviewPackage();
    expect(report.noRunChecklistCount).toBe(report.noRunChecklist.length);
  });

  it("noRunChecklistSatisfiedCount equals noRunChecklistCount", () => {
    const report = evaluateReadyReviewPackage();
    expect(report.noRunChecklistSatisfiedCount).toBe(report.noRunChecklistCount);
  });

  it("sourceExecutionPathCandidateCount is at least 3", () => {
    expect(evaluateReadyReviewPackage().sourceExecutionPathCandidateCount).toBeGreaterThanOrEqual(3);
  });

  it("sourceExecutionPathCandidateSatisfiedCount equals sourceExecutionPathCandidateCount", () => {
    const report = evaluateReadyReviewPackage();
    expect(report.sourceExecutionPathCandidateSatisfiedCount).toBe(report.sourceExecutionPathCandidateCount);
  });

  it("sourceFindingCodes includes controlled_execution_path_candidate_read_only", () => {
    expect(evaluateReadyReviewPackage().sourceFindingCodes).toContain(
      "controlled_execution_path_candidate_read_only",
    );
  });

  it("reviewPackageVersion is stage_4_e_v1", () => {
    expect(evaluateReadyReviewPackage().reviewPackageVersion).toBe("stage_4_e_v1");
  });

  it("reviewFingerprint is deterministic for identical input", () => {
    const input = fingerprintInputFromFlags(ALL_PACKAGE_REVIEWS);
    expect(buildRuntimeWireExperimentReviewFingerprint(input)).toBe(
      buildRuntimeWireExperimentReviewFingerprint(input),
    );
  });

  it("reviewFingerprint changes when confirmation flags change", () => {
    const base = fingerprintInputFromFlags(ALL_PACKAGE_REVIEWS);
    const changed = fingerprintInputFromFlags({ ...ALL_PACKAGE_REVIEWS, runtimeWireReviewConfirmed: false });
    expect(buildRuntimeWireExperimentReviewFingerprint(base)).not.toBe(
      buildRuntimeWireExperimentReviewFingerprint(changed),
    );
  });

  it("ready includes runtime_wire_experiment_review_package_ready finding", () => {
    expect(
      evaluateReadyReviewPackage().findings.some((f) => f.code === "runtime_wire_experiment_review_package_ready"),
    ).toBe(true);
  });

  it("ready includes ready_for_stage4_closure_verdict_not_runtime_permission finding", () => {
    expect(
      evaluateReadyReviewPackage().findings.some(
        (f) => f.code === "ready_for_stage4_closure_verdict_not_runtime_permission",
      ),
    ).toBe(true);
  });

  it("defer includes runtime_wire_experiment_review_package_deferred finding", () => {
    spyControlledCandidateReady({ decision: "defer" });
    expect(
      evaluateRuntimeWireExperimentReviewPackage(ALL_PACKAGE_REVIEWS).findings.some(
        (f) => f.code === "runtime_wire_experiment_review_package_deferred",
      ),
    ).toBe(true);
  });

  it("blocked includes runtime_wire_experiment_review_package_blocked finding", () => {
    spyControlledCandidateReady({ decision: "blocked" });
    expect(
      evaluateRuntimeWireExperimentReviewPackage(ALL_PACKAGE_REVIEWS).findings.some(
        (f) => f.code === "runtime_wire_experiment_review_package_blocked",
      ),
    ).toBe(true);
  });

  it("all checklist items include non-empty reason", () => {
    const report = evaluateReadyReviewPackage();
    const allItems = [
      ...report.experimentReadinessChecklist,
      ...report.connectorGatewayChecklist,
      ...report.executionPathChecklist,
      ...report.featureFlagChecklist,
      ...report.rollbackChecklist,
      ...report.noRunChecklist,
    ];
    expect(allItems.every((item) => item.reason.length > 0)).toBe(true);
  });
});
