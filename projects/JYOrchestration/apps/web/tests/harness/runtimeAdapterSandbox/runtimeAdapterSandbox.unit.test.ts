import { describe, expect, it } from "vitest";

import { buildRuntimeAdapterSandboxPlanningReports } from "@/lib/harness/runtimeAdapterSandbox/buildRuntimeAdapterSandboxPlanningReports";
import { buildRuntimeAdapterSandboxPreflightSummary } from "@/lib/harness/runtimeAdapterSandbox/buildRuntimeAdapterSandboxPreflightSummary";
import { buildRuntimeAdapterSandboxResultMetadata } from "@/lib/harness/runtimeAdapterSandbox/buildRuntimeAdapterSandboxResultMetadata";
import { detectRuntimeAdapterSandboxBoundaryViolations } from "@/lib/harness/runtimeAdapterSandbox/detectRuntimeAdapterSandboxBoundaryViolations";
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

describe("H26 / H26.5 runtime adapter sandbox", () => {
  it("full semantic includes sandbox with actualSandboxInvocationEnabled false", () => {
    const semantic = buildFullSemantic();
    expect(semantic.runtimeAdapterSandboxSummary.actualSandboxInvocationEnabled).toBe(false);
    expect(semantic.runtimeAdapterSandboxResultMetadata.sandboxInvoked).toBe(false);
    expect(semantic.runtimeAdapterSandboxResultMetadata.diagnosticOnly).toBe(true);
    expect(semantic.runtimeAdapterSandboxEnvelopeVerificationReport.mode).toBe(
      "runtime_adapter_sandbox_envelope_verification_report"
    );
    expect(semantic.runtimeAdapterSandboxPreflightSummary.mode).toBe("runtime_adapter_sandbox_preflight_summary");
  });

  it("preflight ready_metadata can yield sandbox_metadata_ready and sandbox preflight", () => {
    const semantic = buildFullSemantic();
    if (semantic.runtimeNoopAdapterPreflightSummary.preflightReadiness === "ready_metadata") {
      expect(semantic.runtimeAdapterSandboxSummary.sandboxReadiness).toBe("sandbox_metadata_ready");
      if (
        semantic.runtimeAdapterSandboxEnvelopeVerificationReport.verificationStatus ===
          "verified_metadata" &&
        semantic.runtimeAdapterSandboxBoundaryViolationReport.actualFlagViolations.length === 0
      ) {
        expect(semantic.runtimeAdapterSandboxPreflightSummary.preflightReadiness).toBe("ready_metadata");
      }
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
    expect(sandbox.runtimeAdapterSandboxPreflightSummary.preflightReadiness).toBe("blocked");
  });

  it("boundary violation detects actualSandboxInvocationEnabled and sandboxInvoked", () => {
    const base = buildRuntimeAdapterSandboxPlanningReports(
      stripRuntimeAdapterSandboxLayer(buildFullSemantic())
    );
    const badSandbox = {
      ...base.runtimeAdapterSandboxResultMetadata,
      actualSandboxInvocationEnabled: true as unknown as false,
      sandboxInvoked: true as unknown as false,
    };
    const violations = detectRuntimeAdapterSandboxBoundaryViolations({
      inputEnvelope: base.runtimeAdapterSandboxInputEnvelope,
      outputEnvelope: base.runtimeAdapterSandboxOutputEnvelope,
      policy: base.runtimeAdapterSandboxPolicy,
      result: badSandbox,
    });
    expect(violations.actualFlagViolations.some((v) => v.includes("actualSandboxInvocationEnabled"))).toBe(
      true
    );
    expect(violations.actualFlagViolations.some((v) => v.includes("sandboxInvoked"))).toBe(true);
  });

  it("boundary violation detects adapterInvoked executionPerformed rollbackPerformed diagnosticOnly false", () => {
    const base = buildRuntimeAdapterSandboxPlanningReports(
      stripRuntimeAdapterSandboxLayer(buildFullSemantic())
    );
    const bad = {
      ...base.runtimeAdapterSandboxResultMetadata,
      adapterInvoked: true as unknown as false,
      executionPerformed: true as unknown as false,
      providerRoutingPerformed: true as unknown as false,
      queueControlPerformed: true as unknown as false,
      rollbackPerformed: true as unknown as false,
      diagnosticOnly: false as unknown as true,
    };
    const violations = detectRuntimeAdapterSandboxBoundaryViolations({
      inputEnvelope: base.runtimeAdapterSandboxInputEnvelope,
      outputEnvelope: base.runtimeAdapterSandboxOutputEnvelope,
      policy: base.runtimeAdapterSandboxPolicy,
      result: bad,
    });
    expect(violations.actualFlagViolations.some((v) => v.includes("adapterInvoked"))).toBe(true);
    expect(violations.actualFlagViolations.some((v) => v.includes("executionPerformed"))).toBe(true);
    expect(violations.actualFlagViolations.some((v) => v.includes("rollbackPerformed"))).toBe(true);
    expect(violations.actualFlagViolations.some((v) => v.includes("diagnosticOnly"))).toBe(true);
  });

  it("envelope verification failed forces sandbox blocked", () => {
    const before = stripRuntimeAdapterSandboxLayer(buildFullSemantic());
    const h25 = buildRuntimeNoopAdapterPlanningReports(before);
    const withNoop = { ...before, ...h25 };
    const sandbox = buildRuntimeAdapterSandboxPlanningReports(withNoop);
    const failedVerification = {
      ...sandbox.runtimeAdapterSandboxEnvelopeVerificationReport,
      verificationStatus: "failed" as const,
    };
    const pf = buildRuntimeAdapterSandboxPreflightSummary({
      summary: { ...sandbox.runtimeAdapterSandboxSummary, sandboxReadiness: "blocked" },
      envelopeVerification: failedVerification,
      boundaryViolation: sandbox.runtimeAdapterSandboxBoundaryViolationReport,
      blockerReport: sandbox.runtimeAdapterSandboxBlockerReport,
    });
    expect(pf.preflightReadiness).toBe("blocked");
  });

  it("partial envelope yields preflight watch", () => {
    const before = stripRuntimeAdapterSandboxLayer(buildFullSemantic());
    const sandbox = buildRuntimeAdapterSandboxPlanningReports(before);
    const pf = buildRuntimeAdapterSandboxPreflightSummary({
      summary: { ...sandbox.runtimeAdapterSandboxSummary, sandboxReadiness: "watch" },
      envelopeVerification: {
        ...sandbox.runtimeAdapterSandboxEnvelopeVerificationReport,
        verificationStatus: "partial",
      },
      boundaryViolation: {
        ...sandbox.runtimeAdapterSandboxBoundaryViolationReport,
        actualFlagViolations: [],
        wordingRiskFindings: ["wording/flag risk: sandboxInvoked=true"],
      },
      blockerReport: { ...sandbox.runtimeAdapterSandboxBlockerReport, blockers: [] },
    });
    expect(pf.preflightReadiness).toBe("watch");
  });

  it("sandbox result flags are all false from builder", () => {
    const result = buildRuntimeAdapterSandboxResultMetadata();
    expect(result.sandboxInvoked).toBe(false);
    expect(result.adapterInvoked).toBe(false);
    expect(result.diagnosticOnly).toBe(true);
  });

  it("serializer includes H26.5 fields", () => {
    const semantic = buildFullSemantic();
    const ser = serializeRuntimeAdapterSandboxDiagnosticBundleFromSemanticReports(semantic);
    expect(ser.runtimeAdapterSandboxEnvelopeVerificationReport.mode).toBe(
      "runtime_adapter_sandbox_envelope_verification_report"
    );
    expect(ser.runtimeAdapterSandboxBoundaryViolationReport.mode).toBe(
      "runtime_adapter_sandbox_boundary_violation_report"
    );
    expect(ser.runtimeAdapterSandboxPreflightSummary.mode).toBe("runtime_adapter_sandbox_preflight_summary");
  });
});
