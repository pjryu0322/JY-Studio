import { describe, expect, it } from "vitest";

import { buildRuntimeNoopExecutionShellPlanningReports } from "@/lib/harness/runtimeNoopExecutionShell/buildRuntimeNoopExecutionShellPlanningReports";
import { serializeRuntimeNoopExecutionShellDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeNoopExecutionShell/serializeRuntimeNoopExecutionShellDiagnosticBundle";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticPlanningReportsBeforeNoopExecutionShell } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  stripRuntimeNoopExecutionShellLayer,
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

function buildNoopExecutionShellPlanning(
  patches: Partial<RuntimeSemanticPlanningReportsBeforeNoopExecutionShell> = {}
) {
  const base = stripRuntimeNoopExecutionShellLayer(buildFullSemantic());
  return buildRuntimeNoopExecutionShellPlanningReports({ ...base, ...patches });
}

describe("H31 isolated dry-run no-op execution shell candidate", () => {
  it("full semantic includes execution shell with all actual execution flags false", () => {
    const semantic = buildFullSemantic();
    expect(semantic.runtimeNoopExecutionShellSummary.mode).toBe("runtime_noop_execution_shell_summary");
    expect(semantic.runtimeNoopExecutionShellSummary.actualNoopShellExecutionEnabled).toBe(false);
    expect(semantic.runtimeNoopExecutionShellSummary.actualExecutionShellExecutionEnabled).toBe(false);
    expect(semantic.runtimeNoopExecutionShellPolicy.actualShellExecutionForbidden).toBe(true);
    expect(semantic.runtimeNoopExecutionShellPolicy.actualRunnerInvocationForbidden).toBe(true);
    expect(semantic.runtimeNoopExecutionShellPolicy.actualExecutionForbidden).toBe(true);
  });

  it("harness final gate ready + verified + aligned can yield shell_metadata_candidate", () => {
    const semantic = buildFullSemantic();
    if (
      semantic.runtimeRunnerNoopHarnessFinalSafetyGate.finalGateStatus === "ready_metadata" &&
      semantic.runtimeRunnerNoopHarnessFinalSafetyGate.h31EntryReadiness === "ready_metadata" &&
      semantic.runtimeRunnerNoopHarnessReadinessVerificationReport.verificationStatus === "verified_metadata" &&
      semantic.runtimeRunnerNoopHarnessAlignmentReport.alignmentStatus === "aligned_metadata" &&
      semantic.runtimeRunnerNoopHarnessBoundaryViolationReport.actualFlagViolations.length === 0
    ) {
      expect(semantic.runtimeNoopExecutionShellSummary.candidateStatus).toBe("shell_metadata_candidate");
      expect(semantic.runtimeNoopExecutionShellSummary.shellMode).toBe("metadata_only");
    }
  });

  it("harness final gate watch yields shell watch", () => {
    const base = stripRuntimeNoopExecutionShellLayer(buildFullSemantic());
    const shell = buildNoopExecutionShellPlanning({
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
      runtimeRunnerNoopHarnessReadinessVerificationReport: {
        ...base.runtimeRunnerNoopHarnessReadinessVerificationReport,
        verificationStatus: "partial",
      },
      runtimeRunnerNoopHarnessAlignmentReport: {
        ...base.runtimeRunnerNoopHarnessAlignmentReport,
        alignmentStatus: "partial",
      },
      runtimeRunnerNoopHarnessBoundaryViolationReport: {
        ...base.runtimeRunnerNoopHarnessBoundaryViolationReport,
        actualFlagViolations: [],
        wordingRiskFindings: ["wording risk"],
      },
      runtimeRunnerInvocationFinalSafetyGate: {
        ...base.runtimeRunnerInvocationFinalSafetyGate,
        finalGateStatus: "ready_metadata",
        blockers: [],
      },
      runtimeRunnerInvocationBlockerReport: {
        ...base.runtimeRunnerInvocationBlockerReport,
        blockers: [],
      },
      runtimeRunnerNoopHarnessPreflightSummary: {
        ...base.runtimeRunnerNoopHarnessPreflightSummary,
        preflightReadiness: "ready_metadata",
        blockers: [],
      },
      runtimePilotSkeletonPreflightSummary: {
        ...base.runtimePilotSkeletonPreflightSummary,
        preflightReadiness: "ready_metadata",
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
    });
    expect(shell.runtimeNoopExecutionShellSummary.candidateStatus).toBe("watch");
    expect(shell.runtimeNoopExecutionShellSummary.shellMode).toBe("disabled");
  });

  it("harness final gate blocked yields shell blocked", () => {
    const base = stripRuntimeNoopExecutionShellLayer(buildFullSemantic());
    const shell = buildNoopExecutionShellPlanning({
      runtimeRunnerNoopHarnessFinalSafetyGate: {
        ...base.runtimeRunnerNoopHarnessFinalSafetyGate,
        finalGateStatus: "blocked",
        h31EntryReadiness: "blocked",
      },
    });
    expect(shell.runtimeNoopExecutionShellSummary.candidateStatus).toBe("blocked");
    expect(shell.runtimeNoopExecutionShellSummary.shellMode).toBe("blocked");
  });

  it("harness readiness failed yields shell blocked", () => {
    const base = stripRuntimeNoopExecutionShellLayer(buildFullSemantic());
    const shell = buildNoopExecutionShellPlanning({
      runtimeRunnerNoopHarnessReadinessVerificationReport: {
        ...base.runtimeRunnerNoopHarnessReadinessVerificationReport,
        verificationStatus: "failed",
      },
    });
    expect(shell.runtimeNoopExecutionShellSummary.candidateStatus).toBe("blocked");
  });

  it("harness alignment failed yields shell blocked", () => {
    const base = stripRuntimeNoopExecutionShellLayer(buildFullSemantic());
    const shell = buildNoopExecutionShellPlanning({
      runtimeRunnerNoopHarnessAlignmentReport: {
        ...base.runtimeRunnerNoopHarnessAlignmentReport,
        alignmentStatus: "failed",
      },
    });
    expect(shell.runtimeNoopExecutionShellSummary.candidateStatus).toBe("blocked");
  });

  it("serializer does not rebuild reports", () => {
    const semantic = buildFullSemantic();
    const serialized = serializeRuntimeNoopExecutionShellDiagnosticBundleFromSemanticReports(semantic);
    expect(serialized.runtimeNoopExecutionShellSummary).toEqual(
      expect.objectContaining({
        mode: semantic.runtimeNoopExecutionShellSummary.mode,
        candidateStatus: semantic.runtimeNoopExecutionShellSummary.candidateStatus,
        shellMode: semantic.runtimeNoopExecutionShellSummary.shellMode,
      })
    );
  });

  it("stripRuntimeNoopExecutionShellLayer removes H31 fields only", () => {
    const semantic = buildFullSemantic();
    const stripped = stripRuntimeNoopExecutionShellLayer(semantic);
    expect("runtimeNoopExecutionShellSummary" in stripped).toBe(false);
    expect(stripped.runtimeRunnerNoopHarnessFinalSafetyGate.mode).toBe(
      "runtime_runner_noop_harness_final_safety_gate"
    );
  });

  it("stripRuntimeRunnerNoopHarnessLayer removes H30 and H31 fields", () => {
    const semantic = buildFullSemantic();
    const stripped = stripRuntimeRunnerNoopHarnessLayer(semantic);
    expect("runtimeRunnerNoopHarnessSummary" in stripped).toBe(false);
    expect("runtimeNoopExecutionShellSummary" in stripped).toBe(false);
  });
});
