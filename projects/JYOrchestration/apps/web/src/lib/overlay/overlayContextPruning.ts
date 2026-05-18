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

function trimSlice(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function coerceNonNegInt(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function reasonFor(item: OverlayAssemblyPlanItem, overflow: OverlayContextBudgetOverflowRisk): string {
  return `overflow_${overflow}_${item.type}`.slice(0, REASON_MAX_LEN);
}

/**
 * pruning 우선순위:
 * 1) `includeMode === "excludeCandidate"` 우선,
 * 2) 같은 그룹 내에서는 낮은 우선순위(큰 priority) 먼저,
 * 3) 같으면 비용이 큰 것 먼저.
 */
function comparePlanForPruning(a: OverlayAssemblyPlanItem, b: OverlayAssemblyPlanItem): number {
  const aExclude = a.includeMode === "excludeCandidate" ? 0 : 1;
  const bExclude = b.includeMode === "excludeCandidate" ? 0 : 1;
  if (aExclude !== bExclude) return aExclude - bExclude;
  if (a.priority !== b.priority) return b.priority - a.priority;
  return b.estimatedCost - a.estimatedCost;
}

/**
 * pruning 후보 산출 기준:
 * - `includeMode === "excludeCandidate"` 항목은 overflow 단계와 무관하게 1차 후보.
 * - 그 외 항목은 legacy `pruningCandidate` 플래그가 true인 경우만 medium/high 단계에서 후보.
 * - `overflowRisk === "low"`이고 excludeCandidate도 없는 경우엔 빈 배열.
 */
export function suggestOverlayPruningCandidates(input: {
  assemblyPlan: readonly OverlayAssemblyPlanItem[];
  overflowRisk: OverlayContextBudgetOverflowRisk;
}): readonly OverlayPruningCandidate[] {
  const candidates = input.assemblyPlan.filter((it) => {
    if (it.includeMode === "excludeCandidate") return true;
    if (input.overflowRisk === "low") return false;
    return it.pruningCandidate === true;
  });
  if (!candidates.length) return [];
  const sorted = candidates.slice().sort(comparePlanForPruning).slice(0, OVERLAY_PRUNING_CANDIDATES_MAX);
  return sorted.map((item) => ({
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
    const source = trimSlice(r.source, SOURCE_MAX_LEN);
    const reason = trimSlice(r.reason, REASON_MAX_LEN);
    if (!source || !reason) continue;
    out.push({ source, reason, estimatedReduction: coerceNonNegInt(r.estimatedReduction) });
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
