/**
 * H19 — Overlay **사용자 친화 wording** 변환(read-only).
 */

import { normalizeSemanticPhrase } from "./stabilizeRuntimeSemanticMeaning";
import type {
  RuntimeSemanticNormalizedLabel,
  RuntimeSemanticVocabularySummary,
} from "./runtimeSemanticVocabularyTypes";

export function toOverlaySemanticLabelKo(
  canonicalKey: string,
  vocabulary: RuntimeSemanticVocabularySummary,
  fallback: string
): string {
  const match = vocabulary.normalizedLabels.find((l) => l.canonicalKey === canonicalKey);
  return match?.labelKo ?? fallback;
}

export function applyVocabularyToOverlayText(
  text: string,
  _labels?: readonly RuntimeSemanticNormalizedLabel[]
): string {
  return normalizeSemanticPhrase(text);
}
