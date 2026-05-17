import { buildRuntimeLimitedPilotReadinessReviewPlanningReports } from "@/lib/harness/runtimeLimitedPilotReadinessReview/buildRuntimeLimitedPilotReadinessReviewPlanningReports";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticPlanningReportsBeforeLimitedPilotReadinessReview } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { stripRuntimeLimitedPilotReadinessReviewLayer } from "../runtimePlanningReportStrip";
import { buildFullSemanticForLimitedPilotBoundary } from "../runtimeLimitedPilotBoundary/runtimeLimitedPilotBoundaryTestFixtures";
import { buildLimitedPilotWatchScenarioPatches } from "../runtimeLimitedPilotBoundary/runtimeLimitedPilotBoundaryTestFixtures";

export function buildFullSemanticForLimitedPilotReadinessReview() {
  return buildFullSemanticForLimitedPilotBoundary();
}

export function buildLimitedPilotReadinessReviewBaseReports() {
  return stripRuntimeLimitedPilotReadinessReviewLayer(buildFullSemanticForLimitedPilotReadinessReview());
}

export function buildLimitedPilotReadinessReviewPlanning(
  patches: Partial<RuntimeSemanticPlanningReportsBeforeLimitedPilotReadinessReview> = {}
) {
  return buildRuntimeLimitedPilotReadinessReviewPlanningReports({
    ...buildLimitedPilotReadinessReviewBaseReports(),
    ...patches,
  });
}

export function buildLimitedPilotReadinessWatchScenarioPatches(
  base: RuntimeSemanticPlanningReportsBeforeLimitedPilotReadinessReview
): Partial<RuntimeSemanticPlanningReportsBeforeLimitedPilotReadinessReview> {
  return {
    ...buildLimitedPilotWatchScenarioPatches(base),
    runtimeLimitedPilotBoundaryFinalSafetyGate: {
      ...base.runtimeLimitedPilotBoundaryFinalSafetyGate,
      finalGateStatus: "watch",
      h43EntryReadiness: "watch",
    },
    runtimeLimitedPilotBoundaryVerificationReport: {
      ...base.runtimeLimitedPilotBoundaryVerificationReport,
      verificationStatus: "partial",
    },
    runtimeLimitedPilotBoundaryAlignmentReport: {
      ...base.runtimeLimitedPilotBoundaryAlignmentReport,
      alignmentStatus: "partial",
    },
    runtimeLimitedPilotBoundaryViolationReport: {
      ...base.runtimeLimitedPilotBoundaryViolationReport,
      actualFlagViolations: [],
      policyViolations: [],
      wordingRiskFindings: ["wording/flag risk: diagnosticOnly=false"],
    },
    runtimeLimitedPilotBoundaryBlockerReport: {
      ...base.runtimeLimitedPilotBoundaryBlockerReport,
      blockers: [],
    },
    runtimeLimitedPilotBoundarySummary: {
      ...base.runtimeLimitedPilotBoundarySummary,
      pilotBoundaryBlockers: [],
    },
  };
}

export { buildRuntimeSemanticPlanningReports };
