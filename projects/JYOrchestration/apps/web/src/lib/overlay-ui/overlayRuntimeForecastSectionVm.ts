/**
 * H20 — Overlay runtime forecast 섹션 ViewModel 타입·reports → VM 변환.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_FORECAST_SECTION_DISCLAIMER_KO,
  RUNTIME_FORECAST_STABILITY_OUTLOOK_LABEL_KO,
  RUNTIME_FORECAST_TREND_LABEL_KO,
} from "@/lib/harness/runtimeForecast/runtimeForecastLabelsKo";

export type OverlayRuntimeForecastSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  primaryForecastKo: string;
  saturationRiskKo: string;
  stabilityOutlookLabel: string;
  governanceDriftKo: string;
  escalationSummaryKo: string;
  trendRows: readonly string[];
  escalationRows: readonly string[];
}>;

const OVERLAY_MAX_TRENDS = 5;
const OVERLAY_MAX_TRENDS_COMPACT = 2;
const OVERLAY_MAX_ESCALATION = 5;
const OVERLAY_MAX_ESCALATION_COMPACT = 1;

export function buildOverlayRuntimeForecastSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeForecastSectionVM {
  const {
    runtimeForecastSummary,
    runtimeForecastEscalation,
    runtimeForecastGovernanceDrift,
    runtimeForecastStability,
  } = reports;
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const maxTrends = compactAndNarrowUi ? OVERLAY_MAX_TRENDS_COMPACT : OVERLAY_MAX_TRENDS;
  const maxEscalation = compactAndNarrowUi ? OVERLAY_MAX_ESCALATION_COMPACT : OVERLAY_MAX_ESCALATION;

  const highSeverity =
    runtimeForecastSummary.topRisks.some((r) => r.severity === "high" || r.severity === "critical_candidate") ||
    runtimeForecastStability.outlook === "degrading" ||
    runtimeForecastStability.outlook === "critical_candidate";

  const trendRows = runtimeForecastSummary.trends.slice(0, maxTrends).map(
    (t) => `${RUNTIME_FORECAST_TREND_LABEL_KO[t.kind]} · ${t.direction} · ${t.noteKo}`
  );
  const escalationRows = compactAndNarrowUi
    ? [runtimeForecastEscalation.primaryChainKo]
    : runtimeForecastEscalation.highRiskFirst.slice(0, maxEscalation);

  return {
    sectionDisclaimer: RUNTIME_FORECAST_SECTION_DISCLAIMER_KO,
    showAttention: highSeverity,
    showDetailSections: !compactAndNarrowUi,
    primaryForecastKo: runtimeForecastSummary.primaryForecastKo,
    saturationRiskKo: runtimeForecastSummary.orchestrationSaturationRiskKo,
    stabilityOutlookLabel: RUNTIME_FORECAST_STABILITY_OUTLOOK_LABEL_KO[runtimeForecastStability.outlook],
    governanceDriftKo: runtimeForecastGovernanceDrift.primaryDriftKo,
    escalationSummaryKo: runtimeForecastEscalation.primaryChainKo,
    trendRows,
    escalationRows,
  };
}
