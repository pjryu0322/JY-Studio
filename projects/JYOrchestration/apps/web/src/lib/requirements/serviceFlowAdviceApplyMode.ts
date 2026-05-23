/**
 * Project SingleChat — advice 응답 직후 APPLY/생성 요청을 실제 service-flow 초안 생성으로 연결.
 */

import {
  isProjectSingleChatScope,
  type ConversationExecutionScope,
} from "@/lib/conversation/conversationScopeBoundary";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import type { QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";
import type { ServiceFlowProposalDecision } from "@/lib/requirements/serviceFlowProposalDecision";
import type { ServiceFlowResponsePolicy } from "@/lib/requirements/serviceFlowAdviceMode";

export const SERVICE_FLOW_ADVICE_TO_FLOW_APPLY_INSTRUCTION =
  "직전 advice 응답을 실제 service-flow 초안으로 변환한다. updatedFlow.steps를 반드시 생성하고, assistantMessage에는 예상 액터와 예상 흐름을 구조화해서 제시한다." as const;

export const ADVICE_TO_FLOW_QUALITY_USER_MESSAGE =
  "서비스 흐름 초안을 생성하지 못했습니다. 직전 절차를 기준으로 액터와 단계가 포함된 초안을 다시 요청해 주세요." as const;

export const ADVICE_TO_FLOW_QUALITY_FAILURE_CODE = "ADVICE_TO_FLOW_QUALITY" as const;

export type ServiceFlowRegenerationTracePrefix =
  | "service_flow_advice"
  | "service_flow_advice_to_flow"
  | "service_flow_proposal";

export function serviceFlowRegenerationTracePrefix(input: {
  readonly adviceMode: boolean;
  readonly adviceToFlowApplyMode: boolean;
}): ServiceFlowRegenerationTracePrefix {
  if (input.adviceToFlowApplyMode) return "service_flow_advice_to_flow";
  if (input.adviceMode) return "service_flow_advice";
  return "service_flow_proposal";
}

/** proposal-first fallback synthesis는 일반 proposal mode에서만 사용 */
export function shouldUseProposalFallbackSynthesis(input: {
  readonly adviceMode: boolean;
  readonly adviceToFlowApplyMode: boolean;
}): boolean {
  return !input.adviceMode && !input.adviceToFlowApplyMode;
}

export type AdviceToFlowQualityFailureResult = Readonly<{
  ok: false;
  code: typeof ADVICE_TO_FLOW_QUALITY_FAILURE_CODE;
  message: string;
  promptText: string;
}>;

export function buildAdviceToFlowQualityFailure(promptText: string): AdviceToFlowQualityFailureResult {
  return {
    ok: false,
    code: ADVICE_TO_FLOW_QUALITY_FAILURE_CODE,
    message: ADVICE_TO_FLOW_QUALITY_USER_MESSAGE,
    promptText,
  };
}

const MIN_ADVICE_TO_FLOW_STEPS = 3;
const MIN_ADVICE_TO_FLOW_ACTORS = 2;

export function isAdviceToFlowApplyMode(responsePolicy: unknown): boolean {
  if (!responsePolicy || typeof responsePolicy !== "object") return false;
  return (responsePolicy as { mode?: string }).mode === "advice_to_flow_apply";
}

export function buildAdviceToFlowApplyResponsePolicy(): ServiceFlowResponsePolicy {
  return {
    mode: "advice_to_flow_apply",
    instruction: SERVICE_FLOW_ADVICE_TO_FLOW_APPLY_INSTRUCTION,
  };
}

/** advice→flow apply에 필요한 최소 초안(actors·steps)이 있는지 */
export function serviceFlowHasMinimumDraftForApply(flow: RequirementsServiceFlowV1 | null): boolean {
  if (!flow) return false;
  return (flow.actors?.length ?? 0) >= MIN_ADVICE_TO_FLOW_ACTORS && (flow.steps?.length ?? 0) >= MIN_ADVICE_TO_FLOW_STEPS;
}

/** recentMessages에 구조화된 AI advice 본문이 있는지 (의도 라우팅 아님, 상태 보조). */
export function recentMessagesHasPriorAdviceResponse(recentMessages: string): boolean {
  const t = String(recentMessages ?? "");
  if (!t.trim()) return false;
  const numberedCount = (t.match(/(^|\n)\s*\d+\.\s+/g) ?? []).length;
  const bulletCount = (t.match(/(^|\n)\s*[-•]\s+/g) ?? []).length;
  if (numberedCount >= 2 && bulletCount >= 2) return true;
  if (numberedCount >= 1 && bulletCount >= 1 && t.length >= 120) return true;
  if (numberedCount >= 1 && /(검수\s*절차|화면\s*구성|예상\s*흐름|서비스\s*흐름|반영할까)/.test(t)) return true;
  return false;
}

function resolveApplyProposalDecision(input: {
  readonly proposalDecision?: ServiceFlowProposalDecision | null;
  readonly directQuickActionId?: QuickActionId | string | null;
}): "APPLY" | null {
  if (input.proposalDecision === "APPLY") return "APPLY";
  if (String(input.directQuickActionId ?? "").trim() === "APPLY_PROPOSAL") return "APPLY";
  return null;
}

function isExplicitApplyProposalQuickAction(directQuickActionId?: QuickActionId | string | null): boolean {
  return String(directQuickActionId ?? "").trim() === "APPLY_PROPOSAL";
}

export function shouldUseAdviceToFlowApplyMode(input: {
  readonly executionScope: ConversationExecutionScope;
  readonly proposalDecision?: ServiceFlowProposalDecision | null;
  readonly directQuickActionId?: QuickActionId | string | null;
  readonly currentFlow: RequirementsServiceFlowV1 | null;
  readonly recentMessages: string;
}): boolean {
  if (!isProjectSingleChatScope(input.executionScope)) return false;
  if (resolveApplyProposalDecision(input) !== "APPLY") return false;
  if (isExplicitApplyProposalQuickAction(input.directQuickActionId) && serviceFlowHasMinimumDraftForApply(input.currentFlow)) {
    return false;
  }
  if (serviceFlowHasMinimumDraftForApply(input.currentFlow)) return false;
  return recentMessagesHasPriorAdviceResponse(input.recentMessages);
}

/**
 * Intent router가 APPLY_PROPOSAL을 내려도, UI 칩이 아니고 steps가 비어 있으면
 * quickActionId를 analyze에 넘기지 않는다(서버 advice_to_flow_apply 진입 보조).
 */
export function shouldOmitQuickActionForAdviceToFlowApplyAnalyze(input: {
  readonly effectiveActionId: QuickActionId;
  readonly explicitDirectQuickActionId?: QuickActionId | null;
  readonly currentFlow: RequirementsServiceFlowV1 | null;
  readonly recentMessages: string;
}): boolean {
  if (input.effectiveActionId !== "APPLY_PROPOSAL") return false;
  if (isExplicitApplyProposalQuickAction(input.explicitDirectQuickActionId)) return false;
  if (serviceFlowHasMinimumDraftForApply(input.currentFlow)) return false;
  return recentMessagesHasPriorAdviceResponse(input.recentMessages);
}

/** Router APPLY_PROPOSAL → analyze 시 quickAction 생략·proposalDecision 전달 옵션 */
export function adviceToFlowApplyAnalyzeDispatchOptions(input: {
  readonly effectiveActionId: QuickActionId;
  readonly explicitDirectQuickActionId?: QuickActionId | null;
  readonly currentFlow: RequirementsServiceFlowV1 | null;
  readonly recentMessages: string;
}): Readonly<{ readonly omitQuickAction: boolean; readonly proposalDecision?: "APPLY" }> {
  const omitQuickAction = shouldOmitQuickActionForAdviceToFlowApplyAnalyze(input);
  return omitQuickAction ? { omitQuickAction, proposalDecision: "APPLY" } : { omitQuickAction };
}

export function isFutureOnlyAssistantMessage(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return true;
  if ((t.match(/(^|\n)\s*\d+\.\s+/g) ?? []).length >= 2) return false;
  if (/(예상\s*액터|예상\s*흐름)/.test(t) && (t.match(/(^|\n)\s*[-•]\s+/g) ?? []).length >= 2) return false;
  const compact = t.replace(/\n+/g, " ");
  if (
    /(정의해\s*보겠습니다|구성해\s*보겠습니다|진행하겠습니다|초안을\s*만들겠습니다|반영하겠습니다)\s*\.?\s*$/u.test(
      compact,
    )
  ) {
    return true;
  }
  if (/초안을\s*제안합니다/.test(compact) && !/(예상\s*액터|예상\s*흐름)/.test(t)) return true;
  if (/구체화하기\s*위한\s*초안을\s*제안합니다/.test(compact)) return true;
  return false;
}

export function buildServiceFlowAdviceToFlowApplySystemPromptBlock(): string {
  return `[Advice-to-Flow Apply Mode]
- 사용자는 직전 advice 내용을 기준으로 실제 서비스 흐름 초안을 만들라고 요청했다.
- 최근 대화의 AI advice 응답을 source로 사용한다.
- updatedFlow.actors와 updatedFlow.steps를 반드시 채운다.
- currentFlow.actors가 있으면 재사용하되 부족하면 보강한다.
- steps는 최소 ${MIN_ADVICE_TO_FLOW_STEPS}개, 권장 4~6개.
- 각 step은 title, description, primaryActorId, order를 포함한다.
- assistantMessage는 "정의해 보겠습니다"가 아니라 실제 초안을 제시한다.
- assistantMessage 형식:
  1) 반영 완료 한 줄
  2) "예상 액터" + 불릿 목록(updatedFlow.actors와 일치)
  3) "예상 흐름" + 번호 목록(updatedFlow.steps와 일치)
  4) 단일 CTA (예: "다음: 이 흐름을 검토하거나 일부 수정할 수 있습니다.")
- nextQuestion은 null이거나 검토 CTA 1문장만(assistantMessage와 중복 금지).

금지:
- "정의해 보겠습니다" / "초안을 제안합니다"만 말하고 끝내기
- "다음: 이 초안을 기준으로 진행할지 선택·수정해 주세요."만 출력
- steps 빈 배열
- actors만 있고 steps 없음
- advice 내용을 반복만 하고 flow 구조를 만들지 않음
- 바로 생성·배포 단계로 이동했다고 말하기`;
}

export function buildServiceFlowAdviceToFlowApplyRegenerationUserPayload(input: {
  readonly issues: readonly string[];
  readonly rejectedAssistantPreview: string;
}): string {
  return `[service-flow advice-to-flow apply 재생성]
직전 응답이 advice→flow 초안 생성 기준에 맞지 않습니다.

거부 사유:
${input.issues.map((c) => `- ${c}`).join("\n") || "- advice_to_flow_apply_missing_steps"}

거부된 assistantMessage 미리보기:
${input.rejectedAssistantPreview.slice(0, 600) || "(없음)"}

다시 출력할 때 반드시:
- updatedFlow.actors >= ${MIN_ADVICE_TO_FLOW_ACTORS}, updatedFlow.steps >= ${MIN_ADVICE_TO_FLOW_STEPS}
- assistantMessage에 예상 액터·예상 흐름을 실제로 제시(미래형 선언만 금지)
- 각 step.primaryActorId는 actors에 존재
- conversationState는 PROPOSAL 또는 REVIEW 수준(바로 APPROVED 금지)
- JSON 스키마만 출력`;
}
