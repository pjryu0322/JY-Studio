import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateConnectorGatewayExperimentBranchApproval } from "@/lib/agents/evaluateConnectorGatewayExperimentBranchApproval";
import * as branchPlanModule from "@/lib/agents/evaluateConnectorGatewayExperimentBranchPlan";
import * as connectorFacade from "@/lib/agents/connectorGatewayFacade";

function checklistItem(
  report: ReturnType<typeof evaluateConnectorGatewayExperimentBranchApproval>,
  item: string,
) {
  return report.approvalChecklist.find((c) => c.item === item);
}

describe("multi-agent connector gateway experiment branch approval stage 2-19", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("cursor.execution.before returns read_only_connector_gateway_experiment_branch_approval mode", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.mode).toBe("read_only_connector_gateway_experiment_branch_approval");
  });

  it("cursor.execution.before returns ready_for_operator_approval decision", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.decision).toBe("ready_for_operator_approval");
  });

  it("cursor.execution.before returns cursor_only scope", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.scope).toBe("cursor_only");
  });

  it("recommendedBranchName is experiment/connector-gateway-cursor-routing", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.recommendedBranchName).toBe("experiment/connector-gateway-cursor-routing");
  });

  it("featureFlagName is JYO_CONNECTOR_GATEWAY_CURSOR_ROUTING", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.featureFlagName).toBe("JYO_CONNECTOR_GATEWAY_CURSOR_ROUTING");
  });

  it("featureFlagDefault is off", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.featureFlagDefault).toBe("off");
  });

  it("requiresOperatorApproval is true for cursor boundary", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.requiresOperatorApproval).toBe(true);
  });

  it("requiresRegressionChecklist is true for cursor boundary", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.requiresRegressionChecklist).toBe(true);
  });

  it("requiresRollbackPlan is true", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.requiresRollbackPlan).toBe(true);
  });

  it("requiresDirectCallFallback is true", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.requiresDirectCallFallback).toBe(true);
  });

  it("approvalChecklist includes branch name selected as satisfied", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["cursor.execution.before"],
    });
    const item = checklistItem(report, "branch name selected");
    expect(item).toBeDefined();
    expect(item?.satisfied).toBe(true);
  });

  it("approvalChecklist includes no git branch creation no feature flag wire no routing change", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(checklistItem(report, "no git branch creation in this step")?.satisfied).toBe(true);
    expect(checklistItem(report, "no feature flag wire in this step")?.satisfied).toBe(true);
    expect(checklistItem(report, "no connector routing change in this step")?.satisfied).toBe(true);
  });

  it("report includes candidateBoundaries", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.candidateBoundaries.length).toBeGreaterThan(0);
  });

  it("report includes candidateConnectorIds", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.candidateConnectorIds).toEqual(["cursor"]);
  });

  it("report includes candidateBoundaryKinds", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.candidateBoundaryKinds).toEqual(["cursor_execution"]);
  });

  it("sourceBranchPlanDecision is included", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.sourceBranchPlanDecision).toBe("ready_for_branch_plan");
  });

  it("sourceRoutingDecision and sourceRoutingScope are included", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.sourceRoutingDecision).toBe("ready_for_experiment_design");
    expect(report.sourceRoutingScope).toBe("cursor_only");
  });

  it("validationSuites is included", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.validationSuites.length).toBeGreaterThan(0);
    expect(report.validationSuites).toContain("multiAgentFoundation.unit.test.ts");
  });

  it("github.pr.create.before returns defer decision", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["github.pr.create.before"],
    });
    expect(report.decision).toBe("defer");
  });

  it("github boundary requires Stage1 regression", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["github.pr.create.before"],
    });
    expect(report.requiresStage1Regression).toBe(true);
  });

  it("cursor and github returns defer decision", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["cursor.execution.before", "github.pr.create.before"],
    });
    expect(report.decision).toBe("defer");
  });

  it("unknown boundary returns blocked decision", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["unknown.boundary"],
    });
    expect(report.decision).toBe("blocked");
  });

  it("unknown boundary has empty recommendedBranchName", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["unknown.boundary"],
    });
    expect(report.recommendedBranchName).toBe("");
  });

  it("unknown boundary includes branch_plan_blocked finding", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["unknown.boundary"],
    });
    expect(report.findings.some((f) => f.code === "branch_plan_blocked")).toBe(true);
  });

  it("blocked report keeps source trace fields", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["unknown.boundary"],
    });
    expect(report.sourceBranchPlanDecision).toBe("blocked");
    expect(report.validationSuites.length).toBeGreaterThan(0);
  });

  it("blocked report has branch name selected false", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["unknown.boundary"],
    });
    expect(checklistItem(report, "branch name selected")?.satisfied).toBe(false);
  });

  it("blocked report keeps no git branch creation no feature flag wire no routing change true", () => {
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["unknown.boundary"],
    });
    expect(checklistItem(report, "no git branch creation in this step")?.satisfied).toBe(true);
    expect(checklistItem(report, "no feature flag wire in this step")?.satisfied).toBe(true);
    expect(checklistItem(report, "no connector routing change in this step")?.satisfied).toBe(true);
  });

  it("ready path does not stay ready when required regression suites are missing", () => {
    vi.spyOn(branchPlanModule, "evaluateConnectorGatewayExperimentBranchPlan").mockReturnValue({
      mode: "read_only_connector_gateway_experiment_branch_plan",
      decision: "ready_for_branch_plan",
      scope: "cursor_only",
      recommendedBranchName: "experiment/connector-gateway-cursor-routing",
      featureFlagName: "JYO_CONNECTOR_GATEWAY_CURSOR_ROUTING",
      featureFlagDefault: "off",
      requiresDirectCallFallback: true,
      requiresStage1Regression: false,
      requiresRollbackPlan: true,
      requiresOperatorApproval: true,
      candidateBoundaries: ["cursor.execution.before"],
      candidateConnectorIds: ["cursor"],
      candidateBoundaryKinds: ["cursor_execution"],
      sourceRoutingDecision: "ready_for_experiment_design",
      sourceRoutingScope: "cursor_only",
      requiredRegressionSuites: [],
      validationSuites: [],
      rollbackCriteria: ["rollback"],
      findings: [],
    });
    const report = evaluateConnectorGatewayExperimentBranchApproval({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.decision).not.toBe("ready_for_operator_approval");
  });

  it("uses branch plan only without git branch creation feature flag wire or connector execution", () => {
    const branchPlanSpy = vi.spyOn(branchPlanModule, "evaluateConnectorGatewayExperimentBranchPlan");
    const evaluateSpy = vi.spyOn(connectorFacade, "evaluateConnectorInvocation");
    const planSpy = vi.spyOn(connectorFacade, "planConnectorInvocation");
    evaluateConnectorGatewayExperimentBranchApproval({ boundaryIds: ["cursor.execution.before"] });
    expect(branchPlanSpy).toHaveBeenCalledTimes(1);
    expect(evaluateSpy).not.toHaveBeenCalled();
    expect(planSpy).not.toHaveBeenCalled();
  });
});
