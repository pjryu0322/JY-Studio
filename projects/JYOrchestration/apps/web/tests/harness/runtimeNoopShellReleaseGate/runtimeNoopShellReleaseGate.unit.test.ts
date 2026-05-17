import { describe, expect, it } from "vitest";

import { buildRuntimeNoopShellReleaseGatePlanningReports } from "@/lib/harness/runtimeNoopShellReleaseGate/buildRuntimeNoopShellReleaseGatePlanningReports";
import { serializeRuntimeNoopShellReleaseGateDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeNoopShellReleaseGate/serializeRuntimeNoopShellReleaseGateDiagnosticBundle";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticPlanningReportsBeforeNoopShellReleaseGate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  stripRuntimeNoopShellHardeningLayer,
  stripRuntimeNoopShellReleaseGateLayer,
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

function buildReleaseGatePlanning(
  patches: Partial<RuntimeSemanticPlanningReportsBeforeNoopShellReleaseGate> = {}
) {
  const base = stripRuntimeNoopShellReleaseGateLayer(buildFullSemantic());
  return buildRuntimeNoopShellReleaseGatePlanningReports({ ...base, ...patches });
}

describe("H34 no-op shell release-gate candidate", () => {
  it("full semantic includes release-gate with all actual execution flags false", () => {
    const semantic = buildFullSemantic();
    expect(semantic.runtimeNoopShellReleaseGateSummary.mode).toBe("runtime_noop_shell_release_gate_summary");
    expect(semantic.runtimeNoopShellReleaseGateSummary.actualNoopShellExecutionEnabled).toBe(false);
    expect(semantic.runtimeNoopShellReleaseGateSummary.actualExecutionShellExecutionEnabled).toBe(false);
    expect(semantic.runtimeNoopShellReleaseGatePolicy.actualReleaseEnforcementForbidden).toBe(true);
    expect(semantic.runtimeNoopShellReleaseGatePolicy.actualShellExecutionForbidden).toBe(true);
  });

  it("hardening final gate ready + verified + aligned yields release_gate_metadata_candidate", () => {
    const semantic = buildFullSemantic();
    if (
      semantic.runtimeNoopShellHardeningFinalSafetyGate.finalGateStatus === "ready_metadata" &&
      semantic.runtimeNoopShellHardeningFinalSafetyGate.h34EntryReadiness === "ready_metadata" &&
      semantic.runtimeNoopShellHardeningReadinessVerificationReport.verificationStatus ===
        "verified_metadata" &&
      semantic.runtimeNoopShellHardeningAlignmentReport.alignmentStatus === "aligned_metadata" &&
      semantic.runtimeNoopShellHardeningBoundaryViolationReport.actualFlagViolations.length === 0
    ) {
      expect(semantic.runtimeNoopShellReleaseGateSummary.candidateStatus).toBe(
        "release_gate_metadata_candidate"
      );
      expect(semantic.runtimeNoopShellReleaseGateSummary.releaseGateMode).toBe("metadata_only");
    }
  });

  it("hardening final gate watch yields release-gate watch", () => {
    const base = stripRuntimeNoopShellReleaseGateLayer(buildFullSemantic());
    const releaseGate = buildReleaseGatePlanning({
      runtimeNoopShellHardeningSummary: {
        ...base.runtimeNoopShellHardeningSummary,
        hardeningReadiness: "watch",
        hardeningBlockers: [],
      },
      runtimeNoopShellHardeningFinalSafetyGate: {
        ...base.runtimeNoopShellHardeningFinalSafetyGate,
        finalGateStatus: "watch",
        h34EntryReadiness: "watch",
        blockers: [],
      },
      runtimeNoopShellHardeningReadinessVerificationReport: {
        ...base.runtimeNoopShellHardeningReadinessVerificationReport,
        verificationStatus: "partial",
      },
      runtimeNoopShellHardeningAlignmentReport: {
        ...base.runtimeNoopShellHardeningAlignmentReport,
        alignmentStatus: "partial",
      },
      runtimeNoopShellHardeningPreflightSummary: {
        ...base.runtimeNoopShellHardeningPreflightSummary,
        preflightReadiness: "watch",
        blockers: [],
      },
      runtimeNoopExecutionShellHarnessPreflightSummary: {
        ...base.runtimeNoopExecutionShellHarnessPreflightSummary,
        preflightReadiness: "ready_metadata",
        blockers: [],
      },
      runtimeNoopExecutionShellFinalSafetyGate: {
        ...base.runtimeNoopExecutionShellFinalSafetyGate,
        finalGateStatus: "watch",
        blockers: [],
      },
      runtimeNoopShellHardeningBoundaryViolationReport: {
        ...base.runtimeNoopShellHardeningBoundaryViolationReport,
        actualFlagViolations: [],
        wordingRiskFindings: ["wording risk"],
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
    expect(releaseGate.runtimeNoopShellReleaseGateSummary.candidateStatus).toBe("watch");
  });

  it("hardening final gate blocked yields release-gate blocked", () => {
    const base = stripRuntimeNoopShellReleaseGateLayer(buildFullSemantic());
    const releaseGate = buildReleaseGatePlanning({
      runtimeNoopShellHardeningFinalSafetyGate: {
        ...base.runtimeNoopShellHardeningFinalSafetyGate,
        finalGateStatus: "blocked",
        h34EntryReadiness: "blocked",
      },
    });
    expect(releaseGate.runtimeNoopShellReleaseGateSummary.candidateStatus).toBe("blocked");
    expect(releaseGate.runtimeNoopShellReleaseGateSummary.releaseGateMode).toBe("blocked");
  });

  it("hardening readiness failed yields release-gate blocked", () => {
    const base = stripRuntimeNoopShellReleaseGateLayer(buildFullSemantic());
    const releaseGate = buildReleaseGatePlanning({
      runtimeNoopShellHardeningReadinessVerificationReport: {
        ...base.runtimeNoopShellHardeningReadinessVerificationReport,
        verificationStatus: "failed",
      },
    });
    expect(releaseGate.runtimeNoopShellReleaseGateSummary.candidateStatus).toBe("blocked");
  });

  it("hardening alignment failed yields release-gate blocked", () => {
    const base = stripRuntimeNoopShellReleaseGateLayer(buildFullSemantic());
    const releaseGate = buildReleaseGatePlanning({
      runtimeNoopShellHardeningAlignmentReport: {
        ...base.runtimeNoopShellHardeningAlignmentReport,
        alignmentStatus: "failed",
      },
    });
    expect(releaseGate.runtimeNoopShellReleaseGateSummary.candidateStatus).toBe("blocked");
  });

  it("hardening boundary actual flag violation yields release-gate blocked", () => {
    const base = stripRuntimeNoopShellReleaseGateLayer(buildFullSemantic());
    const releaseGate = buildReleaseGatePlanning({
      runtimeNoopShellHardeningBoundaryViolationReport: {
        ...base.runtimeNoopShellHardeningBoundaryViolationReport,
        actualFlagViolations: ["runtimeNoopShellHardeningSummary.actualNoopShellExecutionEnabled must be false"],
      },
    });
    expect(releaseGate.runtimeNoopShellReleaseGateSummary.candidateStatus).toBe("blocked");
  });

  it("serializer does not rebuild reports", () => {
    const semantic = buildFullSemantic();
    const serialized = serializeRuntimeNoopShellReleaseGateDiagnosticBundleFromSemanticReports(semantic);
    expect(serialized.runtimeNoopShellReleaseGateSummary).toEqual(
      expect.objectContaining({
        candidateStatus: semantic.runtimeNoopShellReleaseGateSummary.candidateStatus,
        releaseGateMode: semantic.runtimeNoopShellReleaseGateSummary.releaseGateMode,
      })
    );
    expect(serialized.runtimeNoopShellReleaseGatePolicy).toEqual(
      expect.objectContaining({
        actualReleaseEnforcementForbidden:
          semantic.runtimeNoopShellReleaseGatePolicy.actualReleaseEnforcementForbidden,
      })
    );
  });

  it("stripRuntimeNoopShellReleaseGateLayer removes H34 fields only", () => {
    const semantic = buildFullSemantic();
    const stripped = stripRuntimeNoopShellReleaseGateLayer(semantic);
    expect("runtimeNoopShellReleaseGateSummary" in stripped).toBe(false);
    expect(stripped.runtimeNoopShellHardeningSummary.mode).toBe("runtime_noop_shell_hardening_summary");
  });

  it("stripRuntimeNoopShellHardeningLayer removes H33 and H34 fields", () => {
    const semantic = buildFullSemantic();
    const stripped = stripRuntimeNoopShellHardeningLayer(semantic);
    expect("runtimeNoopShellHardeningSummary" in stripped).toBe(false);
    expect("runtimeNoopShellReleaseGateSummary" in stripped).toBe(false);
  });
});
