import { buildRuntimePilotExecutionReadinessPlanningReports } from "@/lib/harness/runtimePilotExecutionReadiness/buildRuntimePilotExecutionReadinessPlanningReports";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticPlanningReportsBeforePilotExecutionReadiness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { stripRuntimePilotExecutionReadinessLayer } from "../runtimePlanningReportStrip";
import {
  buildFullSemanticForLimitedPilotReadinessReview,
  buildLimitedPilotReadinessWatchScenarioPatches,
} from "../runtimeLimitedPilotReadinessReview/runtimeLimitedPilotReadinessReviewTestFixtures";

export function buildFullSemanticForPilotExecutionReadiness() {
  return buildFullSemanticForLimitedPilotReadinessReview();
}

export function buildPilotExecutionReadinessBaseReports() {
  return stripRuntimePilotExecutionReadinessLayer(buildFullSemanticForPilotExecutionReadiness());
}

export function buildPilotExecutionReadinessPlanning(
  patches: Partial<RuntimeSemanticPlanningReportsBeforePilotExecutionReadiness> = {}
) {
  return buildRuntimePilotExecutionReadinessPlanningReports({
    ...buildPilotExecutionReadinessBaseReports(),
    ...patches,
  });
}

export function buildPilotExecutionReadinessWatchScenarioPatches(
  base: RuntimeSemanticPlanningReportsBeforePilotExecutionReadiness
): Partial<RuntimeSemanticPlanningReportsBeforePilotExecutionReadiness> {
  return {
    ...buildLimitedPilotReadinessWatchScenarioPatches(base),
    runtimeLimitedPilotReadinessReviewFinalSafetyGate: {
      ...base.runtimeLimitedPilotReadinessReviewFinalSafetyGate,
      finalGateStatus: "watch",
      h44EntryReadiness: "watch",
    },
    runtimeLimitedPilotReadinessReviewVerificationReport: {
      ...base.runtimeLimitedPilotReadinessReviewVerificationReport,
      verificationStatus: "partial",
    },
    runtimeLimitedPilotReadinessReviewAlignmentReport: {
      ...base.runtimeLimitedPilotReadinessReviewAlignmentReport,
      alignmentStatus: "partial",
    },
    runtimeLimitedPilotReadinessReviewViolationReport: {
      ...base.runtimeLimitedPilotReadinessReviewViolationReport,
      actualFlagViolations: [],
      proofViolations: [],
      forbiddenProofViolations: [],
      wordingRiskFindings: ["wording risk: diagnosticOnly=false"],
    },
    runtimePilotReadinessBlockerReport: {
      ...base.runtimePilotReadinessBlockerReport,
      blockers: [],
    },
    runtimeLimitedPilotReadinessReviewSummary: {
      ...base.runtimeLimitedPilotReadinessReviewSummary,
      reviewBlockers: [],
    },
  };
}

export { buildRuntimeSemanticPlanningReports };
