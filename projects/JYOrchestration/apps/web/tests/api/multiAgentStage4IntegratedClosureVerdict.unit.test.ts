import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildStage4IntegratedClosureFingerprint,
  evaluateStage4IntegratedClosureVerdict,
  resolveStage4IntegratedClosureVerdictDecision,
} from "@/lib/agents/evaluateStage4IntegratedClosureVerdict";
import {
  MULTI_AGENT_ORCHESTRATION_MVP_BASELINE,
  resolveStage2Through4ClosureLocked,
  STAGE2_THROUGH4_CLOSED_STAGES,
  STAGE2_THROUGH4_CLOSURE_SCOPE,
} from "@/lib/agents/multiAgentOrchestrationMvpBaseline";
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
      const report = evaluateStage4IntegratedClosureVerdict({
        ...ALL_CLOSURE_CONFIRMATIONS,
        stage4ReadOnlyScopeConfirmed: false,
      });
      expect(report.decision).toBe("defer");
      expect(report.findings.some((f) => f.code === "stage4_read_only_scope_confirmation_missing")).toBe(true);
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
    it("closureVersion is stage_4_f_v1", () => {
      expect(evaluateReadyClosureVerdict().closureVersion).toBe("stage_4_f_v1");
    });

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

    it("closureIsRuntimeExecutionPermission is always false", () => {
      spyReviewPackageReady({ decision: "defer" });
      const deferReport = evaluateStage4IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS);
      expect(deferReport.closureIsRuntimeExecutionPermission).toBe(false);
      expect(evaluateReadyClosureVerdict().closureIsRuntimeExecutionPermission).toBe(false);
    });

    it("stage4_closure_ready returns stage5Candidate = role_knowledge_binding_foundation", () => {
      expect(evaluateReadyClosureVerdict().stage5Candidate).toBe("role_knowledge_binding_foundation");
    });

    it("ready state keeps requiresSeparateSchemaPr true", () => {
      expect(evaluateReadyClosureVerdict().requiresSeparateSchemaPr).toBe(true);
    });

    it("ready state keeps requiresSeparateConnectorExperimentBranch true", () => {
      expect(evaluateReadyClosureVerdict().requiresSeparateConnectorExperimentBranch).toBe(true);
    });

    it("ready state keeps requiresSeparateRuntimeWritePathWire true", () => {
      expect(evaluateReadyClosureVerdict().requiresSeparateRuntimeWritePathWire).toBe(true);
    });

    it("ready findings include stage4_closure_not_runtime_permission", () => {
      expect(
        evaluateReadyClosureVerdict().findings.some((f) => f.code === "stage4_closure_not_runtime_permission"),
      ).toBe(true);
    });

    it("ready findings include stage4_role_knowledge_binding_recommended", () => {
      expect(
        evaluateReadyClosureVerdict().findings.some((f) => f.code === "stage4_role_knowledge_binding_recommended"),
      ).toBe(true);
    });

    it("ready report defines stage5EntryCandidates for Stage 5 entry planning", () => {
      const report = evaluateReadyClosureVerdict();
      expect(report.stage5EntryCandidates).toEqual([
        "role_knowledge_binding_foundation",
        "runtime_execution_design",
        "continue_read_only_hardening",
      ]);
    });

    it("ready findings include stage4_stage2_through_stage4_closure_complete", () => {
      expect(
        evaluateReadyClosureVerdict().findings.some(
          (f) => f.code === "stage4_stage2_through_stage4_closure_complete",
        ),
      ).toBe(true);
    });

    it("ready findings include stage4_stage5_entry_candidates_defined", () => {
      expect(
        evaluateReadyClosureVerdict().findings.some((f) => f.code === "stage4_stage5_entry_candidates_defined"),
      ).toBe(true);
    });
  });

  describe("closure and MVP baseline hardening", () => {
    it("stage2Through4ClosureLocked is true when Stage 4-F is ready", () => {
      expect(evaluateReadyClosureVerdict().stage2Through4ClosureLocked).toBe(true);
    });

    it("stage2Through4ClosureScope equals read_only_multi_agent_runtime_foundation", () => {
      expect(evaluateReadyClosureVerdict().stage2Through4ClosureScope).toBe(STAGE2_THROUGH4_CLOSURE_SCOPE);
    });

    it("stage2Through4ClosedStages includes Stage 2, Stage 3, Stage 4 identifiers", () => {
      expect(evaluateReadyClosureVerdict().stage2Through4ClosedStages).toEqual([...STAGE2_THROUGH4_CLOSED_STAGES]);
      expect(evaluateReadyClosureVerdict().stage2Through4ClosedStages).toContain(
        "stage_2_read_only_runtime_governance",
      );
      expect(evaluateReadyClosureVerdict().stage2Through4ClosedStages).toContain(
        "stage_3_runtime_execution_handoff_and_approval_design",
      );
      expect(evaluateReadyClosureVerdict().stage2Through4ClosedStages).toContain(
        "stage_4_controlled_runtime_wire_and_closure_review",
      );
    });

    it("mvpBaselinePreserved is true", () => {
      expect(evaluateReadyClosureVerdict().mvpBaselinePreserved).toBe(true);
    });

    it("mvpBaselineSummary contains role-based agents", () => {
      expect(evaluateReadyClosureVerdict().mvpBaselineSummary).toContain("role-based agents");
    });

    it("mvpBaselineSummary contains no actual runtime/schema/git/write-path execution", () => {
      expect(evaluateReadyClosureVerdict().mvpBaselineSummary).toContain(
        "no actual runtime/schema/git/write-path execution",
      );
    });

    it("actualRuntimeChangeAllowedAfterStage4 is false", () => {
      expect(evaluateReadyClosureVerdict().actualRuntimeChangeAllowedAfterStage4).toBe(false);
    });

    it("actualConnectorRoutingChangeAllowedAfterStage4 is false", () => {
      expect(evaluateReadyClosureVerdict().actualConnectorRoutingChangeAllowedAfterStage4).toBe(false);
    });

    it("actualWritePathWireAllowedAfterStage4 is false", () => {
      expect(evaluateReadyClosureVerdict().actualWritePathWireAllowedAfterStage4).toBe(false);
    });

    it("actualSchemaMigrationAllowedAfterStage4 is false", () => {
      expect(evaluateReadyClosureVerdict().actualSchemaMigrationAllowedAfterStage4).toBe(false);
    });

    it("stage5EntryIsCandidateOnly is true", () => {
      expect(evaluateReadyClosureVerdict().stage5EntryIsCandidateOnly).toBe(true);
    });

    it("ready findings include stage2_through_stage4_closure_locked", () => {
      expect(
        evaluateReadyClosureVerdict().findings.some((f) => f.code === "stage2_through_stage4_closure_locked"),
      ).toBe(true);
    });

    it("ready findings include mvp_baseline_preserved", () => {
      expect(evaluateReadyClosureVerdict().findings.some((f) => f.code === "mvp_baseline_preserved")).toBe(true);
    });

    it("ready findings include stage5_entry_candidate_only", () => {
      expect(
        evaluateReadyClosureVerdict().findings.some((f) => f.code === "stage5_entry_candidate_only"),
      ).toBe(true);
    });

    it("no-run violation prevents closure locked", () => {
      spyReviewPackageReady({
        decision: "ready_for_stage4_closure_verdict",
        noRunChecklistCount: 2,
        noRunChecklistSatisfiedCount: 0,
      });
      const report = evaluateStage4IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS);
      expect(report.decision).toBe("blocked");
      expect(report.stage2Through4ClosureLocked).toBe(false);
      expect(
        resolveStage2Through4ClosureLocked({
          decision: report.decision,
          sourceReviewPackageDecision: report.sourceReviewPackageDecision,
          sourceNoRunChecklistCount: report.sourceNoRunChecklistCount,
          sourceNoRunChecklistSatisfiedCount: report.sourceNoRunChecklistSatisfiedCount,
          closureNoRunViolated: false,
        }),
      ).toBe(false);
    });

    it("MVP baseline disallowed capabilities align with Stage 4-F separated work", () => {
      expect(MULTI_AGENT_ORCHESTRATION_MVP_BASELINE.disallowedInBaseline).toContain("actual_runtime_execution");
      expect(MULTI_AGENT_ORCHESTRATION_MVP_BASELINE.disallowedInBaseline).toContain("actual_schema_migration");
    });
  });

  describe("Stage 5-A closure package regression guard", () => {
    it("stage2Through4ClosureLocked remains available after Stage 5-A closure work", () => {
      expect(evaluateReadyClosureVerdict().stage2Through4ClosureLocked).toBe(true);
    });

    it("mvpBaselinePreserved remains true after Stage 5-A closure work", () => {
      expect(evaluateReadyClosureVerdict().mvpBaselinePreserved).toBe(true);
    });

    it("stage5EntryCandidates still includes role_knowledge_binding_foundation", () => {
      expect(evaluateReadyClosureVerdict().stage5EntryCandidates).toContain(
        "role_knowledge_binding_foundation",
      );
    });

    it("closure posture fields unchanged after Stage 5-A closure package addition", () => {
      const report = evaluateReadyClosureVerdict();
      expect(report.stage5EntryIsCandidateOnly).toBe(true);
      expect(report.actualSchemaMigrationAllowedAfterStage4).toBe(false);
    });
  });

  describe("Stage 5-A input hygiene regression guard", () => {
    it("stage5EntryCandidates still includes role_knowledge_binding_foundation", () => {
      expect(evaluateReadyClosureVerdict().stage5EntryCandidates).toContain("role_knowledge_binding_foundation");
    });

    it("stage5EntryIsCandidateOnly remains true", () => {
      expect(evaluateReadyClosureVerdict().stage5EntryIsCandidateOnly).toBe(true);
    });

    it("actualRuntimeChangeAllowedAfterStage4 remains false", () => {
      expect(evaluateReadyClosureVerdict().actualRuntimeChangeAllowedAfterStage4).toBe(false);
    });

    it("actualSchemaMigrationAllowedAfterStage4 remains false", () => {
      expect(evaluateReadyClosureVerdict().actualSchemaMigrationAllowedAfterStage4).toBe(false);
    });

    it("mvpBaselineSummary still contains no actual runtime/schema/git/write-path execution", () => {
      expect(evaluateReadyClosureVerdict().mvpBaselineSummary).toContain(
        "no actual runtime/schema/git/write-path execution",
      );
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
