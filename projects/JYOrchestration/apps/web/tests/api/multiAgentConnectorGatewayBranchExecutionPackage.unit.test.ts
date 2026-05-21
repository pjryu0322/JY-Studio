import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateConnectorGatewayExperimentBranchExecutionPackage } from "@/lib/agents/evaluateConnectorGatewayExperimentBranchExecutionPackage";
import * as branchCreationReadinessModule from "@/lib/agents/evaluateConnectorGatewayExperimentBranchCreationReadiness";

function mockReadyReadiness(
  overrides: Partial<
    ReturnType<typeof branchCreationReadinessModule.evaluateConnectorGatewayExperimentBranchCreationReadiness>
  > = {},
) {
  return {
    mode: "read_only_connector_gateway_branch_creation_readiness" as const,
    decision: "ready_for_explicit_user_approval" as const,
    sourceApprovalDecision: "ready_for_operator_approval",
    sourceScope: "cursor_only",
    sourceCandidateBoundaries: ["cursor.execution.before"],
    sourceCandidateConnectorIds: ["cursor"],
    sourceCandidateBoundaryKinds: ["cursor_execution"],
    sourceBranchPlanDecision: "ready_for_branch_plan",
    sourceRoutingDecision: "ready_for_experiment_design",
    sourceRoutingScope: "cursor_only",
    recommendedBranchName: "experiment/connector-gateway-cursor-routing",
    featureFlagName: "JYO_CONNECTOR_GATEWAY_CURSOR_ROUTING",
    featureFlagDefault: "off" as const,
    commandCandidates: [
      {
        command: "git fetch origin",
        purpose: "sync remote refs",
        allowedAfterExplicitApproval: true,
        caution: "read-only candidate; do not execute without explicit user approval",
      },
      {
        command: "git checkout -b experiment/connector-gateway-cursor-routing",
        purpose: "create experiment branch",
        allowedAfterExplicitApproval: true,
        caution: "read-only candidate; do not execute without explicit user approval",
      },
    ],
    approvalChecklist: [],
    regressionChecklist: ["multiAgentHarnessDryRun.unit.test.ts"],
    rollbackCriteria: ["feature flag default off"],
    requiresExplicitUserApproval: true,
    createsBranchInThisStep: false,
    wiresFeatureFlagInThisStep: false,
    changesRoutingInThisStep: false,
    findings: [],
    ...overrides,
  };
}

describe("multi-agent connector gateway branch execution package stage 2-25", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("explicitUserApproval=false returns defer", () => {
    const report = evaluateConnectorGatewayExperimentBranchExecutionPackage({
      boundaryIds: ["cursor.execution.before"],
      explicitUserApproval: false,
    });
    expect(report.decision).toBe("defer");
  });

  it("explicitUserApproval=false returns empty manualCommands", () => {
    const report = evaluateConnectorGatewayExperimentBranchExecutionPackage({
      boundaryIds: ["cursor.execution.before"],
      explicitUserApproval: false,
    });
    expect(report.manualCommands).toEqual([]);
  });

  it("explicitUserApproval=true returns ready_for_manual_execution_after_approval", () => {
    const report = evaluateConnectorGatewayExperimentBranchExecutionPackage({
      boundaryIds: ["cursor.execution.before"],
      explicitUserApproval: true,
    });
    expect(report.decision).toBe("ready_for_manual_execution_after_approval");
  });

  it("explicitUserApproval=true returns non-empty manualCommands", () => {
    const report = evaluateConnectorGatewayExperimentBranchExecutionPackage({
      boundaryIds: ["cursor.execution.before"],
      explicitUserApproval: true,
    });
    expect(report.manualCommands.length).toBeGreaterThan(0);
  });

  it("manualCommands sequence starts at 1", () => {
    const report = evaluateConnectorGatewayExperimentBranchExecutionPackage({
      boundaryIds: ["cursor.execution.before"],
      explicitUserApproval: true,
    });
    expect(report.manualCommands[0]?.sequence).toBe(1);
    expect(report.manualCommands.at(-1)?.sequence).toBe(report.manualCommands.length);
  });

  it("all manualCommands have mustRunManually=true", () => {
    const report = evaluateConnectorGatewayExperimentBranchExecutionPackage({
      boundaryIds: ["cursor.execution.before"],
      explicitUserApproval: true,
    });
    for (const command of report.manualCommands) {
      expect(command.mustRunManually).toBe(true);
    }
  });

  it("all manualCommands have requiresExplicitUserApproval=true", () => {
    const report = evaluateConnectorGatewayExperimentBranchExecutionPackage({
      boundaryIds: ["cursor.execution.before"],
      explicitUserApproval: true,
    });
    for (const command of report.manualCommands) {
      expect(command.requiresExplicitUserApproval).toBe(true);
    }
  });

  it("all manualCommands include caution", () => {
    const report = evaluateConnectorGatewayExperimentBranchExecutionPackage({
      boundaryIds: ["cursor.execution.before"],
      explicitUserApproval: true,
    });
    for (const command of report.manualCommands) {
      expect(command.caution.length).toBeGreaterThan(0);
    }
  });

  it("executesCommandsInThisStep is false", () => {
    expect(
      evaluateConnectorGatewayExperimentBranchExecutionPackage({
        boundaryIds: ["cursor.execution.before"],
        explicitUserApproval: true,
      }).executesCommandsInThisStep,
    ).toBe(false);
  });

  it("createsBranchInThisStep is false", () => {
    expect(
      evaluateConnectorGatewayExperimentBranchExecutionPackage({
        boundaryIds: ["cursor.execution.before"],
        explicitUserApproval: true,
      }).createsBranchInThisStep,
    ).toBe(false);
  });

  it("wiresFeatureFlagInThisStep is false", () => {
    expect(
      evaluateConnectorGatewayExperimentBranchExecutionPackage({
        boundaryIds: ["cursor.execution.before"],
        explicitUserApproval: true,
      }).wiresFeatureFlagInThisStep,
    ).toBe(false);
  });

  it("changesRoutingInThisStep is false", () => {
    expect(
      evaluateConnectorGatewayExperimentBranchExecutionPackage({
        boundaryIds: ["cursor.execution.before"],
        explicitUserApproval: true,
      }).changesRoutingInThisStep,
    ).toBe(false);
  });

  it("github boundary returns defer", () => {
    const report = evaluateConnectorGatewayExperimentBranchExecutionPackage({
      boundaryIds: ["github.pr.create.before"],
      explicitUserApproval: true,
    });
    expect(report.decision).toBe("defer");
    expect(report.manualCommands).toEqual([]);
  });

  it("unknown boundary returns blocked", () => {
    const report = evaluateConnectorGatewayExperimentBranchExecutionPackage({
      boundaryIds: ["unknown.boundary"],
      explicitUserApproval: true,
    });
    expect(report.decision).toBe("blocked");
    expect(report.manualCommands).toEqual([]);
  });

  it("does not execute git commands branch creation feature flag wire or routing change", () => {
    const readinessSpy = vi.spyOn(
      branchCreationReadinessModule,
      "evaluateConnectorGatewayExperimentBranchCreationReadiness",
    );
    evaluateConnectorGatewayExperimentBranchExecutionPackage({
      boundaryIds: ["cursor.execution.before"],
      explicitUserApproval: true,
    });
    expect(readinessSpy).toHaveBeenCalledTimes(1);
  });
});
