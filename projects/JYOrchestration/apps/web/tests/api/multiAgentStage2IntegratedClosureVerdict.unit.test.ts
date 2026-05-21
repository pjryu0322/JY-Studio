import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateStage2IntegratedClosureVerdict } from "@/lib/agents/evaluateStage2IntegratedClosureVerdict";
import * as runtimeFinalApprovalModule from "@/lib/agents/evaluateRuntimeChangeFinalApprovalPackage";

const CURSOR_BOUNDARY = ["cursor.execution.before"] as const;

function checklistItem(
  report: ReturnType<typeof evaluateStage2IntegratedClosureVerdict>,
  list: "closureChecklist" | "noRunChecklist" | "handoffChecklist" | "riskChecklist",
  item: string,
) {
  return report[list].find((c) => c.item === item);
}

function mockRuntimeFinalApprovalReady(): ReturnType<
  typeof runtimeFinalApprovalModule.evaluateRuntimeChangeFinalApprovalPackage
> {
  return {
    mode: "read_only_runtime_change_final_approval_package",
    decision: "ready_for_final_runtime_change_approval",
    requestedRoutingTarget: "cursor_only",
    requestedRoutingBoundaryIds: [...CURSOR_BOUNDARY],
    requestedRoutingConnectorIds: [],
    sourceRoutingShadowDecision: "shadow_ready",
    sourceRoutingShadowRouteMode: "shadow_compare",
    sourceRoutingShadowTarget: "cursor_only",
    sourceRoutingShadowActualRuntimePath: "/api/requirements",
    sourceRoutingShadowShadowRuntimePath: "/api/requirements/shadow",
    sourceRoutingShadowObservesOnly: true,
    sourceRoutingShadowChangesRuntimeRouteInThisStep: false,
    sourceRoutingShadowCallsConnectorInThisStep: false,
    sourceRoutingShadowInvokesCursorInThisStep: false,
    sourceRoutingShadowInvokesGithubInThisStep: false,
    sourceRoutingShadowWiresFeatureFlagInThisStep: false,
    sourceRoutingShadowWritesDataInThisStep: false,
    sourceRoutingShadowBoundaryIds: [...CURSOR_BOUNDARY],
    sourceRoutingShadowConnectorIds: ["cursor"],
    sourceRoutingShadowBoundarySource: "explicit",
    sourceRoutingShadowConnectorSource: "explicit",
    sourceRoutingShadowRequiresStage1Regression: false,
    sourceRoutingShadowRequiresRollbackPlan: false,
    sourceRoutingShadowBlockingFindingCodes: [],
    sourceWireCandidateDecision: "ready_for_wire_candidate_verification",
    sourceWireCandidateAgentWireGateDecision: "ready_for_write_path_wire_approval",
    sourceWireCandidateOperatorWireGateDecision: "ready_for_write_path_wire_approval",
    sourceWireCandidateSchemaMigrationDecision: "ready_for_schema_migration_pr_readiness",
    sourceWireCandidateBlockingFindingCodes: [],
    sourceWireCandidateRequestedAgentTarget: "agent_execution_record",
    sourceWireCandidateRequestedOperatorTarget: "operator_approval",
    sourceWireCandidateNormalizedAgentTarget: "agent_execution_record",
    sourceWireCandidateNormalizedOperatorTarget: "operator_approval",
    sourceWireCandidateSchemaMigrationReviewConfirmed: true,
    sourceWireCandidateSchemaAppliedInRuntime: false,
    sourceWireCandidateMigrationAppliedInRuntime: false,
    sourceWireCandidateVerifiesCandidateOnly: true,
    sourceWireCandidateWiresWritePathInThisStep: false,
    sourceWireCandidateWiresAdapterInThisStep: false,
    sourceWireCandidateWritesDataInThisStep: false,
    sourceWireCandidateCallsPrismaInThisStep: false,
    sourceWireCandidateModifiesSchemaInThisStep: false,
    sourceWireCandidateCreatesMigrationInThisStep: false,
    sourceWireCandidateWiresFeatureFlagInThisStep: false,
    sourceWireCandidateChangesRuntimeRouteInThisStep: false,
    finalRuntimeApprovalConfirmed: true,
    routingShadowReviewConfirmed: true,
    wireCandidateReviewConfirmed: true,
    stage1RegressionReviewConfirmed: true,
    rollbackPlanReviewConfirmed: true,
    operatorAuditReviewConfirmed: true,
    finalApprovalChecklist: [],
    runtimeSafetyChecklist: [],
    rollbackChecklist: [],
    operatorChecklist: [],
    packagesApprovalOnly: true,
    changesRuntimeInThisStep: false,
    changesConnectorRoutingInThisStep: false,
    wiresWritePathInThisStep: false,
    wiresAdapterInThisStep: false,
    wiresFeatureFlagInThisStep: false,
    writesDataInThisStep: false,
    callsPrismaInThisStep: false,
    modifiesSchemaInThisStep: false,
    createsMigrationInThisStep: false,
    executesGitInThisStep: false,
    callsCursorInThisStep: false,
    callsGitHubInThisStep: false,
    findings: [],
  };
}

const ALL_CLOSURE_CONFIRMATIONS = {
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
} as const;

describe("multi-agent stage 2 integrated closure verdict stage 2-F", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mode is read_only_stage2_integrated_closure_verdict", () => {
    expect(evaluateStage2IntegratedClosureVerdict().mode).toBe(
      "read_only_stage2_integrated_closure_verdict",
    );
  });

  it("default decision is defer", () => {
    expect(evaluateStage2IntegratedClosureVerdict().decision).toBe("defer");
  });

  it("closesStage2Only is true", () => {
    expect(evaluateStage2IntegratedClosureVerdict().closesStage2Only).toBe(true);
  });

  it("executesRuntimeChangeInThisStep is false", () => {
    expect(evaluateStage2IntegratedClosureVerdict().executesRuntimeChangeInThisStep).toBe(false);
  });

  it("changesConnectorRoutingInThisStep is false", () => {
    expect(evaluateStage2IntegratedClosureVerdict().changesConnectorRoutingInThisStep).toBe(false);
  });

  it("wiresWritePathInThisStep is false", () => {
    expect(evaluateStage2IntegratedClosureVerdict().wiresWritePathInThisStep).toBe(false);
  });

  it("wiresAdapterInThisStep is false", () => {
    expect(evaluateStage2IntegratedClosureVerdict().wiresAdapterInThisStep).toBe(false);
  });

  it("wiresFeatureFlagInThisStep is false", () => {
    expect(evaluateStage2IntegratedClosureVerdict().wiresFeatureFlagInThisStep).toBe(false);
  });

  it("writesDataInThisStep is false", () => {
    expect(evaluateStage2IntegratedClosureVerdict().writesDataInThisStep).toBe(false);
  });

  it("callsPrismaInThisStep is false", () => {
    expect(evaluateStage2IntegratedClosureVerdict().callsPrismaInThisStep).toBe(false);
  });

  it("modifiesSchemaInThisStep is false", () => {
    expect(evaluateStage2IntegratedClosureVerdict().modifiesSchemaInThisStep).toBe(false);
  });

  it("createsMigrationInThisStep is false", () => {
    expect(evaluateStage2IntegratedClosureVerdict().createsMigrationInThisStep).toBe(false);
  });

  it("createsPullRequestInThisStep is false", () => {
    expect(evaluateStage2IntegratedClosureVerdict().createsPullRequestInThisStep).toBe(false);
  });

  it("executesGitInThisStep is false", () => {
    expect(evaluateStage2IntegratedClosureVerdict().executesGitInThisStep).toBe(false);
  });

  it("callsCursorInThisStep is false", () => {
    expect(evaluateStage2IntegratedClosureVerdict().callsCursorInThisStep).toBe(false);
  });

  it("callsGitHubInThisStep is false", () => {
    expect(evaluateStage2IntegratedClosureVerdict().callsGitHubInThisStep).toBe(false);
  });

  it("runtime final approval blocked returns blocked", () => {
    vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue({
      ...mockRuntimeFinalApprovalReady(),
      decision: "blocked",
    });

    expect(evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS).decision).toBe("blocked");
  });

  it("runtime final approval defer returns defer", () => {
    vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue({
      ...mockRuntimeFinalApprovalReady(),
      decision: "defer",
    });

    expect(evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS).decision).toBe("defer");
  });

  it("routing shadow blocked source returns blocked", () => {
    vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue({
      ...mockRuntimeFinalApprovalReady(),
      sourceRoutingShadowDecision: "blocked",
      decision: "blocked",
    });

    expect(evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS).decision).toBe("blocked");
  });

  it("wire candidate blocked source returns blocked", () => {
    vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue({
      ...mockRuntimeFinalApprovalReady(),
      sourceWireCandidateDecision: "blocked",
      decision: "blocked",
    });

    expect(evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS).decision).toBe("blocked");
  });

  it("no-run policy violation returns blocked", () => {
    vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue({
      ...mockRuntimeFinalApprovalReady(),
      changesRuntimeInThisStep: true,
    } as ReturnType<typeof runtimeFinalApprovalModule.evaluateRuntimeChangeFinalApprovalPackage>);

    const report = evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS);
    expect(report.decision).toBe("blocked");
    expect(report.findings.some((f) => f.code === "stage2_no_run_policy_violated")).toBe(true);
  });

  it("all conditions satisfied returns stage2_closure_ready", () => {
    vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue(
      mockRuntimeFinalApprovalReady(),
    );

    const report = evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS);
    expect(report.decision).toBe("stage2_closure_ready");
    expect(report.findings.some((f) => f.code === "stage2_closure_ready")).toBe(true);
  });

  it("closureChecklist includes runtime final approval package ready", () => {
    expect(
      checklistItem(
        evaluateStage2IntegratedClosureVerdict(),
        "closureChecklist",
        "runtime final approval package ready",
      ),
    ).toBeDefined();
  });

  it("noRunChecklist includes no runtime change", () => {
    expect(
      checklistItem(evaluateStage2IntegratedClosureVerdict(), "noRunChecklist", "no runtime change")
        ?.satisfied,
    ).toBe(true);
  });

  it("noRunChecklist includes no GitHub call", () => {
    expect(
      checklistItem(evaluateStage2IntegratedClosureVerdict(), "noRunChecklist", "no GitHub call")?.satisfied,
    ).toBe(true);
  });

  it("handoffChecklist includes schema/migration PR must be separate", () => {
    expect(
      checklistItem(
        evaluateStage2IntegratedClosureVerdict(),
        "handoffChecklist",
        "schema/migration PR must be separate",
      ),
    ).toBeDefined();
  });

  it("riskChecklist includes connector gateway routing risk acknowledged", () => {
    expect(
      checklistItem(
        evaluateStage2IntegratedClosureVerdict(),
        "riskChecklist",
        "connector gateway routing risk acknowledged",
      ),
    ).toBeDefined();
  });

  it("defer state does not include stage2_closure_ready finding", () => {
    expect(
      evaluateStage2IntegratedClosureVerdict().findings.some((f) => f.code === "stage2_closure_ready"),
    ).toBe(false);
  });

  it("blocked state includes stage2_closure_blocked finding", () => {
    vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue({
      ...mockRuntimeFinalApprovalReady(),
      decision: "blocked",
    });

    const report = evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS);
    expect(report.decision).toBe("blocked");
    expect(report.findings.some((f) => f.code === "stage2_closure_blocked")).toBe(true);
  });

  it("recommendedNextPhases includes prepare_schema_migration_pr", () => {
    expect(evaluateStage2IntegratedClosureVerdict().recommendedNextPhases).toContain(
      "prepare_schema_migration_pr",
    );
  });

  it("recommendedNextPhases includes prepare_connector_gateway_experiment_branch", () => {
    expect(evaluateStage2IntegratedClosureVerdict().recommendedNextPhases).toContain(
      "prepare_connector_gateway_experiment_branch",
    );
  });

  it("evaluator does not change runtime routing write feature flag DB schema migration git Cursor or GitHub", () => {
    const spy = vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage");

    const report = evaluateStage2IntegratedClosureVerdict();

    expect(spy).toHaveBeenCalled();
    expect(report.executesRuntimeChangeInThisStep).toBe(false);
    expect(report.changesConnectorRoutingInThisStep).toBe(false);
    expect(report.wiresWritePathInThisStep).toBe(false);
    expect(report.modifiesSchemaInThisStep).toBe(false);
    expect(report.createsMigrationInThisStep).toBe(false);
    expect(report.executesGitInThisStep).toBe(false);
    expect(report.callsCursorInThisStep).toBe(false);
    expect(report.callsGitHubInThisStep).toBe(false);
  });

  describe("hardened report fields", () => {
    it("stage2Scope is read_only_multi_agent_runtime_foundation", () => {
      expect(evaluateStage2IntegratedClosureVerdict().stage2Scope).toBe(
        "read_only_multi_agent_runtime_foundation",
      );
    });

    it("actualRuntimeChangeAllowedAfterStage2 is false", () => {
      expect(evaluateStage2IntegratedClosureVerdict().actualRuntimeChangeAllowedAfterStage2).toBe(false);
    });

    it("requiresSeparateSchemaPr is true", () => {
      expect(evaluateStage2IntegratedClosureVerdict().requiresSeparateSchemaPr).toBe(true);
    });

    it("requiresSeparateOperatorAuditSchemaPr is true", () => {
      expect(evaluateStage2IntegratedClosureVerdict().requiresSeparateOperatorAuditSchemaPr).toBe(true);
    });

    it("requiresSeparateConnectorExperimentBranch is true", () => {
      expect(evaluateStage2IntegratedClosureVerdict().requiresSeparateConnectorExperimentBranch).toBe(true);
    });

    it("requiresSeparateRuntimeExecutionWireDesign is true", () => {
      expect(evaluateStage2IntegratedClosureVerdict().requiresSeparateRuntimeExecutionWireDesign).toBe(true);
    });

    it("requiresSeparateFeatureFlagWire is true", () => {
      expect(evaluateStage2IntegratedClosureVerdict().requiresSeparateFeatureFlagWire).toBe(true);
    });

    it("stage2ClosureSummary is non-empty", () => {
      expect(evaluateStage2IntegratedClosureVerdict().stage2ClosureSummary.length).toBeGreaterThan(0);
    });

    it("ready stage3Candidate is runtime_execution_handoff_design", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue(
        mockRuntimeFinalApprovalReady(),
      );
      expect(evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS).stage3Candidate).toBe(
        "runtime_execution_handoff_design",
      );
    });

    it("stage2ExitCriteriaSatisfied follows closure checklist when ready", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue(
        mockRuntimeFinalApprovalReady(),
      );
      const report = evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS);
      expect(report.stage2ExitCriteriaSatisfied).toBe(
        report.closureChecklist.every((c) => c.satisfied),
      );
    });

    it("stage2NoRunPolicySatisfied follows no-run policy when ready", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue(
        mockRuntimeFinalApprovalReady(),
      );
      const report = evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS);
      expect(report.stage2NoRunPolicySatisfied).toBe(true);
      expect(report.noRunChecklist.every((c) => c.satisfied)).toBe(true);
    });

    it("default defer has stage2HandoffReady false", () => {
      expect(evaluateStage2IntegratedClosureVerdict().stage2HandoffReady).toBe(false);
    });

    it("ready has stage2HandoffReady true", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue(
        mockRuntimeFinalApprovalReady(),
      );
      expect(evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS).stage2HandoffReady).toBe(true);
    });

    it("handoff plan documented when handoff checklist satisfied", () => {
      const report = evaluateStage2IntegratedClosureVerdict();
      expect(report.stage2HandoffPlanDocumented).toBe(report.handoffChecklist.every((c) => c.satisfied));
    });

    it("defer stage3Candidate is read_only_hardening_required", () => {
      expect(evaluateStage2IntegratedClosureVerdict().stage3Candidate).toBe("read_only_hardening_required");
    });

    it("blocked stage3Candidate is read_only_hardening_required", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue({
        ...mockRuntimeFinalApprovalReady(),
        decision: "blocked",
      });
      expect(evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS).stage3Candidate).toBe(
        "read_only_hardening_required",
      );
    });
  });

  describe("hardened checklist reasons", () => {
    it("runtime final approval package ready reason includes runtime final approval decision", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue({
        ...mockRuntimeFinalApprovalReady(),
        decision: "defer",
      });
      const reason = checklistItem(
        evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS),
        "closureChecklist",
        "runtime final approval package ready",
      )?.reason;
      expect(reason).toContain("runtime final approval decision=defer");
    });

    it("routing shadow reviewed reason includes routingShadowReviewConfirmed", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue({
        ...mockRuntimeFinalApprovalReady(),
        routingShadowReviewConfirmed: false,
      });
      const reason = checklistItem(
        evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS),
        "closureChecklist",
        "routing shadow reviewed",
      )?.reason;
      expect(reason).toContain("routingShadowReviewConfirmed=false");
    });

    it("wire candidate reviewed reason includes wireCandidateReviewConfirmed", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue({
        ...mockRuntimeFinalApprovalReady(),
        wireCandidateReviewConfirmed: false,
      });
      const reason = checklistItem(
        evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS),
        "closureChecklist",
        "wire candidate reviewed",
      )?.reason;
      expect(reason).toContain("wireCandidateReviewConfirmed=false");
    });

    it("Stage 2 remains read-only reason includes noRunPolicySatisfied", () => {
      const reason = checklistItem(
        evaluateStage2IntegratedClosureVerdict(),
        "closureChecklist",
        "Stage 2 remains read-only",
      )?.reason;
      expect(reason).toContain("noRunPolicySatisfied=");
    });

    it("no runtime change reason includes actual=false", () => {
      const reason = checklistItem(
        evaluateStage2IntegratedClosureVerdict(),
        "noRunChecklist",
        "no runtime change",
      )?.reason;
      expect(reason).toContain("actual=false");
    });

    it("no runtime change reason includes expected=false", () => {
      const reason = checklistItem(
        evaluateStage2IntegratedClosureVerdict(),
        "noRunChecklist",
        "no runtime change",
      )?.reason;
      expect(reason).toContain("expected=false");
    });

    it("no GitHub call reason includes actual=false and expected=false", () => {
      const reason = checklistItem(
        evaluateStage2IntegratedClosureVerdict(),
        "noRunChecklist",
        "no GitHub call",
      )?.reason;
      expect(reason).toContain("actual=false");
      expect(reason).toContain("expected=false");
    });

    it("no runtime change reason does not misleadingly show changesRuntimeInThisStep=true", () => {
      const reason = checklistItem(
        evaluateStage2IntegratedClosureVerdict(),
        "noRunChecklist",
        "no runtime change",
      )?.reason;
      expect(reason).not.toMatch(/changesRuntimeInThisStep=true/);
      expect(reason).toContain("changesRuntimeInThisStep: actual=false");
    });

    it("schema/migration PR must be separate reason includes separate PR wording", () => {
      const reason = checklistItem(
        evaluateStage2IntegratedClosureVerdict(),
        "handoffChecklist",
        "schema/migration PR must be separate",
      )?.reason;
      expect(reason).toContain("separate");
    });

    it("connector gateway routing risk acknowledged reason includes source and review wording", () => {
      const reason = checklistItem(
        evaluateStage2IntegratedClosureVerdict(),
        "riskChecklist",
        "connector gateway routing risk acknowledged",
      )?.reason;
      expect(reason).toContain("risk source=routing shadow");
      expect(reason).toContain("routingShadowReviewConfirmed=");
    });
  });

  describe("risk checklist acknowledgement", () => {
    it("Stage1 regression not required includes not required in reason", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue({
        ...mockRuntimeFinalApprovalReady(),
        sourceRoutingShadowRequiresStage1Regression: false,
      });
      const entry = checklistItem(
        evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS),
        "riskChecklist",
        "Stage1 regression risk acknowledged",
      );
      expect(entry?.satisfied).toBe(true);
      expect(entry?.reason).toContain("not required");
    });

    it("Stage1 regression required and unconfirmed is not satisfied", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue({
        ...mockRuntimeFinalApprovalReady(),
        sourceRoutingShadowRequiresStage1Regression: true,
        stage1RegressionReviewConfirmed: false,
      });
      const entry = checklistItem(
        evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS),
        "riskChecklist",
        "Stage1 regression risk acknowledged",
      );
      expect(entry?.satisfied).toBe(false);
    });

    it("rollback required and unconfirmed is not satisfied", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue({
        ...mockRuntimeFinalApprovalReady(),
        sourceRoutingShadowRequiresRollbackPlan: true,
        rollbackPlanReviewConfirmed: false,
      });
      const entry = checklistItem(
        evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS),
        "riskChecklist",
        "rollback risk acknowledged",
      );
      expect(entry?.satisfied).toBe(false);
    });

    it("operator audit confirmed satisfies operator audit risk acknowledged", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue({
        ...mockRuntimeFinalApprovalReady(),
        operatorAuditReviewConfirmed: true,
      });
      expect(
        checklistItem(
          evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS),
          "riskChecklist",
          "operator audit risk acknowledged",
        )?.satisfied,
      ).toBe(true);
    });

    it("schema migration review confirmed satisfies schema migration risk acknowledged", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue({
        ...mockRuntimeFinalApprovalReady(),
        sourceWireCandidateSchemaMigrationReviewConfirmed: true,
      });
      expect(
        checklistItem(
          evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS),
          "riskChecklist",
          "schema migration risk acknowledged",
        )?.satisfied,
      ).toBe(true);
    });
  });

  describe("recommendedNextPhases order", () => {
    it("defer puts continue_read_only_hardening first", () => {
      expect(evaluateStage2IntegratedClosureVerdict().recommendedNextPhases[0]).toBe(
        "continue_read_only_hardening",
      );
    });

    it("ready excludes continue_read_only_hardening", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue(
        mockRuntimeFinalApprovalReady(),
      );
      const phases = evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS).recommendedNextPhases;
      expect(phases).not.toContain("continue_read_only_hardening");
    });

    it("ready includes prepare_schema_migration_pr", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue(
        mockRuntimeFinalApprovalReady(),
      );
      expect(
        evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS).recommendedNextPhases,
      ).toContain("prepare_schema_migration_pr");
    });

    it("ready includes prepare_operator_audit_schema_pr", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue(
        mockRuntimeFinalApprovalReady(),
      );
      expect(
        evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS).recommendedNextPhases,
      ).toContain("prepare_operator_audit_schema_pr");
    });

    it("ready includes prepare_connector_gateway_experiment_branch", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue(
        mockRuntimeFinalApprovalReady(),
      );
      expect(
        evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS).recommendedNextPhases,
      ).toContain("prepare_connector_gateway_experiment_branch");
    });

    it("ready includes prepare_runtime_execution_wire_design", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue(
        mockRuntimeFinalApprovalReady(),
      );
      expect(
        evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS).recommendedNextPhases,
      ).toContain("prepare_runtime_execution_wire_design");
    });

    it("ready includes prepare_feature_flag_wire_design", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue(
        mockRuntimeFinalApprovalReady(),
      );
      expect(
        evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS).recommendedNextPhases,
      ).toContain("prepare_feature_flag_wire_design");
    });
  });

  describe("blocking finding source separation", () => {
    it("sourceRuntimeBlockingFindingCodes includes only runtime final approval blocking codes", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue({
        ...mockRuntimeFinalApprovalReady(),
        findings: [{ severity: "blocking", code: "runtime_only_block", message: "blocked" }],
        sourceRoutingShadowBlockingFindingCodes: ["routing_block"],
        sourceWireCandidateBlockingFindingCodes: ["wire_block"],
      });
      const report = evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS);
      expect(report.sourceRuntimeBlockingFindingCodes).toEqual(["runtime_only_block"]);
      expect(report.sourceRuntimeBlockingFindingCodes).not.toContain("routing_block");
      expect(report.sourceRuntimeBlockingFindingCodes).not.toContain("wire_block");
    });

    it("sourceAggregatedBlockingFindingCodes includes routing wire and runtime blocking codes", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue({
        ...mockRuntimeFinalApprovalReady(),
        findings: [{ severity: "blocking", code: "runtime_only_block", message: "blocked" }],
        sourceRoutingShadowBlockingFindingCodes: ["routing_block"],
        sourceWireCandidateBlockingFindingCodes: ["wire_block"],
      });
      const report = evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS);
      expect(report.sourceAggregatedBlockingFindingCodes).toEqual(
        expect.arrayContaining(["runtime_only_block", "routing_block", "wire_block"]),
      );
    });

    it("sourceAggregatedBlockingFindingCodes dedupes duplicate codes", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue({
        ...mockRuntimeFinalApprovalReady(),
        findings: [{ severity: "blocking", code: "shared_block", message: "blocked" }],
        sourceRoutingShadowBlockingFindingCodes: ["shared_block"],
        sourceWireCandidateBlockingFindingCodes: ["wire_block"],
      });
      const report = evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS);
      expect(
        report.sourceAggregatedBlockingFindingCodes.filter((c) => c === "shared_block"),
      ).toHaveLength(1);
    });
  });

  describe("integration without upstream mocks", () => {
    const INTEGRATION_CLOSURE_CONFIRMATIONS = {
      ...ALL_CLOSURE_CONFIRMATIONS,
      agentTarget: "agent_execution_record",
      operatorTarget: "operator_approval",
      routingConnectorIds: ["cursor"],
    } as const;

    it("real evaluator chain composes runtime final approval without mocks", () => {
      const report = evaluateStage2IntegratedClosureVerdict(INTEGRATION_CLOSURE_CONFIRMATIONS);
      expect(report.sourceRuntimeFinalApprovalDecision).toBeTruthy();
      expect(report.sourceWireCandidateDecision).toBeTruthy();
      expect(report.sourceRoutingShadowDecision).toBeTruthy();
    });

    it("real chain keeps all no-run execution flags false", () => {
      const report = evaluateStage2IntegratedClosureVerdict(INTEGRATION_CLOSURE_CONFIRMATIONS);
      expect(report.executesRuntimeChangeInThisStep).toBe(false);
      expect(report.changesConnectorRoutingInThisStep).toBe(false);
      expect(report.wiresWritePathInThisStep).toBe(false);
      expect(report.writesDataInThisStep).toBe(false);
      expect(report.callsPrismaInThisStep).toBe(false);
      expect(report.modifiesSchemaInThisStep).toBe(false);
      expect(report.createsMigrationInThisStep).toBe(false);
      expect(report.executesGitInThisStep).toBe(false);
      expect(report.callsCursorInThisStep).toBe(false);
      expect(report.callsGitHubInThisStep).toBe(false);
    });

    it("real defer chain recommendedNextPhases starts with continue_read_only_hardening", () => {
      const report = evaluateStage2IntegratedClosureVerdict(INTEGRATION_CLOSURE_CONFIRMATIONS);
      expect(report.decision).toBe("defer");
      expect(report.recommendedNextPhases[0]).toBe("continue_read_only_hardening");
      expect(report.recommendedNextPhases).toContain("prepare_feature_flag_wire_design");
    });
  });

  describe("hardened findings", () => {
    it("ready includes stage2_read_only_foundation_complete", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue(
        mockRuntimeFinalApprovalReady(),
      );
      expect(
        evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS).findings.some(
          (f) => f.code === "stage2_read_only_foundation_complete",
        ),
      ).toBe(true);
    });

    it("ready includes actual_runtime_change_requires_stage3_or_separate_pr", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue(
        mockRuntimeFinalApprovalReady(),
      );
      expect(
        evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS).findings.some(
          (f) => f.code === "actual_runtime_change_requires_stage3_or_separate_pr",
        ),
      ).toBe(true);
    });

    it("ready includes schema_migration_requires_separate_pr", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue(
        mockRuntimeFinalApprovalReady(),
      );
      expect(
        evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS).findings.some(
          (f) => f.code === "schema_migration_requires_separate_pr",
        ),
      ).toBe(true);
    });

    it("ready includes connector_gateway_routing_requires_experiment_branch", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue(
        mockRuntimeFinalApprovalReady(),
      );
      expect(
        evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS).findings.some(
          (f) => f.code === "connector_gateway_routing_requires_experiment_branch",
        ),
      ).toBe(true);
    });

    it("ready includes write_path_wire_requires_separate_approval", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue(
        mockRuntimeFinalApprovalReady(),
      );
      expect(
        evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS).findings.some(
          (f) => f.code === "write_path_wire_requires_separate_approval",
        ),
      ).toBe(true);
    });

    it("defer includes stage2_closure_requires_additional_read_only_hardening", () => {
      expect(
        evaluateStage2IntegratedClosureVerdict().findings.some(
          (f) => f.code === "stage2_closure_requires_additional_read_only_hardening",
        ),
      ).toBe(true);
    });

    it("blocked includes stage2_closure_requires_blocking_issue_resolution", () => {
      vi.spyOn(runtimeFinalApprovalModule, "evaluateRuntimeChangeFinalApprovalPackage").mockReturnValue({
        ...mockRuntimeFinalApprovalReady(),
        decision: "blocked",
      });
      expect(
        evaluateStage2IntegratedClosureVerdict(ALL_CLOSURE_CONFIRMATIONS).findings.some(
          (f) => f.code === "stage2_closure_requires_blocking_issue_resolution",
        ),
      ).toBe(true);
    });
  });
});
