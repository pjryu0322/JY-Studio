/**
 * H41 — Overlay runtime **controlled activation candidate** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_CONTROLLED_ACTIVATION_MODE_LABEL_KO,
  RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_SECTION_DISCLAIMER_KO,
  RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_STATUS_LABEL_KO,
} from "@/lib/harness/runtimeControlledActivationCandidate/runtimeControlledActivationCandidateLabelsKo";
import { sliceOverlayRows } from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";

export type OverlayRuntimeControlledActivationCandidateSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  candidateStatusKo: string;
  activationModeKo: string;
  topActivationBlocker: string | null;
  topForbiddenActivationOperation: string | null;
  handoffBoundarySummaryKo: string;
  candidateScopeSummaryRows: readonly string[];
  forbiddenActivationOperationRows: readonly string[];
  activationPolicySummaryKo: string;
  readinessChecklistRows: readonly string[];
  missingChecklistRows: readonly string[];
  activationBlockerRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeControlledActivationCandidateSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeControlledActivationCandidateSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const summary = reports.runtimeControlledActivationCandidateSummary;
  const handoff = reports.runtimeControlHandoffBoundary;
  const scope = reports.runtimeControlledActivationCandidateScope;
  const policy = reports.runtimeControlledActivationCandidatePolicy;
  const blockers = reports.runtimeControlledActivationCandidateBlockerReport;
  const checklist = reports.runtimeControlledActivationReadinessChecklist;

  const candidateScopeSummaryRows = compactAndNarrowUi
    ? [scope.candidateSourceLayer].slice(0, 1)
    : [
        `source: ${scope.candidateSourceLayer}`,
        `target: ${scope.candidateTargetLayer}`,
        ...scope.requiredCandidateInputs.slice(0, 2),
        ...scope.expectedCandidateOutputs.slice(0, 2),
      ];
  const forbiddenActivationOperationRows = sliceOverlayRows(
    scope.forbiddenCandidateOperations,
    compactAndNarrowUi
  );
  const readinessChecklistRows = sliceOverlayRows(checklist.checklist, compactAndNarrowUi);
  const missingChecklistRows = sliceOverlayRows(checklist.missingRows, compactAndNarrowUi);
  const activationBlockerRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([...blockers.blockers, ...summary.activationBlockers, ...checklist.blockers]).slice(0, 1)
    : mergeSortedUniqueKo([...blockers.blockers, ...summary.activationBlockers, ...checklist.blockers]);
  const recommendationRows = compactAndNarrowUi ? summary.recommendations.slice(0, 1) : [...summary.recommendations];

  const topActivationBlocker =
    blockers.blockers[0] ?? summary.activationBlockers[0] ?? checklist.blockers[0] ?? null;
  const topForbiddenActivationOperation = scope.forbiddenCandidateOperations[0] ?? null;

  const handoffBoundarySummaryKo = compactAndNarrowUi
    ? handoff.boundarySourceLayer
    : [`source: ${handoff.boundarySourceLayer}`, `target: ${handoff.boundaryTargetLayer}`].join(" · ");

  const activationPolicySummaryKo = compactAndNarrowUi
    ? RUNTIME_CONTROLLED_ACTIVATION_MODE_LABEL_KO[policy.activationAllowedMode]
    : [
        `allowed: ${RUNTIME_CONTROLLED_ACTIVATION_MODE_LABEL_KO[policy.activationAllowedMode]}`,
        "operatorReviewRequired",
        "rollbackReadinessRequired",
        "auditTraceRequired",
      ].join(" · ");

  return {
    sectionDisclaimer: RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_SECTION_DISCLAIMER_KO,
    showAttention:
      summary.candidateStatus !== "controlled_activation_metadata_candidate" ||
      summary.activationMode === "blocked" ||
      blockers.blockers.length > 0 ||
      checklist.missingRows.length > 0 ||
      policy.actualControlledActivationForbidden !== true,
    showDetailSections: !compactAndNarrowUi,
    candidateStatusKo: RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_STATUS_LABEL_KO[summary.candidateStatus],
    activationModeKo: RUNTIME_CONTROLLED_ACTIVATION_MODE_LABEL_KO[summary.activationMode],
    topActivationBlocker,
    topForbiddenActivationOperation,
    handoffBoundarySummaryKo,
    candidateScopeSummaryRows,
    forbiddenActivationOperationRows,
    activationPolicySummaryKo,
    readinessChecklistRows,
    missingChecklistRows,
    activationBlockerRows,
    recommendationRows,
  };
}
