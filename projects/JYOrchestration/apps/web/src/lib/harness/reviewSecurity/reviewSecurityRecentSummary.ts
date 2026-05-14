/**
 * Harness Phase H6 — **Recent Review/Security Summary**.
 *
 * 최근 N개의 promptTrace에서 추출한 `ReviewSecurityHarnessPlan` 묶음을 받아 누적/비율 기반 summary
 * 를 생성한다. H2 / H4.5 / H5.5와 같은 형태의 read-only 진단.
 *
 * **순수 함수 / 읽기 전용.** 실제 보안 스캔·코드 리뷰·이슈 등록·머지 차단 영향 없음.
 */

import type { ReviewSecurityHarnessPlan } from "./reviewSecurityHarnessTypes";

/** Recent review/security summary 결과 타입. */
export type RecentReviewSecuritySummary = Readonly<{
  /** 입력으로 받은 promptTrace 개수(=planEntryCount 후보 모집단). */
  sampledEntryCount: number;
  /** 유효한 plan(mode==="dry_run_review_security" + checklist 배열)을 가진 entry 수. */
  planEntryCount: number;
  /** 전체 checklist item 누계. */
  totalChecklistItems: number;
  /** security area item 비율(0–1, 정밀도 0.0001). */
  securityItemRate: number;
  /** code_quality area item 비율(0–1). */
  codeQualityItemRate: number;
  /** severity === "critical_candidate" item 비율(0–1). */
  criticalCandidateRate: number;
  /** finding이 1개 이상 있던 plan 비율(0–1). */
  findingRate: number;
}>;

/** Empty summary helper(replay/empty fallback). */
export function emptyRecentReviewSecuritySummary(): RecentReviewSecuritySummary {
  return {
    sampledEntryCount: 0,
    planEntryCount: 0,
    totalChecklistItems: 0,
    securityItemRate: 0,
    codeQualityItemRate: 0,
    criticalCandidateRate: 0,
    findingRate: 0,
  };
}

function roundRate(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return Math.round(value * 10_000) / 10_000;
}

function isValidPlan(
  plan: ReviewSecurityHarnessPlan | null | undefined
): plan is ReviewSecurityHarnessPlan {
  return Boolean(
    plan && plan.mode === "dry_run_review_security" && Array.isArray(plan.checklist)
  );
}

/**
 * 최근 N개의 `ReviewSecurityHarnessPlan`을 비율 기반 누적 summary로 환산.
 *
 * - 입력 plan은 호출자가 "최근 → 과거" 또는 "과거 → 최근" 순서로 자유롭게 넣어도 결과 동일.
 * - checklist가 0개인 plan은 분자만 0이고 모집단(=planEntryCount)에는 포함.
 * - `findingRate`: plan 단위. 다른 rate: item 단위.
 */
export function summarizeRecentReviewSecurityPlans(input: {
  readonly plans: readonly (ReviewSecurityHarnessPlan | null | undefined)[];
}): RecentReviewSecuritySummary {
  const plans = Array.isArray(input.plans) ? input.plans : [];
  if (!plans.length) return emptyRecentReviewSecuritySummary();

  const sampledEntryCount = plans.length;
  let planEntryCount = 0;
  let totalChecklistItems = 0;
  let securityItems = 0;
  let codeQualityItems = 0;
  let criticalCandidates = 0;
  let plansWithFindings = 0;

  for (const plan of plans) {
    if (!isValidPlan(plan)) continue;
    planEntryCount += 1;
    if (Array.isArray(plan.findings) && plan.findings.length > 0) plansWithFindings += 1;
    for (const item of plan.checklist) {
      if (!item) continue;
      totalChecklistItems += 1;
      if (item.area === "security") securityItems += 1;
      if (item.area === "code_quality") codeQualityItems += 1;
      if (item.severity === "critical_candidate") criticalCandidates += 1;
    }
  }

  const itemDen = totalChecklistItems > 0 ? totalChecklistItems : 0;
  const planDen = planEntryCount > 0 ? planEntryCount : 0;

  return {
    sampledEntryCount,
    planEntryCount,
    totalChecklistItems,
    securityItemRate: itemDen ? roundRate(securityItems / itemDen) : 0,
    codeQualityItemRate: itemDen ? roundRate(codeQualityItems / itemDen) : 0,
    criticalCandidateRate: itemDen ? roundRate(criticalCandidates / itemDen) : 0,
    findingRate: planDen ? roundRate(plansWithFindings / planDen) : 0,
  };
}
