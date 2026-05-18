/**
 * H39 — final release governance gate **scope** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeFinalReleaseGovernanceGate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  FINAL_RELEASE_GOVERNANCE_GATE_SCOPE_SOURCE_LAYER,
  FINAL_RELEASE_GOVERNANCE_GATE_SCOPE_TARGET_LAYER,
  RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS_DISABLED,
} from "./runtimeFinalReleaseGovernanceGateConstants";
import type { RuntimeFinalReleaseGovernanceGateScope } from "./runtimeFinalReleaseGovernanceGateTypes";

const FORBIDDEN_GATE_OPERATIONS = [
  "actual execution",
  "actual execution routing",
  "actual release enforcement",
  "actual approval enforcement",
  "actual no-op shell execution",
  "actual execution shell execution",
  "actual runtime adapter invocation",
  "actual provider routing",
  "actual queue control",
  "actual rollback execution",
  "actual execution blocking",
  "actual merge blocking",
  "prompt mutation",
  "token enforcement",
  "context pruning",
] as const;

export function buildRuntimeFinalReleaseGovernanceGateScope(
  reports: RuntimeSemanticPlanningReportsBeforeFinalReleaseGovernanceGate
): RuntimeFinalReleaseGovernanceGateScope {
  const releaseFinalGate = reports.runtimeGovernanceReleaseReadinessFinalSafetyGate;
  const releaseBoundary = reports.runtimeGovernanceReleaseReadinessBoundary;

  const requiredInputMetadata = mergeSortedUniqueKo([
    "runtimeGovernanceReleaseReadinessFinalSafetyGate",
    "runtimeGovernanceReleaseReadinessVerificationReport",
    "runtimeGovernanceReleaseReadinessAlignmentReport",
    "runtimeGovernanceReleaseReadinessViolationReport",
    "runtimeGovernanceReleaseReadinessSummary",
    "runtimeGovernanceReleaseReadinessBoundary",
    "runtimeGovernanceNoEnforcementProof",
    "runtimeExecutionGovernanceForbiddenProof",
    "runtimeExecutionGovernanceBoundaryFinalSafetyGate",
    ...releaseBoundary.requiredBoundaryInputs.slice(0, 4),
  ]);

  const expectedOutputMetadata = mergeSortedUniqueKo([
    "runtimeFinalReleaseGovernanceGateSummary",
    "runtimeFinalReleaseGovernanceGateScope",
    "runtimeFinalReleaseGovernanceGatePolicy",
    "runtimeFinalReleaseGovernanceGateBlockerReport",
    "runtimeFinalReleaseGovernanceGateReadinessChecklist",
    `releaseFinalGate:${releaseFinalGate.finalGateStatus}`,
    `h39EntryReadiness:${releaseFinalGate.h39EntryReadiness}`,
  ]);

  const allowedGateMetadataScopes = mergeSortedUniqueKo([
    "final_release_governance_gate_candidate_status",
    "final_release_governance_gate_mode_metadata_only",
    `h39EntryReadiness:${releaseFinalGate.h39EntryReadiness}`,
    "diagnosticBundleIncludesFinalReleaseGovernanceGate:metadata",
  ]);

  return {
    mode: "runtime_final_release_governance_gate_scope",
    ...RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS_DISABLED,
    candidateSourceLayer: FINAL_RELEASE_GOVERNANCE_GATE_SCOPE_SOURCE_LAYER,
    candidateTargetLayer: FINAL_RELEASE_GOVERNANCE_GATE_SCOPE_TARGET_LAYER,
    requiredInputMetadata,
    expectedOutputMetadata,
    allowedGateMetadataScopes,
    forbiddenGateOperations: [...FORBIDDEN_GATE_OPERATIONS],
    recommendations: mergeSortedUniqueKo([
      "H39: final release governance gate scope — metadata_only candidate(실제 release·execution·approval enforcement 없음)",
    ]),
  };
}
