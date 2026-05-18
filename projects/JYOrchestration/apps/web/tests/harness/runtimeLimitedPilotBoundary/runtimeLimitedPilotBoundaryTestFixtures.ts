import { buildRuntimeLimitedPilotBoundaryPlanningReports } from "@/lib/harness/runtimeLimitedPilotBoundary/buildRuntimeLimitedPilotBoundaryPlanningReports";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { stripRuntimeLimitedPilotBoundaryLayer } from "../runtimePlanningReportStrip";
import {
  buildControlledActivationWatchScenarioPatches,
  buildFullSemanticForControlledActivationCandidate,
} from "../runtimeControlledActivationCandidate/runtimeControlledActivationCandidateTestFixtures";

export function buildFullSemanticForLimitedPilotBoundary() {
  return buildFullSemanticForControlledActivationCandidate();
}

export function buildLimitedPilotBoundaryBaseReports() {
  return stripRuntimeLimitedPilotBoundaryLayer(buildFullSemanticForLimitedPilotBoundary());
}

export function buildLimitedPilotBoundaryPlanning(
  patches: Partial<RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary> = {}
) {
  return buildRuntimeLimitedPilotBoundaryPlanningReports({
    ...buildLimitedPilotBoundaryBaseReports(),
    ...patches,
  });
}

/** Controlled activation watch/partial for H42 watch candidate tests. */
export function buildLimitedPilotWatchScenarioPatches(
  base: RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary
): Partial<RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary> {
  return {
    ...buildControlledActivationWatchScenarioPatches(base),
    runtimeControlledActivationCandidateFinalSafetyGate: {
      ...base.runtimeControlledActivationCandidateFinalSafetyGate,
      finalGateStatus: "watch",
      h42EntryReadiness: "watch",
    },
    runtimeControlledActivationCandidateVerificationReport: {
      ...base.runtimeControlledActivationCandidateVerificationReport,
      verificationStatus: "partial",
    },
    runtimeControlledActivationCandidateAlignmentReport: {
      ...base.runtimeControlledActivationCandidateAlignmentReport,
      alignmentStatus: "partial",
    },
    runtimeControlledActivationCandidateViolationReport: {
      ...base.runtimeControlledActivationCandidateViolationReport,
      actualFlagViolations: [],
      policyViolations: [],
      wordingRiskFindings: ["wording/flag risk: diagnosticOnly=false"],
    },
    runtimeControlledActivationCandidateBlockerReport: {
      ...base.runtimeControlledActivationCandidateBlockerReport,
      blockers: [],
    },
    runtimeControlledActivationCandidateSummary: {
      ...base.runtimeControlledActivationCandidateSummary,
      activationBlockers: [],
    },
  };
}

export { buildRuntimeSemanticPlanningReports };
