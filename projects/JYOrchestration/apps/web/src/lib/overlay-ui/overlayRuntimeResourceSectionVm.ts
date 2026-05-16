/**
 * H20.5 — Overlay runtime resource 섹션 ViewModel 타입·reports → VM 변환.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_RESOURCE_CAPACITY_OUTLOOK_LABEL_KO,
  RUNTIME_RESOURCE_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeResource/runtimeResourceLabelsKo";

export type OverlayRuntimeResourceSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  overloadSummaryKo: string;
  primaryPressureKo: string;
  providerPressureKo: string;
  queuePressureKo: string;
  bottleneckPropagationKo: string;
  queueDepthLabel: string;
  capacityOutlookLabel: string;
  capacityForecastKo: string;
  memberSaturationKo: string;
  explainabilityChainKo: string;
  pressureRows: readonly string[];
  memberRows: readonly string[];
}>;

const OVERLAY_MAX_PRESSURES = 6;
const OVERLAY_MAX_PRESSURES_COMPACT = 1;
const OVERLAY_MAX_MEMBERS = 5;
const OVERLAY_MAX_MEMBERS_COMPACT = 2;

export function buildOverlayRuntimeResourceSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeResourceSectionVM {
  const {
    runtimeResourceSummary,
    runtimeResourceForecast,
    runtimeResourceCapacity,
    runtimeMemberWorkload,
    runtimeResourceExplainability,
  } = reports;
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const maxPressures = compactAndNarrowUi ? OVERLAY_MAX_PRESSURES_COMPACT : OVERLAY_MAX_PRESSURES;
  const maxMembers = compactAndNarrowUi ? OVERLAY_MAX_MEMBERS_COMPACT : OVERLAY_MAX_MEMBERS;

  /** `analyzeRuntimeResourcePressure`가 심각도 내림차순으로 이미 정렬함. */
  const pressures = runtimeResourceSummary.pressures;

  const highSeverity = pressures.some(
    (p) => p.severity === "high" || p.severity === "critical_candidate"
  );
  const saturatedMembers = runtimeMemberWorkload.members.filter(
    (m) => m.workloadLevel === "saturated" || m.workloadLevel === "elevated"
  );

  const pressureRows = pressures
    .filter((p) => p.severity !== "low")
    .slice(0, maxPressures)
    .map((p) => `${p.labelKo} · ${p.noteKo}`);
  const memberRows = compactAndNarrowUi
    ? saturatedMembers.slice(0, maxMembers).map((m) => `${m.labelKo}: ${m.workloadLevel}`)
    : runtimeMemberWorkload.members.slice(0, maxMembers).map((m) => `${m.labelKo}: ${m.workloadLevel}`);

  return {
    sectionDisclaimer: RUNTIME_RESOURCE_SECTION_DISCLAIMER_KO,
    showAttention:
      highSeverity ||
      saturatedMembers.length > 0 ||
      runtimeResourceSummary.bottleneckPropagation.propagationSeverity !== "low",
    showDetailSections: !compactAndNarrowUi,
    overloadSummaryKo: runtimeResourceSummary.overloadSummaryKo,
    primaryPressureKo: runtimeResourceSummary.primaryPressureKo,
    providerPressureKo: runtimeResourceSummary.providerPressure.summaryKo,
    queuePressureKo: runtimeResourceSummary.queuePressureInsight.summaryKo,
    bottleneckPropagationKo: runtimeResourceSummary.bottleneckPropagation.bottleneckChainKo,
    queueDepthLabel: runtimeResourceSummary.queue.queueDepthLabel,
    capacityOutlookLabel: RUNTIME_RESOURCE_CAPACITY_OUTLOOK_LABEL_KO[runtimeResourceCapacity.outlook],
    capacityForecastKo: runtimeResourceForecast.primaryPredictionKo,
    memberSaturationKo: runtimeMemberWorkload.primaryOverloadKo,
    explainabilityChainKo: runtimeResourceExplainability.causalChainKo,
    pressureRows: pressureRows.length > 0 ? pressureRows : [runtimeResourceSummary.overloadSummaryKo],
    memberRows: memberRows.length > 0 ? memberRows : [runtimeMemberWorkload.imbalanceNoteKo],
  };
}
