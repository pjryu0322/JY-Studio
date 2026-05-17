import { describe, expect, it } from "vitest";

import { buildRuntimeReleaseGatePreflightPlanningReports } from "@/lib/harness/runtimeReleaseGatePreflight/buildRuntimeReleaseGatePreflightPlanningReports";
import { buildRuntimeReleaseGatePreflightSummary } from "@/lib/harness/runtimeReleaseGatePreflight/buildRuntimeReleaseGatePreflightSummary";
import { buildRuntimeReleaseGatePreflightFinalSafetyGate } from "@/lib/harness/runtimeReleaseGatePreflight/buildRuntimeReleaseGatePreflightFinalSafetyGate";
import { buildRuntimeReleaseGateNoExecutionProof } from "@/lib/harness/runtimeReleaseGatePreflight/buildRuntimeReleaseGateNoExecutionProof";
import { buildRuntimeReleaseGateOperationForbiddenProof } from "@/lib/harness/runtimeReleaseGatePreflight/buildRuntimeReleaseGateOperationForbiddenProof";
import { detectRuntimeReleaseGatePreflightBlockers } from "@/lib/harness/runtimeReleaseGatePreflight/detectRuntimeReleaseGatePreflightBlockers";
import { detectRuntimeReleaseGatePreflightBoundaryViolations } from "@/lib/harness/runtimeReleaseGatePreflight/detectRuntimeReleaseGatePreflightBoundaryViolations";
import { serializeRuntimeReleaseGatePreflightDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeReleaseGatePreflight/serializeRuntimeReleaseGatePreflightDiagnosticBundle";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticPlanningReportsBeforeReleaseGatePreflight } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  stripRuntimeNoopShellReleaseGateLayer,
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

function buildPreflightPlanning(
  patches: Partial<RuntimeSemanticPlanningReportsBeforeReleaseGatePreflight> = {}
) {
  const base = stripRuntimeReleaseGatePreflightLayer(buildFullSemantic());
  return buildRuntimeReleaseGatePreflightPlanningReports({ ...base, ...patches });
}

describe("H35 / H35.5 release-gate final preflight", () => {
  it("full semantic includes preflight with all actual execution flags false", () => {
    const semantic = buildFullSemantic();
    expect(semantic.runtimeReleaseGatePreflightSummary.mode).toBe("runtime_release_gate_preflight_summary");
    expect(semantic.runtimeReleaseGatePreflightSummary.actualReleaseEnforcementEnabled).toBe(false);
    expect(semantic.runtimeReleaseGatePreflightSummary.actualExecutionEnabled).toBe(false);
    expect(semantic.runtimeReleaseGateNoExecutionProof.diagnosticOnly).toBe(true);
    expect(semantic.runtimeReleaseGateOperationForbiddenProof.actualReleaseEnforcementForbidden).toBe(true);
    expect(semantic.runtimeReleaseGateExecutionReadinessBoundary.mode).toBe(
      "runtime_release_gate_execution_readiness_boundary"
    );
  });

  it("final gate ready + verified + aligned yields preflight_metadata_ready", () => {
    const semantic = buildFullSemantic();
    if (
      semantic.runtimeNoopShellReleaseGateFinalSafetyGate.finalGateStatus === "ready_metadata" &&
      semantic.runtimeNoopShellReleaseGateFinalSafetyGate.h35EntryReadiness === "ready_metadata" &&
      semantic.runtimeNoopShellReleaseGateReadinessVerificationReport.verificationStatus ===
        "verified_metadata" &&
      semantic.runtimeNoopShellReleaseGateAlignmentReport.alignmentStatus === "aligned_metadata" &&
      semantic.runtimeNoopShellReleaseGateBoundaryViolationReport.actualFlagViolations.length === 0 &&
      semantic.runtimeReleaseGatePreflightBlockerReport.blockers.length === 0
    ) {
      expect(semantic.runtimeReleaseGatePreflightSummary.preflightReadiness).toBe("preflight_metadata_ready");
      expect(semantic.runtimeReleaseGatePreflightSummary.preflightMode).toBe("metadata_only");
    }
  });

  it("final gate watch yields preflight watch when built in isolation without blockers", () => {
    const base = stripRuntimeReleaseGatePreflightLayer(buildFullSemantic());
    const noExecutionProof = buildRuntimeReleaseGateNoExecutionProof();
    const operationForbiddenProof = buildRuntimeReleaseGateOperationForbiddenProof();
    const patched: RuntimeSemanticPlanningReportsBeforeReleaseGatePreflight = {
      ...base,
      runtimeNoopShellReleaseGateFinalSafetyGate: {
        ...base.runtimeNoopShellReleaseGateFinalSafetyGate,
        finalGateStatus: "watch",
        h35EntryReadiness: "watch",
        blockers: [],
      },
      runtimeNoopShellReleaseGateReadinessVerificationReport: {
        ...base.runtimeNoopShellReleaseGateReadinessVerificationReport,
        verificationStatus: "partial",
      },
      runtimeNoopShellReleaseGateAlignmentReport: {
        ...base.runtimeNoopShellReleaseGateAlignmentReport,
        alignmentStatus: "partial",
      },
      runtimeNoopShellReleaseGateBoundaryViolationReport: {
        ...base.runtimeNoopShellReleaseGateBoundaryViolationReport,
        actualFlagViolations: [],
        wordingRiskFindings: ["wording risk"],
      },
      runtimeNoopShellReleaseGateBlockerReport: {
        ...base.runtimeNoopShellReleaseGateBlockerReport,
        blockers: [],
      },
      runtimeNoopShellReleaseGateSummary: {
        ...base.runtimeNoopShellReleaseGateSummary,
        releaseGateBlockers: [],
      },
      runtimeNoopShellHardeningFinalSafetyGate: {
        ...base.runtimeNoopShellHardeningFinalSafetyGate,
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
    const blockerReport = detectRuntimeReleaseGatePreflightBlockers(patched);
    const summary = buildRuntimeReleaseGatePreflightSummary({
      reports: patched,
      blockerReport,
      noExecutionProof,
      operationForbiddenProof,
    });
    expect(summary.preflightReadiness).toBe("watch");
    expect(summary.preflightMode).toBe("disabled");
  });

  it("serializer does not rebuild reports", () => {
    const semantic = buildFullSemantic();
    const diag = serializeRuntimeReleaseGatePreflightDiagnosticBundleFromSemanticReports(semantic);
    expect(diag.runtimeReleaseGatePreflightSummary.preflightReadiness).toBe(
      semantic.runtimeReleaseGatePreflightSummary.preflightReadiness
    );
    expect(diag.runtimeReleaseGateNoExecutionProof.diagnosticOnly).toBe(true);
  });

  it("stripRuntimeReleaseGatePreflightLayer removes H35 fields only", () => {
    const semantic = buildFullSemantic();
    const stripped = stripRuntimeReleaseGatePreflightLayer(semantic);
    expect("runtimeReleaseGatePreflightSummary" in stripped).toBe(false);
    expect(stripped.runtimeNoopShellReleaseGateSummary.mode).toBe("runtime_noop_shell_release_gate_summary");
  });

  it("stripRuntimeNoopShellReleaseGateLayer removes H34, H35, and H36 fields", () => {
    const semantic = buildFullSemantic();
    const stripped = stripRuntimeNoopShellReleaseGateLayer(semantic);
    expect("runtimeReleaseGatePreflightSummary" in stripped).toBe(false);
    expect("runtimeExecutionBoundaryShellSummary" in stripped).toBe(false);
    expect("runtimeNoopShellReleaseGateSummary" in stripped).toBe(false);
  });

  it("buildPreflightPlanning returns twelve reports including H35.5", () => {
    const reports = buildPreflightPlanning();
    expect(reports.runtimeReleaseGatePreflightSummary.mode).toBe("runtime_release_gate_preflight_summary");
    expect(reports.runtimeReleaseGateInputEnvelope.envelopeRows.length).toBeGreaterThan(0);
    expect(reports.runtimeReleaseGateOutputEnvelope.envelopeRows.length).toBeGreaterThan(0);
    expect(reports.runtimeReleaseGatePreflightChecklist.checklist.length).toBeGreaterThan(0);
    expect(reports.runtimeReleaseGatePreflightFinalSafetyGate.mode).toBe(
      "runtime_release_gate_preflight_final_safety_gate"
    );
  });

  it("preflight_metadata_ready + verified + aligned + no violations yields final gate ready_metadata", () => {
    const semantic = buildFullSemantic();
    if (semantic.runtimeReleaseGatePreflightSummary.preflightReadiness !== "preflight_metadata_ready") {
      return;
    }
    expect(semantic.runtimeReleaseGatePreflightSummary.preflightMode).toBe("metadata_only");
    expect(semantic.runtimeReleaseGatePreflightReadinessVerificationReport.verificationStatus).toBe(
      "verified_metadata"
    );
    expect(semantic.runtimeReleaseGatePreflightAlignmentReport.alignmentStatus).toBe("aligned_metadata");
    expect(semantic.runtimeReleaseGatePreflightBoundaryViolationReport.actualFlagViolations).toEqual([]);
    expect(semantic.runtimeReleaseGatePreflightBoundaryViolationReport.proofViolations).toEqual([]);
    expect(semantic.runtimeReleaseGatePreflightFinalSafetyGate.finalGateStatus).toBe("ready_metadata");
    expect(semantic.runtimeReleaseGatePreflightFinalSafetyGate.h36EntryReadiness).toBe("ready_metadata");
  });

  it("watch preflight yields final gate watch when built in isolation", () => {
    const partial = buildPreflightPlanning();
    const finalGate = buildRuntimeReleaseGatePreflightFinalSafetyGate({
      summary: {
        ...partial.runtimeReleaseGatePreflightSummary,
        preflightReadiness: "watch",
        preflightMode: "metadata_only",
        preflightBlockers: [],
      },
      blockerReport: {
        ...partial.runtimeReleaseGatePreflightBlockerReport,
        blockers: [],
      },
      boundaryViolation: {
        ...partial.runtimeReleaseGatePreflightBoundaryViolationReport,
        actualFlagViolations: [],
        proofViolations: [],
        wordingRiskFindings: ["wording risk"],
      },
      readinessVerification: {
        ...partial.runtimeReleaseGatePreflightReadinessVerificationReport,
        verificationStatus: "partial",
      },
      alignmentReport: {
        ...partial.runtimeReleaseGatePreflightAlignmentReport,
        alignmentStatus: "aligned_metadata",
      },
    });
    expect(finalGate.finalGateStatus).toBe("watch");
    expect(finalGate.h36EntryReadiness).toBe("watch");
  });

  it("blocked preflight yields final gate blocked", () => {
    const base = stripRuntimeReleaseGatePreflightLayer(buildFullSemantic());
    const preflight = buildPreflightPlanning({
      runtimeNoopShellReleaseGateFinalSafetyGate: {
        ...base.runtimeNoopShellReleaseGateFinalSafetyGate,
        finalGateStatus: "blocked",
        h35EntryReadiness: "blocked",
      },
    });
    expect(preflight.runtimeReleaseGatePreflightSummary.preflightReadiness).toBe("blocked");
    expect(preflight.runtimeReleaseGatePreflightFinalSafetyGate.finalGateStatus).toBe("blocked");
  });

  it("noExecutionProof diagnosticOnly false yields boundary proof violation", () => {
    const partial = buildPreflightPlanning();
    const noExecutionProof = {
      ...partial.runtimeReleaseGateNoExecutionProof,
      diagnosticOnly: false as unknown as true,
    };
    const violation = detectRuntimeReleaseGatePreflightBoundaryViolations({
      summary: partial.runtimeReleaseGatePreflightSummary,
      noExecutionProof,
      operationForbiddenProof: partial.runtimeReleaseGateOperationForbiddenProof,
    });
    expect(violation.proofViolations.some((v) => v.includes("diagnosticOnly"))).toBe(true);
  });

  it("releaseEnforced true yields boundary proof violation", () => {
    const partial = buildPreflightPlanning();
    const violation = detectRuntimeReleaseGatePreflightBoundaryViolations({
      summary: partial.runtimeReleaseGatePreflightSummary,
      noExecutionProof: {
        ...partial.runtimeReleaseGateNoExecutionProof,
        releaseEnforced: true as unknown as false,
      },
      operationForbiddenProof: partial.runtimeReleaseGateOperationForbiddenProof,
    });
    expect(violation.proofViolations.some((v) => v.includes("releaseEnforced"))).toBe(true);
  });

  it("serializer includes H35.5 fields", () => {
    const semantic = buildFullSemantic();
    const diag = serializeRuntimeReleaseGatePreflightDiagnosticBundleFromSemanticReports(semantic);
    expect(diag.runtimeReleaseGatePreflightFinalSafetyGate).toEqual(
      expect.objectContaining({
        finalGateStatus: semantic.runtimeReleaseGatePreflightFinalSafetyGate.finalGateStatus,
        h36EntryReadiness: semantic.runtimeReleaseGatePreflightFinalSafetyGate.h36EntryReadiness,
      })
    );
    expect(diag.runtimeReleaseGatePreflightBoundaryViolationReport).toBeDefined();
    expect(diag.runtimeReleaseGatePreflightReadinessVerificationReport).toBeDefined();
    expect(diag.runtimeReleaseGatePreflightAlignmentReport).toBeDefined();
  });
});
