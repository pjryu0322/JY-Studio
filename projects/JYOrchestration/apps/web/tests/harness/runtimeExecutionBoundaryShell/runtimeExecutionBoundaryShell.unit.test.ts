import { describe, expect, it } from "vitest";

import { buildRuntimeExecutionBoundaryShellPlanningReports } from "@/lib/harness/runtimeExecutionBoundaryShell/buildRuntimeExecutionBoundaryShellPlanningReports";
import { serializeRuntimeExecutionBoundaryShellDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeExecutionBoundaryShell/serializeRuntimeExecutionBoundaryShellDiagnosticBundle";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticPlanningReportsBeforeExecutionBoundaryShell } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  stripRuntimeExecutionBoundaryShellLayer,
  stripRuntimeReleaseGatePreflightLayer,
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

function buildBoundaryShellPlanning(
  patches: Partial<RuntimeSemanticPlanningReportsBeforeExecutionBoundaryShell> = {}
) {
  const base = stripRuntimeExecutionBoundaryShellLayer(buildFullSemantic());
  return buildRuntimeExecutionBoundaryShellPlanningReports({ ...base, ...patches });
}

describe("H36 / execution boundary metadata shell candidate", () => {
  it("full semantic includes boundary shell with all actual execution flags false", () => {
    const semantic = buildFullSemantic();
    expect(semantic.runtimeExecutionBoundaryShellSummary.mode).toBe(
      "runtime_execution_boundary_shell_summary"
    );
    expect(semantic.runtimeExecutionBoundaryShellSummary.actualExecutionEnabled).toBe(false);
    expect(semantic.runtimeExecutionBoundaryShellSummary.actualReleaseEnforcementEnabled).toBe(false);
    expect(semantic.runtimeExecutionBoundaryShellPolicy.actualExecutionForbidden).toBe(true);
    expect(semantic.runtimeExecutionBoundaryShellPolicy.actualExecutionRoutingForbidden).toBe(true);
    expect(semantic.runtimeExecutionBoundaryShellPolicy.actualReleaseEnforcementForbidden).toBe(true);
    expect(semantic.runtimeExecutionBoundaryShellPolicy.actualShellExecutionForbidden).toBe(true);
  });

  it("preflight final gate ready + verified + aligned + no violations yields boundary_shell_metadata_candidate", () => {
    const semantic = buildFullSemantic();
    if (
      semantic.runtimeReleaseGatePreflightFinalSafetyGate.finalGateStatus === "ready_metadata" &&
      semantic.runtimeReleaseGatePreflightFinalSafetyGate.h36EntryReadiness === "ready_metadata" &&
      semantic.runtimeReleaseGatePreflightReadinessVerificationReport.verificationStatus ===
        "verified_metadata" &&
      semantic.runtimeReleaseGatePreflightAlignmentReport.alignmentStatus === "aligned_metadata" &&
      semantic.runtimeReleaseGatePreflightBoundaryViolationReport.actualFlagViolations.length === 0 &&
      semantic.runtimeReleaseGatePreflightBoundaryViolationReport.proofViolations.length === 0 &&
      semantic.runtimeReleaseGatePreflightSummary.preflightReadiness === "preflight_metadata_ready" &&
      semantic.runtimeExecutionBoundaryShellBlockerReport.blockers.length === 0
    ) {
      expect(semantic.runtimeExecutionBoundaryShellSummary.candidateStatus).toBe(
        "boundary_shell_metadata_candidate"
      );
      expect(semantic.runtimeExecutionBoundaryShellSummary.shellMode).toBe("metadata_only");
    }
  });

  it("preflight final gate watch yields shell watch", () => {
    const base = stripRuntimeExecutionBoundaryShellLayer(buildFullSemantic());
    const shell = buildBoundaryShellPlanning({
      runtimeReleaseGatePreflightFinalSafetyGate: {
        ...base.runtimeReleaseGatePreflightFinalSafetyGate,
        finalGateStatus: "watch",
        h36EntryReadiness: "watch",
        blockers: [],
      },
      runtimeReleaseGatePreflightReadinessVerificationReport: {
        ...base.runtimeReleaseGatePreflightReadinessVerificationReport,
        verificationStatus: "partial",
      },
      runtimeReleaseGatePreflightAlignmentReport: {
        ...base.runtimeReleaseGatePreflightAlignmentReport,
        alignmentStatus: "partial",
      },
      runtimeReleaseGatePreflightBoundaryViolationReport: {
        ...base.runtimeReleaseGatePreflightBoundaryViolationReport,
        actualFlagViolations: [],
        proofViolations: [],
        wordingRiskFindings: ["wording risk"],
      },
      runtimeReleaseGatePreflightBlockerReport: {
        ...base.runtimeReleaseGatePreflightBlockerReport,
        blockers: [],
      },
      runtimeReleaseGatePreflightSummary: {
        ...base.runtimeReleaseGatePreflightSummary,
        preflightReadiness: "watch",
        preflightBlockers: [],
      },
      runtimeNoopShellReleaseGateFinalSafetyGate: {
        ...base.runtimeNoopShellReleaseGateFinalSafetyGate,
        finalGateStatus: "ready_metadata",
        h35EntryReadiness: "ready_metadata",
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
        boundaryRisk: "low",
      },
    });
    expect(shell.runtimeExecutionBoundaryShellSummary.candidateStatus).toBe("watch");
    expect(shell.runtimeExecutionBoundaryShellSummary.shellMode).toBe("disabled");
  });

  it("preflight final gate blocked yields shell blocked", () => {
    const base = stripRuntimeExecutionBoundaryShellLayer(buildFullSemantic());
    const shell = buildBoundaryShellPlanning({
      runtimeReleaseGatePreflightFinalSafetyGate: {
        ...base.runtimeReleaseGatePreflightFinalSafetyGate,
        finalGateStatus: "blocked",
        h36EntryReadiness: "blocked",
      },
    });
    expect(shell.runtimeExecutionBoundaryShellSummary.candidateStatus).toBe("blocked");
    expect(shell.runtimeExecutionBoundaryShellSummary.shellMode).toBe("blocked");
  });

  it("preflight readiness verification failed yields shell blocked", () => {
    const base = stripRuntimeExecutionBoundaryShellLayer(buildFullSemantic());
    const shell = buildBoundaryShellPlanning({
      runtimeReleaseGatePreflightReadinessVerificationReport: {
        ...base.runtimeReleaseGatePreflightReadinessVerificationReport,
        verificationStatus: "failed",
      },
    });
    expect(shell.runtimeExecutionBoundaryShellSummary.candidateStatus).toBe("blocked");
  });

  it("preflight alignment failed yields shell blocked", () => {
    const base = stripRuntimeExecutionBoundaryShellLayer(buildFullSemantic());
    const shell = buildBoundaryShellPlanning({
      runtimeReleaseGatePreflightAlignmentReport: {
        ...base.runtimeReleaseGatePreflightAlignmentReport,
        alignmentStatus: "failed",
      },
    });
    expect(shell.runtimeExecutionBoundaryShellSummary.candidateStatus).toBe("blocked");
  });

  it("preflight boundary actual flag violation yields shell blocked", () => {
    const base = stripRuntimeExecutionBoundaryShellLayer(buildFullSemantic());
    const shell = buildBoundaryShellPlanning({
      runtimeReleaseGatePreflightBoundaryViolationReport: {
        ...base.runtimeReleaseGatePreflightBoundaryViolationReport,
        actualFlagViolations: ["actualExecutionEnabled must be false"],
        proofViolations: [],
      },
    });
    expect(shell.runtimeExecutionBoundaryShellSummary.candidateStatus).toBe("blocked");
  });

  it("serializer does not rebuild reports", () => {
    const semantic = buildFullSemantic();
    const serialized = serializeRuntimeExecutionBoundaryShellDiagnosticBundleFromSemanticReports(semantic);
    expect(serialized.runtimeExecutionBoundaryShellSummary).toEqual(
      expect.objectContaining({
        candidateStatus: semantic.runtimeExecutionBoundaryShellSummary.candidateStatus,
        shellMode: semantic.runtimeExecutionBoundaryShellSummary.shellMode,
      })
    );
    expect(serialized.runtimeExecutionBoundaryShellPolicy).toEqual(
      expect.objectContaining({
        actualExecutionForbidden: semantic.runtimeExecutionBoundaryShellPolicy.actualExecutionForbidden,
        actualExecutionRoutingForbidden:
          semantic.runtimeExecutionBoundaryShellPolicy.actualExecutionRoutingForbidden,
      })
    );
    expect(serialized.runtimeExecutionBoundaryShellScope.candidateSourceLayer).toBe(
      semantic.runtimeExecutionBoundaryShellScope.candidateSourceLayer
    );
  });

  it("stripRuntimeExecutionBoundaryShellLayer removes H36 fields only", () => {
    const semantic = buildFullSemantic();
    const stripped = stripRuntimeExecutionBoundaryShellLayer(semantic);
    expect("runtimeExecutionBoundaryShellSummary" in stripped).toBe(false);
    expect(stripped.runtimeReleaseGatePreflightSummary.mode).toBe("runtime_release_gate_preflight_summary");
  });

  it("stripRuntimeReleaseGatePreflightLayer removes H35 fields but keeps H36", () => {
    const semantic = buildFullSemantic();
    const stripped = stripRuntimeReleaseGatePreflightLayer(semantic);
    expect("runtimeReleaseGatePreflightSummary" in stripped).toBe(false);
    expect("runtimeExecutionBoundaryShellSummary" in stripped).toBe(true);
    expect(stripped.runtimeNoopShellReleaseGateSummary.mode).toBe("runtime_noop_shell_release_gate_summary");
  });
});
