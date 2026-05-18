/**
 * H22 — Overlay runtime resource **allocation trial** 섹션 VM.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_RESOURCE_TRIAL_CONSISTENCY_LABEL_KO,
  RUNTIME_RESOURCE_TRIAL_MODE_LABEL_KO,
  RUNTIME_RESOURCE_TRIAL_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeResourceTrial/runtimeResourceTrialLabelsKo";

export type OverlayRuntimeResourceTrialSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  trialModeKo: string;
  consistencyKo: string;
  readinessKo: string;
  topBlockedReason: string | null;
  topRecommendation: string | null;
  forecastObservations: readonly string[];
  governanceObservations: readonly string[];
  driftFindings: readonly string[];
  satisfiedRows: readonly string[];
}>;

export function buildOverlayRuntimeResourceTrialSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeResourceTrialSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const t = reports.runtimeResourceAllocationTrialReport;
  const fc = reports.runtimeAllocationForecastComparison;
  const gc = reports.runtimeAllocationGovernanceComparison;
  const drift = reports.runtimeAllocationTrialDriftSummary;

  const forecastObservations = compactAndNarrowUi ? fc.observations.slice(0, 1) : [...fc.observations];
  const governanceObservations = compactAndNarrowUi ? gc.observations.slice(0, 1) : [...gc.observations];
  const driftFindings = compactAndNarrowUi ? drift.driftFindings.slice(0, 1) : [...drift.driftFindings];
  const satisfiedRows = compactAndNarrowUi
    ? t.satisfiedConditions.slice(0, 1)
    : [...t.satisfiedConditions].sort((a, b) => a.localeCompare(b, "ko"));

  const topBlockedReason = t.blockedReasons[0] ?? null;
  const topRecommendation = t.recommendations[0] ?? null;

  return {
    sectionDisclaimer: RUNTIME_RESOURCE_TRIAL_SECTION_DISCLAIMER_KO,
    showAttention:
      t.trialMode !== "not_applicable" ||
      t.consistency !== "consistent" ||
      drift.driftFindings.length > 0 ||
      !fc.aligned ||
      !gc.aligned,
    showDetailSections: !compactAndNarrowUi,
    trialModeKo: RUNTIME_RESOURCE_TRIAL_MODE_LABEL_KO[t.trialMode],
    consistencyKo: RUNTIME_RESOURCE_TRIAL_CONSISTENCY_LABEL_KO[t.consistency],
    readinessKo: t.readinessKo,
    topBlockedReason,
    topRecommendation,
    forecastObservations,
    governanceObservations,
    driftFindings,
    satisfiedRows,
  };
}
