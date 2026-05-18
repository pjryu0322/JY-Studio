import { describe, expect, it } from "vitest";

import { buildRuntimePilotContractPlanningReports } from "@/lib/harness/runtimePilotContract/buildRuntimePilotContractPlanningReports";
import { buildRuntimePilotContractSummary } from "@/lib/harness/runtimePilotContract/buildRuntimePilotContractSummary";
import { evaluateRuntimeAdapterBoundary } from "@/lib/harness/runtimePilotContract/evaluateRuntimeAdapterBoundary";
import { detectRuntimeAdapterForbiddenOperations } from "@/lib/harness/runtimePilotContract/detectRuntimeAdapterForbiddenOperations";
import { serializeRuntimePilotContractDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimePilotContract/serializeRuntimePilotContractDiagnosticBundle";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { stripRuntimePilotContractLayer } from "../runtimePlanningReportStrip";
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

describe("H24.5 runtime pilot contract & adapter boundary", () => {
  it("full semantic includes pilot contract with adapter invocation false", () => {
    const semantic = buildFullSemantic();
    expect(semantic.runtimePilotContractSummary.actualRuntimeAdapterInvocationEnabled).toBe(false);
    expect(semantic.runtimeAdapterBoundarySummary.actualRuntimeAdapterInvocationEnabled).toBe(false);
    expect(semantic.runtimePilotHandoffReadiness.actualRuntimeAdapterInvocationEnabled).toBe(false);
    expect(semantic.runtimePilotContractSummary.mode).toBe("runtime_pilot_contract_summary");
  });

  it("controlledPilot blocked → contract blocked and handoff_blocked", () => {
    const before = stripRuntimePilotContractLayer(buildFullSemantic());
    const blocked = {
      ...before,
      runtimeControlledPilotSummary: {
        ...before.runtimeControlledPilotSummary,
        readiness: "blocked" as const,
        pilotScope: "blocked" as const,
        safetyBlockers: ["blocked"],
      },
    };
    const contract = buildRuntimePilotContractSummary(blocked);
    const boundary = evaluateRuntimeAdapterBoundary(blocked);
    expect(contract.contractReadiness).toBe("blocked");
    expect(boundary.boundaryMode).toBe("handoff_blocked");
  });

  it("metadata_ready + single_flow_metadata + no blockers → contract_metadata_ready", () => {
    const before = stripRuntimePilotContractLayer(buildFullSemantic());
    const ready = {
      ...before,
      runtimeControlledPilotSummary: {
        ...before.runtimeControlledPilotSummary,
        readiness: "metadata_ready" as const,
        pilotScope: "single_flow_metadata" as const,
        safetyBlockers: [],
      },
    };
    const contract = buildRuntimePilotContractSummary(ready);
    expect(contract.contractReadiness).toBe("contract_metadata_ready");
    expect(evaluateRuntimeAdapterBoundary(ready).boundaryMode).toBe("contract_metadata_only");
  });

  it("detects provider routing wording in nested reports", () => {
    const before = stripRuntimePilotContractLayer(buildFullSemantic());
    const withWording = {
      ...before,
      runtimeControlBoundaryViolationReport: {
        ...before.runtimeControlBoundaryViolationReport,
        wordingRiskFindings: ["provider routing risk in metadata"],
      },
    };
    const forbidden = detectRuntimeAdapterForbiddenOperations(withWording);
    expect(forbidden.wordingRiskFindings.some((w) => w.includes("provider routing"))).toBe(true);
    expect(forbidden.forbiddenOperations).toContain("provider routing");
  });

  it("handoff readiness includes approval rollback audit signals", () => {
    const semantic = buildFullSemantic();
    const h = semantic.runtimePilotHandoffReadiness;
    expect(h.operatorApprovalReadiness).toBeTruthy();
    expect(h.rollbackReadiness).toBeTruthy();
    expect(h.auditReadiness).toBeTruthy();
  });

  it("serializer does not rebuild and keeps sorted arrays", () => {
    const semantic = buildFullSemantic();
    const ser = serializeRuntimePilotContractDiagnosticBundleFromSemanticReports(semantic);
    expect(ser.runtimePilotContractSummary.mode).toBe("runtime_pilot_contract_summary");
    expect(ser.runtimeAdapterForbiddenOperationReport.forbiddenOperations).toEqual(
      [...(ser.runtimeAdapterForbiddenOperationReport.forbiddenOperations as string[])].sort((a, b) =>
        a.localeCompare(b, "ko")
      )
    );
  });

  it("buildRuntimePilotContractPlanningReports merges from controlled pilot layer", () => {
    const before = stripRuntimePilotContractLayer(buildFullSemantic());
    const h245 = buildRuntimePilotContractPlanningReports(before);
    expect(h245.runtimePilotContractInputSchema.mode).toBe("runtime_pilot_contract_input_schema");
    expect(h245.runtimePilotContractOutputSchema.mode).toBe("runtime_pilot_contract_output_schema");
  });
});
