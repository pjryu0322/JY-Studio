/**
 * H41.5 — controlled activation candidate **alignment report**(read-only; H42 entry).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  CONTROLLED_ACTIVATION_ALIGNMENT_CHECKLIST_LABEL_ROWS,
  CONTROLLED_ACTIVATION_CANDIDATE_SCOPE_SOURCE_LAYER,
  CONTROLLED_ACTIVATION_CANDIDATE_SCOPE_TARGET_LAYER,
  RUNTIME_CONTROL_HANDOFF_BOUNDARY_SOURCE_LAYER,
  RUNTIME_CONTROL_HANDOFF_BOUNDARY_TARGET_LAYER,
  RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
} from "./runtimeControlledActivationCandidateConstants";
import {
  activationBlockersAligned,
  controlledActivationForbiddenIncludes,
  readControlledActivationUpstreamContext,
  resolveControlledActivationCandidateAlignmentStatus,
  runtimeChecklistHasLabel,
} from "./runtimeControlledActivationCandidateCheckHelpers";
import type {
  RuntimeControlledActivationCandidateAlignmentReport,
  RuntimeControlledActivationCandidateBlockerReport,
  RuntimeControlledActivationCandidatePolicy,
  RuntimeControlledActivationCandidateScope,
  RuntimeControlledActivationCandidateSummary,
  RuntimeControlledActivationCandidateViolationReport,
  RuntimeControlledActivationReadinessChecklist,
  RuntimeControlHandoffBoundary,
} from "./runtimeControlledActivationCandidateTypes";

export function buildRuntimeControlledActivationCandidateAlignmentReport(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate;
  readonly summary: RuntimeControlledActivationCandidateSummary;
  readonly handoff: RuntimeControlHandoffBoundary;
  readonly scope: RuntimeControlledActivationCandidateScope;
  readonly policy: RuntimeControlledActivationCandidatePolicy;
  readonly checklist: RuntimeControlledActivationReadinessChecklist;
  readonly blockerReport: RuntimeControlledActivationCandidateBlockerReport;
  readonly boundaryViolation: RuntimeControlledActivationCandidateViolationReport;
}): RuntimeControlledActivationCandidateAlignmentReport {
  const { reports, summary, handoff, scope, policy, checklist, blockerReport, boundaryViolation } = input;
  const upstream = readControlledActivationUpstreamContext(reports);
  const findings: string[] = [];

  if (
    summary.candidateStatus === "controlled_activation_metadata_candidate" &&
    upstream.ultimateFinalGate?.finalGateStatus !== "ready_metadata"
  ) {
    findings.push("ultimate governance review final safety gate misaligned with controlled activation candidate summary");
  }
  if (handoff.boundarySourceLayer !== RUNTIME_CONTROL_HANDOFF_BOUNDARY_SOURCE_LAYER) {
    findings.push(`handoff.boundarySourceLayer must be ${RUNTIME_CONTROL_HANDOFF_BOUNDARY_SOURCE_LAYER}`);
  }
  if (handoff.boundaryTargetLayer !== RUNTIME_CONTROL_HANDOFF_BOUNDARY_TARGET_LAYER) {
    findings.push(`handoff.boundaryTargetLayer must be ${RUNTIME_CONTROL_HANDOFF_BOUNDARY_TARGET_LAYER}`);
  }
  if (!controlledActivationForbiddenIncludes(handoff.forbiddenHandoffOperations, "actual controlled activation")) {
    findings.push("forbiddenHandoffOperations missing actual controlled activation");
  }
  if (!controlledActivationForbiddenIncludes(handoff.forbiddenHandoffOperations, "actual orchestration")) {
    findings.push("forbiddenHandoffOperations missing actual orchestration");
  }
  if (scope.candidateSourceLayer !== CONTROLLED_ACTIVATION_CANDIDATE_SCOPE_SOURCE_LAYER) {
    findings.push(`scope.candidateSourceLayer must be ${CONTROLLED_ACTIVATION_CANDIDATE_SCOPE_SOURCE_LAYER}`);
  }
  if (scope.candidateTargetLayer !== CONTROLLED_ACTIVATION_CANDIDATE_SCOPE_TARGET_LAYER) {
    findings.push(`scope.candidateTargetLayer must be ${CONTROLLED_ACTIVATION_CANDIDATE_SCOPE_TARGET_LAYER}`);
  }
  if (!controlledActivationForbiddenIncludes(scope.forbiddenCandidateOperations, "actual controlled activation")) {
    findings.push("forbiddenCandidateOperations missing actual controlled activation");
  }
  if (!controlledActivationForbiddenIncludes(scope.forbiddenCandidateOperations, "actual execution")) {
    findings.push("forbiddenCandidateOperations missing actual execution");
  }
  if (policy.activationAllowedMode !== summary.activationMode) {
    findings.push("policy.activationAllowedMode misaligned with summary.activationMode");
  }
  if (policy.actualControlledActivationForbidden !== true) {
    findings.push("policy.actualControlledActivationForbidden must be true");
  }
  if (policy.actualRuntimeOrchestrationForbidden !== true) {
    findings.push("policy.actualRuntimeOrchestrationForbidden must be true");
  }
  for (const label of CONTROLLED_ACTIVATION_ALIGNMENT_CHECKLIST_LABEL_ROWS) {
    if (!runtimeChecklistHasLabel(checklist.checklist, label)) {
      findings.push(`checklist missing ${label}`);
    }
  }
  if (!activationBlockersAligned(blockerReport.blockers, summary.activationBlockers)) {
    findings.push("blocker report misaligned with summary.activationBlockers");
  }
  if (
    summary.candidateStatus === "controlled_activation_metadata_candidate" &&
    (boundaryViolation.actualFlagViolations.length > 0 ||
      boundaryViolation.policyViolations.length > 0 ||
      boundaryViolation.wordingRiskFindings.length > 0)
  ) {
    findings.push("controlled_activation_metadata_candidate requires empty controlled activation violations");
  }
  if (
    upstream.ultimateViolation &&
    summary.candidateStatus === "controlled_activation_metadata_candidate" &&
    (upstream.ultimateViolation.actualFlagViolations.length > 0 ||
      upstream.ultimateViolation.proofViolations.length > 0)
  ) {
    findings.push("upstream ultimate governance violations misaligned with controlled activation candidate");
  }

  const alignmentStatus = resolveControlledActivationCandidateAlignmentStatus(findings);

  return {
    mode: "runtime_controlled_activation_candidate_alignment_report",
    ...RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
    alignmentStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations: mergeSortedUniqueKo([
      ...(alignmentStatus === "aligned_metadata"
        ? ["H41.5: controlled activation candidate aligned_metadata — H42 entry 후보(activation 없음)"]
        : []),
      ...(alignmentStatus === "partial"
        ? ["H41.5: controlled activation candidate partial alignment — handoff·scope·ultimate gate 재검토"]
        : []),
      ...(alignmentStatus === "failed"
        ? ["H41.5: controlled activation candidate alignment failed — policy·forbidden ops·checklist 정렬"]
        : []),
    ]),
  };
}
