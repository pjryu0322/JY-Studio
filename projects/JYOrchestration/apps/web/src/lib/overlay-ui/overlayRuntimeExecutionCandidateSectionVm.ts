/**
 * H23 — Overlay runtime **execution candidate** 섹션 VM.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_EXECUTION_CANDIDATE_RISK_LABEL_KO,
  RUNTIME_EXECUTION_CANDIDATE_SECTION_DISCLAIMER_KO,
  RUNTIME_EXECUTION_CANDIDATE_STATUS_LABEL_KO,
} from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateLabelsKo";

export type OverlayRuntimeExecutionCandidateSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  candidateStatusKo: string;
  candidateRiskKo: string;
  rationaleKo: string;
  topPrecondition: string | null;
  topBlocker: string | null;
  requiredApprovalRows: readonly string[];
  rollbackPrerequisiteRows: readonly string[];
  scopeInputRows: readonly string[];
  scopeForbiddenRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeExecutionCandidateSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeExecutionCandidateSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const s = reports.runtimeExecutionCandidateSummary;
  const sc = reports.runtimeExecutionCandidateScope;

  const requiredApprovalRows = compactAndNarrowUi ? s.requiredApprovals.slice(0, 1) : [...s.requiredApprovals];
  const rollbackPrerequisiteRows = compactAndNarrowUi
    ? s.rollbackPrerequisites.slice(0, 1)
    : [...s.rollbackPrerequisites];
  const scopeInputRows = compactAndNarrowUi ? sc.candidateInputs.slice(0, 1) : [...sc.candidateInputs];
  const scopeForbiddenRows = compactAndNarrowUi
    ? sc.forbiddenExecutionScopes.slice(0, 1)
    : [...sc.forbiddenExecutionScopes];
  const recommendationRows = compactAndNarrowUi ? s.recommendations.slice(0, 1) : [...s.recommendations];

  return {
    sectionDisclaimer: RUNTIME_EXECUTION_CANDIDATE_SECTION_DISCLAIMER_KO,
    showAttention:
      s.candidateStatus !== "not_candidate" ||
      s.candidateRisk !== "stable" ||
      s.candidateBlockers.length > 0,
    showDetailSections: !compactAndNarrowUi,
    candidateStatusKo: RUNTIME_EXECUTION_CANDIDATE_STATUS_LABEL_KO[s.candidateStatus],
    candidateRiskKo: RUNTIME_EXECUTION_CANDIDATE_RISK_LABEL_KO[s.candidateRisk],
    rationaleKo: s.rationaleKo,
    topPrecondition: s.candidatePreconditions[0] ?? null,
    topBlocker: s.candidateBlockers[0] ?? null,
    requiredApprovalRows,
    rollbackPrerequisiteRows,
    scopeInputRows,
    scopeForbiddenRows,
    recommendationRows,
  };
}
