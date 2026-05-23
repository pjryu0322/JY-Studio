/**
 * Project SingleChat service-flow analyze 전용 advice response policy.
 *
 * 적용: requirements workspace / service-flow workshop
 * 비적용: Pre-Project messenger room, 프로젝트 생성 전 브레인스토밍
 */

import {
  isProjectSingleChatScope,
  type ConversationExecutionScope,
} from "@/lib/conversation/conversationScopeBoundary";
import {
  isStrongExecutionAction,
} from "@/lib/requirements/requirementsStrongActionPolicy";
import type { GuardResult } from "@/lib/requirements/requirementsActionGuard";
import {
  normalizeExecutionIntent,
  type ExecutionIntent,
  type IntentRoutingResult,
  type IntentType,
} from "@/lib/requirements/requirementsIntentRouterTypes";
import type { QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";

export type ServiceFlowResponseMode = "flow_update" | "advice";

export type ServiceFlowResponsePolicy = Readonly<{
  readonly mode: ServiceFlowResponseMode;
  readonly strongActionGuarded?: boolean;
  readonly blockedActionId?: QuickActionId | null;
  readonly downgradedTo?: QuickActionId | null;
  readonly instruction?: string;
}>;

export const SERVICE_FLOW_ADVICE_INSTRUCTION =
  "사용자의 요청은 플랫폼 실행 액션보다 기획 조언·절차 제안에 가깝다. updatedFlow 변경을 우선하지 말고, 사용자가 바로 이해할 수 있는 단계별 제안 텍스트를 충분히 작성한다. 대안 비교 Viewer를 열거나 대안 생성 문구로 답하지 않는다. 필요하면 마지막에 「이 절차를 서비스 흐름에 반영할까요?」 정도의 후속 질문만 제공한다." as const;

const ADVICE_MODE_MIN_ASSISTANT_LENGTH = 160;

/** Advice mode + internal DIRECT_INPUT downgrade — quickAction 라벨을 LLM에 넘기지 않는다. */
export function shouldOmitQuickActionForAdviceAnalyze(input: {
  readonly serviceFlowResponseMode?: ServiceFlowResponseMode | null;
  readonly effectiveActionId: QuickActionId;
}): boolean {
  return input.serviceFlowResponseMode === "advice" && input.effectiveActionId === "DIRECT_INPUT";
}

export function isServiceFlowAdviceMode(responsePolicy: unknown): boolean {
  if (!responsePolicy || typeof responsePolicy !== "object") return false;
  return (responsePolicy as { mode?: string }).mode === "advice";
}

export function mergeServiceFlowResponsePolicy(a: unknown, b: unknown): unknown {
  if (a && typeof a === "object" && b && typeof b === "object") {
    return { ...(a as Record<string, unknown>), ...(b as Record<string, unknown>) };
  }
  return b ?? a ?? undefined;
}

export function shouldUseServiceFlowAdviceMode(input: {
  readonly directQuickActionId?: QuickActionId | null;
  readonly effectiveActionId?: QuickActionId | null;
  readonly executionIntent?: ExecutionIntent | string | null;
  readonly intentType?: IntentType | string | null;
  readonly strongActionGuarded?: boolean;
}): boolean {
  if (input.directQuickActionId) return false;
  if (input.strongActionGuarded) return true;
  if (input.effectiveActionId && input.effectiveActionId !== "DIRECT_INPUT") return false;
  const executionIntent = normalizeExecutionIntent(input.executionIntent);
  if (executionIntent === "ask_advice" || executionIntent === "ask_explain") return true;
  if (executionIntent === "ambiguous") return true;
  if (input.intentType === "question") return true;
  return false;
}

export function buildServiceFlowResponsePolicyFromDispatch(input: {
  readonly intent: IntentRoutingResult;
  readonly guard: GuardResult;
  readonly effectiveActionId: QuickActionId | null;
  readonly directQuickActionId?: QuickActionId | null;
  readonly executionScope?: ConversationExecutionScope;
}): ServiceFlowResponsePolicy {
  if (input.executionScope && !isProjectSingleChatScope(input.executionScope)) {
    return { mode: "flow_update" };
  }

  const suggested = input.intent.suggestedActionId;
  const strongActionGuarded = Boolean(
    suggested &&
      isStrongExecutionAction(suggested) &&
      input.guard.warning &&
      input.effectiveActionId === "DIRECT_INPUT",
  );

  const useAdvice = shouldUseServiceFlowAdviceMode({
    directQuickActionId: input.directQuickActionId,
    effectiveActionId: input.effectiveActionId,
    executionIntent: input.intent.executionIntent,
    intentType: input.intent.intentType,
    strongActionGuarded,
  });

  if (!useAdvice) {
    return { mode: "flow_update" };
  }

  return {
    mode: "advice",
    strongActionGuarded,
    blockedActionId: strongActionGuarded ? suggested : null,
    downgradedTo: input.effectiveActionId,
    instruction: SERVICE_FLOW_ADVICE_INSTRUCTION,
  };
}

/** Advice mode prompt — alternative payload는 state에 남기되 주입만 축소 */
export function flowForServiceFlowAnalyzePrompt(
  flow: RequirementsServiceFlowV1 | null,
  responsePolicy: unknown,
): RequirementsServiceFlowV1 | null {
  if (!flow || !isServiceFlowAdviceMode(responsePolicy)) return flow;
  const { alternativeProposalPayload: _omit, ...rest } = flow;
  return { ...rest, alternativeProposalPayload: null };
}

export function isWeakAdviceAssistantMessage(text: string): boolean {
  const t = String(text ?? "").trim();
  if (t.length < ADVICE_MODE_MIN_ASSISTANT_LENGTH) return true;
  if (/^[^.\n]{0,80}(제안합니다|제안드립니다)\.\s*$/u.test(t)) return true;
  return false;
}

export function mergeServiceFlowAdviceUserFacingMessage(
  assistantMessage: string,
  nextQuestion: string | null | undefined,
): string {
  const assistant = String(assistantMessage ?? "").trim();
  const nextQ = String(nextQuestion ?? "").trim();
  if (!nextQ) return assistant;
  if (/반영할까|흐름에\s*반영|절차를\s*흐름/.test(nextQ)) {
    return `${assistant}\n\n${/^다음\s*[:：]/i.test(nextQ) ? nextQ : `다음: ${nextQ}`}`;
  }
  if (/이\s*초안을\s*기준|선택·수정해\s*주/.test(nextQ)) return assistant;
  return assistant;
}

export function buildServiceFlowAdviceRegenerationUserPayload(input: {
  readonly issues: readonly string[];
  readonly rejectedAssistantPreview: string;
}): string {
  return `[service-flow advice mode 재생성]
직전 응답이 기획 조언 품질 기준에 맞지 않습니다.

거부 사유:
${input.issues.map((c) => `- ${c}`).join("\n") || "- advice_message_too_short"}

거부된 assistantMessage 미리보기:
${input.rejectedAssistantPreview.slice(0, 600) || "(없음)"}

다시 출력할 때 반드시:
- assistantMessage는 ${ADVICE_MODE_MIN_ASSISTANT_LENGTH}자 이상, 단계별 절차·항목을 구체적으로 제시
- "제안합니다" 선언만 하고 끝내지 말 것
- numbered list 또는 불릿으로 검수·승인·운영 절차를 상세히 작성
- updatedFlow는 현재 flow를 유지하거나 최소 변경
- nextQuestion은 null이거나 "이 절차를 서비스 흐름에 반영할까요?" 수준 1문장만
- 대안 비교·Viewer·ALTERNATIVE 문구 금지
- JSON 스키마만 출력`;
}

export function buildServiceFlowAdviceSystemPromptBlock(): string {
  return `[Advice Response Mode]
- 사용자는 서비스 흐름 갱신보다 기획 조언·절차 제안을 요청했다.
- updatedFlow 변경은 필수가 아니다. currentFlow를 유지해도 된다.
- assistantMessage는 충분한 본문(최소 ${ADVICE_MODE_MIN_ASSISTANT_LENGTH}자 권장)을 포함한다.
- 사용자가 요청한 절차·검토·승인·운영 방식을 단계별로 제안한다.
- "제안합니다"라고 선언만 하지 말고 실제 절차·확인 항목을 제시한다.
- 대안 비교 Viewer·기존안 vs 후보안·ALTERNATIVE 생성 문구를 쓰지 않는다.
- 마지막에는 필요할 경우 "이 절차를 서비스 흐름에 반영할까요?" 정도만 묻는다.
- 현재 flow에 alternativeProposalPayload가 있어도 이번 턴은 대안 비교가 아니라 기획 조언이다.`;
}
