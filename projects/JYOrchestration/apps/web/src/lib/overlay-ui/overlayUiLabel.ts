/**
 * Overlay Observability UI — **내부 enum/code 값을 사용자 표현으로 변환**하는 read-only helper.
 *
 * - 모든 변환은 **순수 함수**이며, runtime payload·라우팅 어디에도 영향을 주지 않는다.
 * - UI에서만 사용. enforcement·orchestration 변경 없음.
 */

import type { OverlayContextBudgetOverflowRisk, OverlayContextBudgetPolicy } from "@/lib/overlay/overlayContextBudget";
import type {
  OverlayAssemblyIncludeMode,
  OverlayAssemblyPlanItemType,
} from "@/lib/overlay/overlayContextAssemblyPlan";
import type { OverlayPolicyWarningSeverity } from "@/lib/overlay/overlayPolicyWarning";

export type OverlayUiBadgeTone = "neutral" | "info" | "positive" | "warning" | "danger";

const BUDGET_POLICY_LABEL: Readonly<Record<OverlayContextBudgetPolicy, string>> = {
  compact: "압축 정책",
  balanced: "균형 정책",
  default: "기본 정책",
  extended: "확장 정책",
};

const OVERFLOW_RISK_LABEL: Readonly<Record<OverlayContextBudgetOverflowRisk, string>> = {
  low: "낮음",
  medium: "중간",
  high: "높음",
};

const OVERFLOW_RISK_TONE: Readonly<Record<OverlayContextBudgetOverflowRisk, OverlayUiBadgeTone>> = {
  low: "positive",
  medium: "info",
  high: "warning",
};

const INCLUDE_MODE_LABEL: Readonly<Record<OverlayAssemblyIncludeMode, string>> = {
  required: "핵심",
  recommended: "추천",
  optional: "선택",
  excludeCandidate: "축소 후보",
};

const INCLUDE_MODE_TONE: Readonly<Record<OverlayAssemblyIncludeMode, OverlayUiBadgeTone>> = {
  required: "info",
  recommended: "neutral",
  optional: "neutral",
  excludeCandidate: "warning",
};

const PLAN_TYPE_LABEL: Readonly<Record<OverlayAssemblyPlanItemType, string>> = {
  memory: "기억 컨텍스트",
  knowledge: "지식 컨텍스트",
  timeline: "대화 흐름",
  workspace: "워크스페이스",
  policy: "정책 힌트",
};

const SEVERITY_LABEL: Readonly<Record<OverlayPolicyWarningSeverity, string>> = {
  info: "정보",
  warning: "주의",
  critical: "심각",
};

const SEVERITY_TONE: Readonly<Record<OverlayPolicyWarningSeverity, OverlayUiBadgeTone>> = {
  info: "info",
  warning: "warning",
  critical: "danger",
};

export function overlayUiBudgetPolicyLabel(value: OverlayContextBudgetPolicy | null | undefined): string {
  if (!value) return "정책 미정";
  return BUDGET_POLICY_LABEL[value] ?? "기본 정책";
}

export function overlayUiOverflowRiskLabel(value: OverlayContextBudgetOverflowRisk | null | undefined): string {
  if (!value) return "ㅡ";
  return OVERFLOW_RISK_LABEL[value] ?? "LOW";
}

export function overlayUiOverflowRiskTone(value: OverlayContextBudgetOverflowRisk | null | undefined): OverlayUiBadgeTone {
  if (!value) return "neutral";
  return OVERFLOW_RISK_TONE[value] ?? "neutral";
}

export function overlayUiIncludeModeLabel(value: OverlayAssemblyIncludeMode | null | undefined): string {
  if (!value) return "선택";
  return INCLUDE_MODE_LABEL[value] ?? "선택";
}

export function overlayUiIncludeModeTone(value: OverlayAssemblyIncludeMode | null | undefined): OverlayUiBadgeTone {
  if (!value) return "neutral";
  return INCLUDE_MODE_TONE[value] ?? "neutral";
}

export function overlayUiPlanTypeLabel(value: OverlayAssemblyPlanItemType | null | undefined): string {
  if (!value) return "기타 컨텍스트";
  return PLAN_TYPE_LABEL[value] ?? "기타 컨텍스트";
}

export function overlayUiWarningSeverityLabel(value: OverlayPolicyWarningSeverity | null | undefined): string {
  if (!value) return "정보";
  return SEVERITY_LABEL[value] ?? "정보";
}

export function overlayUiWarningSeverityTone(value: OverlayPolicyWarningSeverity | null | undefined): OverlayUiBadgeTone {
  if (!value) return "info";
  return SEVERITY_TONE[value] ?? "info";
}

/** "축소 후보로 분류되었습니다"처럼 boolean에 대한 라벨링이 필요할 때 사용. */
export function overlayUiPruningCandidateLabel(value: boolean | null | undefined): string {
  return value ? "축소 후보" : "유지";
}
