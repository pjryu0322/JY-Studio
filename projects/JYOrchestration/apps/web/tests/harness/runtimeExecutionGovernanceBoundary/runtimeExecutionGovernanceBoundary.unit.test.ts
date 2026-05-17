import { describe, expect, it } from "vitest";

import { buildRuntimeExecutionGovernanceBoundaryPlanningReports } from "@/lib/harness/runtimeExecutionGovernanceBoundary/buildRuntimeExecutionGovernanceBoundaryPlanningReports";
import { serializeRuntimeExecutionGovernanceBoundaryDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeExecutionGovernanceBoundary/serializeRuntimeExecutionGovernanceBoundaryDiagnosticBundle";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticPlanningReportsBeforeExecutionGovernanceBoundary } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  stripRuntimeExecutionGovernanceBoundaryLayer,
  stripRuntimeExecutionBoundaryShellLayer,
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

function buildGovernancePlanning(
  patches: Partial<RuntimeSemanticPlanningReportsBeforeExecutionGovernanceBoundary> = {}
) {
  const base = stripRuntimeExecutionGovernanceBoundaryLayer(buildFullSemantic());
  return buildRuntimeExecutionGovernanceBoundaryPlanningReports({ ...base, ...patches });
}

describe("H37 execution governance boundary candidate", () => {
  it("full semantic includes governance boundary with all actual execution flags false", () => {
    const semantic = buildFullSemantic();
    expect(semantic.runtimeExecutionGovernanceBoundarySummary.mode).toBe(
      "runtime_execution_governance_boundary_summary"
    );
    expect(semantic.runtimeExecutionGovernanceBoundarySummary.actualExecutionEnabled).toBe(false);
    expect(semantic.runtimeExecutionGovernanceBoundarySummary.actualExecutionRoutingEnabled).toBe(false);
    expect(semantic.runtimeExecutionGovernanceBoundarySummary.actualApprovalEnforcementEnabled).toBe(false);
    expect(semantic.runtimeExecutionGovernanceBoundaryPolicy.actualExecutionForbidden).toBe(true);
    expect(semantic.runtimeExecutionGovernanceBoundaryPolicy.actualExecutionRoutingForbidden).toBe(true);
    expect(semantic.runtimeExecutionGovernanceBoundaryPolicy.actualApprovalEnforcementForbidden).toBe(true);
  });

  it("shell final gate ready + verified + aligned + no violations yields governance_boundary_metadata_candidate", () => {
    const semantic = buildFullSemantic();
    if (
      semantic.runtimeExecutionBoundaryShellFinalSafetyGate.finalGateStatus === "ready_metadata" &&
      semantic.runtimeExecutionBoundaryShellReadinessVerificationReport.verificationStatus ===
        "verified_metadata" &&
      semantic.runtimeExecutionBoundaryShellAlignmentReport.alignmentStatus === "aligned_metadata" &&
      semantic.runtimeExecutionBoundaryShellBoundaryViolationReport.actualFlagViolations.length === 0 &&
      semantic.runtimeExecutionBoundaryShellSummary.shellBlockers.length === 0
    ) {
      expect(semantic.runtimeExecutionGovernanceBoundarySummary.candidateStatus).toBe(
        "governance_boundary_metadata_candidate"
      );
      expect(semantic.runtimeExecutionGovernanceBoundarySummary.governanceMode).toBe("metadata_only");
      expect(semantic.runtimeExecutionGovernanceBoundarySummary.hardeningReadiness).toBe(
        "hardening_metadata_ready"
      );
    }
  });

  it("shell final gate watch yields governance watch", () => {
    const base = stripRuntimeExecutionGovernanceBoundaryLayer(buildFullSemantic());
    const governance = buildGovernancePlanning({
      runtimeReleaseGatePreflightFinalSafetyGate: {
        ...base.runtimeReleaseGatePreflightFinalSafetyGate,
        finalGateStatus: "ready_metadata",
        h36EntryReadiness: "ready_metadata",
        blockers: [],
      },
      runtimeReleaseGatePreflightBlockerReport: {
        ...base.runtimeReleaseGatePreflightBlockerReport,
        blockers: [],
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
        boundaryRisk: "stable",
      },
      runtimeExecutionBoundaryShellFinalSafetyGate: {
        ...base.runtimeExecutionBoundaryShellFinalSafetyGate,
        finalGateStatus: "watch",
        h37EntryReadiness: "watch",
        blockers: [],
      },
      runtimeExecutionBoundaryShellSummary: {
        ...base.runtimeExecutionBoundaryShellSummary,
        candidateStatus: "watch",
        shellBlockers: [],
      },
      runtimeExecutionBoundaryShellBlockerReport: {
        ...base.runtimeExecutionBoundaryShellBlockerReport,
        blockers: [],
      },
      runtimeExecutionBoundaryShellBoundaryViolationReport: {
        ...base.runtimeExecutionBoundaryShellBoundaryViolationReport,
        actualFlagViolations: [],
        wordingRiskFindings: ["wording risk"],
      },
      runtimeExecutionBoundaryShellReadinessVerificationReport: {
        ...base.runtimeExecutionBoundaryShellReadinessVerificationReport,
        verificationStatus: "partial",
      },
      runtimeExecutionBoundaryShellAlignmentReport: {
        ...base.runtimeExecutionBoundaryShellAlignmentReport,
        alignmentStatus: "partial",
      },
    });
    expect(governance.runtimeExecutionGovernanceBoundarySummary.candidateStatus).toBe("watch");
  });

  it("shell final gate blocked yields governance blocked", () => {
    const base = stripRuntimeExecutionGovernanceBoundaryLayer(buildFullSemantic());
    const governance = buildGovernancePlanning({
      runtimeExecutionBoundaryShellFinalSafetyGate: {
        ...base.runtimeExecutionBoundaryShellFinalSafetyGate,
        finalGateStatus: "blocked",
        h37EntryReadiness: "blocked",
      },
    });
    expect(governance.runtimeExecutionGovernanceBoundarySummary.candidateStatus).toBe("blocked");
    expect(governance.runtimeExecutionGovernanceBoundarySummary.governanceMode).toBe("blocked");
  });

  it("shell readiness verification failed yields governance blocked", () => {
    const base = stripRuntimeExecutionGovernanceBoundaryLayer(buildFullSemantic());
    const governance = buildGovernancePlanning({
      runtimeExecutionBoundaryShellReadinessVerificationReport: {
        ...base.runtimeExecutionBoundaryShellReadinessVerificationReport,
        verificationStatus: "failed",
      },
    });
    expect(governance.runtimeExecutionGovernanceBoundarySummary.candidateStatus).toBe("blocked");
  });

  it("shell alignment failed yields governance blocked", () => {
    const base = stripRuntimeExecutionGovernanceBoundaryLayer(buildFullSemantic());
    const governance = buildGovernancePlanning({
      runtimeExecutionBoundaryShellAlignmentReport: {
        ...base.runtimeExecutionBoundaryShellAlignmentReport,
        alignmentStatus: "failed",
      },
    });
    expect(governance.runtimeExecutionGovernanceBoundarySummary.candidateStatus).toBe("blocked");
  });

  it("shell boundary actual flag violation yields governance blocked", () => {
    const base = stripRuntimeExecutionGovernanceBoundaryLayer(buildFullSemantic());
    const governance = buildGovernancePlanning({
      runtimeExecutionBoundaryShellBoundaryViolationReport: {
        ...base.runtimeExecutionBoundaryShellBoundaryViolationReport,
        actualFlagViolations: ["actualExecutionEnabled must be false"],
        proofViolations: [],
      },
    });
    expect(governance.runtimeExecutionGovernanceBoundarySummary.candidateStatus).toBe("blocked");
  });

  it("serializer does not rebuild reports", () => {
    const semantic = buildFullSemantic();
    const serialized = serializeRuntimeExecutionGovernanceBoundaryDiagnosticBundleFromSemanticReports(semantic);
    expect(serialized.runtimeExecutionGovernanceBoundarySummary).toEqual(
      expect.objectContaining({
        candidateStatus: semantic.runtimeExecutionGovernanceBoundarySummary.candidateStatus,
        governanceMode: semantic.runtimeExecutionGovernanceBoundarySummary.governanceMode,
        actualExecutionEnabled: false,
        actualExecutionRoutingEnabled: false,
        actualApprovalEnforcementEnabled: false,
      })
    );
    expect(serialized.runtimeExecutionGovernanceBoundaryPolicy).toEqual(
      expect.objectContaining({
        actualExecutionForbidden: semantic.runtimeExecutionGovernanceBoundaryPolicy.actualExecutionForbidden,
        actualExecutionRoutingForbidden:
          semantic.runtimeExecutionGovernanceBoundaryPolicy.actualExecutionRoutingForbidden,
        actualApprovalEnforcementForbidden:
          semantic.runtimeExecutionGovernanceBoundaryPolicy.actualApprovalEnforcementForbidden,
      })
    );
    expect(serialized.runtimeExecutionGovernanceBoundaryScope.candidateSourceLayer).toBe(
      semantic.runtimeExecutionGovernanceBoundaryScope.candidateSourceLayer
    );
  });

  it("stripRuntimeExecutionGovernanceBoundaryLayer removes H37 fields only", () => {
    const semantic = buildFullSemantic();
    const stripped = stripRuntimeExecutionGovernanceBoundaryLayer(semantic);
    expect("runtimeExecutionGovernanceBoundarySummary" in stripped).toBe(false);
    expect("runtimeExecutionBoundaryShellSummary" in stripped).toBe(true);
    expect(stripped.runtimeExecutionBoundaryShellFinalSafetyGate.mode).toBe(
      "runtime_execution_boundary_shell_final_safety_gate"
    );
  });

  it("stripRuntimeExecutionBoundaryShellLayer keeps H37 fields", () => {
    const semantic = buildFullSemantic();
    const stripped = stripRuntimeExecutionBoundaryShellLayer(semantic);
    expect("runtimeExecutionBoundaryShellSummary" in stripped).toBe(false);
    expect("runtimeExecutionGovernanceBoundarySummary" in stripped).toBe(true);
  });
});
