/**
 * H45.5 — controlled pilot execution candidate **alignment report**(read-only; pilot validation entry).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import {
  CONTROLLED_PILOT_EXECUTION_ALIGNMENT_CHECKLIST_LABEL_ROWS,
  CONTROLLED_PILOT_EXECUTION_CANDIDATE_SCOPE_SOURCE_LAYER,
  CONTROLLED_PILOT_EXECUTION_CANDIDATE_SCOPE_TARGET_LAYER,
  RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
  RUNTIME_FINAL_RUNTIME_HANDOFF_BOUNDARY_SOURCE_LAYER,
  RUNTIME_FINAL_RUNTIME_HANDOFF_BOUNDARY_TARGET_LAYER,
} from "./runtimeControlledPilotExecutionCandidateConstants";
import {
  controlledPilotExecutionForbiddenIncludes,
  executionBlockersAligned,
  readControlledPilotExecutionUpstreamContext,
  resolveControlledPilotExecutionCandidateAlignmentStatus,
  runtimeChecklistHasLabel,
} from "./runtimeControlledPilotExecutionCandidateCheckHelpers";
import type {
  RuntimeControlledPilotExecutionCandidateAlignmentReport,
  RuntimeControlledPilotExecutionCandidateBlockerReport,
  RuntimeControlledPilotExecutionCandidatePolicy,
  RuntimeControlledPilotExecutionCandidateScope,
  RuntimeControlledPilotExecutionCandidateSummary,
  RuntimeControlledPilotExecutionCandidateViolationReport,
  RuntimeControlledPilotExecutionInputContract,
  RuntimeControlledPilotExecutionOutputContract,
  RuntimeControlledPilotExecutionReadinessChecklist,
  RuntimeFinalRuntimeHandoffBoundary,
} from "./runtimeControlledPilotExecutionCandidateTypes";
import type { RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";

export function buildRuntimeControlledPilotExecutionCandidateAlignmentReport(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate;
  readonly summary: RuntimeControlledPilotExecutionCandidateSummary;
  readonly handoff: RuntimeFinalRuntimeHandoffBoundary;
  readonly scope: RuntimeControlledPilotExecutionCandidateScope;
  readonly policy: RuntimeControlledPilotExecutionCandidatePolicy;
  readonly inputContract: RuntimeControlledPilotExecutionInputContract;
  readonly outputContract: RuntimeControlledPilotExecutionOutputContract;
  readonly checklist: RuntimeControlledPilotExecutionReadinessChecklist;
  readonly blockerReport: RuntimeControlledPilotExecutionCandidateBlockerReport;
  readonly boundaryViolation: RuntimeControlledPilotExecutionCandidateViolationReport;
}): RuntimeControlledPilotExecutionCandidateAlignmentReport {
  const { reports, summary, handoff, scope, policy, checklist, blockerReport, boundaryViolation } = input;
  const upstream = readControlledPilotExecutionUpstreamContext(reports);
  const findings: string[] = [];

  if (
    summary.candidateStatus === "controlled_pilot_execution_metadata_candidate" &&
    upstream.executionFinalGate.finalGateStatus !== "ready_metadata"
  ) {
    findings.push(
      "pilot execution readiness final safety gate misaligned with controlled pilot execution candidate summary"
    );
  }
  if (handoff.boundarySourceLayer !== RUNTIME_FINAL_RUNTIME_HANDOFF_BOUNDARY_SOURCE_LAYER) {
    findings.push(`handoff.boundarySourceLayer must be ${RUNTIME_FINAL_RUNTIME_HANDOFF_BOUNDARY_SOURCE_LAYER}`);
  }
  if (handoff.boundaryTargetLayer !== RUNTIME_FINAL_RUNTIME_HANDOFF_BOUNDARY_TARGET_LAYER) {
    findings.push(`handoff.boundaryTargetLayer must be ${RUNTIME_FINAL_RUNTIME_HANDOFF_BOUNDARY_TARGET_LAYER}`);
  }
  if (!controlledPilotExecutionForbiddenIncludes(handoff.forbiddenHandoffOperations, "actual pilot activation")) {
    findings.push("forbiddenHandoffOperations missing actual pilot activation");
  }
  if (!controlledPilotExecutionForbiddenIncludes(handoff.forbiddenHandoffOperations, "actual pilot execution")) {
    findings.push("forbiddenHandoffOperations missing actual pilot execution");
  }
  if (scope.candidateSourceLayer !== CONTROLLED_PILOT_EXECUTION_CANDIDATE_SCOPE_SOURCE_LAYER) {
    findings.push(`scope.candidateSourceLayer must be ${CONTROLLED_PILOT_EXECUTION_CANDIDATE_SCOPE_SOURCE_LAYER}`);
  }
  if (scope.candidateTargetLayer !== CONTROLLED_PILOT_EXECUTION_CANDIDATE_SCOPE_TARGET_LAYER) {
    findings.push(`scope.candidateTargetLayer must be ${CONTROLLED_PILOT_EXECUTION_CANDIDATE_SCOPE_TARGET_LAYER}`);
  }
  if (!controlledPilotExecutionForbiddenIncludes(scope.forbiddenCandidateOperations, "actual sandbox invocation")) {
    findings.push("forbiddenCandidateOperations missing actual sandbox invocation");
  }
  if (!controlledPilotExecutionForbiddenIncludes(scope.forbiddenCandidateOperations, "actual execution")) {
    findings.push("forbiddenCandidateOperations missing actual execution");
  }
  if (policy.executionAllowedMode !== summary.executionMode) {
    findings.push("policy.executionAllowedMode misaligned with summary.executionMode");
  }
  if (policy.actualPilotActivationForbidden !== true) {
    findings.push("policy.actualPilotActivationForbidden must be true");
  }
  if (policy.actualPilotExecutionForbidden !== true) {
    findings.push("policy.actualPilotExecutionForbidden must be true");
  }
  for (const label of CONTROLLED_PILOT_EXECUTION_ALIGNMENT_CHECKLIST_LABEL_ROWS) {
    if (!runtimeChecklistHasLabel(checklist.checklist, label)) {
      findings.push(`checklist missing ${label}`);
    }
  }
  if (!executionBlockersAligned(blockerReport.blockers, summary.executionBlockers)) {
    findings.push("blocker report misaligned with summary.executionBlockers");
  }
  if (
    summary.candidateStatus === "controlled_pilot_execution_metadata_candidate" &&
    (boundaryViolation.actualFlagViolations.length > 0 ||
      boundaryViolation.policyViolations.length > 0 ||
      boundaryViolation.wordingRiskFindings.length > 0)
  ) {
    findings.push("controlled_pilot_execution_metadata_candidate requires empty controlled pilot execution violations");
  }
  if (
    upstream.executionViolation &&
    summary.candidateStatus === "controlled_pilot_execution_metadata_candidate" &&
    (upstream.executionViolation.actualFlagViolations.length > 0 ||
      upstream.executionViolation.proofViolations.length > 0 ||
      upstream.executionViolation.forbiddenProofViolations.length > 0)
  ) {
    findings.push("upstream pilot execution readiness violations misaligned with controlled pilot execution candidate");
  }

  const alignmentStatus = resolveControlledPilotExecutionCandidateAlignmentStatus(findings);

  return {
    mode: "runtime_controlled_pilot_execution_candidate_alignment_report",
    ...RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
    alignmentStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations: mergeSortedUniqueKo([
      ...(alignmentStatus === "aligned_metadata"
        ? [
            "H45.5: controlled pilot execution candidate aligned_metadata — pilot validation entry 후보(pilot activation·execution 없음)",
          ]
        : []),
      ...(alignmentStatus === "partial"
        ? ["H45.5: controlled pilot execution candidate partial alignment — handoff·scope·execution gate 재검토"]
        : []),
      ...(alignmentStatus === "failed"
        ? ["H45.5: controlled pilot execution candidate alignment failed — policy·forbidden ops·checklist 정렬"]
        : []),
    ]),
  };
}
