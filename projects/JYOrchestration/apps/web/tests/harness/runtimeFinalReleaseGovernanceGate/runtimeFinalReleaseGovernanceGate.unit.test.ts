import { describe, expect, it } from "vitest";

import { buildRuntimeFinalReleaseGovernanceGatePlanningReports } from "@/lib/harness/runtimeFinalReleaseGovernanceGate/buildRuntimeFinalReleaseGovernanceGatePlanningReports";
import { serializeRuntimeFinalReleaseGovernanceGateDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeFinalReleaseGovernanceGate/serializeRuntimeFinalReleaseGovernanceGateDiagnosticBundle";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticPlanningReportsBeforeFinalReleaseGovernanceGate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  stripRuntimeFinalReleaseGovernanceGateLayer,
  stripRuntimeGovernanceReleaseReadinessLayer,
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

function buildFinalReleaseGatePlanning(
  patches: Partial<RuntimeSemanticPlanningReportsBeforeFinalReleaseGovernanceGate> = {}
) {
  const base = stripRuntimeFinalReleaseGovernanceGateLayer(buildFullSemantic());
  return buildRuntimeFinalReleaseGovernanceGatePlanningReports({ ...base, ...patches });
}

describe("H39 final release governance gate candidate", () => {
  it("full semantic includes final release governance gate with all actual flags false", () => {
    const semantic = buildFullSemantic();
    expect(semantic.runtimeFinalReleaseGovernanceGateSummary.mode).toBe(
      "runtime_final_release_governance_gate_summary"
    );
    expect(semantic.runtimeFinalReleaseGovernanceGateSummary.actualExecutionEnabled).toBe(false);
    expect(semantic.runtimeFinalReleaseGovernanceGateSummary.actualExecutionBlockingEnabled).toBe(false);
    expect(semantic.runtimeFinalReleaseGovernanceGateSummary.actualMergeBlockingEnabled).toBe(false);
    expect(semantic.runtimeFinalReleaseGovernanceGatePolicy.actualExecutionForbidden).toBe(true);
    expect(semantic.runtimeFinalReleaseGovernanceGatePolicy.actualExecutionBlockingForbidden).toBe(true);
    expect(semantic.runtimeFinalReleaseGovernanceGatePolicy.actualMergeBlockingForbidden).toBe(true);
    expect(semantic.runtimeFinalReleaseGovernanceGateScope.candidateSourceLayer).toBe(
      "runtimeGovernanceReleaseReadinessFinalSafetyGate"
    );
    expect(semantic.runtimeFinalReleaseGovernanceGateScope.candidateTargetLayer).toBe(
      "finalReleaseGovernanceGateCandidate"
    );
  });

  it("release final gate ready yields final_release_governance_gate_metadata_candidate when aligned", () => {
    const semantic = buildFullSemantic();
    if (
      semantic.runtimeGovernanceReleaseReadinessFinalSafetyGate.finalGateStatus === "ready_metadata" &&
      semantic.runtimeGovernanceReleaseReadinessFinalSafetyGate.h39EntryReadiness === "ready_metadata" &&
      semantic.runtimeGovernanceReleaseReadinessVerificationReport.verificationStatus === "verified_metadata" &&
      semantic.runtimeGovernanceReleaseReadinessAlignmentReport.alignmentStatus === "aligned_metadata" &&
      semantic.runtimeGovernanceReleaseReadinessViolationReport.actualFlagViolations.length === 0 &&
      semantic.runtimeGovernanceReleaseReadinessViolationReport.proofViolations.length === 0 &&
      semantic.runtimeFinalReleaseGovernanceGateBlockerReport.blockers.length === 0
    ) {
      expect(semantic.runtimeFinalReleaseGovernanceGateSummary.candidateStatus).toBe(
        "final_release_governance_gate_metadata_candidate"
      );
      expect(semantic.runtimeFinalReleaseGovernanceGateSummary.gateMode).toBe("metadata_only");
    }
  });

  it("release final gate watch yields gate watch when built in isolation", () => {
    const base = stripRuntimeFinalReleaseGovernanceGateLayer(buildFullSemantic());
    const gate = buildFinalReleaseGatePlanning({
      runtimeExecutionGovernanceBoundaryFinalSafetyGate: {
        ...base.runtimeExecutionGovernanceBoundaryFinalSafetyGate,
        finalGateStatus: "ready_metadata",
        h38EntryReadiness: "ready_metadata",
        blockers: [],
      },
      runtimeExecutionGovernanceBoundaryBlockerReport: {
        ...base.runtimeExecutionGovernanceBoundaryBlockerReport,
        blockers: [],
      },
      runtimeExecutionBoundaryShellFinalSafetyGate: {
        ...base.runtimeExecutionBoundaryShellFinalSafetyGate,
        finalGateStatus: "ready_metadata",
        blockers: [],
      },
      runtimeGovernanceReleaseReadinessFinalSafetyGate: {
        ...base.runtimeGovernanceReleaseReadinessFinalSafetyGate,
        finalGateStatus: "watch",
        h39EntryReadiness: "watch",
        blockers: [],
      },
      runtimeGovernanceReleaseReadinessSummary: {
        ...base.runtimeGovernanceReleaseReadinessSummary,
        readinessBlockers: [],
      },
      runtimeGovernanceReleaseReadinessVerificationReport: {
        ...base.runtimeGovernanceReleaseReadinessVerificationReport,
        verificationStatus: "partial",
      },
      runtimeGovernanceReleaseReadinessAlignmentReport: {
        ...base.runtimeGovernanceReleaseReadinessAlignmentReport,
        alignmentStatus: "partial",
      },
      runtimeGovernanceReleaseReadinessViolationReport: {
        ...base.runtimeGovernanceReleaseReadinessViolationReport,
        actualFlagViolations: [],
        proofViolations: [],
        wordingRiskFindings: ["wording risk sample"],
      },
      runtimeGovernanceReleaseBlockerReport: {
        ...base.runtimeGovernanceReleaseBlockerReport,
        blockers: [],
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
    expect(gate.runtimeFinalReleaseGovernanceGateSummary.candidateStatus).toBe("watch");
    expect(gate.runtimeFinalReleaseGovernanceGateSummary.gateMode).toBe("disabled");
  });

  it("blocked release readiness yields gate blocked", () => {
    const base = stripRuntimeFinalReleaseGovernanceGateLayer(buildFullSemantic());
    const gate = buildFinalReleaseGatePlanning({
      runtimeGovernanceReleaseReadinessFinalSafetyGate: {
        ...base.runtimeGovernanceReleaseReadinessFinalSafetyGate,
        finalGateStatus: "blocked",
        h39EntryReadiness: "blocked",
      },
      runtimeGovernanceReleaseReadinessVerificationReport: {
        ...base.runtimeGovernanceReleaseReadinessVerificationReport,
        verificationStatus: "failed",
      },
    });
    expect(gate.runtimeFinalReleaseGovernanceGateSummary.candidateStatus).toBe("blocked");
    expect(gate.runtimeFinalReleaseGovernanceGateSummary.gateMode).toBe("blocked");
    expect(gate.runtimeFinalReleaseGovernanceGateBlockerReport.blockers.length).toBeGreaterThan(0);
  });

  it("serializer includes five H39 fields without rebuilding reports", () => {
    const semantic = buildFullSemantic();
    const bundle = serializeRuntimeFinalReleaseGovernanceGateDiagnosticBundleFromSemanticReports(semantic);
    expect(bundle.runtimeFinalReleaseGovernanceGateSummary.candidateStatus).toBe(
      semantic.runtimeFinalReleaseGovernanceGateSummary.candidateStatus
    );
    expect(bundle.runtimeFinalReleaseGovernanceGateScope.candidateTargetLayer).toBe(
      "finalReleaseGovernanceGateCandidate"
    );
    expect(bundle.runtimeFinalReleaseGovernanceGatePolicy.actualExecutionBlockingForbidden).toBe(true);
    expect(bundle.runtimeFinalReleaseGovernanceGateBlockerReport.mode).toBe(
      "runtime_final_release_governance_gate_blocker_report"
    );
    expect(bundle.runtimeFinalReleaseGovernanceGateReadinessChecklist.mode).toBe(
      "runtime_final_release_governance_gate_readiness_checklist"
    );
  });

  it("stripRuntimeFinalReleaseGovernanceGateLayer removes H39 fields only", () => {
    const semantic = buildFullSemantic();
    const stripped = stripRuntimeFinalReleaseGovernanceGateLayer(semantic);
    expect("runtimeFinalReleaseGovernanceGateSummary" in stripped).toBe(false);
    expect(stripped.runtimeGovernanceReleaseReadinessSummary.mode).toBe(
      "runtime_governance_release_readiness_summary"
    );
  });

  it("stripRuntimeGovernanceReleaseReadinessLayer removes H38 and H39 fields", () => {
    const semantic = buildFullSemantic();
    const stripped = stripRuntimeGovernanceReleaseReadinessLayer(semantic);
    expect("runtimeFinalReleaseGovernanceGateSummary" in stripped).toBe(false);
    expect("runtimeGovernanceReleaseReadinessSummary" in stripped).toBe(false);
    expect(stripped.runtimeExecutionGovernanceBoundarySummary.mode).toBe(
      "runtime_execution_governance_boundary_summary"
    );
  });
});
