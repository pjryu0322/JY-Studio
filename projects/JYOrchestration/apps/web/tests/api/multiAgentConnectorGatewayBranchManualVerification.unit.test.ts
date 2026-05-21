import { afterEach, describe, expect, it, vi } from "vitest";
import {
  evaluateConnectorGatewayExperimentBranchManualVerification,
  sanitizeRegressionResults,
} from "@/lib/agents/evaluateConnectorGatewayExperimentBranchManualVerification";
import * as executionPackageModule from "@/lib/agents/evaluateConnectorGatewayExperimentBranchExecutionPackage";

const CURSOR_BOUNDARY = ["cursor.execution.before"] as const;
const EXPECTED_BRANCH = "experiment/connector-gateway-cursor-routing";

function checklistItem(
  report: ReturnType<typeof evaluateConnectorGatewayExperimentBranchManualVerification>,
  item: string,
) {
  return report.verificationChecklist.find((c) => c.item === item);
}

describe("multi-agent connector gateway branch manual verification stage 2-28", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mode is read_only_connector_gateway_branch_manual_verification", () => {
    expect(evaluateConnectorGatewayExperimentBranchManualVerification({
      boundaryIds: [...CURSOR_BOUNDARY],
    }).mode).toBe("read_only_connector_gateway_branch_manual_verification");
  });

  it("explicitManualExecutionConfirmed=false returns defer", () => {
    const report = evaluateConnectorGatewayExperimentBranchManualVerification({
      boundaryIds: [...CURSOR_BOUNDARY],
      explicitManualExecutionConfirmed: false,
      actualBranchName: EXPECTED_BRANCH,
      regressionResults: [{ suite: "multiAgentHarnessDryRun.unit.test.ts", passed: true, summary: "ok" }],
    });
    expect(report.decision).toBe("defer");
  });

  it("missing actualBranchName returns defer", () => {
    const report = evaluateConnectorGatewayExperimentBranchManualVerification({
      boundaryIds: [...CURSOR_BOUNDARY],
      explicitManualExecutionConfirmed: true,
      regressionResults: [{ suite: "multiAgentHarnessDryRun.unit.test.ts", passed: true, summary: "ok" }],
    });
    expect(report.decision).toBe("defer");
  });

  it("actualBranchName mismatch returns blocked", () => {
    const report = evaluateConnectorGatewayExperimentBranchManualVerification({
      boundaryIds: [...CURSOR_BOUNDARY],
      explicitManualExecutionConfirmed: true,
      actualBranchName: "experiment/wrong-branch",
      regressionResults: [{ suite: "multiAgentHarnessDryRun.unit.test.ts", passed: true, summary: "ok" }],
    });
    expect(report.decision).toBe("blocked");
    expect(report.findings.some((f) => f.code === "actual_branch_name_mismatch")).toBe(true);
  });

  it("missing regressionResults returns defer", () => {
    const report = evaluateConnectorGatewayExperimentBranchManualVerification({
      boundaryIds: [...CURSOR_BOUNDARY],
      explicitManualExecutionConfirmed: true,
      actualBranchName: EXPECTED_BRANCH,
    });
    expect(report.decision).toBe("defer");
    expect(report.findings.some((f) => f.code === "regression_results_missing")).toBe(true);
  });

  it("failed regression returns blocked with rollbackRequired", () => {
    const report = evaluateConnectorGatewayExperimentBranchManualVerification({
      boundaryIds: [...CURSOR_BOUNDARY],
      explicitManualExecutionConfirmed: true,
      actualBranchName: EXPECTED_BRANCH,
      regressionResults: [
        { suite: "multiAgentHarnessDryRun.unit.test.ts", passed: false, summary: "failed" },
      ],
    });
    expect(report.decision).toBe("blocked");
    expect(report.rollbackRequired).toBe(true);
    expect(report.findings.some((f) => f.code === "regression_failed")).toBe(true);
  });

  it("all conditions satisfied returns manual_branch_verified", () => {
    const report = evaluateConnectorGatewayExperimentBranchManualVerification({
      boundaryIds: [...CURSOR_BOUNDARY],
      explicitManualExecutionConfirmed: true,
      actualBranchName: EXPECTED_BRANCH,
      regressionResults: [
        { suite: "multiAgentHarnessDryRun.unit.test.ts", passed: true, summary: "ok" },
        { suite: "multiAgentFoundation.unit.test.ts", passed: true, summary: "ok" },
      ],
    });
    expect(report.decision).toBe("manual_branch_verified");
    expect(report.currentBranchMatchesExpected).toBe(true);
    expect(report.regressionPassed).toBe(true);
  });

  it("verified report has featureFlagDefault off", () => {
    expect(
      evaluateConnectorGatewayExperimentBranchManualVerification({
        boundaryIds: [...CURSOR_BOUNDARY],
        explicitManualExecutionConfirmed: true,
        actualBranchName: EXPECTED_BRANCH,
        regressionResults: [{ suite: "multiAgentHarnessDryRun.unit.test.ts", passed: true, summary: "ok" }],
      }).featureFlagDefault,
    ).toBe("off");
  });

  it("executesGitInThisStep is false", () => {
    expect(
      evaluateConnectorGatewayExperimentBranchManualVerification({
        boundaryIds: [...CURSOR_BOUNDARY],
        explicitManualExecutionConfirmed: true,
        actualBranchName: EXPECTED_BRANCH,
        regressionResults: [{ suite: "multiAgentHarnessDryRun.unit.test.ts", passed: true, summary: "ok" }],
      }).executesGitInThisStep,
    ).toBe(false);
  });

  it("createsBranchInThisStep is false", () => {
    expect(
      evaluateConnectorGatewayExperimentBranchManualVerification({
        boundaryIds: [...CURSOR_BOUNDARY],
        explicitManualExecutionConfirmed: true,
        actualBranchName: EXPECTED_BRANCH,
        regressionResults: [{ suite: "multiAgentHarnessDryRun.unit.test.ts", passed: true, summary: "ok" }],
      }).createsBranchInThisStep,
    ).toBe(false);
  });

  it("runsTestsInThisStep is false", () => {
    expect(
      evaluateConnectorGatewayExperimentBranchManualVerification({
        boundaryIds: [...CURSOR_BOUNDARY],
        explicitManualExecutionConfirmed: true,
        actualBranchName: EXPECTED_BRANCH,
        regressionResults: [{ suite: "multiAgentHarnessDryRun.unit.test.ts", passed: true, summary: "ok" }],
      }).runsTestsInThisStep,
    ).toBe(false);
  });

  it("wiresFeatureFlagInThisStep is false", () => {
    expect(
      evaluateConnectorGatewayExperimentBranchManualVerification({
        boundaryIds: [...CURSOR_BOUNDARY],
        explicitManualExecutionConfirmed: true,
        actualBranchName: EXPECTED_BRANCH,
        regressionResults: [{ suite: "multiAgentHarnessDryRun.unit.test.ts", passed: true, summary: "ok" }],
      }).wiresFeatureFlagInThisStep,
    ).toBe(false);
  });

  it("changesRoutingInThisStep is false", () => {
    expect(
      evaluateConnectorGatewayExperimentBranchManualVerification({
        boundaryIds: [...CURSOR_BOUNDARY],
        explicitManualExecutionConfirmed: true,
        actualBranchName: EXPECTED_BRANCH,
        regressionResults: [{ suite: "multiAgentHarnessDryRun.unit.test.ts", passed: true, summary: "ok" }],
      }).changesRoutingInThisStep,
    ).toBe(false);
  });

  it("verificationChecklist includes no git execution satisfied", () => {
    const report = evaluateConnectorGatewayExperimentBranchManualVerification({
      boundaryIds: [...CURSOR_BOUNDARY],
      explicitManualExecutionConfirmed: true,
      actualBranchName: EXPECTED_BRANCH,
      regressionResults: [{ suite: "multiAgentHarnessDryRun.unit.test.ts", passed: true, summary: "ok" }],
    });
    expect(checklistItem(report, "no git execution in this step")?.satisfied).toBe(true);
    expect(checklistItem(report, "no branch creation in this step")?.satisfied).toBe(true);
    expect(checklistItem(report, "no test execution in this step")?.satisfied).toBe(true);
  });

  it("unknown boundary returns blocked", () => {
    const report = evaluateConnectorGatewayExperimentBranchManualVerification({
      boundaryIds: ["unknown.boundary"],
      explicitManualExecutionConfirmed: true,
      actualBranchName: EXPECTED_BRANCH,
      regressionResults: [{ suite: "multiAgentHarnessDryRun.unit.test.ts", passed: true, summary: "ok" }],
    });
    expect(report.decision).toBe("blocked");
    expect(report.findings.some((f) => f.code === "expected_branch_name_missing")).toBe(true);
    expect(report.currentBranchMatchesExpected).toBe(false);
  });

  it("sanitizeRegressionResults normalizes empty suite and summary", () => {
    const sanitized = sanitizeRegressionResults([{ suite: "  ", passed: true, summary: "" }]);
    expect(sanitized).toHaveLength(1);
    expect(sanitized[0]?.suite).toBe("unknown_regression_suite");
    expect(sanitized[0]?.summary).toBe("no summary provided");
  });

  it("sanitizeRegressionResults dedupes suite and fails if any duplicate failed", () => {
    const sanitized = sanitizeRegressionResults([
      { suite: "suite-a", passed: true, summary: "ok" },
      { suite: "suite-a", passed: false, summary: "failed" },
    ]);
    expect(sanitized).toHaveLength(1);
    expect(sanitized[0]?.passed).toBe(false);
  });

  it("verified report includes source trace from execution package", () => {
    const report = evaluateConnectorGatewayExperimentBranchManualVerification({
      boundaryIds: [...CURSOR_BOUNDARY],
      explicitManualExecutionConfirmed: true,
      actualBranchName: EXPECTED_BRANCH,
      regressionResults: [{ suite: "multiAgentHarnessDryRun.unit.test.ts", passed: true, summary: "ok" }],
    });
    expect(report.sourceBoundaryIds).toEqual([...CURSOR_BOUNDARY]);
    expect(report.sourceExecutionPackageFindings.length).toBeGreaterThan(0);
    expect(report.sourceExecutionPackageChecklistSummary.total).toBeGreaterThan(0);
    expect(report.sourceExecutionPackageChecklistSummary.satisfied).toBeGreaterThanOrEqual(0);
    expect(report.sourceExecutionPackageChecklistSummary.unsatisfied).toBeGreaterThanOrEqual(0);
    expect(
      report.sourceExecutionPackageChecklistSummary.satisfied +
        report.sourceExecutionPackageChecklistSummary.unsatisfied,
    ).toBe(report.sourceExecutionPackageChecklistSummary.total);
  });

  it("uses execution package only without git branch test flag or routing execution", () => {
    const packageSpy = vi.spyOn(
      executionPackageModule,
      "evaluateConnectorGatewayExperimentBranchExecutionPackage",
    );
    evaluateConnectorGatewayExperimentBranchManualVerification({
      boundaryIds: [...CURSOR_BOUNDARY],
      explicitManualExecutionConfirmed: true,
      actualBranchName: EXPECTED_BRANCH,
      regressionResults: [{ suite: "multiAgentHarnessDryRun.unit.test.ts", passed: true, summary: "ok" }],
    });
    expect(packageSpy).toHaveBeenCalledTimes(1);
    expect(packageSpy).toHaveBeenCalledWith({
      boundaryIds: [...CURSOR_BOUNDARY],
      explicitUserApproval: true,
    });
  });
});
