/**
 * H9 — context budget **권장 힌트**(read-only). 실제 budget metadata나 프롬프트를 바꾸지 않음.
 */

import type { OverlayContextBudgetMetadata, OverlayContextBudgetPolicy } from "@/lib/overlay/overlayContextBudget";
import type { ContextBudgetRecommendation, ResourcePressureSummary } from "./resourceOrchestrationTypes";

function pickRecommended(
  current: OverlayContextBudgetPolicy | null,
  pressure: ResourcePressureSummary
): OverlayContextBudgetPolicy {
  if (pressure.level === "high") return "compact";
  if (pressure.level === "medium") return "balanced";
  if (current === "extended") return "balanced";
  if (current === "compact") return "default";
  return current ?? "default";
}

export function recommendContextBudgetPolicy(input: {
  readonly budget: OverlayContextBudgetMetadata | null | undefined;
  readonly pressure: ResourcePressureSummary;
}): ContextBudgetRecommendation {
  const currentPolicy = input.budget?.budgetPolicy ?? null;
  const recommended = pickRecommended(currentPolicy, input.pressure);
  const aligned = currentPolicy !== null && currentPolicy === recommended;

  let rationale: string;
  if (!input.budget) {
    rationale =
      "저장된 토큰 예산 메타가 없어 압력 요약만으로 권장 정책을 제시합니다. 타임라인에 budget이 기록되면 현재 정책과의 정렬 여부를 함께 볼 수 있습니다.";
  } else if (input.pressure.level === "high") {
    rationale = "압력이 높게 잡혀 입력 측면을 줄이는 compact 권장(자동 적용 아님).";
  } else if (input.pressure.level === "medium") {
    rationale = "압력이 중간 — balanced 쪽으로 완충하는 편이 관측상 무난합니다.";
  } else {
    rationale = "압력이 낮음 — 과도한 extended 유지는 비용 대비 이득이 적을 수 있어 기본·balanced를 권장할 수 있습니다.";
  }

  return {
    currentPolicy,
    recommendedPolicy: recommended,
    aligned,
    rationale,
  };
}
