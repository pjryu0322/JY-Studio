import { describe, expect, it } from "vitest";

import { buildRuntimeNoopShellHardeningPlanningReports } from "@/lib/harness/runtimeNoopShellHardening/buildRuntimeNoopShellHardeningPlanningReports";
import { buildRuntimeNoopShellHardeningPreflightSummary } from "@/lib/harness/runtimeNoopShellHardening/buildRuntimeNoopShellHardeningPreflightSummary";
import { detectRuntimeNoopShellHardeningBoundaryViolations } from "@/lib/harness/runtimeNoopShellHardening/detectRuntimeNoopShellHardeningBoundaryViolations";
import { serializeRuntimeNoopShellHardeningDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeNoopShellHardening/serializeRuntimeNoopShellHardeningDiagnosticBundle";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticPlanningReportsBeforeNoopShellHardening } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  stripRuntimeNoopExecutionShellLayer,
  stripRuntimeNoopShellHardeningLayer,
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

function buildShellHardeningPlanning(
  patches: Partial<RuntimeSemanticPlanningReportsBeforeNoopShellHardening> = {}
) {
  const base = stripRuntimeNoopShellHardeningLayer(buildFullSemantic());
  return buildRuntimeNoopShellHardeningPlanningReports({ ...base, ...patches });
}

describe("H33 no-op shell hardening & contract verification", () => {
  it("full semantic includes shell hardening with all actual execution flags false", () => {
    const semantic = buildFullSemantic();
    expect(semantic.runtimeNoopShellHardeningSummary.mode).toBe("runtime_noop_shell_hardening_summary");
    expect(semantic.runtimeNoopShellHardeningSummary.actualNoopShellExecutionEnabled).toBe(false);
    expect(semantic.runtimeNoopShellHardeningSummary.actualExecutionShellExecutionEnabled).toBe(false);
    expect(semantic.runtimeNoopShellHardeningSafetyGuard.actualShellExecutionForbidden).toBe(true);
    expect(semantic.runtimeNoopShellNoExecutionResultMetadata.diagnosticOnly).toBe(true);
    expect(semantic.runtimeNoopShellNoExecutionResultMetadata.noopShellExecuted).toBe(false);
  });

  it("shell final gate ready_metadata + verified can yield hardening_metadata_ready", () => {
    const semantic = buildFullSemantic();
    if (
      semantic.runtimeNoopExecutionShellFinalSafetyGate.finalGateStatus === "ready_metadata" &&
      semantic.runtimeNoopExecutionShellFinalSafetyGate.h32EntryReadiness === "ready_metadata" &&
      semantic.runtimeNoopExecutionShellReadinessVerificationReport.verificationStatus ===
        "verified_metadata" &&
      semantic.runtimeNoopExecutionShellBoundaryViolationReport.actualFlagViolations.length === 0
    ) {
      expect(semantic.runtimeNoopShellHardeningSummary.hardeningReadiness).toBe("hardening_metadata_ready");
      expect(semantic.runtimeNoopShellHardeningSummary.hardeningMode).toBe("contract_verification_only");
    }
  });

  it("shell final gate watch yields hardening watch", () => {
    const base = stripRuntimeNoopShellHardeningLayer(buildFullSemantic());
    const hardening = buildShellHardeningPlanning({
      runtimeNoopExecutionShellFinalSafetyGate: {
        ...base.runtimeNoopExecutionShellFinalSafetyGate,
        finalGateStatus: "watch",
        h32EntryReadiness: "watch",
        blockers: [],
      },
      runtimeNoopExecutionShellSummary: {
        ...base.runtimeNoopExecutionShellSummary,
        candidateStatus: "watch",
        shellBlockers: [],
      },
      runtimeNoopExecutionShellReadinessVerificationReport: {
        ...base.runtimeNoopExecutionShellReadinessVerificationReport,
        verificationStatus: "partial",
      },
      runtimeNoopExecutionShellBlockerReport: {
        ...base.runtimeNoopExecutionShellBlockerReport,
        blockers: [],
      },
    });
    expect(hardening.runtimeNoopShellHardeningSummary.hardeningReadiness).toBe("watch");
  });

  it("shell final gate blocked yields hardening blocked", () => {
    const base = stripRuntimeNoopShellHardeningLayer(buildFullSemantic());
    const hardening = buildShellHardeningPlanning({
      runtimeNoopExecutionShellFinalSafetyGate: {
        ...base.runtimeNoopExecutionShellFinalSafetyGate,
        finalGateStatus: "blocked",
        h32EntryReadiness: "blocked",
      },
    });
    expect(hardening.runtimeNoopShellHardeningSummary.hardeningReadiness).toBe("blocked");
    expect(hardening.runtimeNoopShellHardeningPreflightSummary.preflightReadiness).toBe("blocked");
  });

  it("contract verification failed yields preflight blocked", () => {
    const hardening = buildShellHardeningPlanning();
    const preflight = buildRuntimeNoopShellHardeningPreflightSummary({
      summary: hardening.runtimeNoopShellHardeningSummary,
      contractVerification: {
        ...hardening.runtimeNoopShellHardeningContractVerificationReport,
        verificationStatus: "failed",
      },
      boundaryViolation: hardening.runtimeNoopShellHardeningBoundaryViolationReport,
      result: hardening.runtimeNoopShellNoExecutionResultMetadata,
    });
    expect(preflight.preflightReadiness).toBe("blocked");
  });

  it("boundary violation detects actualNoopShellExecutionEnabled true on summary", () => {
    const hardening = buildShellHardeningPlanning();
    const badSummary = {
      ...hardening.runtimeNoopShellHardeningSummary,
      actualNoopShellExecutionEnabled: true as unknown as false,
    };
    const violations = detectRuntimeNoopShellHardeningBoundaryViolations({
      summary: badSummary,
      inputEnvelope: hardening.runtimeNoopShellHardeningInputEnvelope,
      result: hardening.runtimeNoopShellNoExecutionResultMetadata,
      safetyGuard: hardening.runtimeNoopShellHardeningSafetyGuard,
    });
    expect(violations.actualFlagViolations.some((v) => v.includes("actualNoopShellExecutionEnabled"))).toBe(
      true
    );
  });

  it("boundary violation detects actualExecutionShellExecutionEnabled true on summary", () => {
    const hardening = buildShellHardeningPlanning();
    const badSummary = {
      ...hardening.runtimeNoopShellHardeningSummary,
      actualExecutionShellExecutionEnabled: true as unknown as false,
    };
    const violations = detectRuntimeNoopShellHardeningBoundaryViolations({
      summary: badSummary,
      inputEnvelope: hardening.runtimeNoopShellHardeningInputEnvelope,
      result: hardening.runtimeNoopShellNoExecutionResultMetadata,
      safetyGuard: hardening.runtimeNoopShellHardeningSafetyGuard,
    });
    expect(
      violations.actualFlagViolations.some((v) => v.includes("actualExecutionShellExecutionEnabled"))
    ).toBe(true);
  });

  it("boundary violation detects noopShellExecuted true on result", () => {
    const hardening = buildShellHardeningPlanning();
    const badResult = {
      ...hardening.runtimeNoopShellNoExecutionResultMetadata,
      noopShellExecuted: true as unknown as false,
    };
    const violations = detectRuntimeNoopShellHardeningBoundaryViolations({
      summary: hardening.runtimeNoopShellHardeningSummary,
      inputEnvelope: hardening.runtimeNoopShellHardeningInputEnvelope,
      result: badResult,
      safetyGuard: hardening.runtimeNoopShellHardeningSafetyGuard,
    });
    expect(violations.actualFlagViolations.some((v) => v.includes("noopShellExecuted"))).toBe(true);
  });

  it("boundary violation detects diagnosticOnly false on result", () => {
    const hardening = buildShellHardeningPlanning();
    const badResult = {
      ...hardening.runtimeNoopShellNoExecutionResultMetadata,
      diagnosticOnly: false as unknown as true,
    };
    const violations = detectRuntimeNoopShellHardeningBoundaryViolations({
      summary: hardening.runtimeNoopShellHardeningSummary,
      inputEnvelope: hardening.runtimeNoopShellHardeningInputEnvelope,
      result: badResult,
      safetyGuard: hardening.runtimeNoopShellHardeningSafetyGuard,
    });
    expect(violations.actualFlagViolations.some((v) => v.includes("diagnosticOnly"))).toBe(true);
  });

  it("serializer does not rebuild reports", () => {
    const semantic = buildFullSemantic();
    const serialized = serializeRuntimeNoopShellHardeningDiagnosticBundleFromSemanticReports(semantic);
    expect(serialized.runtimeNoopShellHardeningSummary).toEqual(
      expect.objectContaining({
        hardeningReadiness: semantic.runtimeNoopShellHardeningSummary.hardeningReadiness,
        hardeningMode: semantic.runtimeNoopShellHardeningSummary.hardeningMode,
      })
    );
    expect(serialized.runtimeNoopShellNoExecutionResultMetadata).toEqual(
      expect.objectContaining({
        diagnosticOnly: semantic.runtimeNoopShellNoExecutionResultMetadata.diagnosticOnly,
        noopShellExecuted: semantic.runtimeNoopShellNoExecutionResultMetadata.noopShellExecuted,
      })
    );
  });

  it("stripRuntimeNoopShellHardeningLayer removes H33 fields only", () => {
    const semantic = buildFullSemantic();
    const stripped = stripRuntimeNoopShellHardeningLayer(semantic);
    expect("runtimeNoopShellHardeningSummary" in stripped).toBe(false);
    expect(stripped.runtimeNoopExecutionShellSummary.mode).toBe("runtime_noop_execution_shell_summary");
  });

  it("stripRuntimeNoopExecutionShellLayer removes H31–H33 shell stack fields", () => {
    const semantic = buildFullSemantic();
    const stripped = stripRuntimeNoopExecutionShellLayer(semantic);
    expect("runtimeNoopExecutionShellSummary" in stripped).toBe(false);
    expect("runtimeNoopExecutionShellHarnessSummary" in stripped).toBe(false);
    expect("runtimeNoopShellHardeningSummary" in stripped).toBe(false);
  });
});
