/**
 * H19 — cross-layer **vocabulary dictionary** 구축(read-only).
 */

import type { RuntimeSemanticCorePlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticGraphPlanningReports } from "@/lib/harness/runtimeSemanticGraph/buildRuntimeSemanticGraphPlanningReports";
import type { RuntimeSemanticNarrativePlanningReports } from "@/lib/harness/runtimeSemanticNarrative/runtimeSemanticNarrativeTypes";
import { stabilizeRuntimeSemanticMeaning } from "./stabilizeRuntimeSemanticMeaning";
import type {
  RuntimeSemanticNormalizedLabel,
  RuntimeSemanticVocabularyEntry,
  RuntimeSemanticVocabularyGroup,
  RuntimeSemanticVocabularySourceLayer,
  RuntimeSemanticVocabularySummary,
} from "./runtimeSemanticVocabularyTypes";

const MAX_GROUPS = 10;
const MAX_ENTRIES_PER_GROUP = 6;

function collectRawLabels(
  core: RuntimeSemanticCorePlanningReports,
  graph: RuntimeSemanticGraphPlanningReports,
  narrative: RuntimeSemanticNarrativePlanningReports
): readonly Readonly<{ raw: string; layer: RuntimeSemanticVocabularySourceLayer }>[] {
  const items: { raw: string; layer: RuntimeSemanticVocabularySourceLayer }[] = [];

  for (const f of core.compressionQualityReport.findings) {
    items.push({ raw: f.code, layer: "compression" });
    items.push({ raw: f.messageKo, layer: "compression" });
  }
  for (const f of core.hiddenTraceAudit.findings) {
    items.push({ raw: f.messageKo, layer: "governance" });
  }
  for (const path of graph.semanticExplainabilityGraph.causalPaths) {
    items.push({ raw: path, layer: "graph" });
  }
  for (const origin of graph.semanticWarningOriginSummary.origins) {
    items.push({ raw: origin.warningCode, layer: "warning" });
    for (const step of origin.originChain) {
      items.push({ raw: step, layer: "warning" });
    }
  }
  for (const n of narrative.semanticNarrativeSummary.narratives) {
    items.push({ raw: n.narrativeKo.slice(0, 120), layer: "narrative" });
  }
  for (const g of narrative.semanticRootCauseGroups) {
    items.push({ raw: g.labelKo, layer: "narrative" });
    for (const step of g.primaryChain) {
      items.push({ raw: step, layer: "narrative" });
    }
  }
  items.push({ raw: narrative.semanticGraphRelevanceSummary.criticalPath, layer: "graph" });
  items.push({ raw: graph.semanticExplosionRiskSummary.explosionRisk, layer: "overlay" });

  return items.filter((i) => i.raw.trim().length > 0);
}

export function buildRuntimeSemanticVocabularyDictionary(
  core: RuntimeSemanticCorePlanningReports,
  graph: RuntimeSemanticGraphPlanningReports,
  narrative: RuntimeSemanticNarrativePlanningReports
): RuntimeSemanticVocabularySummary {
  const rawItems = collectRawLabels(core, graph, narrative);
  const groupMap = new Map<string, RuntimeSemanticVocabularyEntry[]>();
  let collapsedDuplicateCount = 0;

  for (const { raw, layer } of rawItems) {
    const stabilized = stabilizeRuntimeSemanticMeaning(raw);
    const entry: RuntimeSemanticVocabularyEntry = {
      rawLabel: raw.slice(0, 160),
      canonicalKey: stabilized.canonicalKey,
      canonicalLabelKo: stabilized.canonicalLabelKo,
      meaningLevel: stabilized.meaningLevel,
      sourceLayer: layer,
    };
    const list = groupMap.get(stabilized.canonicalKey) ?? [];
    const duplicate = list.some(
      (e) => e.rawLabel.toLowerCase() === entry.rawLabel.toLowerCase() && e.sourceLayer === layer
    );
    if (duplicate) {
      collapsedDuplicateCount += 1;
      continue;
    }
    if (list.length < MAX_ENTRIES_PER_GROUP) {
      list.push(entry);
      groupMap.set(stabilized.canonicalKey, list);
    }
  }

  const groups: RuntimeSemanticVocabularyGroup[] = [...groupMap.entries()]
    .map(([canonicalKey, entries]) => ({
      canonicalKey,
      canonicalLabelKo: entries[0]?.canonicalLabelKo ?? canonicalKey,
      entries,
      collapsedAliasCount: Math.max(0, entries.length - 1),
    }))
    .sort((a, b) => b.collapsedAliasCount - a.collapsedAliasCount || a.canonicalKey.localeCompare(b.canonicalKey))
    .slice(0, MAX_GROUPS);

  const normalizedLabels: RuntimeSemanticNormalizedLabel[] = groups.map((g) => ({
    canonicalKey: g.canonicalKey,
    labelKo: g.canonicalLabelKo,
    meaningLevel: g.entries[0]?.meaningLevel ?? "info",
  }));

  return {
    mode: "runtime_semantic_vocabulary_summary",
    actualRuntimeOrchestrationEnabled: false,
    groups,
    normalizedLabels,
    collapsedDuplicateCount,
    recommendations: [
      "Vocabulary dictionary는 read-only meaning normalization입니다. actual orchestration 없음.",
      collapsedDuplicateCount > 0
        ? "duplicate wording을 canonical label로 접었습니다."
        : "현재 semantic wording drift가 낮습니다.",
    ].slice(0, 6),
  };
}

export function serializeRuntimeSemanticVocabularySummaryForDiagnostic(
  summary: RuntimeSemanticVocabularySummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    groups: summary.groups.map((g) => ({
      canonicalKey: g.canonicalKey,
      canonicalLabelKo: g.canonicalLabelKo,
      collapsedAliasCount: g.collapsedAliasCount,
      entries: g.entries.map((e) => ({ ...e })),
    })),
    normalizedLabels: summary.normalizedLabels.map((l) => ({ ...l })),
    collapsedDuplicateCount: summary.collapsedDuplicateCount,
    recommendations: [...summary.recommendations],
  };
}

export function serializeRuntimeSemanticNormalizedLabelsForDiagnostic(
  labels: readonly RuntimeSemanticNormalizedLabel[]
): Readonly<Record<string, unknown>> {
  return {
    mode: "runtime_semantic_normalized_labels",
    actualRuntimeOrchestrationEnabled: false,
    labels: labels.map((l) => ({ ...l })),
  };
}
