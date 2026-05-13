/**
 * Overlay: **selection policy drift** 진단 헬퍼.
 *
 * conflict와 달리 사용자 입력 텍스트가 아닌 **assembly plan + budget metadata 자체의
 * 불일치**를 휴리스틱으로 감지한다.
 *
 * **WARNING ONLY.** 모든 결과는 `enforcement: "not_applied"`. prompt 본문·라우팅·실행
 * 어느 것도 변경하지 않는다.
 */

import type {
  OverlayAssemblyPlanItem,
  OverlayAssemblyPlanItemType,
} from "@/lib/overlay/overlayContextAssemblyPlan";
import type { OverlayContextBudgetMetadata } from "@/lib/overlay/overlayContextBudget";
import type {
  OverlayPolicyWarning,
  OverlayPolicyWarningSeverity,
} from "@/lib/overlay/overlayPolicyWarning";

const DRIFT_SOURCE: OverlayPolicyWarning["source"] = "diagnostic";

const COMPACT_TIMELINE_DRIFT_THRESHOLD = 1;

type PlanStats = Readonly<{
  total: number;
  byType: Readonly<Record<OverlayAssemblyPlanItemType, number>>;
  hasPruningCandidate: boolean;
}>;

type DriftContext = Readonly<{
  stats: PlanStats;
  budgetMetadata: OverlayContextBudgetMetadata | null;
}>;

type DriftRule = Readonly<{
  code: string;
  severity: OverlayPolicyWarningSeverity;
  test: (ctx: DriftContext) => boolean;
  message: (ctx: DriftContext) => string;
}>;

function makePlanStats(plan: readonly OverlayAssemblyPlanItem[]): PlanStats {
  const byType: Record<OverlayAssemblyPlanItemType, number> = {
    memory: 0,
    knowledge: 0,
    timeline: 0,
    workspace: 0,
    policy: 0,
  };
  let hasPruningCandidate = false;
  for (const item of plan) {
    byType[item.type]++;
    if (item.pruningCandidate) hasPruningCandidate = true;
  }
  return { total: plan.length, byType, hasPruningCandidate };
}

function makeDrift(rule: DriftRule, ctx: DriftContext): OverlayPolicyWarning {
  return {
    code: rule.code,
    severity: rule.severity,
    message: rule.message(ctx),
    source: DRIFT_SOURCE,
    enforcement: "not_applied",
  };
}

const DRIFT_RULES: readonly DriftRule[] = [
  {
    code: "OVERLAY_DRIFT_COMPACT_TIMELINE_OVERLOAD",
    severity: "warning",
    test: (c) =>
      c.budgetMetadata?.budgetPolicy === "compact" &&
      c.stats.byType.timeline > COMPACT_TIMELINE_DRIFT_THRESHOLD,
    message: (c) =>
      `compact policy인데 timeline 항목이 ${c.stats.byType.timeline}개로 과다합니다(권장 ≤ ${COMPACT_TIMELINE_DRIFT_THRESHOLD}).`,
  },
  {
    code: "OVERLAY_DRIFT_OVERFLOW_HIGH_WITHOUT_PRUNING",
    severity: "warning",
    test: (c) =>
      c.budgetMetadata?.overflowRisk === "high" &&
      c.stats.total > 0 &&
      !c.stats.hasPruningCandidate,
    message: () => "overflowRisk가 high인데 pruning candidate가 없습니다(plan 재검토 권장).",
  },
  {
    code: "OVERLAY_DRIFT_NO_MEMORY_SCOPE",
    severity: "info",
    test: (c) => c.stats.total > 0 && c.stats.byType.memory === 0,
    message: () => "assembly plan에 memory scope 항목이 없습니다(역할 기본 memory scope 누락 가능).",
  },
  {
    code: "OVERLAY_DRIFT_NO_KNOWLEDGE_SCOPE",
    severity: "info",
    test: (c) => c.stats.total > 0 && c.stats.byType.knowledge === 0,
    message: () =>
      "assembly plan에 knowledge scope 항목이 없습니다(planner 등 역할 기본 knowledge hint 누락 가능).",
  },
];

export function detectOverlayPolicyDrift(input: {
  assemblyPlan: readonly OverlayAssemblyPlanItem[];
  budgetMetadata?: OverlayContextBudgetMetadata | null;
}): readonly OverlayPolicyWarning[] {
  const ctx: DriftContext = {
    stats: makePlanStats(input.assemblyPlan),
    budgetMetadata: input.budgetMetadata ?? null,
  };
  const out: OverlayPolicyWarning[] = [];
  for (const rule of DRIFT_RULES) {
    if (rule.test(ctx)) out.push(makeDrift(rule, ctx));
  }
  return out;
}
