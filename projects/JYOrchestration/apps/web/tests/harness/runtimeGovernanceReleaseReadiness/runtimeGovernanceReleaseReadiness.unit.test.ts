import { describe, expect, it } from "vitest";

import { buildRuntimeGovernanceReleaseReadinessPlanningReports } from "@/lib/harness/runtimeGovernanceReleaseReadiness/buildRuntimeGovernanceReleaseReadinessPlanningReports";
import { buildRuntimeGovernanceReleaseReadinessSummary } from "@/lib/harness/runtimeGovernanceReleaseReadiness/buildRuntimeGovernanceReleaseReadinessSummary";
import { buildRuntimeGovernanceNoEnforcementProof } from "@/lib/harness/runtimeGovernanceReleaseReadiness/buildRuntimeGovernanceNoEnforcementProof";
import {
  buildRuntimeExecutionGovernanceForbiddenProof,
  isRuntimeExecutionGovernanceForbiddenProofComplete,
} from "@/lib/harness/runtimeGovernanceReleaseReadiness/buildRuntimeExecutionGovernanceForbiddenProof";
import { detectRuntimeGovernanceReleaseBlockers } from "@/lib/harness/runtimeGovernanceReleaseReadiness/detectRuntimeGovernanceReleaseBlockers";
import { detectRuntimeGovernanceReleaseReadinessViolations } from "@/lib/harness/runtimeGovernanceReleaseReadiness/detectRuntimeGovernanceReleaseReadinessViolations";
import { serializeRuntimeGovernanceReleaseReadinessDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeGovernanceReleaseReadiness/serializeRuntimeGovernanceReleaseReadinessDiagnosticBundle";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticPlanningReportsBeforeGovernanceReleaseReadiness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  stripRuntimeExecutionGovernanceBoundaryLayer,
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

function buildGovernanceReleasePlanning(
  patches: Partial<RuntimeSemanticPlanningReportsBeforeGovernanceReleaseReadiness> = {}
) {
  const base = stripRuntimeGovernanceReleaseReadinessLayer(buildFullSemantic());
  return buildRuntimeGovernanceReleaseReadinessPlanningReports({ ...base, ...patches });
}

describe("H38 / H38.5 governance release-readiness", () => {
  it("full semantic includes governance release-readiness with all actual flags false", () => {
    const semantic = buildFullSemantic();
    expect(semantic.runtimeGovernanceReleaseReadinessSummary.mode).toBe(
      "runtime_governance_release_readiness_summary"
    );
    expect(semantic.runtimeGovernanceReleaseReadinessSummary.actualExecutionEnabled).toBe(false);
    expect(semantic.runtimeGovernanceNoEnforcementProof.diagnosticOnly).toBe(true);
    expect(semantic.runtimeExecutionGovernanceForbiddenProof.actualExecutionForbidden).toBe(true);
    expect(semantic.runtimeGovernanceReleaseReadinessBoundary.boundaryTargetLayer).toBe(
      "finalExecutionGovernanceReadinessBoundary"
    );
    expect(semantic.runtimeGovernanceReleaseReadinessFinalSafetyGate.mode).toBe(
      "runtime_governance_release_readiness_final_safety_gate"
    );
    expect(semantic.runtimeGovernanceReleaseReadinessViolationReport.mode).toBe(
      "runtime_governance_release_readiness_violation_report"
    );
    expect(semantic.runtimeGovernanceReleaseReadinessVerificationReport.mode).toBe(
      "runtime_governance_release_readiness_verification_report"
    );
    expect(semantic.runtimeGovernanceReleaseReadinessAlignmentReport.mode).toBe(
      "runtime_governance_release_readiness_alignment_report"
    );
  });

  it("governance final gate ready yields governance_release_metadata_ready when upstream aligned", () => {
    const semantic = buildFullSemantic();
    if (
      semantic.runtimeExecutionGovernanceBoundaryFinalSafetyGate.finalGateStatus === "ready_metadata" &&
      semantic.runtimeExecutionGovernanceBoundaryFinalSafetyGate.h38EntryReadiness === "ready_metadata" &&
      semantic.runtimeExecutionGovernanceBoundaryReadinessVerificationReport.verificationStatus ===
        "verified_metadata" &&
      semantic.runtimeExecutionGovernanceBoundaryAlignmentReport.alignmentStatus === "aligned_metadata" &&
      semantic.runtimeExecutionGovernanceBoundaryViolationReport.actualFlagViolations.length === 0 &&
      semantic.runtimeGovernanceReleaseBlockerReport.blockers.length === 0
    ) {
      expect(semantic.runtimeGovernanceReleaseReadinessSummary.readinessStatus).toBe(
        "governance_release_metadata_ready"
      );
      expect(semantic.runtimeGovernanceReleaseReadinessSummary.readinessMode).toBe("metadata_only");
    }
  });

  it("governance final gate watch yields watch when built in isolation without blockers", () => {
    const base = stripRuntimeGovernanceReleaseReadinessLayer(buildFullSemantic());
    const noEnforcementProof = buildRuntimeGovernanceNoEnforcementProof();
    const forbiddenProof = buildRuntimeExecutionGovernanceForbiddenProof();
    const patched: RuntimeSemanticPlanningReportsBeforeGovernanceReleaseReadiness = {
      ...base,
      runtimeExecutionGovernanceBoundaryFinalSafetyGate: {
        ...base.runtimeExecutionGovernanceBoundaryFinalSafetyGate,
        finalGateStatus: "watch",
        h38EntryReadiness: "watch",
        blockers: [],
      },
      runtimeExecutionGovernanceBoundaryReadinessVerificationReport: {
        ...base.runtimeExecutionGovernanceBoundaryReadinessVerificationReport,
        verificationStatus: "partial",
      },
      runtimeExecutionGovernanceBoundaryAlignmentReport: {
        ...base.runtimeExecutionGovernanceBoundaryAlignmentReport,
        alignmentStatus: "partial",
      },
      runtimeExecutionGovernanceBoundaryViolationReport: {
        ...base.runtimeExecutionGovernanceBoundaryViolationReport,
        actualFlagViolations: [],
        wordingRiskFindings: ["wording risk"],
      },
      runtimeExecutionGovernanceBoundaryBlockerReport: {
        ...base.runtimeExecutionGovernanceBoundaryBlockerReport,
        blockers: [],
      },
      runtimeExecutionGovernanceBoundarySummary: {
        ...base.runtimeExecutionGovernanceBoundarySummary,
        governanceBlockers: [],
      },
      runtimeExecutionBoundaryShellFinalSafetyGate: {
        ...base.runtimeExecutionBoundaryShellFinalSafetyGate,
        finalGateStatus: "ready_metadata",
        blockers: [],
      },
      runtimeReleaseGatePreflightFinalSafetyGate: {
        ...base.runtimeReleaseGatePreflightFinalSafetyGate,
        finalGateStatus: "ready_metadata",
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
    };
    const blockerReport = detectRuntimeGovernanceReleaseBlockers(patched);
    const summary = buildRuntimeGovernanceReleaseReadinessSummary({
      reports: patched,
      blockerReport,
      noEnforcementProof,
      forbiddenProof,
    });
    expect(summary.readinessStatus).toBe("watch");
  });

  it("governance_release_metadata_ready + verified + aligned yields final gate ready_metadata", () => {
    const semantic = buildFullSemantic();
    if (
      semantic.runtimeGovernanceReleaseReadinessSummary.readinessStatus === "governance_release_metadata_ready" &&
      semantic.runtimeGovernanceReleaseReadinessSummary.readinessMode === "metadata_only" &&
      semantic.runtimeGovernanceReleaseReadinessVerificationReport.verificationStatus === "verified_metadata" &&
      semantic.runtimeGovernanceReleaseReadinessAlignmentReport.alignmentStatus === "aligned_metadata" &&
      semantic.runtimeGovernanceReleaseReadinessViolationReport.actualFlagViolations.length === 0 &&
      semantic.runtimeGovernanceReleaseReadinessViolationReport.proofViolations.length === 0
    ) {
      expect(semantic.runtimeGovernanceReleaseReadinessFinalSafetyGate.finalGateStatus).toBe("ready_metadata");
      expect(semantic.runtimeGovernanceReleaseReadinessFinalSafetyGate.h39EntryReadiness).toBe("ready_metadata");
    }
  });

  it("noEnforcementProof diagnosticOnly false yields proof violation", () => {
    const partial = buildGovernanceReleasePlanning();
    const violation = detectRuntimeGovernanceReleaseReadinessViolations({
      summary: partial.runtimeGovernanceReleaseReadinessSummary,
      noEnforcementProof: {
        ...partial.runtimeGovernanceNoEnforcementProof,
        diagnosticOnly: false as unknown as true,
      },
      forbiddenProof: partial.runtimeExecutionGovernanceForbiddenProof,
    });
    expect(violation.proofViolations.some((v) => v.includes("diagnosticOnly"))).toBe(true);
  });

  it("noEnforcementProof releaseEnforced true yields proof violation", () => {
    const partial = buildGovernanceReleasePlanning();
    const violation = detectRuntimeGovernanceReleaseReadinessViolations({
      summary: partial.runtimeGovernanceReleaseReadinessSummary,
      noEnforcementProof: {
        ...partial.runtimeGovernanceNoEnforcementProof,
        releaseEnforced: true as unknown as false,
      },
      forbiddenProof: partial.runtimeExecutionGovernanceForbiddenProof,
    });
    expect(violation.proofViolations.some((v) => v.includes("releaseEnforced"))).toBe(true);
  });

  it("forbidden proof incomplete yields proof violation", () => {
    const partial = buildGovernanceReleasePlanning();
    const incomplete = {
      ...partial.runtimeExecutionGovernanceForbiddenProof,
      actualExecutionForbidden: false as unknown as true,
    };
    expect(isRuntimeExecutionGovernanceForbiddenProofComplete(incomplete)).toBe(false);
    const violation = detectRuntimeGovernanceReleaseReadinessViolations({
      summary: partial.runtimeGovernanceReleaseReadinessSummary,
      noEnforcementProof: partial.runtimeGovernanceNoEnforcementProof,
      forbiddenProof: incomplete,
    });
    expect(violation.proofViolations.some((v) => v.includes("incomplete"))).toBe(true);
  });

  it("serializeRuntimeGovernanceReleaseReadinessDiagnosticBundle exposes twelve fields", () => {
    const semantic = buildFullSemantic();
    const serialized = serializeRuntimeGovernanceReleaseReadinessDiagnosticBundleFromSemanticReports(semantic);
    expect(serialized.runtimeGovernanceReleaseReadinessSummary).toBeDefined();
    expect(serialized.runtimeGovernanceReleaseReadinessBoundary).toBeDefined();
    expect(serialized.runtimeGovernanceNoEnforcementProof.diagnosticOnly).toBe(true);
    expect(serialized.runtimeExecutionGovernanceForbiddenProof.actualExecutionForbidden).toBe(true);
    expect(serialized.runtimeGovernanceReleaseReadinessChecklist).toBeDefined();
    expect(serialized.runtimeGovernanceReleaseReadinessViolationReport).toBeDefined();
    expect(serialized.runtimeGovernanceReleaseReadinessVerificationReport).toBeDefined();
    expect(serialized.runtimeGovernanceReleaseReadinessAlignmentReport).toBeDefined();
    expect(serialized.runtimeGovernanceReleaseReadinessFinalSafetyGate).toEqual(
      expect.objectContaining({
        finalGateStatus: semantic.runtimeGovernanceReleaseReadinessFinalSafetyGate.finalGateStatus,
        h39EntryReadiness: semantic.runtimeGovernanceReleaseReadinessFinalSafetyGate.h39EntryReadiness,
      })
    );
  });

  it("stripRuntimeGovernanceReleaseReadinessLayer removes H38 fields only", () => {
    const semantic = buildFullSemantic();
    const stripped = stripRuntimeGovernanceReleaseReadinessLayer(semantic);
    expect("runtimeGovernanceReleaseReadinessSummary" in stripped).toBe(false);
    expect("runtimeExecutionGovernanceBoundarySummary" in stripped).toBe(true);
  });

  it("stripRuntimeExecutionGovernanceBoundaryLayer keeps H36 and removes H37/H38", () => {
    const semantic = buildFullSemantic();
    const stripped = stripRuntimeExecutionGovernanceBoundaryLayer(semantic);
    expect("runtimeExecutionGovernanceBoundarySummary" in stripped).toBe(false);
    expect("runtimeGovernanceReleaseReadinessSummary" in stripped).toBe(false);
    expect("runtimeExecutionBoundaryShellSummary" in stripped).toBe(true);
  });

  it("buildGovernanceReleasePlanning merges patches", () => {
    const reports = buildGovernanceReleasePlanning();
    expect(reports.runtimeGovernanceReleaseReadinessSummary.mode).toBe(
      "runtime_governance_release_readiness_summary"
    );
    expect(reports.runtimeGovernanceReleaseBlockerReport.mode).toBe("runtime_governance_release_blocker_report");
    expect(reports.runtimeGovernanceReleaseReadinessFinalSafetyGate.mode).toBe(
      "runtime_governance_release_readiness_final_safety_gate"
    );
    expect(reports.runtimeGovernanceReleaseReadinessViolationReport.actualFlagViolations).toBeDefined();
    expect(reports.runtimeGovernanceReleaseReadinessVerificationReport.findings).toBeDefined();
    expect(reports.runtimeGovernanceReleaseReadinessAlignmentReport.findings).toBeDefined();
  });
});
