import { afterEach, describe, expect, it, vi } from "vitest";
import {
  evaluateConnectorGatewayExperimentBranchCreationReadiness,
  isSafeBranchName,
  isSafeFeatureFlagName,
} from "@/lib/agents/evaluateConnectorGatewayExperimentBranchCreationReadiness";
import * as branchApprovalModule from "@/lib/agents/evaluateConnectorGatewayExperimentBranchApproval";
import * as connectorFacade from "@/lib/agents/connectorGatewayFacade";

function checklistItem(
  report: ReturnType<typeof evaluateConnectorGatewayExperimentBranchCreationReadiness>,
  item: string,
) {
  return report.approvalChecklist.find((c) => c.item === item);
}

function mockReadyApproval(
  overrides: Partial<ReturnType<typeof branchApprovalModule.evaluateConnectorGatewayExperimentBranchApproval>> = {},
) {
  return {
    mode: "read_only_connector_gateway_experiment_branch_approval" as const,
    decision: "ready_for_operator_approval" as const,
    scope: "cursor_only" as const,
    recommendedBranchName: "experiment/connector-gateway-cursor-routing",
    featureFlagName: "JYO_CONNECTOR_GATEWAY_CURSOR_ROUTING",
    featureFlagDefault: "off" as const,
    requiresOperatorApproval: true,
    requiresRegressionChecklist: true,
    requiresRollbackPlan: true,
    requiresDirectCallFallback: true,
    requiresStage1Regression: false,
    candidateBoundaries: ["cursor.execution.before"],
    candidateConnectorIds: ["cursor"],
    candidateBoundaryKinds: ["cursor_execution"],
    sourceBranchPlanDecision: "ready_for_branch_plan",
    sourceRoutingDecision: "ready_for_experiment_design",
    sourceRoutingScope: "cursor_only",
    requiredRegressionSuites: ["multiAgentHarnessDryRun.unit.test.ts"],
    validationSuites: ["multiAgentFoundation.unit.test.ts"],
    rollbackCriteria: ["feature flag default off"],
    approvalChecklist: [],
    findings: [],
    ...overrides,
  };
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

  it("report includes sourceCandidateBoundaries", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.sourceCandidateBoundaries).toContain("cursor.execution.before");
  });

  it("report includes sourceCandidateConnectorIds", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.sourceCandidateConnectorIds).toEqual(["cursor"]);
  });

  it("report includes sourceCandidateBoundaryKinds", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.sourceCandidateBoundaryKinds).toEqual(["cursor_execution"]);
  });

  it("report includes sourceBranchPlanDecision sourceRoutingDecision sourceRoutingScope", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.sourceBranchPlanDecision).toBe("ready_for_branch_plan");
    expect(report.sourceRoutingDecision).toBe("ready_for_experiment_design");
    expect(report.sourceRoutingScope).toBe("cursor_only");
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
    expect(
      evaluateConnectorGatewayExperimentBranchCreationReadiness({
        boundaryIds: ["cursor.execution.before"],
      }).createsBranchInThisStep,
    ).toBe(false);
  });

  it("wiresFeatureFlagInThisStep is false", () => {
    expect(
      evaluateConnectorGatewayExperimentBranchCreationReadiness({
        boundaryIds: ["cursor.execution.before"],
      }).wiresFeatureFlagInThisStep,
    ).toBe(false);
  });

  it("changesRoutingInThisStep is false", () => {
    expect(
      evaluateConnectorGatewayExperimentBranchCreationReadiness({
        boundaryIds: ["cursor.execution.before"],
      }).changesRoutingInThisStep,
    ).toBe(false);
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

  it("all commandCandidates include caution", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    for (const candidate of report.commandCandidates) {
      expect(candidate.caution.length).toBeGreaterThan(0);
    }
  });

  it("commandCandidates caution includes explicit user approval wording", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    for (const candidate of report.commandCandidates) {
      expect(candidate.caution.toLowerCase()).toMatch(/explicit user approval/);
    }
  });

  it("approvalChecklist includes explicit user approval required true", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(checklistItem(report, "explicit user approval required")?.satisfied).toBe(true);
  });

  it("approvalChecklist includes no branch creation in this step true", () => {
    expect(
      checklistItem(
        evaluateConnectorGatewayExperimentBranchCreationReadiness({
          boundaryIds: ["cursor.execution.before"],
        }),
        "no branch creation in this step",
      )?.satisfied,
    ).toBe(true);
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

  it("defer state has requiresExplicitUserApproval true", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["github.pr.create.before"],
    });
    expect(report.requiresExplicitUserApproval).toBe(true);
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

  it("blocked state has requiresExplicitUserApproval false", () => {
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["unknown.boundary"],
    });
    expect(report.requiresExplicitUserApproval).toBe(false);
  });

  it("unsafe branch name results in blocked decision", () => {
    vi.spyOn(branchApprovalModule, "evaluateConnectorGatewayExperimentBranchApproval").mockReturnValue(
      mockReadyApproval({ recommendedBranchName: "../unsafe-branch" }),
    );
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.decision).toBe("blocked");
    expect(report.findings.some((f) => f.code === "unsafe_branch_name")).toBe(true);
    expect(report.commandCandidates).toEqual([]);
  });

  it("unsafe feature flag name results in blocked decision", () => {
    vi.spyOn(branchApprovalModule, "evaluateConnectorGatewayExperimentBranchApproval").mockReturnValue(
      mockReadyApproval({ featureFlagName: "bad-flag-name" }),
    );
    const report = evaluateConnectorGatewayExperimentBranchCreationReadiness({
      boundaryIds: ["cursor.execution.before"],
    });
    expect(report.decision).toBe("blocked");
    expect(report.findings.some((f) => f.code === "unsafe_feature_flag_name")).toBe(true);
    expect(isSafeFeatureFlagName("bad-flag-name")).toBe(false);
  });

  it("isSafeBranchName rejects path traversal patterns", () => {
    expect(isSafeBranchName("../bad")).toBe(false);
    expect(isSafeBranchName("experiment/connector-gateway-cursor-routing")).toBe(true);
  });

  it("uses branch approval only without git branch creation feature flag wire or connector execution", () => {
    const approvalSpy = vi.spyOn(branchApprovalModule, "evaluateConnectorGatewayExperimentBranchApproval");
    const evaluateSpy = vi.spyOn(connectorFacade, "evaluateConnectorInvocation");
    const planSpy = vi.spyOn(connectorFacade, "planConnectorInvocation");
    evaluateConnectorGatewayExperimentBranchCreationReadiness({ boundaryIds: ["cursor.execution.before"] });
    expect(approvalSpy).toHaveBeenCalledTimes(1);
    expect(evaluateSpy).not.toHaveBeenCalled();
    expect(planSpy).not.toHaveBeenCalled();
  });
});
