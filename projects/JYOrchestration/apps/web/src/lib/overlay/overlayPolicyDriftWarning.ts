/**
 * Overlay: **selection policy drift** 진단 헬퍼.
 *
 * conflict와 달리 사용자 입력 텍스트가 아닌 **assembly plan + budget metadata 자체의
 * 불일치**를 휴리스틱으로 감지한다.
 *
 * **WARNING ONLY.** 모든 결과는 `enforcement: "not_applied"`. prompt 본문·라우팅·실행
 * 어느 것도 변경하지 않는다.
 */

import type { OverlayAssemblyPlanItem } from "@/lib/overlay/overlayContextAssemblyPlan";
import type { OverlayContextBudgetMetadata } from "@/lib/overlay/overlayContextBudget";
import type { OverlayPolicyWarning } from "@/lib/overlay/overlayPolicyWarning";

const DRIFT_SOURCE = "diagnostic" as const;

const COMPACT_TIMELINE_DRIFT_THRESHOLD = 1;

function drift(code: string, severity: "info" | "warning", message: string): OverlayPolicyWarning {
  return {
    code,
    severity,
    message,
    source: DRIFT_SOURCE,
    enforcement: "not_applied",
  };
}

export function detectOverlayPolicyDrift(input: {
  assemblyPlan: readonly OverlayAssemblyPlanItem[];
  budgetMetadata?: OverlayContextBudgetMetadata | null;
}): readonly OverlayPolicyWarning[] {
  const out: OverlayPolicyWarning[] = [];
  const plan = input.assemblyPlan;
  const policy = input.budgetMetadata?.budgetPolicy ?? null;
  const overflow = input.budgetMetadata?.overflowRisk ?? null;

  const timelineCount = plan.filter((i) => i.type === "timeline").length;
  const memoryCount = plan.filter((i) => i.type === "memory").length;
  const knowledgeCount = plan.filter((i) => i.type === "knowledge").length;
  const hasPruningCandidate = plan.some((i) => i.pruningCandidate);

  if (policy === "compact" && timelineCount > COMPACT_TIMELINE_DRIFT_THRESHOLD) {
    out.push(
      drift(
        "OVERLAY_DRIFT_COMPACT_TIMELINE_OVERLOAD",
        "warning",
        `compact policy인데 timeline 항목이 ${timelineCount}개로 과다합니다(권장 ≤ ${COMPACT_TIMELINE_DRIFT_THRESHOLD}).`
      )
    );
  }

  if (overflow === "high" && plan.length > 0 && !hasPruningCandidate) {
    out.push(
      drift(
        "OVERLAY_DRIFT_OVERFLOW_HIGH_WITHOUT_PRUNING",
        "warning",
        "overflowRisk가 high인데 pruning candidate가 없습니다(plan 재검토 권장)."
      )
    );
  }

  if (plan.length > 0 && memoryCount === 0) {
    out.push(
      drift(
        "OVERLAY_DRIFT_NO_MEMORY_SCOPE",
        "info",
        "assembly plan에 memory scope 항목이 없습니다(역할 기본 memory scope 누락 가능)."
      )
    );
  }

  if (plan.length > 0 && knowledgeCount === 0) {
    out.push(
      drift(
        "OVERLAY_DRIFT_NO_KNOWLEDGE_SCOPE",
        "info",
        "assembly plan에 knowledge scope 항목이 없습니다(planner 등 역할 기본 knowledge hint 누락 가능)."
      )
    );
  }

  return out;
}
