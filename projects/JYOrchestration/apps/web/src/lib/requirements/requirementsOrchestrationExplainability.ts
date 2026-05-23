/**
 * Human-readable orchestration explainability for timeline & user-facing copy.
 */

import type { GuardResult } from "@/lib/requirements/requirementsActionGuard";
import {
  normalizeExecutionIntent,
  type IntentRoutingResult,
} from "@/lib/requirements/requirementsIntentRouterTypes";

export type OrchestrationHumanExplainability = Readonly<{
  readonly humanReadableReason?: string;
  readonly humanReadableGuardReason?: string;
  readonly humanReadableFallbackReason?: string;
}>;

export function buildOrchestrationHumanExplainability(input: {
  readonly intent: IntentRoutingResult;
  readonly guard: GuardResult;
}): OrchestrationHumanExplainability {
  const mode = input.intent.routerMode;
  const action = input.intent.suggestedActionId;
  const executionIntent = normalizeExecutionIntent(input.intent.executionIntent);

  let humanReadableReason: string | undefined;
  if (mode === "clarification_resolution") {
    humanReadableReason = "이전에 물어본 확인 질문에 대한 답으로 요청을 이해했습니다.";
  } else if (mode === "cache") {
    humanReadableReason = "같은 맥락의 최근 요청과 동일하게 처리했습니다.";
  } else if (mode === "direct") {
    humanReadableReason = "선택한 빠른 작업 버튼을 그대로 실행합니다.";
  } else if (input.intent.explainability?.focusReason) {
    humanReadableReason = "현재 선택된 작업 대상(포커스)을 기준으로 요청을 해석했습니다.";
  } else if (executionIntent === "ask_advice") {
    humanReadableReason = "기획·절차 제안 요청으로 이해했습니다.";
  } else if (executionIntent === "ask_explain") {
    humanReadableReason = "현재 기획·흐름에 대한 설명 요청으로 이해했습니다.";
  } else if (input.intent.intentType === "question") {
    humanReadableReason = "질문·상담 요청으로 이해했습니다.";
  } else if (action) {
    humanReadableReason = `대화 내용을 분석해 「${action}」 작업을 제안합니다.`;
  } else if (input.intent.clarificationQuestion) {
    humanReadableReason = "요청이 모호해 추가 확인이 필요합니다.";
  } else {
    humanReadableReason = "요청을 자동 분류했습니다.";
  }

  let humanReadableGuardReason: string | undefined;
  if (input.guard.allowed) {
    humanReadableGuardReason = "현재 단계에서 허용된 작업입니다.";
  } else if (input.guard.reason) {
    humanReadableGuardReason = input.guard.reason;
  } else {
    humanReadableGuardReason = "현재 단계에서는 이 작업을 실행할 수 없습니다.";
  }

  const humanReadableFallbackReason = input.intent.explainability?.fallbackReason
    ? `AI 분류를 사용하지 못해 규칙 기반으로 대체했습니다. (${input.intent.explainability.fallbackReason})`
    : undefined;

  return { humanReadableReason, humanReadableGuardReason, humanReadableFallbackReason };
}
