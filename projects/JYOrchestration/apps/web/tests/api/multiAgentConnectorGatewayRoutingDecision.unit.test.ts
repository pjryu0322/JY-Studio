import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateConnectorGatewayRoutingDecision } from "@/lib/agents/evaluateConnectorGatewayRoutingDecision";
import * as connectorFacade from "@/lib/agents/connectorGatewayFacade";

describe("multi-agent connector gateway routing decision stage 2-9", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("unknown boundaryId returns blocked", () => {
    const report = evaluateConnectorGatewayRoutingDecision({
      boundaryId: "unknown.boundary",
    });
    expect(report.decision).toBe("blocked");
    expect(report.findings.some((f) => f.code === "boundary_not_found")).toBe(true);
  });

  it("cursor.execution.before returns defer", () => {
    const report = evaluateConnectorGatewayRoutingDecision({
      boundaryId: "cursor.execution.before",
    });
    expect(report.decision).toBe("defer");
    expect(report.target).toBe("cursor_execution");
    expect(report.connectorId).toBe("cursor");
  });

  it("cursor.execution.before requiresExecutionPathChange=true", () => {
    const report = evaluateConnectorGatewayRoutingDecision({
      boundaryId: "cursor.execution.before",
    });
    expect(report.requiresExecutionPathChange).toBe(true);
  });

  it("cursor.execution.before requiresRollbackPlan=true", () => {
    const report = evaluateConnectorGatewayRoutingDecision({
      boundaryId: "cursor.execution.before",
    });
    expect(report.requiresRollbackPlan).toBe(true);
  });

  it("github.pr.create.before returns defer", () => {
    const report = evaluateConnectorGatewayRoutingDecision({
      boundaryId: "github.pr.create.before",
    });
    expect(report.decision).toBe("defer");
    expect(report.target).toBe("github_pr");
  });

  it("github.pr.create.before requiresStage1Regression=true", () => {
    const report = evaluateConnectorGatewayRoutingDecision({
      boundaryId: "github.pr.create.before",
    });
    expect(report.requiresStage1Regression).toBe(true);
  });

  it("github.merge.before requiresStage1Regression=true", () => {
    const report = evaluateConnectorGatewayRoutingDecision({
      boundaryId: "github.merge.before",
    });
    expect(report.requiresStage1Regression).toBe(true);
    expect(report.target).toBe("github_merge");
  });

  it("report mode is read_only_routing_decision", () => {
    const report = evaluateConnectorGatewayRoutingDecision({
      boundaryId: "cursor.execution.before",
    });
    expect(report.mode).toBe("read_only_routing_decision");
  });

  it("evaluator does not call Cursor/GitHub connector facade execution planners", () => {
    const cursorSpy = vi.spyOn(connectorFacade, "planCursorConnectorInvocation");
    const githubSpy = vi.spyOn(connectorFacade, "planGithubConnectorInvocation");
    const planSpy = vi.spyOn(connectorFacade, "planConnectorInvocation");
    evaluateConnectorGatewayRoutingDecision({ boundaryId: "github.status.check.before" });
    expect(cursorSpy).not.toHaveBeenCalled();
    expect(githubSpy).not.toHaveBeenCalled();
    expect(planSpy).not.toHaveBeenCalled();
  });

  it("evaluator does not mutate connector gateway routing", () => {
    const reportBefore = evaluateConnectorGatewayRoutingDecision({
      boundaryId: "cursor.execution.before",
    });
    const reportAfter = evaluateConnectorGatewayRoutingDecision({
      boundaryId: "cursor.execution.before",
    });
    expect(reportAfter).toEqual(reportBefore);
  });
});
