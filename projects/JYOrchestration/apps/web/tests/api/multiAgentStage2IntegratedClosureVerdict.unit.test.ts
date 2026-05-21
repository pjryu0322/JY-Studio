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
});
