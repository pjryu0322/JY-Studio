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
    expect(evaluateConnectorGatewayRoutingShadow().boundarySource).toBe("missing");
  });

  it("target cursor_only with boundaryIds undefined uses default boundary and boundarySource default", () => {
    const report = evaluateConnectorGatewayRoutingShadow({ target: "cursor_only" });
    expect(report.boundarySource).toBe("default");
    expect(report.boundaryIds).toEqual([...CURSOR_BOUNDARY]);
  });

  it("target cursor_only with boundaryIds empty array returns blocked and boundarySource missing", () => {
    const report = evaluateConnectorGatewayRoutingShadow({
      target: "cursor_only",
      boundaryIds: [],
    });
    expect(report.decision).toBe("blocked");
    expect(report.boundarySource).toBe("missing");
    expect(report.boundaryIds).toEqual([]);
  });

  it("target unknown with boundaryIds undefined returns blocked and boundarySource missing", () => {
    const report = evaluateConnectorGatewayRoutingShadow({ target: "unknown" });
    expect(report.decision).toBe("blocked");
    expect(report.boundarySource).toBe("missing");
  });

  it("explicit connectorIds sets connectorSource explicit", () => {
    const report = evaluateConnectorGatewayRoutingShadow({
      target: "cursor_only",
      boundaryIds: [...CURSOR_BOUNDARY],
      connectorIds: ["cursor"],
    });
    expect(report.connectorSource).toBe("explicit");
    expect(report.connectorIds).toEqual(["cursor"]);
  });

  it("missing connectorIds uses routing experiment connectorSource routing_experiment", () => {
    const report = evaluateConnectorGatewayRoutingShadow({
      target: "cursor_only",
      boundaryIds: [...CURSOR_BOUNDARY],
    });
    expect(report.connectorSource).toBe("routing_experiment");
    expect(report.connectorIds.length).toBeGreaterThan(0);
  });

  it("manual verification external result trace fields are false", () => {
    const report = evaluateConnectorGatewayRoutingShadow({
      target: "cursor_only",
      boundaryIds: [...CURSOR_BOUNDARY],
    });
    expect(report.sourceManualVerificationUsesExternalResults).toBe(false);
    expect(report.sourceManualVerificationActualBranchProvided).toBe(false);
    expect(report.sourceManualVerificationRegressionResultsProvided).toBe(false);
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
    expect(report.findings.some((f) => f.code === "explicit_shadow_approval_missing")).toBe(true);
  });

  it("explicitShadowApproval=true with cursor_only returns shadow_ready", () => {
    const report = evaluateConnectorGatewayRoutingShadow({
      target: "cursor_only",
      boundaryIds: [...CURSOR_BOUNDARY],
      explicitShadowApproval: true,
    });
    expect(report.decision).toBe("shadow_ready");
    expect(report.sourceRoutingScope).toBe("cursor_only");
    expect(report.findings.some((f) => f.code === "routing_shadow_ready")).toBe(true);
  });

  it("github_only with explicitShadowApproval=true returns defer with stage1 regression warning", () => {
    const report = evaluateConnectorGatewayRoutingShadow({
      target: "github_only",
      boundaryIds: ["github.pr.create.before"],
      explicitShadowApproval: true,
    });
    expect(report.decision).toBe("defer");
    expect(report.findings.some((f) => f.code === "stage1_regression_required")).toBe(true);
    expect(report.findings.some((f) => f.code === "routing_shadow_ready")).toBe(false);
  });

  it("cursor_and_github with explicitShadowApproval=true returns defer with stage1 regression warning", () => {
    const report = evaluateConnectorGatewayRoutingShadow({
      target: "cursor_and_github",
      boundaryIds: ["cursor.execution.before", "github.pr.create.before"],
      explicitShadowApproval: true,
    });
    expect(report.decision).toBe("defer");
    expect(report.findings.some((f) => f.code === "stage1_regression_required")).toBe(true);
    expect(report.findings.some((f) => f.code === "routing_shadow_ready")).toBe(false);
  });

  it("blocked state does not include routing_shadow_ready finding", () => {
    const report = evaluateConnectorGatewayRoutingShadow();
    expect(report.decision).toBe("blocked");
    expect(report.findings.some((f) => f.code === "routing_shadow_ready")).toBe(false);
  });

  it("defer state does not include routing_shadow_ready finding", () => {
    const report = evaluateConnectorGatewayRoutingShadow({
      target: "cursor_only",
      boundaryIds: [...CURSOR_BOUNDARY],
    });
    expect(report.decision).toBe("defer");
    expect(report.findings.some((f) => f.code === "routing_shadow_ready")).toBe(false);
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
    expect(facadeSpy).not.toHaveBeenCalled();
    expect(report.changesRuntimeRouteInThisStep).toBe(false);
    expect(report.callsConnectorInThisStep).toBe(false);
  });
});
