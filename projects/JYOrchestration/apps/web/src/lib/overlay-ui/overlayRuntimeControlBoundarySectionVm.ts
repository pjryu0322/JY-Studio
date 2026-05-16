/**
 * H22.5 — Overlay runtime **control boundary** 섹션 VM.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_CONTROL_BOUNDARY_LEVEL_LABEL_KO,
  RUNTIME_CONTROL_BOUNDARY_RISK_LABEL_KO,
  RUNTIME_CONTROL_BOUNDARY_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeControlBoundary/runtimeControlBoundaryLabelsKo";

export type OverlayRuntimeControlBoundarySectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  boundaryLevelKo: string;
  boundaryRiskKo: string;
  rationaleKo: string;
  topBlockedReason: string | null;
  topForbiddenScope: string | null;
  violationFlagRows: readonly string[];
  wordingRiskRows: readonly string[];
  allowedScopeRows: readonly string[];
  forbiddenScopeRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeControlBoundarySectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeControlBoundarySectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const s = reports.runtimeControlBoundarySummary;
  const v = reports.runtimeControlBoundaryViolationReport;
  const m = reports.runtimeControlScopeMatrix;

  const violationFlagRows = compactAndNarrowUi ? v.actualFlagViolations.slice(0, 1) : [...v.actualFlagViolations];
  const wordingRiskRows = compactAndNarrowUi ? v.wordingRiskFindings.slice(0, 1) : [...v.wordingRiskFindings];
  const allowedScopeRows = compactAndNarrowUi ? m.allowedMetadataScopes.slice(0, 1) : [...m.allowedMetadataScopes];
  const forbiddenScopeRows = compactAndNarrowUi
    ? m.forbiddenControlScopes.slice(0, 1)
    : [...m.forbiddenControlScopes];
  const recommendationRows = compactAndNarrowUi ? s.recommendations.slice(0, 1) : [...s.recommendations];

  return {
    sectionDisclaimer: RUNTIME_CONTROL_BOUNDARY_SECTION_DISCLAIMER_KO,
    showAttention:
      s.boundaryRisk !== "stable" ||
      s.boundaryLevel === "actual_control_forbidden" ||
      v.actualFlagViolations.length > 0 ||
      v.wordingRiskFindings.length > 0,
    showDetailSections: !compactAndNarrowUi,
    boundaryLevelKo: RUNTIME_CONTROL_BOUNDARY_LEVEL_LABEL_KO[s.boundaryLevel],
    boundaryRiskKo: RUNTIME_CONTROL_BOUNDARY_RISK_LABEL_KO[s.boundaryRisk],
    rationaleKo: s.rationaleKo,
    topBlockedReason: s.blockedReasons[0] ?? null,
    topForbiddenScope: m.forbiddenControlScopes[0] ?? null,
    violationFlagRows,
    wordingRiskRows,
    allowedScopeRows,
    forbiddenScopeRows,
    recommendationRows,
  };
}
