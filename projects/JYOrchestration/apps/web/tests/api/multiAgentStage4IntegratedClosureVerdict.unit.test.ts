import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildStage4IntegratedClosureFingerprint,
  evaluateStage4IntegratedClosureVerdict,
  resolveStage4IntegratedClosureVerdictDecision,
} from "@/lib/agents/evaluateStage4IntegratedClosureVerdict";
import * as reviewPackageModule from "@/lib/agents/evaluateRuntimeWireExperimentReviewPackage";
import type { RuntimeWireExperimentReviewPackageReport } from "@/lib/agents/runtimeWireExperimentReviewPackageTypes";

function mockReviewPackageReady(
  overrides: Partial<RuntimeWireExperimentReviewPackageReport> = {},
): RuntimeWireExperimentReviewPackageReport {
  const noRunChecklist = [
    { item: "executesRuntimeInThisStep=false", satisfied: true, reason: "ok" },
    { item: "changesConnectorRoutingInThisStep=false", satisfied: true, reason: "ok" },
  ];

  return {
    mode: "read_only_runtime_wire_experiment_review_package",
    stage: "stage_4_e",
    decision: "ready_for_stage4_closure_verdict",
    sourceControlledExecutionPathDecision: "ready_for_execution_path_review",
    sourceExecutionPathCandidateCount: 3,
    sourceExecutionPathCandidateSatisfiedCount: 3,
    sourceNoRunChecklistCount: 2,
    sourceNoRunChecklistSatisfiedCount: 2,
    sourceFindingCodes: [
      "runtime_wire_experiment_review_package_read_only",
      "controlled_execution_path_candidate_read_only",
    ],
    reviewPackageVersion: "stage_4_e_v1",
    reviewPackageTitle: "Runtime Wire Experiment Review Package (Read-Only)",
    reviewPackageSummary: "ready for closure",
    reviewFingerprint: "runtime-wire-review-v1:ready",
    runtimeWireReviewConfirmed: true,
    connectorGatewayReviewConfirmed: true,
    executionPathReviewConfirmedForPackage: true,
    featureFlagReviewConfirmedForPackage: true,
    rollbackReviewConfirmedForPackage: true,
    operatorFinalReviewConfirmed: true,
    experimentReadinessChecklist: [],
    connectorGatewayChecklist: [],
    executionPathChecklist: [],
    featureFlagChecklist: [],
    rollbackChecklist: [],
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
      { severity: "info", code: "runtime_wire_experiment_review_package_read_only", message: "read-only" },
      { severity: "info", code: "runtime_wire_review_package_created", message: "created" },
      { severity: "info", code: "runtime_wire_experiment_review_package_ready", message: "ready" },
    ],
    ...overrides,
  };
}

function spyReviewPackageReady(overrides: Partial<RuntimeWireExperimentReviewPackageReport> = {}) {
  return vi
    .spyOn(reviewPackageModule, "evaluateRuntimeWireExperimentReviewPackage")
    .mockReturnValue(mockReviewPackageReady(overrides));
}

const ALL_PACKAGE_REVIEWS = {
  runtimeWireReviewConfirmed: true,
  connectorGatewayReviewConfirmed: true,
  executionPathReviewConfirmedForPackage: true,
  featureFlagReviewConfirmedForPackage: true,
  rollbackReviewConfirmedForPackage: true,
  operatorFinalReviewConfirmed: true,
} as const;

const ALL_CLOSURE_CONFIRMATIONS = {
  ...ALL_PACKAGE_REVIEWS,
  stage4ReadOnlyScopeConfirmed: true,
  stage4NoRuntimeExecutionConfirmed: true,
  stage4NoRoutingChangeConfirmed: true,
  stage4NoDbSchemaChangeConfirmed: true,
  stage4HandoffPlanConfirmed: true,
} as const;

function evaluateReadyClosureVerdict() {
  spyReviewPackageReady();
  return evaluateStage4IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS);
}

function closureFingerprintInput(flags: typeof ALL_CLOSURE_CONFIRMATIONS) {
  return {
    sourceReviewPackageDecision: "ready_for_stage4_closure_verdict" as const,
    sourceReviewPackageFingerprint: "fp-ready",
    sourceNoRunChecklistCount: 2,
    sourceNoRunChecklistSatisfiedCount: 2,
    stage4ReadOnlyScopeConfirmed: flags.stage4ReadOnlyScopeConfirmed,
    stage4NoRuntimeExecutionConfirmed: flags.stage4NoRuntimeExecutionConfirmed,
    stage4NoRoutingChangeConfirmed: flags.stage4NoRoutingChangeConfirmed,
    stage4NoDbSchemaChangeConfirmed: flags.stage4NoDbSchemaChangeConfirmed,
    stage4HandoffPlanConfirmed: flags.stage4HandoffPlanConfirmed,
  };
}

describe("multi-agent stage 4 integrated closure verdict stage 4-F", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("resolveStage4IntegratedClosureVerdictDecision", () => {
    it("returns blocked when source review package is blocked", () => {
      expect(
        resolveStage4IntegratedClosureVerdictDecision({
          sourceReviewPackageDecision: "blocked",
          sourceNoRunChecklistCount: 2,
          sourceNoRunChecklistSatisfiedCount: 2,
          stage4ReadOnlyScopeConfirmed: true,
          stage4NoRuntimeExecutionConfirmed: true,
          stage4NoRoutingChangeConfirmed: true,
          stage4NoDbSchemaChangeConfirmed: true,
          stage4HandoffPlanConfirmed: true,
        }),
      ).toBe("blocked");
    });

    it("returns blocked when source no-run checklist counts mismatch", () => {
      expect(
        resolveStage4IntegratedClosureVerdictDecision({
          sourceReviewPackageDecision: "ready_for_stage4_closure_verdict",
          sourceNoRunChecklistCount: 2,
          sourceNoRunChecklistSatisfiedCount: 1,
          ...ALL_CLOSURE_CONFIRMATIONS,
        }),
      ).toBe("blocked");
    });

    it("returns stage4_closure_ready when source ready and all confirmations satisfied", () => {
      expect(
        resolveStage4IntegratedClosureVerdictDecision({
          sourceReviewPackageDecision: "ready_for_stage4_closure_verdict",
          sourceNoRunChecklistCount: 2,
          sourceNoRunChecklistSatisfiedCount: 2,
          ...ALL_CLOSURE_CONFIRMATIONS,
        }),
      ).toBe("stage4_closure_ready");
    });
  });

  it("mode is read_only_stage4_integrated_closure_verdict", () => {
    expect(evaluateStage4IntegratedClosureVerdict().mode).toBe("read_only_stage4_integrated_closure_verdict");
  });

  it("stage is stage_4_f", () => {
    expect(evaluateStage4IntegratedClosureVerdict().stage).toBe("stage_4_f");
  });

  it("default decision is defer", () => {
    expect(evaluateStage4IntegratedClosureVerdict().decision).toBe("defer");
  });

  describe("blocked cases", () => {
    it("source review package blocked yields blocked", () => {
      spyReviewPackageReady({ decision: "blocked" });
      expect(evaluateStage4IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS).decision).toBe("blocked");
    });

    it("source no-run checklist mismatch yields blocked", () => {
      spyReviewPackageReady({ noRunChecklistCount: 2, noRunChecklistSatisfiedCount: 1 });
      expect(evaluateStage4IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS).decision).toBe("blocked");
    });

    it("blocked includes stage4_integrated_closure_blocked finding", () => {
      spyReviewPackageReady({ decision: "blocked" });
      expect(
        evaluateStage4IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS).findings.some(
          (f) => f.code === "stage4_integrated_closure_blocked",
        ),
      ).toBe(true);
    });
  });

  describe("defer cases", () => {
    it("source review package defer yields defer", () => {
      spyReviewPackageReady({ decision: "defer" });
      expect(evaluateStage4IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS).decision).toBe("defer");
    });

    it("source ready but stage4ReadOnlyScopeConfirmed=false yields defer", () => {
      spyReviewPackageReady();
      expect(
        evaluateStage4IntegratedClosureVerdict({ ...ALL_CLOSURE_CONFIRMATIONS, stage4ReadOnlyScopeConfirmed: false })
          .decision,
      ).toBe("defer");
    });

    it("missing stage4NoRuntimeExecutionConfirmed yields defer and finding", () => {
      spyReviewPackageReady();
      const report = evaluateStage4IntegratedClosureVerdict({
        ...ALL_CLOSURE_CONFIRMATIONS,
        stage4NoRuntimeExecutionConfirmed: false,
      });
      expect(report.decision).toBe("defer");
      expect(report.findings.some((f) => f.code === "stage4_no_runtime_execution_confirmation_missing")).toBe(true);
    });

    it("missing stage4NoRoutingChangeConfirmed yields defer and finding", () => {
      spyReviewPackageReady();
      const report = evaluateStage4IntegratedClosureVerdict({
        ...ALL_CLOSURE_CONFIRMATIONS,
        stage4NoRoutingChangeConfirmed: false,
      });
      expect(report.decision).toBe("defer");
      expect(report.findings.some((f) => f.code === "stage4_no_routing_change_confirmation_missing")).toBe(true);
    });

    it("missing stage4NoDbSchemaChangeConfirmed yields defer and finding", () => {
      spyReviewPackageReady();
      const report = evaluateStage4IntegratedClosureVerdict({
        ...ALL_CLOSURE_CONFIRMATIONS,
        stage4NoDbSchemaChangeConfirmed: false,
      });
      expect(report.decision).toBe("defer");
      expect(report.findings.some((f) => f.code === "stage4_no_db_schema_change_confirmation_missing")).toBe(true);
    });

    it("missing stage4HandoffPlanConfirmed yields defer and finding", () => {
      spyReviewPackageReady();
      const report = evaluateStage4IntegratedClosureVerdict({
        ...ALL_CLOSURE_CONFIRMATIONS,
        stage4HandoffPlanConfirmed: false,
      });
      expect(report.decision).toBe("defer");
      expect(report.findings.some((f) => f.code === "stage4_handoff_plan_confirmation_missing")).toBe(true);
    });

    it("defer includes stage4_integrated_closure_deferred finding", () => {
      spyReviewPackageReady({ decision: "defer" });
      expect(
        evaluateStage4IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS).findings.some(
          (f) => f.code === "stage4_integrated_closure_deferred",
        ),
      ).toBe(true);
    });
  });

  describe("ready case", () => {
    it("all confirmations satisfied yields stage4_closure_ready", () => {
      expect(evaluateReadyClosureVerdict().decision).toBe("stage4_closure_ready");
    });

    it("ready includes stage4_integrated_closure_ready finding", () => {
      expect(
        evaluateReadyClosureVerdict().findings.some((f) => f.code === "stage4_integrated_closure_ready"),
      ).toBe(true);
    });

    it("ready includes stage4_closure_ready_not_runtime_permission finding", () => {
      const finding = evaluateReadyClosureVerdict().findings.find(
        (f) => f.code === "stage4_closure_ready_not_runtime_permission",
      );
      expect(finding).toBeDefined();
      expect(finding?.message).toContain("not runtime execution permission");
    });
  });

  describe("no-run invariants", () => {
    it("keeps all no-run flags false when ready", () => {
      const report = evaluateReadyClosureVerdict();
      expect(report.executesRuntimeInThisStep).toBe(false);
      expect(report.changesExecutionPathInThisStep).toBe(false);
      expect(report.changesConnectorRoutingInThisStep).toBe(false);
      expect(report.callsConnectorInThisStep).toBe(false);
      expect(report.callsCursorInThisStep).toBe(false);
      expect(report.callsGitHubInThisStep).toBe(false);
      expect(report.createsPullRequestInThisStep).toBe(false);
      expect(report.executesGitInThisStep).toBe(false);
      expect(report.createsBranchInThisStep).toBe(false);
      expect(report.wiresWritePathInThisStep).toBe(false);
      expect(report.wiresFeatureFlagInThisStep).toBe(false);
      expect(report.writesDataInThisStep).toBe(false);
      expect(report.callsPrismaInThisStep).toBe(false);
      expect(report.modifiesSchemaInThisStep).toBe(false);
      expect(report.createsMigrationInThisStep).toBe(false);
    });
  });

  describe("checklist count fingerprint and handoff", () => {
    it("noRunChecklistCount matches noRunChecklist length", () => {
      const report = evaluateReadyClosureVerdict();
      expect(report.noRunChecklistCount).toBe(report.noRunChecklist.length);
    });

    it("noRunChecklistSatisfiedCount equals noRunChecklistCount", () => {
      const report = evaluateReadyClosureVerdict();
      expect(report.noRunChecklistSatisfiedCount).toBe(report.noRunChecklistCount);
    });

    it("closureFingerprint is deterministic for identical input", () => {
      const input = closureFingerprintInput(ALL_CLOSURE_CONFIRMATIONS);
      expect(buildStage4IntegratedClosureFingerprint(input)).toBe(buildStage4IntegratedClosureFingerprint(input));
    });

    it("closureFingerprint changes when confirmation flags change", () => {
      const base = closureFingerprintInput(ALL_CLOSURE_CONFIRMATIONS);
      const changed = closureFingerprintInput({ ...ALL_CLOSURE_CONFIRMATIONS, stage4HandoffPlanConfirmed: false });
      expect(buildStage4IntegratedClosureFingerprint(base)).not.toBe(buildStage4IntegratedClosureFingerprint(changed));
    });

    it("recommendedNextActions is non-empty", () => {
      expect(evaluateReadyClosureVerdict().recommendedNextActions.length).toBeGreaterThan(0);
    });

    it("separatedWorkItems includes actual git branch creation", () => {
      expect(evaluateReadyClosureVerdict().separatedWorkItems).toContain("actual_git_branch_creation");
    });

    it("separatedWorkItems includes actual connector gateway routing change", () => {
      expect(evaluateReadyClosureVerdict().separatedWorkItems).toContain("actual_connector_gateway_routing_change");
    });

    it("all checklist items include non-empty reason", () => {
      const report = evaluateReadyClosureVerdict();
      const allItems = [
        ...report.closureChecklist,
        ...report.noRunChecklist,
        ...report.handoffChecklist,
        ...report.riskChecklist,
      ];
      expect(allItems.every((item) => item.reason.length > 0)).toBe(true);
    });

    it("handoffChecklist includes prepare_feature_flag_wire_followup", () => {
      expect(
        evaluateReadyClosureVerdict().handoffChecklist.some((item) => item.item === "prepare_feature_flag_wire_followup"),
      ).toBe(true);
    });
  });
});
