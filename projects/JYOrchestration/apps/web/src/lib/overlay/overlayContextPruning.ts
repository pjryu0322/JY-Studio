/**
 * Overlay: **context pruning suggestion** — overflowRisk가 있을 때 줄일 후보를 제안한다.
 *
 * **이 헬퍼는 실제로 어떤 context도 제거하지 않는다.** suggestion metadata만 만든다.
 * 실제 pruning·payload·라우팅 변경 없음.
 */

import type { OverlayAssemblyPlanItem } from "@/lib/overlay/overlayContextAssemblyPlan";
import type { OverlayContextBudgetOverflowRisk } from "@/lib/overlay/overlayContextBudget";

export type OverlayPruningCandidate = Readonly<{
  source: string;
  /** 왜 줄여야 하는지(예: `overflow_high_low_priority_timeline`). */
  reason: string;
  /** 줄였을 때 절감 가능한 heuristic 비용 단위(0 이상). 실제 토큰 측정 아님. */
  estimatedReduction: number;
}>;

/** 행당 pruning candidate 상한. */
export const OVERLAY_PRUNING_CANDIDATES_MAX = 32;

const SOURCE_MAX_LEN = 240;
const REASON_MAX_LEN = 120;

function reasonFor(item: OverlayAssemblyPlanItem, overflow: OverlayContextBudgetOverflowRisk): string {
  return `overflow_${overflow}_${item.type}`.slice(0, REASON_MAX_LEN);
}

export function suggestOverlayPruningCandidates(input: {
  assemblyPlan: readonly OverlayAssemblyPlanItem[];
  overflowRisk: OverlayContextBudgetOverflowRisk;
}): readonly OverlayPruningCandidate[] {
  if (input.overflowRisk === "low") return [];
  // pruningCandidate가 true로 표시된 항목을 우선 모으되, 우선순위 낮음(priority 큼) → 비용 큰 순서로 정렬.
  const candidates = input.assemblyPlan
    .filter((it) => it.pruningCandidate)
    .slice() // shallow copy
    .sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.estimatedCost - a.estimatedCost;
    })
    .slice(0, OVERLAY_PRUNING_CANDIDATES_MAX);

  return candidates.map((item) => ({
    source: item.source.slice(0, SOURCE_MAX_LEN),
    reason: reasonFor(item, input.overflowRisk),
    estimatedReduction: item.estimatedCost,
  }));
}

export function parseOverlayPruningCandidatesFromUnknown(
  raw: unknown
): readonly OverlayPruningCandidate[] {
  if (!Array.isArray(raw)) return [];
  const out: OverlayPruningCandidate[] = [];
  for (const item of raw) {
    if (out.length >= OVERLAY_PRUNING_CANDIDATES_MAX) break;
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const source = String(r.source ?? "").trim().slice(0, SOURCE_MAX_LEN);
    const reason = String(r.reason ?? "").trim().slice(0, REASON_MAX_LEN);
    if (!source || !reason) continue;
    const redRaw = Number(r.estimatedReduction);
    const estimatedReduction = Number.isFinite(redRaw) ? Math.max(0, Math.floor(redRaw)) : 0;
    out.push({ source, reason, estimatedReduction });
  }
  return out;
}

export type OverlayPruningSummaryWire = Readonly<{
  candidateCount: number;
  totalEstimatedReduction: number;
}>;

export function summarizeOverlayPruningCandidates(
  candidates: readonly OverlayPruningCandidate[]
): OverlayPruningSummaryWire {
  let totalEstimatedReduction = 0;
  for (const c of candidates) totalEstimatedReduction += c.estimatedReduction;
  return { candidateCount: candidates.length, totalEstimatedReduction };
}
