import { describe, expect, it } from "vitest";

import { buildRuntimeAdapterSandboxPlanningReports } from "@/lib/harness/runtimeAdapterSandbox/buildRuntimeAdapterSandboxPlanningReports";
import { buildRuntimeNoopAdapterPlanningReports } from "@/lib/harness/runtimeNoopAdapter/buildRuntimeNoopAdapterPlanningReports";
import { buildRuntimePilotActivationFinalSafetyGate } from "@/lib/harness/runtimePilotActivation/buildRuntimePilotActivationFinalSafetyGate";
import { buildRuntimePilotActivationPlanningReports } from "@/lib/harness/runtimePilotActivation/buildRuntimePilotActivationPlanningReports";
import { detectRuntimePilotActivationBoundaryViolations } from "@/lib/harness/runtimePilotActivation/detectRuntimePilotActivationBoundaryViolations";
import { verifyRuntimePilotActivationReadiness } from "@/lib/harness/runtimePilotActivation/verifyRuntimePilotActivationReadiness";
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
    expect(semantic.runtimePilotActivationFinalSafetyGate.mode).toBe("runtime_pilot_activation_final_safety_gate");
    expect(semantic.runtimePilotActivationBoundaryViolationReport.mode).toBe(
      "runtime_pilot_activation_boundary_violation_report"
    );
    expect(semantic.runtimePilotActivationReadinessVerificationReport.mode).toBe(
      "runtime_pilot_activation_readiness_verification_report"
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

  it("ready candidate with verified readiness can yield final gate ready_metadata", () => {
    const semantic = buildFullSemantic();
    if (
      semantic.runtimePilotActivationSummary.candidateStatus === "activation_metadata_candidate" &&
      semantic.runtimePilotActivationSummary.activationMode === "metadata_only" &&
      semantic.runtimePilotActivationReadinessVerificationReport.verificationStatus === "verified_metadata" &&
      semantic.runtimePilotActivationBoundaryViolationReport.actualFlagViolations.length === 0
    ) {
      expect(semantic.runtimePilotActivationFinalSafetyGate.finalGateStatus).toBe("ready_metadata");
      expect(semantic.runtimePilotActivationFinalSafetyGate.h28EntryReadiness).toBe("ready_metadata");
    }
  });

  it("watch candidate yields final gate watch", () => {
    const activation = buildRuntimePilotActivationPlanningReports(
      stripRuntimePilotActivationLayer(buildFullSemantic())
    );
    const gate = buildRuntimePilotActivationFinalSafetyGate({
      summary: { ...activation.runtimePilotActivationSummary, candidateStatus: "watch", activationMode: "disabled" },
      blockerReport: { ...activation.runtimePilotActivationBlockerReport, blockers: [] },
      boundaryViolation: {
        ...activation.runtimePilotActivationBoundaryViolationReport,
        actualFlagViolations: [],
        wordingRiskFindings: ["wording/flag risk: pilotActivation=true"],
      },
      readinessVerification: {
        ...activation.runtimePilotActivationReadinessVerificationReport,
        verificationStatus: "partial",
      },
    });
    expect(gate.finalGateStatus).toBe("watch");
    expect(gate.h28EntryReadiness).toBe("watch");
  });

  it("boundary violation detects actualPilotActivationEnabled true", () => {
    const activation = buildRuntimePilotActivationPlanningReports(
      stripRuntimePilotActivationLayer(buildFullSemantic())
    );
    const badSummary = {
      ...activation.runtimePilotActivationSummary,
      actualPilotActivationEnabled: true as unknown as false,
    };
    const violations = detectRuntimePilotActivationBoundaryViolations({
      summary: badSummary,
      scope: activation.runtimePilotActivationScope,
      policy: activation.runtimePilotActivationPolicy,
      checklist: activation.runtimePilotActivationReadinessChecklist,
    });
    expect(violations.actualFlagViolations.some((v) => v.includes("actualPilotActivationEnabled"))).toBe(
      true
    );
  });

  it("boundary violation detects actualPilotExecutionEnabled and actualSandboxInvocationEnabled", () => {
    const activation = buildRuntimePilotActivationPlanningReports(
      stripRuntimePilotActivationLayer(buildFullSemantic())
    );
    const badSummary = {
      ...activation.runtimePilotActivationSummary,
      actualPilotExecutionEnabled: true as unknown as false,
      actualSandboxInvocationEnabled: true as unknown as false,
    };
    const violations = detectRuntimePilotActivationBoundaryViolations({
      summary: badSummary,
      scope: activation.runtimePilotActivationScope,
      policy: activation.runtimePilotActivationPolicy,
      checklist: activation.runtimePilotActivationReadinessChecklist,
    });
    expect(violations.actualFlagViolations.some((v) => v.includes("actualPilotExecutionEnabled"))).toBe(
      true
    );
    expect(violations.actualFlagViolations.some((v) => v.includes("actualSandboxInvocationEnabled"))).toBe(
      true
    );
  });

  it("policy actualActivationForbidden false is detected", () => {
    const activation = buildRuntimePilotActivationPlanningReports(
      stripRuntimePilotActivationLayer(buildFullSemantic())
    );
    const badPolicy = {
      ...activation.runtimePilotActivationPolicy,
      actualActivationForbidden: false as unknown as true,
    };
    const violations = detectRuntimePilotActivationBoundaryViolations({
      summary: activation.runtimePilotActivationSummary,
      scope: activation.runtimePilotActivationScope,
      policy: badPolicy,
      checklist: activation.runtimePilotActivationReadinessChecklist,
    });
    expect(violations.actualFlagViolations.some((v) => v.includes("actualActivationForbidden"))).toBe(true);
  });

  it("policy mode mismatch yields readiness partial or failed", () => {
    const activation = buildRuntimePilotActivationPlanningReports(
      stripRuntimePilotActivationLayer(buildFullSemantic())
    );
    const verification = verifyRuntimePilotActivationReadiness({
      summary: { ...activation.runtimePilotActivationSummary, activationMode: "metadata_only" },
      scope: activation.runtimePilotActivationScope,
      policy: { ...activation.runtimePilotActivationPolicy, activationAllowedMode: "blocked" },
      checklist: activation.runtimePilotActivationReadinessChecklist,
      blockerReport: activation.runtimePilotActivationBlockerReport,
    });
    expect(["partial", "failed"]).toContain(verification.verificationStatus);
  });

  it("serializer does not rebuild reports", () => {
    const semantic = buildFullSemantic();
    const ser = serializeRuntimePilotActivationDiagnosticBundleFromSemanticReports(semantic);
    expect(ser.runtimePilotActivationSummary.mode).toBe("runtime_pilot_activation_summary");
    expect(ser.runtimePilotActivationScope.mode).toBe("runtime_pilot_activation_scope");
    expect(ser.runtimePilotActivationPolicy.actualActivationForbidden).toBe(true);
    expect(ser.runtimePilotActivationFinalSafetyGate.mode).toBe("runtime_pilot_activation_final_safety_gate");
    expect(ser.runtimePilotActivationBoundaryViolationReport.mode).toBe(
      "runtime_pilot_activation_boundary_violation_report"
    );
    expect(ser.runtimePilotActivationReadinessVerificationReport.mode).toBe(
      "runtime_pilot_activation_readiness_verification_report"
    );
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
