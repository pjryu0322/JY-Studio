/**
 * Harness Phase H4 Preparation — **Memory Freshness** 평가.
 *
 * 메모리 후보의 시간 경과·충돌 신호를 보고 `fresh | aging | stale`을 결정한다.
 *
 * **read-only / diagnostic only.** 실제 삭제·pruning·prompt 영향 없음.
 */

import type { MemoryFreshness } from "./memoryRuntimeTypes";

/** Freshness 임계값(ms). 단일 출처로 평가/테스트가 공유. */
export const MEMORY_FRESHNESS_THRESHOLDS_MS = {
  /** 이 기준 이내는 `fresh`. 기본 24h. */
  freshUpperBoundMs: 24 * 60 * 60 * 1000,
  /** 이 기준 이내는 `aging`. 기본 14d. 초과는 `stale`. */
  agingUpperBoundMs: 14 * 24 * 60 * 60 * 1000,
} as const;

export type EvaluateMemoryFreshnessInput = Readonly<{
  /** 참조 후보가 마지막으로 갱신/참조된 시각(ISO 또는 epoch ms). 알 수 없으면 null. */
  lastReferencedAt?: string | number | Date | null | undefined;
  /** 평가 기준 시각(주로 turn 발생 시각). 미제공이면 `Date.now()` 사용. */
  now?: number | Date | null | undefined;
  /**
   * 현재 turn의 방향성 키워드(예: `"microservice"`)와 메모리 요약(예: `"monolith"`)이 충돌하면
   * fresh라도 `stale`로 강등한다. **휴리스틱**이며 결정은 진단 표시용.
   */
  conflictDetected?: boolean;
}>;

export type EvaluateMemoryFreshnessResult = Readonly<{
  freshness: MemoryFreshness;
  /** UI/문서 표시용 사유(예: `"recent_within_24h"`, `"older_than_14d"`, `"conflict_demoted"`). */
  reason: string;
}>;

function toEpochMs(value: string | number | Date | null | undefined): number | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 단일 메모리 참조의 freshness를 평가한다.
 *
 * 규칙:
 * 1. `conflictDetected === true`: `stale` + `"conflict_demoted"`.
 * 2. `lastReferencedAt`이 알 수 없음: `aging` + `"unknown_timestamp"`(보수적 fallback; 사용자에게 사유 노출).
 * 3. age ≤ `freshUpperBoundMs`: `fresh`.
 * 4. age ≤ `agingUpperBoundMs`: `aging`.
 * 5. 그 외: `stale`.
 *
 * 미래 시각/음수 age는 `aging` + `"future_timestamp"`로 보수 처리(절대 fresh 처리하지 않음).
 */
export function evaluateMemoryFreshness(input: EvaluateMemoryFreshnessInput): EvaluateMemoryFreshnessResult {
  if (input.conflictDetected === true) {
    return { freshness: "stale", reason: "conflict_demoted" };
  }
  const lastMs = toEpochMs(input.lastReferencedAt);
  if (lastMs == null) {
    return { freshness: "aging", reason: "unknown_timestamp" };
  }
  const nowMs = toEpochMs(input.now) ?? Date.now();
  const ageMs = nowMs - lastMs;
  if (!Number.isFinite(ageMs)) {
    return { freshness: "aging", reason: "unknown_timestamp" };
  }
  if (ageMs < 0) {
    return { freshness: "aging", reason: "future_timestamp" };
  }
  if (ageMs <= MEMORY_FRESHNESS_THRESHOLDS_MS.freshUpperBoundMs) {
    return { freshness: "fresh", reason: "recent_within_24h" };
  }
  if (ageMs <= MEMORY_FRESHNESS_THRESHOLDS_MS.agingUpperBoundMs) {
    return { freshness: "aging", reason: "within_14d" };
  }
  return { freshness: "stale", reason: "older_than_14d" };
}
