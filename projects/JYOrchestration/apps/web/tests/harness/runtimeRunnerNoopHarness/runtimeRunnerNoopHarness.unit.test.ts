import { describe, expect, it } from "vitest";

import { buildRuntimeRunnerNoopHarnessAlignmentReport } from "@/lib/harness/runtimeRunnerNoopHarness/buildRuntimeRunnerNoopHarnessAlignmentReport";
import { buildRuntimeRunnerNoopHarnessPlanningReports } from "@/lib/harness/runtimeRunnerNoopHarness/buildRuntimeRunnerNoopHarnessPlanningReports";
import { buildRuntimeRunnerNoopHarnessPreflightSummary } from "@/lib/harness/runtimeRunnerNoopHarness/buildRuntimeRunnerNoopHarnessPreflightSummary";
import { detectRuntimeRunnerNoopHarnessBoundaryViolations } from "@/lib/harness/runtimeRunnerNoopHarness/detectRuntimeRunnerNoopHarnessBoundaryViolations";
import { verifyRuntimeRunnerNoopHarnessReadiness } from "@/lib/harness/runtimeRunnerNoopHarness/verifyRuntimeRunnerNoopHarnessReadiness";
import { serializeRuntimeRunnerNoopHarnessDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeRunnerNoopHarness/serializeRuntimeRunnerNoopHarnessDiagnosticBundle";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticPlanningReportsBeforeRunnerNoopHarness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  stripRuntimeRunnerInvocationLayer,
  stripRuntimeRunnerNoopHarnessLayer,
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

/** H30 layer tests: runner invocation reports are patched in-place (noop harness builder references upstream only). */
function buildRunnerNoopHarnessPlanning(
  patches: Partial<RuntimeSemanticPlanningReportsBeforeRunnerNoopHarness> = {}
) {
  const base = stripRuntimeRunnerNoopHarnessLayer(buildFullSemantic());
  return buildRuntimeRunnerNoopHarnessPlanningReports({ ...base, ...patches });
}

describe("H30 isolated dry-run runner no-op harness", () => {
  it("full semantic includes no-op harness with all actual invocation flags false", () => {
    const semantic = buildFullSemantic();
    expect(semantic.runtimeRunnerNoopHarnessSummary.mode).toBe("runtime_runner_noop_harness_summary");
    expect(semantic.runtimeRunnerNoopHarnessSummary.actualIsolatedRunnerInvocationEnabled).toBe(false);
    expect(semantic.runtimeRunnerNoopHarnessSummary.actualDryRunRunnerExecutionEnabled).toBe(false);
    expect(semantic.runtimeRunnerNoopResultMetadata.diagnosticOnly).toBe(true);
    expect(semantic.runtimeRunnerNoopResultMetadata.isolatedRunnerInvoked).toBe(false);
    expect(semantic.runtimeRunnerNoopHarnessSafetyGuard.actualInvocationForbidden).toBe(true);
  });

  it("final gate ready_metadata + verified invocation can yield noop_harness_metadata_ready", () => {
    const semantic = buildFullSemantic();
    if (
      semantic.runtimeRunnerInvocationFinalSafetyGate.finalGateStatus === "ready_metadata" &&
      semantic.runtimeRunnerInvocationFinalSafetyGate.h30EntryReadiness === "ready_metadata" &&
      semantic.runtimeRunnerInvocationReadinessVerificationReport.verificationStatus === "verified_metadata" &&
      semantic.runtimeRunnerInvocationBoundaryViolationReport.actualFlagViolations.length === 0
    ) {
      expect(semantic.runtimeRunnerNoopHarnessSummary.harnessReadiness).toBe("noop_harness_metadata_ready");
      expect(semantic.runtimeRunnerNoopHarnessSummary.harnessMode).toBe("noop_contract_only");
    }
  });

  it("final gate watch yields harness watch", () => {
    const base = stripRuntimeRunnerNoopHarnessLayer(buildFullSemantic());
    const harness = buildRunnerNoopHarnessPlanning({
      runtimeRunnerInvocationFinalSafetyGate: {
        ...base.runtimeRunnerInvocationFinalSafetyGate,
        finalGateStatus: "watch",
        h30EntryReadiness: "watch",
        blockers: [],
      },
      runtimeRunnerInvocationBlockerReport: {
        ...base.runtimeRunnerInvocationBlockerReport,
        blockers: [],
      },
      runtimeRunnerInvocationBoundaryViolationReport: {
        ...base.runtimeRunnerInvocationBoundaryViolationReport,
        actualFlagViolations: [],
        wordingRiskFindings: ["wording risk"],
      },
      runtimeRunnerInvocationReadinessVerificationReport: {
        ...base.runtimeRunnerInvocationReadinessVerificationReport,
        verificationStatus: "partial",
      },
    });
    expect(harness.runtimeRunnerNoopHarnessSummary.harnessReadiness).toBe("watch");
    expect(harness.runtimeRunnerNoopHarnessSummary.harnessMode).toBe("disabled");
  });

  it("final gate blocked yields harness blocked", () => {
    const base = stripRuntimeRunnerNoopHarnessLayer(buildFullSemantic());
    const harness = buildRunnerNoopHarnessPlanning({
      runtimeRunnerInvocationFinalSafetyGate: {
        ...base.runtimeRunnerInvocationFinalSafetyGate,
        finalGateStatus: "blocked",
        h30EntryReadiness: "blocked",
      },
    });
    expect(harness.runtimeRunnerNoopHarnessSummary.harnessReadiness).toBe("blocked");
    expect(harness.runtimeRunnerNoopHarnessSummary.harnessMode).toBe("blocked");
  });

  it("boundary violation detects actualIsolatedRunnerInvocationEnabled true on summary", () => {
    const harness = buildRunnerNoopHarnessPlanning();
    const badSummary = {
      ...harness.runtimeRunnerNoopHarnessSummary,
      actualIsolatedRunnerInvocationEnabled: true as unknown as false,
    };
    const violations = detectRuntimeRunnerNoopHarnessBoundaryViolations({
      summary: badSummary,
      envelope: harness.runtimeRunnerNoopInvocationEnvelope,
      result: harness.runtimeRunnerNoopResultMetadata,
      safetyGuard: harness.runtimeRunnerNoopHarnessSafetyGuard,
    });
    expect(
      violations.actualFlagViolations.some((v) => v.includes("actualIsolatedRunnerInvocationEnabled"))
    ).toBe(true);
  });

  it("boundary violation detects dryRunRunnerExecuted true on result", () => {
    const harness = buildRunnerNoopHarnessPlanning();
    const badResult = {
      ...harness.runtimeRunnerNoopResultMetadata,
      dryRunRunnerExecuted: true as unknown as false,
    };
    const violations = detectRuntimeRunnerNoopHarnessBoundaryViolations({
      summary: harness.runtimeRunnerNoopHarnessSummary,
      envelope: harness.runtimeRunnerNoopInvocationEnvelope,
      result: badResult,
      safetyGuard: harness.runtimeRunnerNoopHarnessSafetyGuard,
    });
    expect(violations.actualFlagViolations.some((v) => v.includes("dryRunRunnerExecuted"))).toBe(true);
  });

  it("boundary violation detects isolatedRunnerInvoked true on result", () => {
    const harness = buildRunnerNoopHarnessPlanning();
    const badResult = {
      ...harness.runtimeRunnerNoopResultMetadata,
      isolatedRunnerInvoked: true as unknown as false,
    };
    const violations = detectRuntimeRunnerNoopHarnessBoundaryViolations({
      summary: harness.runtimeRunnerNoopHarnessSummary,
      envelope: harness.runtimeRunnerNoopInvocationEnvelope,
      result: badResult,
      safetyGuard: harness.runtimeRunnerNoopHarnessSafetyGuard,
    });
    expect(violations.actualFlagViolations.some((v) => v.includes("isolatedRunnerInvoked"))).toBe(true);
  });

  it("boundary violation detects diagnosticOnly false on result", () => {
    const harness = buildRunnerNoopHarnessPlanning();
    const badResult = {
      ...harness.runtimeRunnerNoopResultMetadata,
      diagnosticOnly: false as unknown as true,
    };
    const violations = detectRuntimeRunnerNoopHarnessBoundaryViolations({
      summary: harness.runtimeRunnerNoopHarnessSummary,
      envelope: harness.runtimeRunnerNoopInvocationEnvelope,
      result: badResult,
      safetyGuard: harness.runtimeRunnerNoopHarnessSafetyGuard,
    });
    expect(violations.actualFlagViolations.some((v) => v.includes("diagnosticOnly"))).toBe(true);
  });

  it("contract verification failed yields preflight blocked", () => {
    const harness = buildRunnerNoopHarnessPlanning();
    const preflight = buildRuntimeRunnerNoopHarnessPreflightSummary({
      summary: harness.runtimeRunnerNoopHarnessSummary,
      contractVerification: {
        ...harness.runtimeRunnerNoopHarnessContractVerificationReport,
        verificationStatus: "failed",
      },
      boundaryViolation: harness.runtimeRunnerNoopHarnessBoundaryViolationReport,
      result: harness.runtimeRunnerNoopResultMetadata,
    });
    expect(preflight.preflightReadiness).toBe("blocked");
  });

  it("serializer does not rebuild reports", () => {
    const semantic = buildFullSemantic();
    const ser = serializeRuntimeRunnerNoopHarnessDiagnosticBundleFromSemanticReports(semantic);
    expect(ser.runtimeRunnerNoopHarnessSummary.mode).toBe("runtime_runner_noop_harness_summary");
    expect(ser.runtimeRunnerNoopInvocationEnvelope.mode).toBe("runtime_runner_noop_invocation_envelope");
    expect(ser.runtimeRunnerNoopResultMetadata.diagnosticOnly).toBe(true);
    expect(ser.runtimeRunnerNoopHarnessSafetyGuard.actualInvocationForbidden).toBe(true);
    expect(ser.runtimeRunnerNoopHarnessContractVerificationReport.mode).toBe(
      "runtime_runner_noop_harness_contract_verification_report"
    );
    expect(ser.runtimeRunnerNoopHarnessBoundaryViolationReport.mode).toBe(
      "runtime_runner_noop_harness_boundary_violation_report"
    );
    expect(ser.runtimeRunnerNoopHarnessPreflightSummary.mode).toBe("runtime_runner_noop_harness_preflight_summary");
    expect(ser.runtimeRunnerNoopHarnessReadinessVerificationReport.mode).toBe(
      "runtime_runner_noop_harness_readiness_verification_report"
    );
    expect(ser.runtimeRunnerNoopHarnessAlignmentReport.mode).toBe("runtime_runner_noop_harness_alignment_report");
    expect(ser.runtimeRunnerNoopHarnessFinalSafetyGate.mode).toBe("runtime_runner_noop_harness_final_safety_gate");
  });

  it("stripRuntimeRunnerNoopHarnessLayer removes H30 and H30.5 fields only", () => {
    const semantic = buildFullSemantic();
    const stripped = stripRuntimeRunnerNoopHarnessLayer(semantic);
    expect("runtimeRunnerNoopHarnessSummary" in stripped).toBe(false);
    expect("runtimeRunnerNoopHarnessFinalSafetyGate" in stripped).toBe(false);
    expect(stripped.runtimeRunnerInvocationSummary.mode).toBe("runtime_runner_invocation_summary");
  });

  it("stripRuntimeRunnerInvocationLayer removes H29 fields only", () => {
    const semantic = buildFullSemantic();
    const stripped = stripRuntimeRunnerInvocationLayer(semantic);
    expect("runtimeRunnerInvocationSummary" in stripped).toBe(false);
    expect("runtimeRunnerNoopHarnessSummary" in stripped).toBe(true);
    expect(stripped.runtimePilotSkeletonPreflightSummary.mode).toBe("runtime_pilot_skeleton_preflight_summary");
  });
});

describe("H30.5 runner no-op harness stabilization & final safety gate", () => {
  it("full semantic includes H30.5 reports", () => {
    const semantic = buildFullSemantic();
    expect(semantic.runtimeRunnerNoopHarnessFinalSafetyGate.mode).toBe(
      "runtime_runner_noop_harness_final_safety_gate"
    );
    expect(semantic.runtimeRunnerNoopHarnessReadinessVerificationReport.mode).toBe(
      "runtime_runner_noop_harness_readiness_verification_report"
    );
    expect(semantic.runtimeRunnerNoopHarnessAlignmentReport.mode).toBe("runtime_runner_noop_harness_alignment_report");
  });

  it("preflight ready_metadata with verified readiness and aligned report can yield final gate ready_metadata", () => {
    const semantic = buildFullSemantic();
    if (
      semantic.runtimeRunnerNoopHarnessPreflightSummary.preflightReadiness === "ready_metadata" &&
      semantic.runtimeRunnerNoopHarnessReadinessVerificationReport.verificationStatus === "verified_metadata" &&
      semantic.runtimeRunnerNoopHarnessAlignmentReport.alignmentStatus === "aligned_metadata" &&
      semantic.runtimeRunnerNoopHarnessContractVerificationReport.verificationStatus === "verified_metadata" &&
      semantic.runtimeRunnerNoopHarnessBoundaryViolationReport.actualFlagViolations.length === 0
    ) {
      expect(semantic.runtimeRunnerNoopHarnessFinalSafetyGate.finalGateStatus).toBe("ready_metadata");
      expect(semantic.runtimeRunnerNoopHarnessFinalSafetyGate.h31EntryReadiness).toBe("ready_metadata");
    }
  });

  it("preflight watch yields final gate watch", () => {
    const base = stripRuntimeRunnerNoopHarnessLayer(buildFullSemantic());
    const harness = buildRunnerNoopHarnessPlanning({
      runtimeRunnerInvocationFinalSafetyGate: {
        ...base.runtimeRunnerInvocationFinalSafetyGate,
        finalGateStatus: "watch",
        h30EntryReadiness: "watch",
        blockers: [],
      },
      runtimeRunnerInvocationBlockerReport: {
        ...base.runtimeRunnerInvocationBlockerReport,
        blockers: [],
      },
      runtimeRunnerInvocationBoundaryViolationReport: {
        ...base.runtimeRunnerInvocationBoundaryViolationReport,
        actualFlagViolations: [],
        wordingRiskFindings: ["wording risk"],
      },
      runtimeRunnerInvocationReadinessVerificationReport: {
        ...base.runtimeRunnerInvocationReadinessVerificationReport,
        verificationStatus: "partial",
      },
    });
    expect(harness.runtimeRunnerNoopHarnessPreflightSummary.preflightReadiness).toBe("watch");
    expect(harness.runtimeRunnerNoopHarnessFinalSafetyGate.finalGateStatus).toBe("watch");
  });

  it("preflight blocked yields final gate blocked", () => {
    const base = stripRuntimeRunnerNoopHarnessLayer(buildFullSemantic());
    const harness = buildRunnerNoopHarnessPlanning({
      runtimeRunnerInvocationFinalSafetyGate: {
        ...base.runtimeRunnerInvocationFinalSafetyGate,
        finalGateStatus: "blocked",
        h30EntryReadiness: "blocked",
      },
    });
    expect(harness.runtimeRunnerNoopHarnessPreflightSummary.preflightReadiness).toBe("blocked");
    expect(harness.runtimeRunnerNoopHarnessFinalSafetyGate.finalGateStatus).toBe("blocked");
  });

  it("contract failed yields readiness verification failed", () => {
    const harness = buildRunnerNoopHarnessPlanning();
    const readiness = verifyRuntimeRunnerNoopHarnessReadiness({
      summary: harness.runtimeRunnerNoopHarnessSummary,
      preflight: {
        ...harness.runtimeRunnerNoopHarnessPreflightSummary,
        preflightReadiness: "ready_metadata",
        blockers: [],
      },
      contractVerification: {
        ...harness.runtimeRunnerNoopHarnessContractVerificationReport,
        verificationStatus: "failed",
      },
      boundaryViolation: harness.runtimeRunnerNoopHarnessBoundaryViolationReport,
      result: harness.runtimeRunnerNoopResultMetadata,
      safetyGuard: harness.runtimeRunnerNoopHarnessSafetyGuard,
    });
    expect(readiness.verificationStatus).toBe("failed");
  });

  it("alignment failed when diagnosticOnly false", () => {
    const harness = buildRunnerNoopHarnessPlanning();
    const badResult = {
      ...harness.runtimeRunnerNoopResultMetadata,
      diagnosticOnly: false as unknown as true,
    };
    const alignment = buildRuntimeRunnerNoopHarnessAlignmentReport({
      envelope: harness.runtimeRunnerNoopInvocationEnvelope,
      result: badResult,
      safetyGuard: harness.runtimeRunnerNoopHarnessSafetyGuard,
      contractVerification: harness.runtimeRunnerNoopHarnessContractVerificationReport,
      boundaryViolation: harness.runtimeRunnerNoopHarnessBoundaryViolationReport,
      preflight: harness.runtimeRunnerNoopHarnessPreflightSummary,
    });
    expect(alignment.alignmentStatus).toBe("failed");
  });

  it("alignment failed when promptMutated true", () => {
    const harness = buildRunnerNoopHarnessPlanning();
    const badResult = {
      ...harness.runtimeRunnerNoopResultMetadata,
      promptMutated: true as unknown as false,
    };
    const alignment = buildRuntimeRunnerNoopHarnessAlignmentReport({
      envelope: harness.runtimeRunnerNoopInvocationEnvelope,
      result: badResult,
      safetyGuard: harness.runtimeRunnerNoopHarnessSafetyGuard,
      contractVerification: harness.runtimeRunnerNoopHarnessContractVerificationReport,
      boundaryViolation: harness.runtimeRunnerNoopHarnessBoundaryViolationReport,
      preflight: harness.runtimeRunnerNoopHarnessPreflightSummary,
    });
    expect(alignment.alignmentStatus).toBe("failed");
  });

  it("actualFlagViolations yield final gate blocked", () => {
    const harness = buildRunnerNoopHarnessPlanning();
    const badSummary = {
      ...harness.runtimeRunnerNoopHarnessSummary,
      actualIsolatedRunnerInvocationEnabled: true as unknown as false,
    };
    const boundary = detectRuntimeRunnerNoopHarnessBoundaryViolations({
      summary: badSummary,
      envelope: harness.runtimeRunnerNoopInvocationEnvelope,
      result: harness.runtimeRunnerNoopResultMetadata,
      safetyGuard: harness.runtimeRunnerNoopHarnessSafetyGuard,
    });
    expect(boundary.actualFlagViolations.length).toBeGreaterThan(0);
    const harnessWithViolation = buildRunnerNoopHarnessPlanning();
    if (harnessWithViolation.runtimeRunnerNoopHarnessBoundaryViolationReport.actualFlagViolations.length > 0) {
      expect(harnessWithViolation.runtimeRunnerNoopHarnessFinalSafetyGate.finalGateStatus).toBe("blocked");
    }
  });
});
