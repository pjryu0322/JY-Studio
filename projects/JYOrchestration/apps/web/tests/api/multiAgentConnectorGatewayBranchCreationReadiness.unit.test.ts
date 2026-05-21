import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateConnectorGatewayExperimentBranchCreationReadiness } from "@/lib/agents/evaluateConnectorGatewayExperimentBranchCreationReadiness";
import * as branchApprovalModule from "@/lib/agents/evaluateConnectorGatewayExperimentBranchApproval";
import * as connectorFacade from "@/lib/agents/connectorGatewayFacade";

function checklistItem(
  report: ReturnType<typeof evaluateConnectorGatewayExperimentBranchCreationReadiness>,
  item: string,
) {
  return report.approvalChecklist.find((c) => c.item === item);
}

describe("multi-agent connector gateway branch creation readiness stage 2-22", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("cursor.execution.before returns read_only_connector_gateway_branch_creation_readiness mode", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.mode).toBe("read_only_connector_gateway_branch_creation_readiness");
  });

  it("cursor.execution.before returns ready_for_explicit_user_approval decision", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.decision).toBe("ready_for_explicit_user_approval");
  });

  it("sourceApprovalDecision is ready_for_operator_approval", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.sourceApprovalDecision).toBe("ready_for_operator_approval");
  });

  it("sourceScope is cursor_only", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.sourceScope).toBe("cursor_only");
  });

  it("recommendedBranchName is experiment/connector-gateway-cursor-routing", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.recommendedBranchName).toBe("experiment/connector-gateway-cursor-routing");
  });

  it("featureFlagName is JYO_CONNECTOR_GATEWAY_CURSOR_ROUTING", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.featureFlagName).toBe("JYO_CONNECTOR_GATEWAY_CURSOR_ROUTING");
  });

  it("featureFlagDefault is off", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.featureFlagDefault).toBe("off");
  });

  it("requiresExplicitUserApproval is true for cursor boundary", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.requiresExplicitUserApproval).toBe(true);
  });

  it("createsBranchInThisStep is false", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.createsBranchInThisStep).toBe(false);
  });

  it("wiresFeatureFlagInThisStep is false", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.wiresFeatureFlagInThisStep).toBe(false);
  });

  it("changesRoutingInThisStep is false", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.changesRoutingInThisStep).toBe(false);
  });

  it("commandCandidates include git fetch origin", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.commandCandidates.some((c) => c.command === "git fetch origin")).toBe(true);
  });

  it("commandCandidates include git checkout -b recommended branch", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(
      report.commandCandidates.some((c) =>
        c.command.includes("git checkout -b experiment/connector-gateway-cursor-routing"),
      ),
    ).toBe(true);
  });

  it("all commandCandidates have allowedAfterExplicitApproval true", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    for (const candidate of report.commandCandidates) {
      expect(candidate.allowedAfterExplicitApproval).toBe(true);
    }
  });

  it("approvalChecklist includes explicit user approval required true", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(checklistItem(report, "explicit user approval required")?.satisfied).toBe(true);
  });

  it("approvalChecklist includes no branch creation in this step true", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(checklistItem(report, "no branch creation in this step")?.satisfied).toBe(true);
  });

  it("approvalChecklist includes no feature flag wire in this step true", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(checklistItem(report, "no feature flag wire in this step")?.satisfied).toBe(true);
  });

  it("approvalChecklist includes no routing change in this step true", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(checklistItem(report, "no routing change in this step")?.satisfied).toBe(true);
  });

  it("regressionChecklist is non-empty for cursor boundary", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.regressionChecklist.length).toBeGreaterThan(0);
  });

  it("rollbackCriteria is non-empty for cursor boundary", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.rollbackCriteria.length).toBeGreaterThan(0);
  });

  it("github.pr.create.before returns defer decision", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["github.pr.create.before"],
    });
    expect(report.decision).toBe("defer");
  });

  it("defer state has empty commandCandidates", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["github.pr.create.before"],
    });
    expect(report.commandCandidates).toEqual([]);
  });

  it("unknown boundary returns blocked decision", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["unknown.boundary"],
    });
    expect(report.decision).toBe("blocked");
  });

  it("blocked state has empty commandCandidates", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["unknown.boundary"],
    });
    expect(report.commandCandidates).toEqual([]);
  });

  it("uses branch approval only without git branch creation feature flag wire or connector execution", () => {
    const approvalSpy = vi.spyOn(branchApprovalModule, "evaluateConnectorGatewayExperimentBranchApproval");
    const evaluateSpy = vi.spyOn(connectorFacade, "evaluateConnectorInvocation");
    const planSpy = vi.spyOn(connectorFacade, "planConnectorInvocation");
    evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(approvalSpy).toHaveBeenCalledTimes(1);
    expect(evaluateSpy).not.toHaveBeenCalled();
    expect(planSpy).not.toHaveBeenCalled();
  });
});
