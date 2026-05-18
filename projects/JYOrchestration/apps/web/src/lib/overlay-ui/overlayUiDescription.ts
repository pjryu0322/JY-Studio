/**
 * Overlay Observability UI — 사용자 표현용 **본문 문장** helper.
 *
 * 내부 enum/code 값을 그대로 노출하지 않고, 1~2 문장 단위의 사용자 친화적 설명으로 변환한다.
 * 모든 결과는 read-only string이며 prompt/payload에 영향 없음.
 */

import type { OverlayContextBudgetOverflowRisk } from "@/lib/overlay/overlayContextBudget";
import type {
  OverlayAssemblyIncludeMode,
  OverlayAssemblyPlanItemType,
} from "@/lib/overlay/overlayContextAssemblyPlan";

const OVERFLOW_RISK_DESCRIPTION: Readonly<Record<OverlayContextBudgetOverflowRisk, string>> = {
  low: "현재 대화 맥락의 길이는 안정 범위입니다.",
  medium: "대화 맥락이 길어지고 있어 일부 정보가 요약될 가능성이 있습니다.",
  high: "대화 맥락이 많아 일부 오래된 정보가 축약될 가능성이 있습니다.",
};

const INCLUDE_MODE_DESCRIPTION: Readonly<Record<OverlayAssemblyIncludeMode, string>> = {
  required: "핵심 맥락으로 우선 참조됩니다.",
  recommended: "추천 맥락으로 함께 참조됩니다.",
  optional: "선택 맥락으로 여유가 있을 때 참조됩니다.",
  excludeCandidate: "맥락이 많아질 경우 우선 축소할 수 있는 후보입니다(실제 제거 아님).",
};

const PLAN_TYPE_DESCRIPTION: Readonly<Record<OverlayAssemblyPlanItemType, string>> = {
  memory: "프로젝트·역할에 저장된 기억을 참조합니다.",
  knowledge: "AI 역할에 연결된 지식팩을 참조합니다.",
  timeline: "최근 대화 흐름을 참조합니다.",
  workspace: "현재 작업 화면 컨텍스트를 참조합니다.",
  policy: "역할별 정책 힌트를 참조합니다.",
};

export function overlayUiOverflowRiskDescription(
  value: OverlayContextBudgetOverflowRisk | null | undefined
): string {
  if (!value) return "토큰 예산 정보가 기록되지 않았습니다.";
  return OVERFLOW_RISK_DESCRIPTION[value] ?? OVERFLOW_RISK_DESCRIPTION.low;
}

export function overlayUiIncludeModeDescription(
  value: OverlayAssemblyIncludeMode | null | undefined
): string {
  if (!value) return "분류되지 않은 항목입니다.";
  return INCLUDE_MODE_DESCRIPTION[value] ?? INCLUDE_MODE_DESCRIPTION.optional;
}

export function overlayUiPlanTypeDescription(
  value: OverlayAssemblyPlanItemType | null | undefined
): string {
  if (!value) return "분류되지 않은 컨텍스트입니다.";
  return PLAN_TYPE_DESCRIPTION[value] ?? PLAN_TYPE_DESCRIPTION.policy;
}

export function overlayUiConflictWarningDescription(count: number): string {
  if (count <= 0) return "감지된 설계 방향 충돌이 없습니다.";
  return `설계 방향 간 일부 충돌 가능성이 ${count}건 감지되었습니다(차단 아님, 참고용).`;
}

export function overlayUiPolicyDriftDescription(count: number): string {
  if (count <= 0) return "정책 정렬 이슈가 감지되지 않았습니다.";
  return `정책 정렬과 다른 부분이 ${count}건 감지되었습니다(차단 아님, 참고용).`;
}

export function overlayUiPruningSuggestionDescription(count: number): string {
  if (count <= 0) return "축소 후보로 분류된 항목이 없습니다.";
  return `축소 후보로 분류된 항목이 ${count}건 있습니다. 실제 제거는 수행되지 않습니다.`;
}

/** Planning metadata임을 사용자에게 명시하는 공통 안내문. UI 상단에 항상 노출 권장. */
export const OVERLAY_UI_PLANNING_DISCLAIMER =
  "이 정보는 실제 프롬프트 포함 결과가 아니라, AI가 참고 후보로 분류한 계획 정보입니다.";

/** 토큰 추정이 heuristic임을 사용자에게 명시. */
export const OVERLAY_UI_BUDGET_DISCLAIMER =
  "표시되는 토큰 수치는 휴리스틱 추정값이며 실제 모델 측정값이 아닙니다.";

/** Warning이 차단되지 않음을 사용자에게 명시. */
export const OVERLAY_UI_WARNING_DISCLAIMER =
  "표시되는 경고는 참고용이며 대화/실행을 차단하지 않습니다.";

/** Empty state — overlay metadata가 없는 과거 timeline. */
export const OVERLAY_UI_EMPTY_STATE_MESSAGE =
  "이 시점에는 Overlay Runtime 정보가 기록되지 않았습니다.";

/**
 * Empty state 보조 안내. 정상 상태임을 함께 설명해 "에러"로 오해되지 않게 한다.
 */
export const OVERLAY_UI_EMPTY_STATE_HINT =
  "최근 AI 응답부터 역할, 맥락, 경고, 예산 정보가 기록됩니다.";
