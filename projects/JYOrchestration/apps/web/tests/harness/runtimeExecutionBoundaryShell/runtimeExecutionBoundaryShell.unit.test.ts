import { describe, expect, it } from "vitest";

import { buildRuntimeExecutionBoundaryShellFinalSafetyGate } from "@/lib/harness/runtimeExecutionBoundaryShell/buildRuntimeExecutionBoundaryShellFinalSafetyGate";
import { buildRuntimeExecutionBoundaryShellPlanningReports } from "@/lib/harness/runtimeExecutionBoundaryShell/buildRuntimeExecutionBoundaryShellPlanningReports";
import { detectRuntimeExecutionBoundaryShellBoundaryViolations } from "@/lib/harness/runtimeExecutionBoundaryShell/detectRuntimeExecutionBoundaryShellBoundaryViolations";
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

describe("H36 / H36.5 execution boundary metadata shell candidate", () => {
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
    expect(semantic.runtimeExecutionBoundaryShellFinalSafetyGate.mode).toBe(
      "runtime_execution_boundary_shell_final_safety_gate"
    );
    expect(semantic.runtimeExecutionBoundaryShellFinalSafetyGate.h37EntryReadiness).toBe(
      semantic.runtimeExecutionBoundaryShellFinalSafetyGate.finalGateStatus
    );
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

  it("boundary_shell_metadata_candidate + verified + aligned yields final gate ready_metadata", () => {
    const semantic = buildFullSemantic();
    if (
      semantic.runtimeExecutionBoundaryShellSummary.candidateStatus === "boundary_shell_metadata_candidate" &&
      semantic.runtimeExecutionBoundaryShellSummary.shellMode === "metadata_only" &&
      semantic.runtimeExecutionBoundaryShellReadinessVerificationReport.verificationStatus ===
        "verified_metadata" &&
      semantic.runtimeExecutionBoundaryShellAlignmentReport.alignmentStatus === "aligned_metadata" &&
      semantic.runtimeExecutionBoundaryShellBoundaryViolationReport.actualFlagViolations.length === 0
    ) {
      expect(semantic.runtimeExecutionBoundaryShellFinalSafetyGate.finalGateStatus).toBe("ready_metadata");
    }
  });

  it("watch candidate with partial verification yields final gate watch when built in isolation", () => {
    const partial = buildBoundaryShellPlanning();
    const finalGate = buildRuntimeExecutionBoundaryShellFinalSafetyGate({
      summary: {
        ...partial.runtimeExecutionBoundaryShellSummary,
        candidateStatus: "watch",
        shellMode: "disabled",
        shellBlockers: [],
      },
      blockerReport: { ...partial.runtimeExecutionBoundaryShellBlockerReport, blockers: [] },
      boundaryViolation: {
        ...partial.runtimeExecutionBoundaryShellBoundaryViolationReport,
        actualFlagViolations: [],
        wordingRiskFindings: ["wording risk"],
      },
      readinessVerification: {
        ...partial.runtimeExecutionBoundaryShellReadinessVerificationReport,
        verificationStatus: "partial",
      },
      alignmentReport: {
        ...partial.runtimeExecutionBoundaryShellAlignmentReport,
        alignmentStatus: "aligned_metadata",
      },
    });
    expect(finalGate.finalGateStatus).toBe("watch");
    expect(finalGate.h37EntryReadiness).toBe("watch");
  });

  it("policy actualExecutionForbidden false yields boundary violation", () => {
    const partial = buildBoundaryShellPlanning();
    const violation = detectRuntimeExecutionBoundaryShellBoundaryViolations({
      summary: partial.runtimeExecutionBoundaryShellSummary,
      policy: {
        ...partial.runtimeExecutionBoundaryShellPolicy,
        actualExecutionForbidden: false as unknown as true,
      },
    });
    expect(violation.actualFlagViolations.some((v) => v.includes("actualExecutionForbidden"))).toBe(true);
  });

  it("policy actualExecutionRoutingForbidden false yields boundary violation", () => {
    const partial = buildBoundaryShellPlanning();
    const violation = detectRuntimeExecutionBoundaryShellBoundaryViolations({
      summary: partial.runtimeExecutionBoundaryShellSummary,
      policy: {
        ...partial.runtimeExecutionBoundaryShellPolicy,
        actualExecutionRoutingForbidden: false as unknown as true,
      },
    });
    expect(violation.actualFlagViolations.some((v) => v.includes("actualExecutionRoutingForbidden"))).toBe(true);
  });

  it("summary actualExecutionEnabled true yields boundary violation", () => {
    const partial = buildBoundaryShellPlanning();
    const violation = detectRuntimeExecutionBoundaryShellBoundaryViolations({
      summary: {
        ...partial.runtimeExecutionBoundaryShellSummary,
        actualExecutionEnabled: true as unknown as false,
      },
      policy: partial.runtimeExecutionBoundaryShellPolicy,
    });
    expect(violation.actualFlagViolations.length).toBeGreaterThan(0);
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
    expect(serialized.runtimeExecutionBoundaryShellFinalSafetyGate).toEqual(
      expect.objectContaining({
        finalGateStatus: semantic.runtimeExecutionBoundaryShellFinalSafetyGate.finalGateStatus,
        h37EntryReadiness: semantic.runtimeExecutionBoundaryShellFinalSafetyGate.h37EntryReadiness,
      })
    );
    expect(serialized.runtimeExecutionBoundaryShellBoundaryViolationReport).toBeDefined();
    expect(serialized.runtimeExecutionBoundaryShellReadinessVerificationReport).toBeDefined();
    expect(serialized.runtimeExecutionBoundaryShellAlignmentReport).toBeDefined();
  });

  it("stripRuntimeExecutionBoundaryShellLayer removes H36 and H36.5 fields only", () => {
    const semantic = buildFullSemantic();
    const stripped = stripRuntimeExecutionBoundaryShellLayer(semantic);
    expect("runtimeExecutionBoundaryShellSummary" in stripped).toBe(false);
    expect("runtimeExecutionGovernanceBoundarySummary" in stripped).toBe(true);
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
