import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateConnectorGatewayExperimentBranchPlan } from "@/lib/agents/evaluateConnectorGatewayExperimentBranchPlan";
import * as connectorFacade from "@/lib/agents/connectorGatewayFacade";

describe("multi-agent connector gateway experiment branch plan stage 2-16", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("cursor.execution.before returns read_only_connector_gateway_experiment_branch_plan mode", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.mode).toBe("read_only_connector_gateway_experiment_branch_plan");
  });

  it("cursor.execution.before returns cursor_only scope", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.scope).toBe("cursor_only");
  });

  it("cursor_only returns ready_for_branch_plan decision", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.decision).toBe("ready_for_branch_plan");
  });

  it("cursor_only recommends experiment/connector-gateway-cursor-routing branch", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.recommendedBranchName).toBe("experiment/connector-gateway-cursor-routing");
  });

  it("cursor_only recommends JYO_CONNECTOR_GATEWAY_CURSOR_ROUTING feature flag", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.featureFlagName).toBe("JYO_CONNECTOR_GATEWAY_CURSOR_ROUTING");
  });

  it("featureFlagDefault is off", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.featureFlagDefault).toBe("off");
  });

  it("requiresDirectCallFallback is true", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.requiresDirectCallFallback).toBe(true);
  });

  it("requiresRollbackPlan is true", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.requiresRollbackPlan).toBe(true);
  });

  it("requiresOperatorApproval is true", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.requiresOperatorApproval).toBe(true);
  });

  it("github.pr.create.before returns github_only scope", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["github.pr.create.before"],
    });
    expect(report.scope).toBe("github_only");
  });

  it("github.pr.create.before returns defer decision", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["github.pr.create.before"],
    });
    expect(report.decision).toBe("defer");
  });

  it("github boundary requires Stage1 regression", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["github.pr.create.before"],
    });
    expect(report.requiresStage1Regression).toBe(true);
  });

  it("cursor and github returns cursor_and_github scope", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["cursor.execution.before", "github.pr.create.before"],
    });
    expect(report.scope).toBe("cursor_and_github");
  });

  it("cursor_and_github recommends experiment/connector-gateway-runtime-routing branch", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["cursor.execution.before", "github.pr.create.before"],
    });
    expect(report.recommendedBranchName).toBe("experiment/connector-gateway-runtime-routing");
  });

  it("unknown boundary returns blocked decision", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["unknown.boundary"],
    });
    expect(report.decision).toBe("blocked");
  });

  it("unknown boundary returns empty recommendedBranchName", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["unknown.boundary"],
    });
    expect(report.recommendedBranchName).toBe("");
  });

  it("github scope includes Stage1 or GitHub regression suites", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["github.pr.create.before"],
    });
    const suites = report.requiredRegressionSuites.join(" ");
    expect(suites).toMatch(/ENV_TEST|GitHub|requirementsOrchestrationPhase4Product/);
  });

  it("rollbackCriteria includes direct call fallback and feature flag default off", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["cursor.execution.before"],
    });
    const criteria = report.rollbackCriteria.join(" ");
    expect(criteria).toMatch(/direct call fallback/i);
    expect(criteria).toMatch(/feature flag default off/i);
  });

  it("report includes candidateConnectorIds", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.candidateConnectorIds).toEqual(["cursor"]);
  });

  it("report includes candidateBoundaryKinds", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.candidateBoundaryKinds).toEqual(["cursor_execution"]);
  });

  it("sourceRoutingDecision matches routing experiment", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.sourceRoutingDecision).toBe("ready_for_experiment_design");
  });

  it("sourceRoutingScope matches routing experiment", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.sourceRoutingScope).toBe("cursor_only");
  });

  it("blocked report has empty requiredRegressionSuites", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["unknown.boundary"],
    });
    expect(report.requiredRegressionSuites).toEqual([]);
  });

  it("validationSuites includes common unit suites", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.validationSuites).toContain(
      "multiAgentConnectorGatewayRoutingExperiment.unit.test.ts",
    );
    expect(report.validationSuites).toContain("multiAgentFoundation.unit.test.ts");
  });

  it("includes branch_plan_read_only finding on all reports", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.findings.some((f) => f.code === "branch_plan_read_only")).toBe(true);
  });

  it("includes no_git_branch_creation finding", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["github.pr.create.before"],
    });
    expect(report.findings.some((f) => f.code === "no_git_branch_creation")).toBe(true);
  });

  it("includes no_feature_flag_wire finding", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.findings.some((f) => f.code === "no_feature_flag_wire")).toBe(true);
  });

  it("includes no_routing_change finding", () => {
    const report = evaluateConnectorGatewayExperimentBranchPlan({
      boundaryIds: ["unknown.boundary"],
    });
    expect(report.findings.some((f) => f.code === "no_routing_change")).toBe(true);
  });

  it("does not create git branch wire routing or invoke connector execution", () => {
    const evaluateSpy = vi.spyOn(connectorFacade, "evaluateConnectorInvocation");
    const planSpy = vi.spyOn(connectorFacade, "planConnectorInvocation");
    evaluateConnectorGatewayExperimentBranchPlan({ boundaryIds: ["cursor.execution.before"] });
    expect(evaluateSpy).not.toHaveBeenCalled();
    expect(planSpy).not.toHaveBeenCalled();
  });
});
