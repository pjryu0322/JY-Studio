/**
 * H19 — 동일 의미 **canonical key**로 drift stabilization(read-only).
 */

import { RUNTIME_SEMANTIC_CANONICAL_LABEL_KO } from "./runtimeSemanticVocabularyLabelsKo";
import type { RuntimeSemanticMeaningLevel } from "./runtimeSemanticVocabularyTypes";

export type StabilizedSemanticMeaning = Readonly<{
  canonicalKey: string;
  canonicalLabelKo: string;
  meaningLevel: RuntimeSemanticMeaningLevel;
}>;

const ALIAS_TO_CANONICAL: Readonly<Record<string, string>> = {
  "hidden governance trace": "governance_hidden_trace",
  "governance trace hidden": "governance_hidden_trace",
  "compressed governance signal": "governance_hidden_trace",
  "hidden governance": "governance_hidden_trace",
  "hidden critical transition": "hidden_critical_transition",
  "hidden critical": "hidden_critical_transition",
  "semantic compression": "semantic_compression",
  "compression quality": "compression_quality",
  "quality warning": "compression_quality",
  "propagation escalation": "propagation_escalation",
  "critical propagation": "propagation_escalation",
  "high escalation": "propagation_escalation",
  "major propagation risk": "propagation_escalation",
  "impact propagation": "propagation_escalation",
  "dependency conflict": "dependency_conflict",
  "reasoning explosion": "reasoning_explosion",
  "semantic explosion": "semantic_explosion",
  "group imbalance": "group_imbalance",
  "dominant group": "group_imbalance",
  "warning origin": "warning_origin",
  "causal path": "causal_path",
  "stable semantic path": "stable_planning",
  "stable planning": "stable_planning",
  "planning trace": "stable_planning",
  "reasoning chain": "stable_planning",
  "compressed trace": "semantic_compression",
  "propagation chain": "propagation_escalation",
};

const MEANING_LEVEL_BY_KEY: Readonly<Record<string, RuntimeSemanticMeaningLevel>> = {
  governance_hidden_trace: "critical",
  hidden_critical_transition: "critical",
  compression_quality: "watch",
  propagation_escalation: "watch",
  dependency_conflict: "watch",
  reasoning_explosion: "watch",
  semantic_explosion: "watch",
  group_imbalance: "info",
  stable_planning: "info",
  warning_origin: "watch",
  causal_path: "info",
  semantic_compression: "info",
};

function normalizeRawKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolveCanonicalKeyFromRawLabel(rawLabel: string): string {
  const normalized = normalizeRawKey(rawLabel);
  if (ALIAS_TO_CANONICAL[normalized]) return ALIAS_TO_CANONICAL[normalized];
  for (const [alias, key] of Object.entries(ALIAS_TO_CANONICAL)) {
    if (normalized.includes(alias)) return key;
  }
  const slug = normalized.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return slug.length > 0 ? slug.slice(0, 48) : "unknown_label";
}

export function stabilizeRuntimeSemanticMeaning(rawLabel: string): StabilizedSemanticMeaning {
  const canonicalKey = resolveCanonicalKeyFromRawLabel(rawLabel);
  const canonicalLabelKo =
    (RUNTIME_SEMANTIC_CANONICAL_LABEL_KO[canonicalKey] ?? rawLabel.trim().slice(0, 80)) || "—";
  const meaningLevel = MEANING_LEVEL_BY_KEY[canonicalKey] ?? "info";
  return { canonicalKey, canonicalLabelKo, meaningLevel };
}

export function normalizeSemanticPhrase(text: string): string {
  let result = text;
  const sortedAliases = Object.keys(ALIAS_TO_CANONICAL).sort((a, b) => b.length - a.length);
  for (const alias of sortedAliases) {
    const key = ALIAS_TO_CANONICAL[alias]!;
    const label = RUNTIME_SEMANTIC_CANONICAL_LABEL_KO[key];
    if (!label) continue;
    const re = new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    result = result.replace(re, label);
  }
  return result;
}
