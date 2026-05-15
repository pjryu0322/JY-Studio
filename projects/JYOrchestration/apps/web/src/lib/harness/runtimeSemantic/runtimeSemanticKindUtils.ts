/**
 * H17 — semantic kind 파싱·정렬(read-only).
 */

import type { RuntimeSemanticGroupKind } from "./runtimeSemanticTypes";
import { RUNTIME_SEMANTIC_GROUP_LABEL_KO } from "./runtimeSemanticLabelsKo";

export const SEMANTIC_KIND_ORDER: Record<RuntimeSemanticGroupKind, number> = {
  governance: 0,
  lifecycle: 1,
  dependency: 2,
  propagation: 3,
  criticality: 4,
  coherence: 5,
  other: 99,
};

export function parseSemanticKindFromStep(step: string): RuntimeSemanticGroupKind {
  const match = /\(([^)]+)\)\s*$/.exec(step.trim());
  const raw = (match?.[1] ?? "other").toLowerCase();
  if (raw in SEMANTIC_KIND_ORDER) return raw as RuntimeSemanticGroupKind;
  if (raw === "escalation") return "criticality";
  return "other";
}

export function semanticGroupLabelKo(kind: RuntimeSemanticGroupKind): string {
  return RUNTIME_SEMANTIC_GROUP_LABEL_KO[kind] ?? RUNTIME_SEMANTIC_GROUP_LABEL_KO.other;
}

export function compareSemanticKinds(a: RuntimeSemanticGroupKind, b: RuntimeSemanticGroupKind): number {
  return SEMANTIC_KIND_ORDER[a] - SEMANTIC_KIND_ORDER[b];
}
