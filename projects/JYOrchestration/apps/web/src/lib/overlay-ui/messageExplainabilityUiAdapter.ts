/**
 * Harness Phase H7 — Message-level explainability UI adapter.
 * Read-only labels / disclaimer / empty copy. No orchestration side effects.
 */

import type {
  MessageExplainabilityRiskLevel,
  MessageExplainabilitySectionType,
} from "@/lib/harness/explainability/messageExplainabilityTypes";
import type { MessageExplainabilityTraceConfidence } from "@/lib/harness/explainability/messageExplainabilityTraceResolution";
import type { OverlayUiBadgeTone } from "@/lib/overlay-ui/overlayUiLabel";

export const MESSAGE_EXPLAINABILITY_EMPTY_COPY =
  "이 메시지에는 AI 판단 정보가 기록되지 않았습니다.";

export const MESSAGE_EXPLAINABILITY_DISCLAIMER =
  "아래 내용은 실제 실행·차단·이슈 등록이 아니라, 이번 응답을 준비할 때 참고한 계획 정보를 요약한 것입니다.";

const SECTION_TITLE: Readonly<Record<MessageExplainabilitySectionType, string>> = {
  role: "AI 역할",
  context: "참조 맥락",
  knowledge: "지식팩",
  memory: "기억 후보",
  execution: "실행 capability",
  review_security: "검토/보안",
  issue_planning: "이슈 후보",
  budget: "맥락 예산",
  warnings: "경고",
};

const RISK_LABEL: Readonly<Record<MessageExplainabilityRiskLevel, string>> = {
  none: "정상",
  low: "참고",
  medium: "주의",
  high: "위험 신호",
};

const RISK_TONE: Readonly<Record<MessageExplainabilityRiskLevel, OverlayUiBadgeTone>> = {
  none: "positive",
  low: "info",
  medium: "warning",
  high: "danger",
};

export function messageExplainabilitySectionTitle(type: MessageExplainabilitySectionType): string {
  return SECTION_TITLE[type];
}

export function messageExplainabilityRiskLabel(level: MessageExplainabilityRiskLevel): string {
  return RISK_LABEL[level];
}

export function messageExplainabilityRiskTone(level: MessageExplainabilityRiskLevel): OverlayUiBadgeTone {
  return RISK_TONE[level];
}

/** H8.5 — confidence enum을 사용자에게 보여줄 짧은 문구로만 변환(내부 키 비노출). */
export function messageExplainabilityConfidenceUserLabel(
  confidence: MessageExplainabilityTraceConfidence
): string {
  switch (confidence) {
    case "direct":
      return "저장된 AI 판단 메타와 직접 연결됨";
    case "response_text":
      return "관련 AI 판단 근거 연결됨";
    case "role_time":
      return "역할·시간 기준으로 연결됨";
    case "none":
      return "";
  }
}
