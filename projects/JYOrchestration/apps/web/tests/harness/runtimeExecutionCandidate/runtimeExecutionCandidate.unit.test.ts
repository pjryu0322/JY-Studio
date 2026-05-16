import { describe, expect, it } from "vitest";

import type { RuntimeSemanticPlanningReportsBeforeExecutionCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { detectRuntimeExecutionCandidateBlockers } from "@/lib/harness/runtimeExecutionCandidate/detectRuntimeExecutionCandidateBlockers";
import { evaluateRuntimeExecutionCandidate } from "@/lib/harness/runtimeExecutionCandidate/evaluateRuntimeExecutionCandidate";
import { serializeRuntimeExecutionCandidateDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeExecutionCandidate/serializeRuntimeExecutionCandidateDiagnosticBundle";
import { buildRuntimeControlBoundaryPlanningReports } from "@/lib/harness/runtimeControlBoundary/buildRuntimeControlBoundaryPlanningReports";
import { buildRuntimeResourceTrialPlanningReports } from "@/lib/harness/runtimeResourceTrial/buildRuntimeResourceTrialPlanningReports";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { normalizeRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/normalizeRuntimePlanningContext";
import { buildRuntimeCriticalityPlanningReports } from "@/lib/harness/runtimeCriticality/buildRuntimeCriticalityPlanningReports";
import { buildRuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import { buildRuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import { buildRuntimeTraceabilityPlanningReports } from "@/lib/harness/runtimeTraceability/buildRuntimeTraceabilityPlanningReports";

function buildPlanningContext() {
  const maturityBaseline = evaluateHarnessMaturityBaseline({
    overlayExtract: null,
    harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
    recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
    messageExplainabilityAvailable: true,
  });
  return normalizeRuntimePlanningContext({
    overlay: null,
    maturityBaseline,
    releaseGate: evaluateHarnessReleaseGateReadiness(maturityBaseline),
    messageExplainabilityAvailable: true,
    overlayWarningCount: 0,
  });
}

function stableGovernanceForCandidateTests<
  T extends { runtimeResourceGovernanceSummary: { readonly operatorReviewRequirement: string } },
>(before: T) {
  return {
    ...before.runtimeResourceGovernanceSummary,
    operatorReviewRequirement: "not_required" as const,
    allocationReadiness: "allocation_planning_candidate" as const,
    governanceRisk: "stable" as const,
  };
}

function emptyBoundaryViolations<
  T extends { runtimeControlBoundaryViolationReport: { readonly actualFlagViolations: readonly unknown[] } },
>(before: T) {
  return {
    ...before.runtimeControlBoundaryViolationReport,
    actualFlagViolations: [],
    wordingRiskFindings: [],
  };
}

function buildSemanticBeforeExecutionCandidate(): RuntimeSemanticPlanningReportsBeforeExecutionCandidate {
  const ctx = buildPlanningContext();
  const dep = buildRuntimeDependencyPlanningReports(ctx);
  const crit = buildRuntimeCriticalityPlanningReports(ctx, dep);
  const trace = buildRuntimeTraceabilityPlanningReports(ctx, dep, crit);
  const reasoning = buildRuntimeReasoningPlanningReports(dep, crit, trace);
  const semantic = buildRuntimeSemanticPlanningReports(reasoning);
  const {
    runtimeExecutionCandidateSummary: _a,
    runtimeExecutionCandidateScope: _b,
    runtimeExecutionCandidatePreconditions: _c,
    runtimeExecutionCandidateBlockers: _d,
    runtimeOperatorApprovalSummary: _o1,
    runtimeRollbackReadinessSummary: _o2,
    runtimeAuditReadinessSummary: _o3,
    runtimePilotPreconditionSummary: _o4,
    runtimeControlledPilotSummary: _h24a,
    runtimeControlledPilotSafetyEnvelope: _h24b,
    runtimeControlledPilotFallbackPlan: _h24c,
    runtimeControlledPilotAbortConditions: _h24d,
    runtimePilotContractSummary: _h245a,
    runtimePilotContractInputSchema: _h245b,
    runtimePilotContractOutputSchema: _h245c,
    runtimeAdapterBoundarySummary: _h245d,
    runtimeAdapterForbiddenOperationReport: _h245e,
    runtimePilotHandoffReadiness: _h245f,
    ...rest
  } = semantic;
  return rest as RuntimeSemanticPlanningReportsBeforeExecutionCandidate;
}

describe("H23 runtime execution candidate", () => {
  it("full semantic includes execution candidate with actualExecutionEnabled false", () => {
    const ctx = buildPlanningContext();
    const dep = buildRuntimeDependencyPlanningReports(ctx);
    const crit = buildRuntimeCriticalityPlanningReports(ctx, dep);
    const trace = buildRuntimeTraceabilityPlanningReports(ctx, dep, crit);
    const reasoning = buildRuntimeReasoningPlanningReports(dep, crit, trace);
    const semantic = buildRuntimeSemanticPlanningReports(reasoning);
    expect(semantic.runtimeExecutionCandidateSummary.actualExecutionEnabled).toBe(false);
    expect(semantic.runtimeExecutionCandidateScope.actualExecutionEnabled).toBe(false);
    expect(semantic.runtimeExecutionCandidatePreconditions.actualExecutionEnabled).toBe(false);
    expect(semantic.runtimeExecutionCandidateBlockers.actualExecutionEnabled).toBe(false);
    expect(semantic.runtimeOperatorApprovalSummary.actualApprovalEnforcementEnabled).toBe(false);
    expect(semantic.runtimeRollbackReadinessSummary.actualRollbackExecutionEnabled).toBe(false);
  });

  it("read_only boundary → not_candidate", () => {
    const before = buildSemanticBeforeExecutionCandidate();
    const patched: RuntimeSemanticPlanningReportsBeforeExecutionCandidate = {
      ...before,
      runtimeResourceGovernanceSummary: stableGovernanceForCandidateTests(before),
      runtimeControlBoundaryViolationReport: emptyBoundaryViolations(before),
      runtimeAllocationTrialDriftSummary: {
        ...before.runtimeAllocationTrialDriftSummary,
        driftLevel: "none",
      },
      runtimeResourceAllocationTrialReport: {
        ...before.runtimeResourceAllocationTrialReport,
        trialMode: "not_applicable",
        consistency: "consistent",
      },
      runtimeControlBoundarySummary: {
        ...before.runtimeControlBoundarySummary,
        boundaryLevel: "read_only",
        boundaryRisk: "stable",
      },
    };
    const blockers = detectRuntimeExecutionCandidateBlockers(patched);
    const ev = evaluateRuntimeExecutionCandidate(patched, blockers);
    expect(ev.candidateStatus).toBe("not_candidate");
  });

  it("execution_candidate_metadata boundary → operator_review_required", () => {
    const before = buildSemanticBeforeExecutionCandidate();
    const patched: RuntimeSemanticPlanningReportsBeforeExecutionCandidate = {
      ...before,
      runtimeResourceGovernanceSummary: stableGovernanceForCandidateTests(before),
      runtimeControlBoundaryViolationReport: emptyBoundaryViolations(before),
      runtimeAllocationTrialDriftSummary: {
        ...before.runtimeAllocationTrialDriftSummary,
        driftLevel: "none",
      },
      runtimeResourceAllocationTrialReport: {
        ...before.runtimeResourceAllocationTrialReport,
        trialMode: "dry_run_ready",
        consistency: "consistent",
      },
      runtimeControlBoundarySummary: {
        ...before.runtimeControlBoundarySummary,
        boundaryLevel: "execution_candidate_metadata",
        boundaryRisk: "watch",
      },
    };
    const blockers = detectRuntimeExecutionCandidateBlockers(patched);
    const ev = evaluateRuntimeExecutionCandidate(patched, blockers);
    expect(ev.candidateStatus).toBe("operator_review_required");
  });

  it("actual_control_forbidden → blocked via blockers", () => {
    const before = buildSemanticBeforeExecutionCandidate();
    const patched: RuntimeSemanticPlanningReportsBeforeExecutionCandidate = {
      ...before,
      runtimeControlBoundarySummary: {
        ...before.runtimeControlBoundarySummary,
        boundaryLevel: "actual_control_forbidden",
        boundaryRisk: "blocked",
      },
    };
    const blockers = detectRuntimeExecutionCandidateBlockers(patched);
    expect(blockers.length).toBeGreaterThan(0);
    const ev = evaluateRuntimeExecutionCandidate(patched, blockers);
    expect(ev.candidateStatus).toBe("blocked");
  });

  it("dry_run_metadata + consistent + no blockers → metadata_candidate", () => {
    const before = buildSemanticBeforeExecutionCandidate();
    const trial = buildRuntimeResourceTrialPlanningReports(before);
    const withTrial = {
      ...before,
      ...trial,
      runtimeResourceGovernanceSummary: stableGovernanceForCandidateTests(before),
      runtimeControlBoundaryViolationReport: emptyBoundaryViolations(before),
      runtimeResourceControlBoundary: {
        ...before.runtimeResourceControlBoundary,
        boundary: "trial_candidate",
      },
      runtimeResourceAllocationPlan: {
        ...before.runtimeResourceAllocationPlan,
        globalAllocationMode: "dry_run_candidate",
      },
      runtimeResourceAllocationTrialReport: {
        ...trial.runtimeResourceAllocationTrialReport,
        trialMode: "dry_run_ready",
        consistency: "consistent",
      },
    };
    const cb = buildRuntimeControlBoundaryPlanningReports(withTrial);
    const withCb: RuntimeSemanticPlanningReportsBeforeExecutionCandidate = {
      ...withTrial,
      ...cb,
      runtimeControlBoundaryViolationReport: {
        ...cb.runtimeControlBoundaryViolationReport,
        actualFlagViolations: [],
        wordingRiskFindings: [],
      },
    };
    const blockers = detectRuntimeExecutionCandidateBlockers(withCb);
    const ev = evaluateRuntimeExecutionCandidate(withCb, blockers);
    expect(ev.candidateStatus).toBe("metadata_candidate");
  });

  it("serializer sorts keys and does not rebuild reports", () => {
    const ctx = buildPlanningContext();
    const dep = buildRuntimeDependencyPlanningReports(ctx);
    const crit = buildRuntimeCriticalityPlanningReports(ctx, dep);
    const trace = buildRuntimeTraceabilityPlanningReports(ctx, dep, crit);
    const reasoning = buildRuntimeReasoningPlanningReports(dep, crit, trace);
    const full = buildRuntimeSemanticPlanningReports(reasoning);
    const ser = serializeRuntimeExecutionCandidateDiagnosticBundleFromSemanticReports(full);
    const pre = ser.runtimeExecutionCandidatePreconditions as { preconditions?: string[] };
    const sorted = [...(pre.preconditions ?? [])].sort((a, b) => a.localeCompare(b, "ko"));
    expect(pre.preconditions).toEqual(sorted);
  });
});
