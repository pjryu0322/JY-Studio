/**
 * H19 — Overlay semantic vocabulary 섹션 ViewModel 타입·reports → VM 변환.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { applyVocabularyToOverlayText } from "@/lib/harness/runtimeSemanticVocabulary/runtimeSemanticVocabularyUiAdapter";
import { RUNTIME_SEMANTIC_VOCABULARY_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeSemanticVocabulary/runtimeSemanticVocabularyLabelsKo";

export type OverlayRuntimeSemanticVocabularySectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  topPriorityLabel: string;
  collapsedDuplicateLabel: string;
  canonicalLabelRows: readonly string[];
  priorityRows: readonly string[];
  rootCauseNormalizedRows: readonly string[];
}>;

const OVERLAY_MAX_CANONICAL = 6;
const OVERLAY_MAX_CANONICAL_COMPACT = 3;

export function buildOverlayRuntimeSemanticVocabularySectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeSemanticVocabularySectionVM {
  const { semanticVocabularySummary, semanticPriorityVocabulary, semanticRootCauseGroups } = reports;
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const maxCanonical = compactAndNarrowUi ? OVERLAY_MAX_CANONICAL_COMPACT : OVERLAY_MAX_CANONICAL;

  const canonicalLabelRows = semanticVocabularySummary.normalizedLabels
    .slice(0, maxCanonical)
    .map((l) => applyVocabularyToOverlayText(`${l.labelKo} (${l.meaningLevel})`));

  const priorityRows = semanticPriorityVocabulary.priorities
    .slice(0, 5)
    .map((p) => `${p.rank}. ${p.labelKo}`);

  const rootCauseNormalizedRows = semanticRootCauseGroups
    .slice(0, 4)
    .map((g) => applyVocabularyToOverlayText(`${g.labelKo}: ${g.primaryChain.join(" → ")}`));

  const hasDrift = semanticVocabularySummary.collapsedDuplicateCount > 0;
  const hasCriticalPriority = semanticPriorityVocabulary.priorities.some((p) => p.meaningLevel === "critical");

  return {
    sectionDisclaimer: RUNTIME_SEMANTIC_VOCABULARY_SECTION_DISCLAIMER_KO,
    showAttention: hasDrift || hasCriticalPriority,
    showDetailSections: !compactAndNarrowUi,
    topPriorityLabel: semanticPriorityVocabulary.topPriorityLabelKo,
    collapsedDuplicateLabel: hasDrift
      ? `중복 wording ${semanticVocabularySummary.collapsedDuplicateCount}건 접힘`
      : "중복 wording 없음",
    canonicalLabelRows,
    priorityRows,
    rootCauseNormalizedRows,
  };
}
