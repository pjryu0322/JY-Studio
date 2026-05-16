/**
 * H27 — Overlay runtime **pilot activation candidate** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_PILOT_ACTIVATION_CANDIDATE_STATUS_LABEL_KO,
  RUNTIME_PILOT_ACTIVATION_MODE_LABEL_KO,
  RUNTIME_PILOT_ACTIVATION_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimePilotActivation/runtimePilotActivationLabelsKo";

export type OverlayRuntimePilotActivationSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  candidateStatusKo: string;
  activationModeKo: string;
  topActivationBlocker: string | null;
  topForbiddenActivationOperation: string | null;
  activationPolicySummaryKo: string;
  scopeSummaryRows: readonly string[];
  forbiddenActivationOperationRows: readonly string[];
  readinessChecklistRows: readonly string[];
  activationBlockerRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimePilotActivationSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimePilotActivationSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const s = reports.runtimePilotActivationSummary;
  const scope = reports.runtimePilotActivationScope;
  const policy = reports.runtimePilotActivationPolicy;
  const blockers = reports.runtimePilotActivationBlockerReport;
  const checklist = reports.runtimePilotActivationReadinessChecklist;

  const scopeSummaryRows = compactAndNarrowUi
    ? [
        scope.candidateSourceLayer,
        scope.candidateTargetLayer,
      ].slice(0, 1)
    : [
        `source: ${scope.candidateSourceLayer}`,
        `target: ${scope.candidateTargetLayer}`,
        ...scope.requiredInputMetadata.slice(0, 2),
        ...scope.expectedOutputMetadata.slice(0, 2),
      ];
  const forbiddenActivationOperationRows = compactAndNarrowUi
    ? scope.forbiddenActivationOperations.slice(0, 1)
    : [...scope.forbiddenActivationOperations];
  const readinessChecklistRows = compactAndNarrowUi
    ? checklist.checklist.slice(0, 1)
    : [...checklist.checklist];
  const activationBlockerRows = compactAndNarrowUi
    ? [...blockers.blockers.slice(0, 1), ...s.activationBlockers.slice(0, 1)]
    : mergeSortedUniqueKo([...blockers.blockers, ...s.activationBlockers]);
  const recommendationRows = compactAndNarrowUi ? s.recommendations.slice(0, 1) : [...s.recommendations];

  const topActivationBlocker = blockers.blockers[0] ?? s.activationBlockers[0] ?? null;
  const topForbiddenActivationOperation = scope.forbiddenActivationOperations[0] ?? null;

  const activationPolicySummaryKo = [
    `allowedMode: ${RUNTIME_PILOT_ACTIVATION_MODE_LABEL_KO[policy.activationAllowedMode]}`,
    policy.operatorReviewBeforeActivation ? "operatorReview: required" : "operatorReview: optional",
    policy.sandboxPreflightRequired ? "sandboxPreflight: required" : "sandboxPreflight: optional",
    "actualActivationForbidden: true",
  ].join(" · ");

  return {
    sectionDisclaimer: RUNTIME_PILOT_ACTIVATION_SECTION_DISCLAIMER_KO,
    showAttention:
      s.candidateStatus !== "activation_metadata_candidate" ||
      s.activationMode === "blocked" ||
      blockers.blockers.length > 0 ||
      checklist.blockers.length > 0,
    showDetailSections: !compactAndNarrowUi,
    candidateStatusKo: RUNTIME_PILOT_ACTIVATION_CANDIDATE_STATUS_LABEL_KO[s.candidateStatus],
    activationModeKo: RUNTIME_PILOT_ACTIVATION_MODE_LABEL_KO[s.activationMode],
    topActivationBlocker,
    topForbiddenActivationOperation,
    activationPolicySummaryKo,
    scopeSummaryRows,
    forbiddenActivationOperationRows,
    readinessChecklistRows,
    activationBlockerRows,
    recommendationRows,
  };
}
