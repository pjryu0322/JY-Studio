import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateConnectorGatewayRoutingShadow } from "@/lib/agents/evaluateConnectorGatewayRoutingShadow";
import * as manualVerificationModule from "@/lib/agents/evaluateConnectorGatewayExperimentBranchManualVerification";
import * as routingExperimentModule from "@/lib/agents/evaluateConnectorGatewayRoutingExperiment";
import * as connectorFacade from "@/lib/agents/connectorGatewayFacade";

const CURSOR_BOUNDARY = ["cursor.execution.before"] as const;

describe("multi-agent connector gateway routing shadow stage 2-A", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mode is read_only_connector_gateway_routing_shadow", () => {
    expect(evaluateConnectorGatewayRoutingShadow().mode).toBe(
      "read_only_connector_gateway_routing_shadow",
    );
  });

  it("observesOnly is true", () => {
    expect(evaluateConnectorGatewayRoutingShadow().observesOnly).toBe(true);
  });

  it("changesRuntimeRouteInThisStep is false", () => {
    expect(evaluateConnectorGatewayRoutingShadow().changesRuntimeRouteInThisStep).toBe(false);
  });

  it("callsConnectorInThisStep is false", () => {
    expect(evaluateConnectorGatewayRoutingShadow().callsConnectorInThisStep).toBe(false);
  });

  it("invokesCursorInThisStep is false", () => {
    expect(evaluateConnectorGatewayRoutingShadow().invokesCursorInThisStep).toBe(false);
  });

  it("invokesGithubInThisStep is false", () => {
    expect(evaluateConnectorGatewayRoutingShadow().invokesGithubInThisStep).toBe(false);
  });

  it("wiresFeatureFlagInThisStep is false", () => {
    expect(evaluateConnectorGatewayRoutingShadow().wiresFeatureFlagInThisStep).toBe(false);
  });

  it("writesDataInThisStep is false", () => {
    expect(evaluateConnectorGatewayRoutingShadow().writesDataInThisStep).toBe(false);
  });

  it("missing target returns blocked", () => {
    expect(evaluateConnectorGatewayRoutingShadow().decision).toBe("blocked");
    expect(evaluateConnectorGatewayRoutingShadow().target).toBe("unknown");
  });

  it("missing boundaryIds with unknown target returns blocked", () => {
    const report = evaluateConnectorGatewayRoutingShadow({ target: "unknown", boundaryIds: [] });
    expect(report.decision).toBe("blocked");
    expect(report.findings.some((f) => f.code === "routing_shadow_boundary_missing")).toBe(true);
  });

  it("featureFlagEnabled=true returns blocked", () => {
    const report = evaluateConnectorGatewayRoutingShadow({
      target: "cursor_only",
      boundaryIds: [...CURSOR_BOUNDARY],
      featureFlagEnabled: true,
    });
    expect(report.decision).toBe("blocked");
    expect(report.findings.some((f) => f.code === "feature_flag_enabled_not_allowed_in_shadow")).toBe(
      true,
    );
  });

  it("explicitShadowApproval=false returns defer", () => {
    const report = evaluateConnectorGatewayRoutingShadow({
      target: "cursor_only",
      boundaryIds: [...CURSOR_BOUNDARY],
      explicitShadowApproval: false,
    });
    expect(report.decision).toBe("defer");
    expect(report.routeMode).toBe("observe_only");
  });

  it("explicitShadowApproval=true with cursor_only returns shadow_ready", () => {
    const report = evaluateConnectorGatewayRoutingShadow({
      target: "cursor_only",
      boundaryIds: [...CURSOR_BOUNDARY],
      explicitShadowApproval: true,
    });
    expect(report.decision).toBe("shadow_ready");
    expect(report.sourceRoutingScope).toBe("cursor_only");
  });

  it("github_only scope includes stage1 regression required warning", () => {
    const report = evaluateConnectorGatewayRoutingShadow({
      target: "github_only",
      boundaryIds: ["github.pr.create.before"],
      explicitShadowApproval: true,
    });
    expect(report.sourceRoutingScope).toBe("github_only");
    expect(report.findings.some((f) => f.code === "stage1_regression_required")).toBe(true);
  });

  it("defer routeMode is observe_only", () => {
    expect(
      evaluateConnectorGatewayRoutingShadow({
        target: "cursor_only",
        boundaryIds: [...CURSOR_BOUNDARY],
      }).routeMode,
    ).toBe("observe_only");
  });

  it("shadow_ready routeMode is shadow_compare", () => {
    expect(
      evaluateConnectorGatewayRoutingShadow({
        target: "cursor_only",
        boundaryIds: [...CURSOR_BOUNDARY],
        explicitShadowApproval: true,
      }).routeMode,
    ).toBe("shadow_compare");
  });

  it("blocked routeMode is fallback_required", () => {
    expect(evaluateConnectorGatewayRoutingShadow().routeMode).toBe("fallback_required");
  });

  it("default actualRuntimePath is existing_runtime_path", () => {
    expect(
      evaluateConnectorGatewayRoutingShadow({
        target: "cursor_only",
        boundaryIds: [...CURSOR_BOUNDARY],
      }).actualRuntimePath,
    ).toBe("existing_runtime_path");
  });

  it("shadowRuntimePath is connector_gateway_shadow_path", () => {
    expect(
      evaluateConnectorGatewayRoutingShadow({
        target: "cursor_only",
        boundaryIds: [...CURSOR_BOUNDARY],
      }).shadowRuntimePath,
    ).toBe("connector_gateway_shadow_path");
  });

  it("evaluator does not call connector facade or change runtime route", () => {
    const routingSpy = vi.spyOn(routingExperimentModule, "evaluateConnectorGatewayRoutingExperiment");
    const manualSpy = vi.spyOn(
      manualVerificationModule,
      "evaluateConnectorGatewayExperimentBranchManualVerification",
    );
    const facadeSpy = vi.spyOn(connectorFacade, "evaluateConnectorInvocation");

    const report = evaluateConnectorGatewayRoutingShadow({
      target: "cursor_only",
      boundaryIds: [...CURSOR_BOUNDARY],
      explicitShadowApproval: true,
    });

    expect(routingSpy).toHaveBeenCalled();
    expect(manualSpy).toHaveBeenCalled();
    expect(routingSpy.mock.calls.some((call) => call[0]?.boundaryIds?.includes("cursor.execution.before"))).toBe(
      true,
    );
    expect(facadeSpy).not.toHaveBeenCalled();
    expect(report.changesRuntimeRouteInThisStep).toBe(false);
    expect(report.callsConnectorInThisStep).toBe(false);
  });
});
