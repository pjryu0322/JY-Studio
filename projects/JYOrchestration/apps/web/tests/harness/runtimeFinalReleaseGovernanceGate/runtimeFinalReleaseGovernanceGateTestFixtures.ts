import { buildRuntimeFinalReleaseGovernanceGatePlanningReports } from "@/lib/harness/runtimeFinalReleaseGovernanceGate/buildRuntimeFinalReleaseGovernanceGatePlanningReports";
import { detectRuntimeFinalReleaseGovernanceGateViolations } from "@/lib/harness/runtimeFinalReleaseGovernanceGate/detectRuntimeFinalReleaseGovernanceGateViolations";
import type { RuntimeFinalReleaseGovernanceGatePlanningReports } from "@/lib/harness/runtimeFinalReleaseGovernanceGate/runtimeFinalReleaseGovernanceGateTypes";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticPlanningReportsBeforeFinalReleaseGovernanceGate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { stripRuntimeFinalReleaseGovernanceGateLayer } from "../runtimePlanningReportStrip";
import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { normalizeRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/normalizeRuntimePlanningContext";
import { buildRuntimeCriticalityPlanningReports } from "@/lib/harness/runtimeCriticality/buildRuntimeCriticalityPlanningReports";
import { buildRuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import { buildRuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import { buildRuntimeTraceabilityPlanningReports } from "@/lib/harness/runtimeTraceability/buildRuntimeTraceabilityPlanningReports";

export function buildFullSemanticForFinalReleaseGovernanceGate() {
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

export function buildFinalReleaseGovernanceGateBaseReports() {
  return stripRuntimeFinalReleaseGovernanceGateLayer(buildFullSemanticForFinalReleaseGovernanceGate());
}

export function buildFinalReleaseGatePlanningReports(
  patches: Partial<RuntimeSemanticPlanningReportsBeforeFinalReleaseGovernanceGate> = {}
): RuntimeFinalReleaseGovernanceGatePlanningReports {
  return buildRuntimeFinalReleaseGovernanceGatePlanningReports({
    ...buildFinalReleaseGovernanceGateBaseReports(),
    ...patches,
  });
}

/** release-readiness watch 시나리오용 upstream 패치(H39 gate watch 유도). */
export function releaseReadinessWatchUpstreamPatches(
  base: RuntimeSemanticPlanningReportsBeforeFinalReleaseGovernanceGate
): Partial<RuntimeSemanticPlanningReportsBeforeFinalReleaseGovernanceGate> {
  return {
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
  };
}

export function releaseReadinessBlockedUpstreamPatches(
  base: RuntimeSemanticPlanningReportsBeforeFinalReleaseGovernanceGate
): Partial<RuntimeSemanticPlanningReportsBeforeFinalReleaseGovernanceGate> {
  return {
    runtimeGovernanceReleaseReadinessFinalSafetyGate: {
      ...base.runtimeGovernanceReleaseReadinessFinalSafetyGate,
      finalGateStatus: "blocked",
      h39EntryReadiness: "blocked",
    },
    runtimeGovernanceReleaseReadinessVerificationReport: {
      ...base.runtimeGovernanceReleaseReadinessVerificationReport,
      verificationStatus: "failed",
    },
  };
}

export function detectFinalReleaseGatePolicyViolation(
  partial: RuntimeFinalReleaseGovernanceGatePlanningReports,
  policyPatch: Partial<RuntimeFinalReleaseGovernanceGatePlanningReports["runtimeFinalReleaseGovernanceGatePolicy"]>
) {
  return detectRuntimeFinalReleaseGovernanceGateViolations({
    summary: partial.runtimeFinalReleaseGovernanceGateSummary,
    policy: {
      ...partial.runtimeFinalReleaseGovernanceGatePolicy,
      ...policyPatch,
    },
  });
}

export function detectFinalReleaseGateSummaryViolation(
  partial: RuntimeFinalReleaseGovernanceGatePlanningReports,
  summaryPatch: Partial<RuntimeFinalReleaseGovernanceGatePlanningReports["runtimeFinalReleaseGovernanceGateSummary"]>
) {
  return detectRuntimeFinalReleaseGovernanceGateViolations({
    summary: {
      ...partial.runtimeFinalReleaseGovernanceGateSummary,
      ...summaryPatch,
    },
    policy: partial.runtimeFinalReleaseGovernanceGatePolicy,
  });
}
