/**
 * Harness Phase H4.5 — **Recent Memory Runtime Summary**.
 *
 * 최근 N개의 promptTrace에서 추출한 `MemoryRuntimePlan` 묶음을 받아 누적/비율 기반 summary를
 * 생성한다. H2 Apply-readiness와 같은 형태로 "여러 turn 누적 진단"을 위한 read-only 입력이다.
 *
 * **순수 함수 / 읽기 전용.** 실제 prompt payload·retrieval·persistence에 영향 없음.
 */

import type { MemoryRuntimePlan } from "./memoryRuntimeTypes";

/** Recent summary 결과 타입. */
export type RecentMemoryRuntimeSummary = Readonly<{
  /** 입력으로 받은 promptTrace 개수(=planEntryCount 후보 모집단). */
  sampledEntryCount: number;
  /** 유효한 plan(mode==="dry_run" + references 배열)을 가진 entry 수. */
  planEntryCount: number;
  /** 전체 reference 누계. */
  totalReferences: number;
  /** stale reference 비율(0–1, 정밀도 0.0001). */
  staleReferenceRate: number;
  /** aging reference 비율(0–1). */
  agingReferenceRate: number;
  /** fresh reference 비율(0–1). */
  freshReferenceRate: number;
  /** role scope 비율(0–1). */
  roleScopedRate: number;
  /** project scope 비율(0–1). */
  projectScopedRate: number;
  /** working scope 비율(0–1). */
  workingScopedRate: number;
  /** finding이 1개 이상 있던 plan 비율(0–1). */
  findingRate: number;
}>;

/** Empty summary helper(replay/empty fallback). */
export function emptyRecentMemoryRuntimeSummary(): RecentMemoryRuntimeSummary {
  return {
    sampledEntryCount: 0,
    planEntryCount: 0,
    totalReferences: 0,
    staleReferenceRate: 0,
    agingReferenceRate: 0,
    freshReferenceRate: 0,
    roleScopedRate: 0,
    projectScopedRate: 0,
    workingScopedRate: 0,
    findingRate: 0,
  };
}

function roundRate(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return Math.round(value * 10_000) / 10_000;
}

function isValidPlan(plan: MemoryRuntimePlan | null | undefined): plan is MemoryRuntimePlan {
  return Boolean(plan && plan.mode === "dry_run" && Array.isArray(plan.references));
}

/**
 * 최근 N개의 `MemoryRuntimePlan`을 비율 기반 누적 summary로 환산.
 *
 * - 입력 plan은 호출자가 "최근 → 과거" 또는 "과거 → 최근" 순서로 자유롭게 넣어도 결과 동일.
 * - reference가 0개인 plan은 분자만 0이고 모집단(=planEntryCount)에는 포함.
 * - `findingRate`: plan 단위(plan 중 findings.length>0 비율).
 * - 다른 rate: reference 단위(전체 reference 중 해당 부류 비율).
 */
export function summarizeRecentMemoryRuntimePlans(input: {
  readonly plans: readonly (MemoryRuntimePlan | null | undefined)[];
}): RecentMemoryRuntimeSummary {
  const plans = Array.isArray(input.plans) ? input.plans : [];
  if (!plans.length) return emptyRecentMemoryRuntimeSummary();

  const sampledEntryCount = plans.length;
  let planEntryCount = 0;
  let totalReferences = 0;
  let fresh = 0;
  let aging = 0;
  let stale = 0;
  let roleScoped = 0;
  let projectScoped = 0;
  let workingScoped = 0;
  let plansWithFindings = 0;

  for (const plan of plans) {
    if (!isValidPlan(plan)) continue;
    planEntryCount += 1;
    if (Array.isArray(plan.findings) && plan.findings.length > 0) plansWithFindings += 1;
    for (const ref of plan.references) {
      if (!ref) continue;
      totalReferences += 1;
      if (ref.freshness === "fresh") fresh += 1;
      else if (ref.freshness === "aging") aging += 1;
      else if (ref.freshness === "stale") stale += 1;
      if (ref.scope === "role") roleScoped += 1;
      else if (ref.scope === "project") projectScoped += 1;
      else if (ref.scope === "working") workingScoped += 1;
    }
  }

  const refDen = totalReferences > 0 ? totalReferences : 0;
  const planDen = planEntryCount > 0 ? planEntryCount : 0;

  return {
    sampledEntryCount,
    planEntryCount,
    totalReferences,
    staleReferenceRate: refDen ? roundRate(stale / refDen) : 0,
    agingReferenceRate: refDen ? roundRate(aging / refDen) : 0,
    freshReferenceRate: refDen ? roundRate(fresh / refDen) : 0,
    roleScopedRate: refDen ? roundRate(roleScoped / refDen) : 0,
    projectScopedRate: refDen ? roundRate(projectScoped / refDen) : 0,
    workingScopedRate: refDen ? roundRate(workingScoped / refDen) : 0,
    findingRate: planDen ? roundRate(plansWithFindings / planDen) : 0,
  };
}
