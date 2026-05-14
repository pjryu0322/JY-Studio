/**
 * Harness Phase H5.5 — **Recent Execution Routing Summary**.
 *
 * 최근 N개의 promptTrace에서 추출한 `ExecutionRoutingPlan` 묶음을 받아 누적/비율 기반 summary를
 * 생성한다. H2 Apply-readiness / H4.5 Recent Memory Runtime과 같은 형태의 read-only 진단.
 *
 * **순수 함수 / 읽기 전용.** 실제 provider switching·execution routing에 영향 없음.
 */

import type { ExecutionRoutingPlan } from "./executionCapabilityTypes";

/** Recent execution routing summary 결과 타입. */
export type RecentExecutionRoutingSummary = Readonly<{
  /** 입력으로 받은 promptTrace 개수(=planEntryCount 후보 모집단). */
  sampledEntryCount: number;
  /** 유효한 plan(mode==="dry_run" + items 배열)을 가진 entry 수. */
  planEntryCount: number;
  /** 전체 item 누계. */
  totalItems: number;
  /** disabled item 비율(0–1, 정밀도 0.0001). */
  disabledItemRate: number;
  /** warning이 있는 item 비율(0–1). */
  warningItemRate: number;
  /** provider==="unknown" item 비율(0–1). */
  unknownProviderRate: number;
  /** capability가 cursor 계열(code_generation/cursor_execution)인 item 비율(0–1). */
  cursorCapabilityRate: number;
  /** capability가 github_operation인 item 비율(0–1). */
  githubCapabilityRate: number;
  /** finding이 1개 이상 있던 plan 비율(0–1). */
  findingRate: number;
}>;

/** Empty summary helper(replay/empty fallback). */
export function emptyRecentExecutionRoutingSummary(): RecentExecutionRoutingSummary {
  return {
    sampledEntryCount: 0,
    planEntryCount: 0,
    totalItems: 0,
    disabledItemRate: 0,
    warningItemRate: 0,
    unknownProviderRate: 0,
    cursorCapabilityRate: 0,
    githubCapabilityRate: 0,
    findingRate: 0,
  };
}

function roundRate(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return Math.round(value * 10_000) / 10_000;
}

function isValidPlan(plan: ExecutionRoutingPlan | null | undefined): plan is ExecutionRoutingPlan {
  return Boolean(plan && plan.mode === "dry_run" && Array.isArray(plan.items));
}

/**
 * 최근 N개의 `ExecutionRoutingPlan`을 비율 기반 누적 summary로 환산.
 *
 * - 입력 plan은 호출자가 "최근 → 과거" 또는 "과거 → 최근" 순서로 자유롭게 넣어도 결과 동일.
 * - items가 0개인 plan은 분자만 0이고 모집단(=planEntryCount)에는 포함.
 * - `findingRate`: plan 단위(plan 중 findings.length>0 비율).
 * - 다른 rate: item 단위(전체 item 중 해당 부류 비율).
 */
export function summarizeRecentExecutionRoutingPlans(input: {
  readonly plans: readonly (ExecutionRoutingPlan | null | undefined)[];
}): RecentExecutionRoutingSummary {
  const plans = Array.isArray(input.plans) ? input.plans : [];
  if (!plans.length) return emptyRecentExecutionRoutingSummary();

  const sampledEntryCount = plans.length;
  let planEntryCount = 0;
  let totalItems = 0;
  let disabledItems = 0;
  let warningItems = 0;
  let unknownProviderItems = 0;
  let cursorCapabilityItems = 0;
  let githubCapabilityItems = 0;
  let plansWithFindings = 0;

  for (const plan of plans) {
    if (!isValidPlan(plan)) continue;
    planEntryCount += 1;
    if (Array.isArray(plan.findings) && plan.findings.length > 0) plansWithFindings += 1;
    for (const item of plan.items) {
      if (!item) continue;
      totalItems += 1;
      if (!item.enabled) disabledItems += 1;
      if (typeof item.warning === "string" && item.warning.length > 0) warningItems += 1;
      if (item.provider === "unknown") unknownProviderItems += 1;
      if (item.capability === "code_generation" || item.capability === "cursor_execution") {
        cursorCapabilityItems += 1;
      }
      if (item.capability === "github_operation") githubCapabilityItems += 1;
    }
  }

  const itemDen = totalItems > 0 ? totalItems : 0;
  const planDen = planEntryCount > 0 ? planEntryCount : 0;

  return {
    sampledEntryCount,
    planEntryCount,
    totalItems,
    disabledItemRate: itemDen ? roundRate(disabledItems / itemDen) : 0,
    warningItemRate: itemDen ? roundRate(warningItems / itemDen) : 0,
    unknownProviderRate: itemDen ? roundRate(unknownProviderItems / itemDen) : 0,
    cursorCapabilityRate: itemDen ? roundRate(cursorCapabilityItems / itemDen) : 0,
    githubCapabilityRate: itemDen ? roundRate(githubCapabilityItems / itemDen) : 0,
    findingRate: planDen ? roundRate(plansWithFindings / planDen) : 0,
  };
}
