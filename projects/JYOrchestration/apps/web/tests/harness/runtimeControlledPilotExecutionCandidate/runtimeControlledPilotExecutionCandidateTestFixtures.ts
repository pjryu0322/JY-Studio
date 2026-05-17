import { buildRuntimeControlledPilotExecutionCandidatePlanningReports } from "@/lib/harness/runtimeControlledPilotExecutionCandidate/buildRuntimeControlledPilotExecutionCandidatePlanningReports";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { stripRuntimeControlledPilotExecutionCandidateLayer } from "../runtimePlanningReportStrip";
import {
  buildFullSemanticForPilotExecutionReadiness,
  buildPilotExecutionReadinessWatchScenarioPatches,
} from "../runtimePilotExecutionReadiness/runtimePilotExecutionReadinessTestFixtures";

export function buildFullSemanticForControlledPilotExecutionCandidate() {
  return buildFullSemanticForPilotExecutionReadiness();
}

export function buildControlledPilotExecutionCandidateBaseReports() {
  return stripRuntimeControlledPilotExecutionCandidateLayer(buildFullSemanticForControlledPilotExecutionCandidate());
}

export function buildControlledPilotExecutionCandidatePlanning(
  patches: Partial<RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate> = {}
) {
  return buildRuntimeControlledPilotExecutionCandidatePlanningReports({
    ...buildControlledPilotExecutionCandidateBaseReports(),
    ...patches,
  });
}

export function buildControlledPilotExecutionWatchScenarioPatches(
  base: RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate
): Partial<RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate> {
  return {
    ...buildPilotExecutionReadinessWatchScenarioPatches(base),
    runtimePilotExecutionReadinessFinalSafetyGate: {
      ...base.runtimePilotExecutionReadinessFinalSafetyGate,
      finalGateStatus: "watch",
      h45EntryReadiness: "watch",
    },
    runtimePilotExecutionReadinessVerificationReport: {
      ...base.runtimePilotExecutionReadinessVerificationReport,
      verificationStatus: "partial",
    },
    runtimePilotExecutionReadinessAlignmentReport: {
      ...base.runtimePilotExecutionReadinessAlignmentReport,
      alignmentStatus: "partial",
    },
    runtimePilotExecutionReadinessViolationReport: {
      ...base.runtimePilotExecutionReadinessViolationReport,
      actualFlagViolations: [],
      proofViolations: [],
      forbiddenProofViolations: [],
      wordingRiskFindings: ["wording risk: diagnosticOnly=false"],
    },
    runtimePilotExecutionReadinessBlockerReport: {
      ...base.runtimePilotExecutionReadinessBlockerReport,
      blockers: [],
    },
  };
}

export { buildRuntimeSemanticPlanningReports };
