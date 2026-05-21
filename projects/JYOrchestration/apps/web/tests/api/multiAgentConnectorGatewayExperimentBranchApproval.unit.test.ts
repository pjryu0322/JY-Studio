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
