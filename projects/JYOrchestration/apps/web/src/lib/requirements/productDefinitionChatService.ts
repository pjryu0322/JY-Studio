import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { newRequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { runProductDefinitionChatOpenAI } from "@/lib/requirements/productDefinitionOpenAi";
import { buildProductDefinitionCompletedOrchestrationStage } from "@/lib/requirements/productDefinitionOrchestration";
import {
  evaluateProductDefinitionReadiness,
  formatProductDefinitionUserSummary,
  isProductDefinitionCompleteIntent,
  parseProductDefinitionV1,
  type ProductDefinitionV1,
} from "@/lib/requirements/productDefinitionV1";
import { mergeProductDefinitionIntoRequirementsState } from "@/lib/requirements/productDefinitionArtifact";
import {
  mergeRequirementsStateJson,
  parseRequirementsStateJson,
  type RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";

export const PRODUCT_DEFINITION_INTRO_INTERNAL_TYPE = "product_definition_intro_v1" as const;

export function hasProductDefinitionIntroMessage(messages: readonly RequirementsMessage[]): boolean {
  return messages.some((m) => m.meta?.internalType === PRODUCT_DEFINITION_INTRO_INTERNAL_TYPE);
}

export function buildProductDefinitionIntroAiMessage(input: Readonly<{
  readonly definition: ProductDefinitionV1;
  readonly nowIso?: string;
}>): RequirementsMessage {
  const now = input.nowIso ?? new Date().toISOString();
  return newRequirementsMessage({
    role: "ai",
    speakerType: "AI",
    speakerId: "ai-planner",
    speakerName: "AI기획자",
    messageType: "NOTICE",
    content: formatProductDefinitionUserSummary(input.definition),
    createdAt: now,
    meta: {
      internalType: PRODUCT_DEFINITION_INTRO_INTERNAL_TYPE,
      interviewSuggestions: ["핵심 기능 확정", "범위 수정", "성공 기준 보완", "기획 단계로 진행"],
      interviewAllowCustomInput: true,
    },
  });
}

export type ProductDefinitionChatTurnResult =
  | Readonly<{
      readonly ok: true;
      readonly assistantMessage: RequirementsMessage;
      readonly mergedState: RequirementsStateJson;
      readonly completedPlanning: boolean;
    }>
  | Readonly<{ readonly ok: false; readonly code: string; readonly message: string }>;

export async function executeProductDefinitionChatTurn(input: Readonly<{
  readonly projectId: string;
  readonly userMessage: string;
  readonly requirementsStateJson: unknown;
  readonly apiKey: string | null;
  readonly recentTranscript?: string;
  readonly nowIso?: string;
}>): Promise<ProductDefinitionChatTurnResult> {
  const now = input.nowIso ?? new Date().toISOString();
  const state = parseRequirementsStateJson(input.requirementsStateJson);
  const current = state.productDefinitionV1 ?? null;
  if (!current) {
    return { ok: false, code: "NO_DEFINITION", message: "Product Definition이 없습니다." };
  }

  const userText = input.userMessage.trim();
  if (!userText) {
    return { ok: false, code: "EMPTY", message: "메시지를 입력해 주세요." };
  }

  if (isProductDefinitionCompleteIntent(userText)) {
    const readiness = evaluateProductDefinitionReadiness(current);
    if (!readiness.ready) {
      const assistantMessage = newRequirementsMessage({
        role: "ai",
        speakerType: "AI",
        speakerId: "ai-planner",
        speakerName: "AI기획자",
        messageType: "NOTICE",
        content: [
          "아직 Product Definition 완료 조건을 충족하지 못했습니다.",
          "",
          "부족 항목:",
          ...readiness.missing.map((m) => `- ${m}`),
          "",
          "대화로 항목을 확정한 뒤 다시 「기획 단계로 진행」을 요청해 주세요.",
        ].join("\n"),
        createdAt: now,
        meta: { interviewAllowCustomInput: true },
      });
      return {
        ok: true,
        assistantMessage,
        mergedState: state,
        completedPlanning: false,
      };
    }

    const completedDef: ProductDefinitionV1 = {
      ...current,
      updatedAt: now,
      completedAt: now,
    };
    const mergedState = mergeRequirementsStateJson(
      mergeProductDefinitionIntoRequirementsState(state, completedDef, now),
      { requirementsOrchestrationStageV1: buildProductDefinitionCompletedOrchestrationStage(now) },
    );
    const assistantMessage = newRequirementsMessage({
      role: "ai",
      speakerType: "AI",
      speakerId: "ai-planner",
      speakerName: "AI기획자",
      messageType: "NOTICE",
      content:
        "Product Definition을 확정했습니다. 이제 기획 단계에서 서비스 흐름·기능·화면을 Product Definition을 기준으로 구체화합니다.",
      createdAt: now,
      meta: {
        interviewSuggestions: ["서비스 흐름 정리", "액터 정의", "기능 정리 시작"],
        interviewAllowCustomInput: true,
      },
    });
    return { ok: true, assistantMessage, mergedState, completedPlanning: true };
  }

  if (!input.apiKey?.trim()) {
    return {
      ok: false,
      code: "NO_KEY",
      message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다.",
    };
  }

  const llm = await runProductDefinitionChatOpenAI({
    apiKey: input.apiKey.trim(),
    current,
    userMessage: userText,
    recentTranscript: input.recentTranscript,
  });
  if (!llm.ok) {
    return { ok: false, code: llm.code, message: llm.message };
  }

  const parsed = parseProductDefinitionV1(llm.definition);
  if (!parsed) {
    return { ok: false, code: "SCHEMA", message: "Product Definition 저장 형식이 올바르지 않습니다." };
  }

  const mergedState = mergeProductDefinitionIntoRequirementsState(state, parsed, now);
  const assistantMessage = newRequirementsMessage({
    role: "ai",
    speakerType: "AI",
    speakerId: "ai-planner",
    speakerName: "AI기획자",
    messageType: "CHAT",
    content: llm.assistantMessage,
    createdAt: now,
    meta: { interviewAllowCustomInput: true },
  });

  return { ok: true, assistantMessage, mergedState, completedPlanning: false };
}
