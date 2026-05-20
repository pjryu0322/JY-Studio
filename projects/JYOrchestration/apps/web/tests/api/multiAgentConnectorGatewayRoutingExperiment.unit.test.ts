import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateConnectorGatewayRoutingExperiment } from "@/lib/agents/evaluateConnectorGatewayRoutingExperiment";
import * as connectorFacade from "@/lib/agents/connectorGatewayFacade";

describe("multi-agent connector gateway routing experiment stage 2-13", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("empty boundaryIds returns blocked and none scope", () => {
    const report = evaluateConnectorGatewayRoutingExperiment({ boundaryIds: [] });
    expect(report.decision).toBe("blocked");
    expect(report.scope).toBe("none");
    expect(report.findings.some((f) => f.code === "empty_boundary_ids")).toBe(true);
  });

  it("unknown boundary returns blocked", () => {
    const report = evaluateConnectorGatewayRoutingExperiment({
      boundaryIds: ["unknown.boundary"],
    });
    expect(report.decision).toBe("blocked");
    expect(report.scope).toBe("none");
    expect(report.findings.some((f) => f.code === "unknown_boundary")).toBe(true);
  });

  it("cursor.execution.before only returns cursor_only scope", () => {
    const report = evaluateConnectorGatewayRoutingExperiment({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.scope).toBe("cursor_only");
  });

  it("cursor_only returns ready_for_experiment_design", () => {
    const report = evaluateConnectorGatewayRoutingExperiment({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.decision).toBe("ready_for_experiment_design");
  });

  it("github.pr.create.before only returns github_only scope", () => {
    const report = evaluateConnectorGatewayRoutingExperiment({
      boundaryIds: ["github.pr.create.before"],
    });
    expect(report.scope).toBe("github_only");
    expect(report.decision).toBe("defer");
  });

  it("github_only sets stage1RegressionRequired true", () => {
    const report = evaluateConnectorGatewayRoutingExperiment({
      boundaryIds: ["github.pr.create.before"],
    });
    expect(report.stage1RegressionRequired).toBe(true);
  });

  it("cursor and github boundaries return cursor_and_github scope", () => {
    const report = evaluateConnectorGatewayRoutingExperiment({
      boundaryIds: ["cursor.execution.before", "github.pr.create.before"],
    });
    expect(report.scope).toBe("cursor_and_github");
    expect(report.decision).toBe("defer");
  });

  it("active experiment requires feature flag default off", () => {
    const report = evaluateConnectorGatewayRoutingExperiment({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.featureFlagRequired).toBe(true);
    expect(report.featureFlagDefault).toBe("off");
    expect(report.experimentBranchRequired).toBe(true);
  });

  it("active experiment requires directCallFallbackRequired true", () => {
    const report = evaluateConnectorGatewayRoutingExperiment({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.directCallFallbackRequired).toBe(true);
  });

  it("active experiment requires rollbackPlanRequired true", () => {
    const report = evaluateConnectorGatewayRoutingExperiment({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.rollbackPlanRequired).toBe(true);
  });

  it("does not change Cursor/GitHub execution paths", () => {
    const evaluateSpy = vi.spyOn(connectorFacade, "evaluateConnectorInvocation");
    const planSpy = vi.spyOn(connectorFacade, "planConnectorInvocation");
    evaluateConnectorGatewayRoutingExperiment({ boundaryIds: ["cursor.execution.before"] });
    expect(evaluateSpy).not.toHaveBeenCalled();
    expect(planSpy).not.toHaveBeenCalled();
  });

  it("report mode is read_only_routing_experiment_design", () => {
    const report = evaluateConnectorGatewayRoutingExperiment({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.mode).toBe("read_only_routing_experiment_design");
  });
});
