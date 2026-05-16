import { describe, expect, it } from "vitest";

import { buildRuntimeAdapterSandboxPlanningReports } from "@/lib/harness/runtimeAdapterSandbox/buildRuntimeAdapterSandboxPlanningReports";
import { buildRuntimeNoopAdapterPlanningReports } from "@/lib/harness/runtimeNoopAdapter/buildRuntimeNoopAdapterPlanningReports";
import { serializeRuntimeAdapterSandboxDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeAdapterSandbox/serializeRuntimeAdapterSandboxDiagnosticBundle";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { stripRuntimeAdapterSandboxLayer, stripRuntimeNoopAdapterLayer } from "../runtimePlanningReportStrip";
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

describe("H26 runtime adapter sandbox", () => {
  it("full semantic includes sandbox with actualSandboxInvocationEnabled false", () => {
    const semantic = buildFullSemantic();
    expect(semantic.runtimeAdapterSandboxSummary.actualSandboxInvocationEnabled).toBe(false);
    expect(semantic.runtimeAdapterSandboxResultMetadata.sandboxInvoked).toBe(false);
    expect(semantic.runtimeAdapterSandboxResultMetadata.diagnosticOnly).toBe(true);
  });

  it("preflight ready_metadata can yield sandbox_metadata_ready", () => {
    const semantic = buildFullSemantic();
    if (semantic.runtimeNoopAdapterPreflightSummary.preflightReadiness === "ready_metadata") {
      expect(semantic.runtimeAdapterSandboxSummary.sandboxReadiness).toBe("sandbox_metadata_ready");
      expect(semantic.runtimeAdapterSandboxSummary.sandboxMode).toBe("metadata_only");
    }
  });

  it("preflight blocked yields sandbox blocked", () => {
    const before = stripRuntimeNoopAdapterLayer(buildFullSemantic());
    const blocked = {
      ...before,
      runtimePilotContractSummary: {
        ...before.runtimePilotContractSummary,
        contractReadiness: "blocked" as const,
      },
    };
    const withNoop = { ...blocked, ...buildRuntimeNoopAdapterPlanningReports(blocked) };
    const sandbox = buildRuntimeAdapterSandboxPlanningReports(withNoop);
    expect(sandbox.runtimeAdapterSandboxSummary.sandboxReadiness).toBe("blocked");
  });

  it("invocationGuard always_blocked yields sandbox blocked", () => {
    const before = stripRuntimeAdapterSandboxLayer(buildFullSemantic());
    const h25 = buildRuntimeNoopAdapterPlanningReports(before);
    const withGuard = {
      ...before,
      ...h25,
      runtimeAdapterInvocationGuardReport: {
        ...h25.runtimeAdapterInvocationGuardReport,
        invocationGuard: "always_blocked" as const,
      },
      runtimeNoopAdapterSummary: {
        ...h25.runtimeNoopAdapterSummary,
        noopAdapterStatus: "blocked" as const,
        invocationGuard: "always_blocked" as const,
      },
      runtimeNoopAdapterPreflightSummary: {
        ...h25.runtimeNoopAdapterPreflightSummary,
        preflightReadiness: "blocked" as const,
      },
    };
    const sandbox = buildRuntimeAdapterSandboxPlanningReports(withGuard);
    expect(sandbox.runtimeAdapterSandboxSummary.sandboxReadiness).toBe("blocked");
  });

  it("actual flag violation yields sandbox blocked", () => {
    const before = stripRuntimeAdapterSandboxLayer(buildFullSemantic());
    const h25 = buildRuntimeNoopAdapterPlanningReports(before);
    const withViolation = {
      ...before,
      ...h25,
      runtimeNoopAdapterBoundaryViolationReport: {
        ...h25.runtimeNoopAdapterBoundaryViolationReport,
        actualFlagViolations: ["runtimeNoopAdapterResultMetadata.actualExecutionEnabled must be false"],
      },
    };
    const sandbox = buildRuntimeAdapterSandboxPlanningReports(withViolation);
    expect(sandbox.runtimeAdapterSandboxSummary.sandboxReadiness).toBe("blocked");
  });

  it("sandbox result flags are all false", () => {
    const result = buildRuntimeAdapterSandboxPlanningReports(
      stripRuntimeAdapterSandboxLayer(buildFullSemantic())
    ).runtimeAdapterSandboxResultMetadata;
    expect(result.adapterInvoked).toBe(false);
    expect(result.executionPerformed).toBe(false);
    expect(result.sandboxInvoked).toBe(false);
    expect(result.diagnosticOnly).toBe(true);
  });

  it("serializer includes sandbox fields without rebuilding", () => {
    const semantic = buildFullSemantic();
    const ser = serializeRuntimeAdapterSandboxDiagnosticBundleFromSemanticReports(semantic);
    expect(ser.runtimeAdapterSandboxSummary.mode).toBe("runtime_adapter_sandbox_summary");
    expect(ser.runtimeAdapterSandboxBlockerReport.mode).toBe("runtime_adapter_sandbox_blocker_report");
    const serAgain = serializeRuntimeAdapterSandboxDiagnosticBundleFromSemanticReports(semantic);
    expect(serAgain).toEqual(ser);
  });
});
