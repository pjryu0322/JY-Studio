import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { workspaceAiMemberSystemPrefix } from "@/lib/ai-member/platformAiMembers";
import type { RequirementsSingleChatOrchestrationStateV1 } from "@/lib/requirements/singleChatOrchestrationTypes";
import { quickActionNextQuestionBlock, type SingleChatQuickActionKind } from "@/lib/requirements/singleChatQuickAction";
import { safeJsonParse } from "@/lib/requirements/singleChatOrchestrationOpenAI.shared";

export type CoordinatorSynthesisInput = Readonly<{
  projectName: string;
  projectDescription: string;
  userMessage: string;
  dialogueExcerpt: string;
  specialistDigest: string;
  specialistContributors: readonly string[];
  state: RequirementsSingleChatOrchestrationStateV1;
  decisionAxis: string;
  conflictHint: string | null;
  recentAssistantQuestions: readonly string[];
  stickyTurnsRemainingPrev: number;
  ownerPersistenceReason: string | null;
  quickActionLabel: string | null;
  quickActionKind: SingleChatQuickActionKind | null;
}>;

export type CoordinatorSynthesisOk = Readonly<{
  ok: true;
  assistantMessage: string;
  suggestions: string[] | null;
  promptText: string;
  model: string;
}>;

export type CoordinatorSynthesisErr = Readonly<{ ok: false; code: string; message: string }>;

export type CoordinatorSynthesisResult = CoordinatorSynthesisOk | CoordinatorSynthesisErr;

const COORDINATOR_SYNTHESIS_RULES = `
당신은 SingleChat의 **대화 코디네이터(AI 기획자 대표)** 입니다.
내부 specialist(분석·설계·보안 등)는 사용자에게 직접 말하지 않는 contributor입니다. 그들의 관점은 당신이 한 통의 메시지로 통합합니다.

[필수 — 사용자 노출]
- 사용자에게는 **하나의 메시지**만 제공한다.
- specialist별 독립 질문·인사·서명 금지 ("AI 분석가", "AI 설계자" 등 역할 소개 금지).
- 여러 질문을 동시에 던지지 않는다(물음표는 최대 1개).
- 마지막에는 반드시 **하나의 선택·행동**만 요청한다(‘다음: …’ 한 줄).
- 내부 슬롯 키·ownerAgent·phase·orchestration 용어 금지.

[메시지 구조 — 짧게]
1) 지금 이해한 내용 1~2줄
2) 가능하면 대안 2~3개(번호 목록) — analyst 관점은 **제안(proposal-first)**: 빈 질문 대신 예상 액터·흐름 후보를 제시하고 선택/추가를 요청
3) 추천안 1줄(‘추천: …’)
4) 다음 행동 1줄(‘다음: …’)

[대기·연속성]
- 직전에 이미 질문했고 사용자가 아직 답하지 않은 맥락이면, 새 축의 다중 질문을 열지 말고 이전 질문을 짧게 상기하거나 답을 정리한다.
- 사용자가 짧게 동의·확인만 한 경우, 같은 의미 질문 반복 금지.

[출력 JSON]
{ "assistantMessage": "한국어 통합 메시지", "suggestions": ["추천안 적용", "일부 수정", "다른 대안 보기", "직접 입력", "보류"] }
`.trim();

export async function runCoordinatorSynthesisTurnOpenAI(
  input: CoordinatorSynthesisInput
): Promise<CoordinatorSynthesisResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { ok: false, code: "NO_KEY", message: "NO_KEY" };

  const model = resolveOpenAiModelFromEnv();
  const slotsJson = JSON.stringify(input.state.slots, null, 0).slice(0, 14_000);
  const contributors =
    input.specialistContributors.length > 0
      ? input.specialistContributors.join(", ")
      : input.specialistDigest.trim()
        ? "(digest만 참고)"
        : "(없음)";

  const waitingContinuity =
    input.stickyTurnsRemainingPrev > 0 &&
    typeof input.ownerPersistenceReason === "string" &&
    (input.ownerPersistenceReason.startsWith("sticky_keep") || input.ownerPersistenceReason.startsWith("explicit_sticky"));

  const system = `${workspaceAiMemberSystemPrefix("ideation")}
${COORDINATOR_SYNTHESIS_RULES}`;

  const quickBlock = quickActionNextQuestionBlock(input.quickActionKind, input.quickActionLabel);
  const recentBlock =
    input.recentAssistantQuestions.length > 0
      ? input.recentAssistantQuestions
          .slice(0, 5)
          .map((q, i) => `${i + 1}. ${q}`)
          .join("\n")
      : "(없음)";

  const user = `[프로젝트] ${input.projectName.trim()}
[프로젝트 설명] ${input.projectDescription.trim().slice(0, 900)}
[최근 사용자 발화] ${input.userMessage.trim().slice(0, 1600)}
${quickBlock ? `${quickBlock}\n` : ""}[대화 발췌] ${input.dialogueExcerpt.trim().slice(0, 7000)}
[내부 specialist 요약 — 사용자에게 그대로 노출 금지]
${input.specialistDigest.slice(0, 4500) || "(없음)"}
[contributor roles] ${contributors}
[결정 축] ${input.decisionAxis}
${input.conflictHint ? `[조정 필요] ${input.conflictHint}\n` : ""}[직전 assistant 질문]
${recentBlock}
[대기 연속성] ${waitingContinuity ? "yes — 이전 질문에 대한 답을 이어가거나 짧게 상기. 새 다축 질문 금지." : "no"}
[슬롯 스냅샷] ${slotsJson}`;

  const res = await postOpenAiChatCompletion({
    apiKey,
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.28,
    responseFormatJsonObject: true,
    maxTokens: input.quickActionKind ? 280 : 220,
  });

  if (!res.ok) return { ok: false, code: res.code, message: res.message.slice(0, 400) };

  const parsed = safeJsonParse(res.text ?? "") as Record<string, unknown> | null;
  const msg = String(parsed?.assistantMessage ?? "").trim();
  if (!msg) return { ok: false, code: "EMPTY", message: "coordinator synthesis empty" };

  const suggestions = Array.isArray(parsed?.suggestions)
    ? (parsed!.suggestions as unknown[])
        .map((x) => String(x ?? "").trim())
        .filter(Boolean)
        .slice(0, 8)
    : null;

  const promptText = `[coordinator-synthesis]\n[system]\n${system}\n\n[user]\n${user}\n\n[raw]\n${String(res.text ?? "").slice(0, 4000)}`;

  return { ok: true, assistantMessage: msg, suggestions: suggestions?.length ? suggestions : null, promptText, model };
}
