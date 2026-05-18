import { describe, expect, it } from "vitest";

import { buildRuntimeNoopExecutionShellHarnessPlanningReports } from "@/lib/harness/runtimeNoopExecutionShellHarness/buildRuntimeNoopExecutionShellHarnessPlanningReports";
import { buildRuntimeNoopExecutionShellHarnessPreflightSummary } from "@/lib/harness/runtimeNoopExecutionShellHarness/buildRuntimeNoopExecutionShellHarnessPreflightSummary";
import { serializeRuntimeNoopExecutionShellHarnessDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeNoopExecutionShellHarness/serializeRuntimeNoopExecutionShellHarnessDiagnosticBundle";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticPlanningReportsBeforeNoopExecutionShellHarness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  stripRuntimeNoopExecutionShellHarnessLayer,
  stripRuntimeNoopExecutionShellLayer,
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

function buildShellHarnessPlanning(
  patches: Partial<RuntimeSemanticPlanningReportsBeforeNoopExecutionShellHarness> = {}
) {
  const base = stripRuntimeNoopExecutionShellHarnessLayer(buildFullSemantic());
  return buildRuntimeNoopExecutionShellHarnessPlanningReports({ ...base, ...patches });
}

function withHarnessUpstreamWatchBaseline(
  base: RuntimeSemanticPlanningReportsBeforeNoopExecutionShellHarness,
  extra: Partial<RuntimeSemanticPlanningReportsBeforeNoopExecutionShellHarness> = {}
): Partial<RuntimeSemanticPlanningReportsBeforeNoopExecutionShellHarness> {
  return {
    runtimeRunnerNoopHarnessSummary: {
      ...base.runtimeRunnerNoopHarnessSummary,
      harnessBlockers: [],
    },
    runtimeRunnerNoopHarnessFinalSafetyGate: {
      ...base.runtimeRunnerNoopHarnessFinalSafetyGate,
      finalGateStatus: "watch",
      h31EntryReadiness: "watch",
      blockers: [],
    },
    runtimeRunnerNoopHarnessBoundaryViolationReport: {
      ...base.runtimeRunnerNoopHarnessBoundaryViolationReport,
      actualFlagViolations: [],
    },
    runtimeOperatorApprovalSummary: {
      ...base.runtimeOperatorApprovalSummary,
      approvalReadiness: "ready_for_review_metadata",
    },
    runtimeRollbackReadinessSummary: {
      ...base.runtimeRollbackReadinessSummary,
      rollbackReadiness: "metadata_ready",
    },
    runtimeAuditReadinessSummary: {
      ...base.runtimeAuditReadinessSummary,
      auditReadiness: "sufficient_metadata",
    },
    runtimeControlBoundarySummary: {
      ...base.runtimeControlBoundarySummary,
      boundaryRisk: "watch",
    },
    ...extra,
  };
}

describe("H32 controlled no-op execution shell harness", () => {
  it("full semantic includes harness with all actual execution flags false", () => {
    const semantic = buildFullSemantic();
    expect(semantic.runtimeNoopExecutionShellHarnessSummary.mode).toBe(
      "runtime_noop_execution_shell_harness_summary"
    );
    expect(semantic.runtimeNoopExecutionShellHarnessSummary.actualNoopShellExecutionEnabled).toBe(false);
    expect(semantic.runtimeNoopExecutionShellHarnessSummary.actualExecutionShellExecutionEnabled).toBe(false);
    expect(semantic.runtimeNoopExecutionShellNoopResultMetadata.diagnosticOnly).toBe(true);
    expect(semantic.runtimeNoopExecutionShellNoopResultMetadata.noopShellExecuted).toBe(false);
    expect(semantic.runtimeNoopExecutionShellNoopResultMetadata.tokenEnforced).toBe(false);
    expect(semantic.runtimeNoopExecutionShellNoopResultMetadata.contextPruned).toBe(false);
    expect(semantic.runtimeNoopExecutionShellHarnessSafetyGuard.actualShellExecutionForbidden).toBe(true);
  });

  it("shell final gate ready_metadata + verified + no violations can yield shell_harness_metadata_ready", () => {
    const semantic = buildFullSemantic();
    if (
      semantic.runtimeNoopExecutionShellFinalSafetyGate.finalGateStatus === "ready_metadata" &&
      semantic.runtimeNoopExecutionShellFinalSafetyGate.h32EntryReadiness === "ready_metadata" &&
      semantic.runtimeNoopExecutionShellReadinessVerificationReport.verificationStatus ===
        "verified_metadata" &&
      semantic.runtimeNoopExecutionShellBoundaryViolationReport.actualFlagViolations.length === 0
    ) {
      expect(semantic.runtimeNoopExecutionShellHarnessSummary.harnessReadiness).toBe(
        "shell_harness_metadata_ready"
      );
      expect(semantic.runtimeNoopExecutionShellHarnessSummary.harnessMode).toBe("shell_contract_only");
    }
  });

  it("shell final gate watch yields harness watch", () => {
    const base = stripRuntimeNoopExecutionShellHarnessLayer(buildFullSemantic());
    const harness = buildShellHarnessPlanning(
      withHarnessUpstreamWatchBaseline(base, {
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
        runtimeNoopExecutionShellBoundaryViolationReport: {
          ...base.runtimeNoopExecutionShellBoundaryViolationReport,
          actualFlagViolations: [],
        },
        runtimeNoopExecutionShellBlockerReport: {
          ...base.runtimeNoopExecutionShellBlockerReport,
          blockers: [],
        },
      })
    );
    expect(harness.runtimeNoopExecutionShellHarnessSummary.harnessReadiness).toBe("watch");
  });

  it("shell final gate blocked yields harness blocked", () => {
    const base = stripRuntimeNoopExecutionShellHarnessLayer(buildFullSemantic());
    const harness = buildShellHarnessPlanning({
      runtimeNoopExecutionShellFinalSafetyGate: {
        ...base.runtimeNoopExecutionShellFinalSafetyGate,
        finalGateStatus: "blocked",
        h32EntryReadiness: "blocked",
      },
    });
    expect(harness.runtimeNoopExecutionShellHarnessSummary.harnessReadiness).toBe("blocked");
  });

  it("shell readiness failed yields harness blocked", () => {
    const base = stripRuntimeNoopExecutionShellHarnessLayer(buildFullSemantic());
    const harness = buildShellHarnessPlanning({
      runtimeNoopExecutionShellReadinessVerificationReport: {
        ...base.runtimeNoopExecutionShellReadinessVerificationReport,
        verificationStatus: "failed",
      },
    });
    expect(harness.runtimeNoopExecutionShellHarnessSummary.harnessReadiness).toBe("blocked");
  });

  it("shell boundary actual flag violation yields harness blocked", () => {
    const base = stripRuntimeNoopExecutionShellHarnessLayer(buildFullSemantic());
    const harness = buildShellHarnessPlanning({
      runtimeNoopExecutionShellBoundaryViolationReport: {
        ...base.runtimeNoopExecutionShellBoundaryViolationReport,
        actualFlagViolations: ["actualNoopShellExecutionEnabled:true"],
      },
    });
    expect(harness.runtimeNoopExecutionShellHarnessSummary.harnessReadiness).toBe("blocked");
  });

  it("noop result diagnosticOnly=false yields preflight blocked", () => {
    const harness = buildShellHarnessPlanning();
    const preflight = buildRuntimeNoopExecutionShellHarnessPreflightSummary({
      summary: harness.runtimeNoopExecutionShellHarnessSummary,
      contractBoundary: harness.runtimeNoopExecutionShellContractBoundary,
      inputEnvelope: harness.runtimeNoopExecutionShellHarnessInputEnvelope,
      outputEnvelope: harness.runtimeNoopExecutionShellHarnessOutputEnvelope,
      result: {
        ...harness.runtimeNoopExecutionShellNoopResultMetadata,
        diagnosticOnly: false as unknown as true,
      },
      safetyGuard: harness.runtimeNoopExecutionShellHarnessSafetyGuard,
      blockerReport: harness.runtimeNoopExecutionShellHarnessBlockerReport,
    });
    expect(preflight.preflightReadiness).toBe("blocked");
    expect(preflight.blockers.some((b) => b.includes("diagnosticOnly"))).toBe(true);
  });

  it("safety guard forbidden false yields preflight blocked", () => {
    const harness = buildShellHarnessPlanning();
    const preflight = buildRuntimeNoopExecutionShellHarnessPreflightSummary({
      summary: harness.runtimeNoopExecutionShellHarnessSummary,
      contractBoundary: harness.runtimeNoopExecutionShellContractBoundary,
      inputEnvelope: harness.runtimeNoopExecutionShellHarnessInputEnvelope,
      outputEnvelope: harness.runtimeNoopExecutionShellHarnessOutputEnvelope,
      result: harness.runtimeNoopExecutionShellNoopResultMetadata,
      safetyGuard: {
        ...harness.runtimeNoopExecutionShellHarnessSafetyGuard,
        actualShellExecutionForbidden: false as unknown as true,
      },
      blockerReport: harness.runtimeNoopExecutionShellHarnessBlockerReport,
    });
    expect(preflight.preflightReadiness).toBe("blocked");
    expect(preflight.blockers.some((b) => b.includes("safety guard"))).toBe(true);
  });

  it("serializer does not rebuild reports", () => {
    const semantic = buildFullSemantic();
    const serialized = serializeRuntimeNoopExecutionShellHarnessDiagnosticBundleFromSemanticReports(semantic);
    expect(serialized.runtimeNoopExecutionShellHarnessSummary).toEqual(
      expect.objectContaining({
        harnessReadiness: semantic.runtimeNoopExecutionShellHarnessSummary.harnessReadiness,
        harnessMode: semantic.runtimeNoopExecutionShellHarnessSummary.harnessMode,
      })
    );
    expect(serialized.runtimeNoopExecutionShellNoopResultMetadata).toEqual(
      expect.objectContaining({
        diagnosticOnly: semantic.runtimeNoopExecutionShellNoopResultMetadata.diagnosticOnly,
        noopShellExecuted: semantic.runtimeNoopExecutionShellNoopResultMetadata.noopShellExecuted,
      })
    );
  });

  it("stripRuntimeNoopExecutionShellHarnessLayer removes H32 fields only", () => {
    const semantic = buildFullSemantic();
    const stripped = stripRuntimeNoopExecutionShellHarnessLayer(semantic);
    expect("runtimeNoopExecutionShellHarnessSummary" in stripped).toBe(false);
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
