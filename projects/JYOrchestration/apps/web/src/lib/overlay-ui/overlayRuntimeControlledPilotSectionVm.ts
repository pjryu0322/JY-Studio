/**
 * H24 — Overlay runtime **controlled pilot** 섹션 VM.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_CONTROLLED_PILOT_READINESS_LABEL_KO,
  RUNTIME_CONTROLLED_PILOT_SCOPE_LABEL_KO,
  RUNTIME_CONTROLLED_PILOT_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeControlledPilot/runtimeControlledPilotLabelsKo";

export type OverlayRuntimeControlledPilotSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  pilotReadinessKo: string;
  pilotScopeKo: string;
  candidateFlowKo: string;
  topSafetyBlocker: string | null;
  topAbortCondition: string | null;
  safetyBlockerRows: readonly string[];
  fallbackRequirementRows: readonly string[];
  abortConditionRows: readonly string[];
  forbiddenScopeRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeControlledPilotSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeControlledPilotSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const s = reports.runtimeControlledPilotSummary;
  const e = reports.runtimeControlledPilotSafetyEnvelope;

  const safetyBlockerRows = compactAndNarrowUi ? s.safetyBlockers.slice(0, 1) : [...s.safetyBlockers];
  const fallbackRequirementRows = compactAndNarrowUi
    ? s.fallbackRequirements.slice(0, 1)
    : [...s.fallbackRequirements];
  const abortConditionRows = compactAndNarrowUi ? s.abortConditionMetadata.slice(0, 1) : [...s.abortConditionMetadata];
  const forbiddenScopeRows = compactAndNarrowUi
    ? e.forbiddenPilotExecutionScopes.slice(0, 1)
    : [...e.forbiddenPilotExecutionScopes];
  const recommendationRows = compactAndNarrowUi ? s.recommendations.slice(0, 1) : [...s.recommendations];

  return {
    sectionDisclaimer: RUNTIME_CONTROLLED_PILOT_SECTION_DISCLAIMER_KO,
    showAttention:
      s.readiness !== "not_ready" ||
      s.pilotScope !== "none" ||
      s.safetyBlockers.length > 0 ||
      s.abortConditionMetadata.length > 0,
    showDetailSections: !compactAndNarrowUi,
    pilotReadinessKo: RUNTIME_CONTROLLED_PILOT_READINESS_LABEL_KO[s.readiness],
    pilotScopeKo: RUNTIME_CONTROLLED_PILOT_SCOPE_LABEL_KO[s.pilotScope],
    candidateFlowKo: s.candidateFlowKo,
    topSafetyBlocker: s.safetyBlockers[0] ?? null,
    topAbortCondition: s.abortConditionMetadata[0] ?? null,
    safetyBlockerRows,
    fallbackRequirementRows,
    abortConditionRows,
    forbiddenScopeRows,
    recommendationRows,
  };
}
