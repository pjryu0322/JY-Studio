import { describe, expect, it } from "vitest";

import { buildRuntimeAdapterSandboxPlanningReports } from "@/lib/harness/runtimeAdapterSandbox/buildRuntimeAdapterSandboxPlanningReports";
import { buildRuntimeNoopAdapterPlanningReports } from "@/lib/harness/runtimeNoopAdapter/buildRuntimeNoopAdapterPlanningReports";
import { buildRuntimePilotActivationPlanningReports } from "@/lib/harness/runtimePilotActivation/buildRuntimePilotActivationPlanningReports";
import { serializeRuntimePilotActivationDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimePilotActivation/serializeRuntimePilotActivationDiagnosticBundle";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  stripRuntimeAdapterSandboxLayer,
  stripRuntimeNoopAdapterLayer,
  stripRuntimePilotActivationLayer,
} from "../runtimePlanningReportStrip";
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

describe("H27 runtime pilot activation candidate", () => {
  it("full semantic includes pilot activation with actual flags false", () => {
    const semantic = buildFullSemantic();
    expect(semantic.runtimePilotActivationSummary.actualPilotActivationEnabled).toBe(false);
    expect(semantic.runtimePilotActivationSummary.actualPilotExecutionEnabled).toBe(false);
    expect(semantic.runtimePilotActivationPolicy.actualActivationForbidden).toBe(true);
    expect(semantic.runtimePilotActivationReadinessChecklist.mode).toBe(
      "runtime_pilot_activation_readiness_checklist"
    );
  });

  it("ready sandbox preflight can yield activation_metadata_candidate", () => {
    const semantic = buildFullSemantic();
    if (
      semantic.runtimeAdapterSandboxPreflightSummary.preflightReadiness === "ready_metadata" &&
      semantic.runtimeAdapterSandboxEnvelopeVerificationReport.verificationStatus === "verified_metadata" &&
      semantic.runtimeAdapterSandboxBoundaryViolationReport.actualFlagViolations.length === 0 &&
      semantic.runtimeAdapterSandboxBlockerReport.blockers.length === 0
    ) {
      expect(semantic.runtimePilotActivationSummary.candidateStatus).toBe("activation_metadata_candidate");
      expect(semantic.runtimePilotActivationSummary.activationMode).toBe("metadata_only");
    }
  });

  it("sandbox preflight blocked yields activation blocked", () => {
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
    const activation = buildRuntimePilotActivationPlanningReports({ ...withNoop, ...sandbox });
    expect(activation.runtimePilotActivationSummary.candidateStatus).toBe("blocked");
    expect(activation.runtimePilotActivationSummary.activationMode).toBe("blocked");
  });

  it("envelope failed yields activation blocked", () => {
    const base = stripRuntimePilotActivationLayer(buildFullSemantic());
    const activation = buildRuntimePilotActivationPlanningReports({
      ...base,
      runtimeAdapterSandboxEnvelopeVerificationReport: {
        ...base.runtimeAdapterSandboxEnvelopeVerificationReport,
        verificationStatus: "failed",
      },
      runtimeAdapterSandboxPreflightSummary: {
        ...base.runtimeAdapterSandboxPreflightSummary,
        preflightReadiness: "blocked",
      },
    });
    expect(activation.runtimePilotActivationSummary.candidateStatus).toBe("blocked");
  });

  it("sandbox blocker exists yields activation blocked", () => {
    const base = stripRuntimePilotActivationLayer(buildFullSemantic());
    const activation = buildRuntimePilotActivationPlanningReports({
      ...base,
      runtimeAdapterSandboxBlockerReport: {
        ...base.runtimeAdapterSandboxBlockerReport,
        blockers: ["sandbox blocker test"],
      },
    });
    expect(activation.runtimePilotActivationSummary.candidateStatus).toBe("blocked");
    expect(activation.runtimePilotActivationBlockerReport.blockers.length).toBeGreaterThan(0);
  });

  it("serializer does not rebuild reports", () => {
    const semantic = buildFullSemantic();
    const ser = serializeRuntimePilotActivationDiagnosticBundleFromSemanticReports(semantic);
    expect(ser.runtimePilotActivationSummary.mode).toBe("runtime_pilot_activation_summary");
    expect(ser.runtimePilotActivationScope.mode).toBe("runtime_pilot_activation_scope");
    expect(ser.runtimePilotActivationPolicy.actualActivationForbidden).toBe(true);
  });

  it("stripRuntimePilotActivationLayer removes H27 fields only", () => {
    const semantic = buildFullSemantic();
    const stripped = stripRuntimePilotActivationLayer(semantic);
    expect("runtimePilotActivationSummary" in stripped).toBe(false);
    expect(stripped.runtimeAdapterSandboxSummary.mode).toBe("runtime_adapter_sandbox_summary");
  });

  it("stripRuntimeAdapterSandboxLayer removes sandbox and pilot activation", () => {
    const semantic = buildFullSemantic();
    const stripped = stripRuntimeAdapterSandboxLayer(semantic);
    expect("runtimeAdapterSandboxSummary" in stripped).toBe(false);
    expect("runtimePilotActivationSummary" in stripped).toBe(false);
  });
});
