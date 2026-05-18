import { describe, expect, it } from "vitest";

import { buildRuntimeRunnerInvocationPlanningReports } from "@/lib/harness/runtimeRunnerInvocation/buildRuntimeRunnerInvocationPlanningReports";
import { detectRuntimeRunnerInvocationBoundaryViolations } from "@/lib/harness/runtimeRunnerInvocation/detectRuntimeRunnerInvocationBoundaryViolations";
import { verifyRuntimeRunnerInvocationReadiness } from "@/lib/harness/runtimeRunnerInvocation/verifyRuntimeRunnerInvocationReadiness";
import { serializeRuntimeRunnerInvocationDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeRunnerInvocation/serializeRuntimeRunnerInvocationDiagnosticBundle";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticPlanningReportsBeforeRunnerInvocation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { stripRuntimeRunnerInvocationLayer } from "../runtimePlanningReportStrip";
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

/** H29 layer tests: skeleton reports are patched in-place (skeleton builder recomputes preflight). */
function buildRunnerInvocationPlanning(
  patches: Partial<RuntimeSemanticPlanningReportsBeforeRunnerInvocation> = {}
) {
  const base = stripRuntimeRunnerInvocationLayer(buildFullSemantic());
  return buildRuntimeRunnerInvocationPlanningReports({ ...base, ...patches });
}

/** Clears H29 upstream blocker fields so skeleton-only watch paths are testable. */
function withH29UpstreamWatchBaseline(
  patches: Partial<RuntimeSemanticPlanningReportsBeforeRunnerInvocation>
): Partial<RuntimeSemanticPlanningReportsBeforeRunnerInvocation> {
  const base = stripRuntimeRunnerInvocationLayer(buildFullSemantic());
  return {
    runtimePilotActivationFinalSafetyGate: {
      ...base.runtimePilotActivationFinalSafetyGate,
      finalGateStatus: "watch",
    },
    runtimeAdapterSandboxPreflightSummary: {
      ...base.runtimeAdapterSandboxPreflightSummary,
      preflightReadiness: "ready_metadata",
    },
    runtimeNoopAdapterPreflightSummary: {
      ...base.runtimeNoopAdapterPreflightSummary,
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
    ...patches,
  };
}

describe("H29 isolated dry-run runner invocation candidate", () => {
  it("full semantic includes runner invocation with all actual invocation flags false", () => {
    const semantic = buildFullSemantic();
    expect(semantic.runtimeRunnerInvocationSummary.mode).toBe("runtime_runner_invocation_summary");
    expect(semantic.runtimeRunnerInvocationSummary.actualIsolatedRunnerInvocationEnabled).toBe(false);
    expect(semantic.runtimeRunnerInvocationSummary.actualDryRunRunnerInvocationEnabled).toBe(false);
    expect(semantic.runtimeRunnerInvocationPolicy.actualInvocationForbidden).toBe(true);
    expect(semantic.runtimeRunnerInvocationPolicy.runnerContractRequired).toBe(true);
    expect(semantic.runtimeRunnerInvocationPolicy.runnerSafetyGuardRequired).toBe(true);
    expect(semantic.runtimeRunnerInvocationPolicy.runnerNoExecutionResultRequired).toBe(true);
  });

  it("skeleton preflight ready_metadata + verified contract can yield invocation_metadata_candidate", () => {
    const semantic = buildFullSemantic();
    if (
      semantic.runtimePilotSkeletonPreflightSummary.preflightReadiness === "ready_metadata" &&
      semantic.runtimePilotRunnerContractVerificationReport.verificationStatus === "verified_metadata" &&
      semantic.runtimePilotRunnerBoundaryViolationReport.actualFlagViolations.length === 0 &&
      semantic.runtimePilotSkeletonBlockerReport.blockers.length === 0 &&
      semantic.runtimePilotRunnerNoExecutionResultMetadata.diagnosticOnly === true
    ) {
      expect(semantic.runtimeRunnerInvocationSummary.candidateStatus).toBe("invocation_metadata_candidate");
      expect(semantic.runtimeRunnerInvocationSummary.invocationMode).toBe("metadata_only");
    }
  });

  it("skeleton preflight watch yields invocation watch", () => {
    const base = stripRuntimeRunnerInvocationLayer(buildFullSemantic());
    const invocation = buildRunnerInvocationPlanning(
      withH29UpstreamWatchBaseline({
        runtimePilotSkeletonPreflightSummary: {
          ...base.runtimePilotSkeletonPreflightSummary,
          preflightReadiness: "watch",
        },
        runtimePilotRunnerContractVerificationReport: {
          ...base.runtimePilotRunnerContractVerificationReport,
          verificationStatus: "partial",
        },
        runtimePilotRunnerBoundaryViolationReport: {
          ...base.runtimePilotRunnerBoundaryViolationReport,
          actualFlagViolations: [],
          wordingRiskFindings: ["wording risk"],
        },
        runtimePilotSkeletonBlockerReport: {
          ...base.runtimePilotSkeletonBlockerReport,
          blockers: [],
        },
      })
    );
    expect(invocation.runtimeRunnerInvocationSummary.candidateStatus).toBe("watch");
    expect(invocation.runtimeRunnerInvocationSummary.invocationMode).toBe("disabled");
  });

  it("skeleton preflight blocked yields invocation blocked", () => {
    const base = stripRuntimeRunnerInvocationLayer(buildFullSemantic());
    const invocation = buildRunnerInvocationPlanning({
      runtimePilotSkeletonPreflightSummary: {
        ...base.runtimePilotSkeletonPreflightSummary,
        preflightReadiness: "blocked",
      },
    });
    expect(invocation.runtimeRunnerInvocationSummary.candidateStatus).toBe("blocked");
    expect(invocation.runtimeRunnerInvocationSummary.invocationMode).toBe("blocked");
  });

  it("runner contract failed yields invocation blocked", () => {
    const base = stripRuntimeRunnerInvocationLayer(buildFullSemantic());
    const invocation = buildRunnerInvocationPlanning({
      runtimePilotRunnerContractVerificationReport: {
        ...base.runtimePilotRunnerContractVerificationReport,
        verificationStatus: "failed",
      },
    });
    expect(invocation.runtimeRunnerInvocationSummary.candidateStatus).toBe("blocked");
  });

  it("runner boundary violation yields invocation blocked", () => {
    const semantic = buildFullSemantic();
    if (semantic.runtimePilotRunnerBoundaryViolationReport.actualFlagViolations.length > 0) {
      expect(semantic.runtimeRunnerInvocationSummary.candidateStatus).toBe("blocked");
    }
  });

  it("skeleton blocker exists yields invocation blocked", () => {
    const base = stripRuntimeRunnerInvocationLayer(buildFullSemantic());
    const invocation = buildRunnerInvocationPlanning({
      runtimePilotSkeletonBlockerReport: {
        ...base.runtimePilotSkeletonBlockerReport,
        blockers: ["test skeleton blocker"],
      },
    });
    expect(invocation.runtimeRunnerInvocationSummary.candidateStatus).toBe("blocked");
  });

  it("serializer does not rebuild reports", () => {
    const semantic = buildFullSemantic();
    const ser = serializeRuntimeRunnerInvocationDiagnosticBundleFromSemanticReports(semantic);
    expect(ser.runtimeRunnerInvocationSummary.mode).toBe("runtime_runner_invocation_summary");
    expect(ser.runtimeRunnerInvocationScope.mode).toBe("runtime_runner_invocation_scope");
    expect(ser.runtimeRunnerInvocationPolicy.actualInvocationForbidden).toBe(true);
    expect(ser.runtimeRunnerInvocationBlockerReport.mode).toBe("runtime_runner_invocation_blocker_report");
    expect(ser.runtimeRunnerInvocationReadinessChecklist.mode).toBe(
      "runtime_runner_invocation_readiness_checklist"
    );
    expect(ser.runtimeRunnerInvocationFinalSafetyGate.mode).toBe("runtime_runner_invocation_final_safety_gate");
    expect(ser.runtimeRunnerInvocationBoundaryViolationReport.mode).toBe(
      "runtime_runner_invocation_boundary_violation_report"
    );
    expect(ser.runtimeRunnerInvocationReadinessVerificationReport.mode).toBe(
      "runtime_runner_invocation_readiness_verification_report"
    );
  });

  it("stripRuntimeRunnerInvocationLayer removes H29 fields only", () => {
    const semantic = buildFullSemantic();
    const stripped = stripRuntimeRunnerInvocationLayer(semantic);
    expect("runtimeRunnerInvocationSummary" in stripped).toBe(false);
    expect("runtimeRunnerInvocationFinalSafetyGate" in stripped).toBe(false);
    expect(stripped.runtimePilotSkeletonPreflightSummary.mode).toBe("runtime_pilot_skeleton_preflight_summary");
  });
});

describe("H29.5 runner invocation stabilization & final safety gate", () => {
  it("full semantic includes H29.5 reports", () => {
    const semantic = buildFullSemantic();
    expect(semantic.runtimeRunnerInvocationFinalSafetyGate.mode).toBe("runtime_runner_invocation_final_safety_gate");
    expect(semantic.runtimeRunnerInvocationBoundaryViolationReport.mode).toBe(
      "runtime_runner_invocation_boundary_violation_report"
    );
    expect(semantic.runtimeRunnerInvocationReadinessVerificationReport.mode).toBe(
      "runtime_runner_invocation_readiness_verification_report"
    );
  });

  it("ready candidate with verified readiness can yield final gate ready_metadata", () => {
    const semantic = buildFullSemantic();
    if (
      semantic.runtimeRunnerInvocationSummary.candidateStatus === "invocation_metadata_candidate" &&
      semantic.runtimeRunnerInvocationSummary.invocationMode === "metadata_only" &&
      semantic.runtimeRunnerInvocationReadinessVerificationReport.verificationStatus === "verified_metadata" &&
      semantic.runtimeRunnerInvocationBoundaryViolationReport.actualFlagViolations.length === 0 &&
      semantic.runtimeRunnerInvocationBlockerReport.blockers.length === 0
    ) {
      expect(semantic.runtimeRunnerInvocationFinalSafetyGate.finalGateStatus).toBe("ready_metadata");
      expect(semantic.runtimeRunnerInvocationFinalSafetyGate.h30EntryReadiness).toBe("ready_metadata");
    }
  });

  it("watch candidate yields final gate watch", () => {
    const base = stripRuntimeRunnerInvocationLayer(buildFullSemantic());
    const invocation = buildRunnerInvocationPlanning(
      withH29UpstreamWatchBaseline({
        runtimePilotSkeletonPreflightSummary: {
          ...base.runtimePilotSkeletonPreflightSummary,
          preflightReadiness: "watch",
        },
        runtimePilotRunnerContractVerificationReport: {
          ...base.runtimePilotRunnerContractVerificationReport,
          verificationStatus: "partial",
        },
        runtimePilotRunnerBoundaryViolationReport: {
          ...base.runtimePilotRunnerBoundaryViolationReport,
          actualFlagViolations: [],
          wordingRiskFindings: ["wording risk"],
        },
        runtimePilotSkeletonBlockerReport: {
          ...base.runtimePilotSkeletonBlockerReport,
          blockers: [],
        },
      })
    );
    expect(invocation.runtimeRunnerInvocationSummary.candidateStatus).toBe("watch");
    expect(invocation.runtimeRunnerInvocationFinalSafetyGate.finalGateStatus).toBe("watch");
  });

  it("blocked candidate yields final gate blocked", () => {
    const base = stripRuntimeRunnerInvocationLayer(buildFullSemantic());
    const invocation = buildRunnerInvocationPlanning({
      runtimePilotSkeletonPreflightSummary: {
        ...base.runtimePilotSkeletonPreflightSummary,
        preflightReadiness: "blocked",
      },
    });
    expect(invocation.runtimeRunnerInvocationSummary.candidateStatus).toBe("blocked");
    expect(invocation.runtimeRunnerInvocationFinalSafetyGate.finalGateStatus).toBe("blocked");
  });

  it("boundary violation detects actualIsolatedRunnerInvocationEnabled true", () => {
    const invocation = buildRunnerInvocationPlanning();
    const badSummary = {
      ...invocation.runtimeRunnerInvocationSummary,
      actualIsolatedRunnerInvocationEnabled: true as unknown as false,
    };
    const violations = detectRuntimeRunnerInvocationBoundaryViolations({
      summary: badSummary,
      scope: invocation.runtimeRunnerInvocationScope,
      policy: invocation.runtimeRunnerInvocationPolicy,
      checklist: invocation.runtimeRunnerInvocationReadinessChecklist,
    });
    expect(violations.actualFlagViolations.some((v) => v.includes("actualIsolatedRunnerInvocationEnabled"))).toBe(
      true
    );
  });

  it("boundary violation detects actualDryRunRunnerInvocationEnabled true", () => {
    const invocation = buildRunnerInvocationPlanning();
    const badSummary = {
      ...invocation.runtimeRunnerInvocationSummary,
      actualDryRunRunnerInvocationEnabled: true as unknown as false,
    };
    const violations = detectRuntimeRunnerInvocationBoundaryViolations({
      summary: badSummary,
      scope: invocation.runtimeRunnerInvocationScope,
      policy: invocation.runtimeRunnerInvocationPolicy,
      checklist: invocation.runtimeRunnerInvocationReadinessChecklist,
    });
    expect(violations.actualFlagViolations.some((v) => v.includes("actualDryRunRunnerInvocationEnabled"))).toBe(true);
  });

  it("policy actualInvocationForbidden false is detected", () => {
    const invocation = buildRunnerInvocationPlanning();
    const badPolicy = {
      ...invocation.runtimeRunnerInvocationPolicy,
      actualInvocationForbidden: false as unknown as true,
    };
    const violations = detectRuntimeRunnerInvocationBoundaryViolations({
      summary: invocation.runtimeRunnerInvocationSummary,
      scope: invocation.runtimeRunnerInvocationScope,
      policy: badPolicy,
      checklist: invocation.runtimeRunnerInvocationReadinessChecklist,
    });
    expect(violations.actualFlagViolations.some((v) => v.includes("actualInvocationForbidden"))).toBe(true);
  });

  it("policy mode mismatch yields readiness partial or failed", () => {
    const invocation = buildRunnerInvocationPlanning();
    const verification = verifyRuntimeRunnerInvocationReadiness({
      summary: { ...invocation.runtimeRunnerInvocationSummary, invocationMode: "metadata_only" },
      scope: invocation.runtimeRunnerInvocationScope,
      policy: { ...invocation.runtimeRunnerInvocationPolicy, invocationAllowedMode: "blocked" },
      checklist: invocation.runtimeRunnerInvocationReadinessChecklist,
      blockerReport: invocation.runtimeRunnerInvocationBlockerReport,
    });
    expect(["partial", "failed"]).toContain(verification.verificationStatus);
  });
});
