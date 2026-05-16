import { describe, expect, it } from "vitest";

import { buildRuntimeOperatorApprovalPlanningReports } from "@/lib/harness/runtimeOperatorApproval/buildRuntimeOperatorApprovalPlanningReports";
import { serializeRuntimeOperatorApprovalDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeOperatorApproval/serializeRuntimeOperatorApprovalDiagnosticBundle";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { normalizeRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/normalizeRuntimePlanningContext";
import { buildRuntimeCriticalityPlanningReports } from "@/lib/harness/runtimeCriticality/buildRuntimeCriticalityPlanningReports";
import { buildRuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import { buildRuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import { buildRuntimeTraceabilityPlanningReports } from "@/lib/harness/runtimeTraceability/buildRuntimeTraceabilityPlanningReports";

function buildFullSemantic() {
  const maturityBaseline = evaluateHarnessMaturityBaseline({
    overlayExtract: null,
    harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
    recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
    messageExplainabilityAvailable: true,
  });
  const ctx = normalizeRuntimePlanningContext({
    overlay: null,
    maturityBaseline,
    releaseGate: evaluateHarnessReleaseGateReadiness(maturityBaseline),
    messageExplainabilityAvailable: true,
    overlayWarningCount: 0,
  });
  const dep = buildRuntimeDependencyPlanningReports(ctx);
  const crit = buildRuntimeCriticalityPlanningReports(ctx, dep);
  const trace = buildRuntimeTraceabilityPlanningReports(ctx, dep, crit);
  const reasoning = buildRuntimeReasoningPlanningReports(dep, crit, trace);
  return buildRuntimeSemanticPlanningReports(reasoning);
}

describe("H23.5 runtime operator approval readiness", () => {
  it("full semantic includes four summaries with enforcement flags false", () => {
    const semantic = buildFullSemantic();
    expect(semantic.runtimeOperatorApprovalSummary.actualApprovalEnforcementEnabled).toBe(false);
    expect(semantic.runtimeRollbackReadinessSummary.actualRollbackExecutionEnabled).toBe(false);
    expect(semantic.runtimeAuditReadinessSummary.mode).toBe("runtime_audit_readiness_summary");
    expect(semantic.runtimePilotPreconditionSummary.mode).toBe("runtime_pilot_precondition_summary");
  });

  it("buildRuntimeOperatorApprovalPlanningReports merges from execution candidate layer", () => {
    const semantic = buildFullSemantic();
    const {
      runtimeOperatorApprovalSummary: _a,
      runtimeRollbackReadinessSummary: _b,
      runtimeAuditReadinessSummary: _c,
      runtimePilotPreconditionSummary: _d,
      ...before
    } = semantic;
    const h235 = buildRuntimeOperatorApprovalPlanningReports(before);
    expect(h235.runtimeOperatorApprovalSummary.approvalReadiness).toBeTruthy();
    expect(h235.runtimeRollbackReadinessSummary.rollbackPrerequisites.length).toBeGreaterThan(0);
  });

  it("serializes operator approval diagnostic bundle with sorted string arrays", () => {
    const semantic = buildFullSemantic();
    const ser = serializeRuntimeOperatorApprovalDiagnosticBundleFromSemanticReports(semantic);
    expect(ser.runtimeOperatorApprovalSummary.mode).toBe("runtime_operator_approval_summary");
    expect(ser.runtimeRollbackReadinessSummary.mode).toBe("runtime_rollback_readiness_summary");
    expect(ser.runtimeAuditReadinessSummary.auditFindings).toEqual(
      [...(ser.runtimeAuditReadinessSummary.auditFindings as string[])].sort((a, b) => a.localeCompare(b, "ko"))
    );
  });
});
