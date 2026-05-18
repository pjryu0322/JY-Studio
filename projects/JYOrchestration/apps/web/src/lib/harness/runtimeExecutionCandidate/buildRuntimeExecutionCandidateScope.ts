/**
 * H23 — execution candidate **scope** 정규화(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeExecutionCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type {
  RuntimeExecutionCandidateScope,
  RuntimeExecutionCandidateStatus,
} from "./runtimeExecutionCandidateTypes";
import { mergeSortedUniqueKo } from "./runtimeExecutionCandidateMerge";

const FORBIDDEN_EXECUTION_SCOPES_BASE: readonly string[] = [
  "actual execution",
  "actual execution routing",
  "actual provider switching",
  "actual token enforcement",
  "actual context pruning",
  "actual queue control",
  "actual retrieval orchestration",
  "actual prompt payload mutation",
  "automatic Cursor execution",
  "실제 orchestration 런타임",
  "실행 차단(메타 아닌 강제)",
  "merge 차단(메타 아닌 강제)",
];

export function buildRuntimeExecutionCandidateScope(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeExecutionCandidate;
  readonly candidateStatus: RuntimeExecutionCandidateStatus;
}): RuntimeExecutionCandidateScope {
  const { reports, candidateStatus } = input;
  const b = reports.runtimeControlBoundarySummary;
  const trial = reports.runtimeResourceAllocationTrialReport;
  const alloc = reports.runtimeResourceAllocationPlan;

  const candidateInputs = mergeSortedUniqueKo([
    `boundaryLevel=${b.boundaryLevel}`,
    `boundaryRisk=${b.boundaryRisk}`,
    `trialMode=${trial.trialMode}`,
    `trialConsistency=${trial.consistency}`,
    `globalAllocationMode=${alloc.globalAllocationMode}`,
  ]);

  const candidateOutputs = mergeSortedUniqueKo([
    `candidateStatus=${candidateStatus}`,
    "candidatePathDescriptionOnly=true",
  ]);

  const allowedMetadataScopes = mergeSortedUniqueKo([
    "candidate_source",
    "candidate_target",
    "candidate_preconditions",
    "candidate_blockers",
    "candidate_required_approvals",
    "candidate_rollback_prerequisites",
    "diagnostic_serialization_only",
  ]);

  const forbiddenExecutionScopes = mergeSortedUniqueKo([...FORBIDDEN_EXECUTION_SCOPES_BASE]);

  return {
    mode: "runtime_execution_candidate_scope",
    actualRuntimeOrchestrationEnabled: false,
    actualExecutionEnabled: false,
    sourceLayer: "H22.5_runtime_control_boundary",
    targetLayer: "H23_orchestration_execution_candidate_metadata",
    candidateInputs,
    candidateOutputs,
    allowedMetadataScopes,
    forbiddenExecutionScopes,
  };
}
