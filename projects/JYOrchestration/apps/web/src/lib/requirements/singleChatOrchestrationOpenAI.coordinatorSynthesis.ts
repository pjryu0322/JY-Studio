import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { workspaceAiMemberSystemPrefix } from "@/lib/ai-member/platformAiMembers";
import type { RequirementsSingleChatOrchestrationStateV1 } from "@/lib/requirements/singleChatOrchestrationTypes";
import { quickActionNextQuestionBlock, type SingleChatQuickActionKind } from "@/lib/requirements/singleChatQuickAction";
import {
  detectQuestionFirstUx,
  hasProposalFirstStructure,
} from "@/lib/requirements/requirementsBootstrapInterviewQuality";
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
  referencePromptContextBlock?: string;
  /** repeat-guard / proposal-first 재시도 시 추가 지시 */
  synthesisRetryHint?: string | null;
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
내부 specialist(분석·설계·보안 등)는 사용자에게 직접 말하지 않는 **proposal contributor**입니다. 그들의 슬롯·관점은 당신이 **구조화된 초안(draft)** 으로 통합합니다.

[절대 금지 — question-first UX]
- 빈 설계 질문: "첫 단계는 무엇입니까?", "어떤 액터가 필요하신가요?", "무엇을 할까요?" 류
- 사용자가 처음부터 백지 설계하게 만드는 질문만 던지기
- specialist별 독립 질문·인사·서명 ("AI 분석가" 등 역할 소개 금지)
- 여러 질문 동시 나열(물음표 최대 1개, 마지막 확인용만)
- 내부 슬롯 키·ownerAgent·phase·orchestration 용어

[필수 — proposal-first UX]
사용자에게 **하나의 메시지**만 제공한다. 구조:
1) 프로젝트 이해 1~2줄 ("~로 이해했습니다")
2) **구조화된 초안** (가능한 항목을 채울 것 — specialist digest·슬롯 스냅샷 반영):
   - 예상 서비스 흐름(번호 목록 3~8단계)
   - 예상 액터·역할(불릿 2~5개)
   - (맥락상 필요 시) 예상 핵심 기능·사용자 흐름·처리 방식 중 1블록
3) 추천안 1줄 ('추천: …')
4) 마지막 CTA 1줄: "맞는지 선택하거나 수정해 주세요" / '다음: …' (하나의 행동만)

analyst 관점은 **질문자가 아니라 구조화 제안자**: 액터·권한·흐름을 후보로 제시하고 사용자는 검토·선택·수정만 하면 된다.

[대기·연속성]
- 직전에 이미 제안했고 사용자가 아직 답하지 않았으면, 새 축의 빈 질문을 열지 말고 이전 초안을 짧게 상기하거나 사용자 답을 반영해 초안을 갱신한다.
- 사용자가 짧게 동의·확인만 한 경우, 같은 의미 질문 반복 금지.

[출력 JSON]
{ "assistantMessage": "한국어 통합 proposal 메시지", "suggestions": ["추천안 적용", "일부 수정", "다른 대안 보기", "직접 입력", "보류"] }
`.trim();

function shouldRejectCoordinatorMessage(msg: string): boolean {
  const t = String(msg ?? "").trim();
  if (!t) return true;
  return detectQuestionFirstUx(t) && !hasProposalFirstStructure(t);
}

async function callCoordinatorSynthesis(
  input: CoordinatorSynthesisInput,
  apiKey: string,
  model: string
): Promise<CoordinatorSynthesisResult> {
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

  const synthesisRetryHintText = String(input.synthesisRetryHint ?? "").trim();
  const retryBlock = synthesisRetryHintText ? `\n[재시도 지시]\n${synthesisRetryHintText.slice(0, 800)}\n` : "";

  const user = `[프로젝트] ${input.projectName.trim()}
[프로젝트 설명] ${input.projectDescription.trim().slice(0, 900)}
${(input.referencePromptContextBlock ?? "").trim().slice(0, 6000)}
[최근 사용자 발화] ${input.userMessage.trim().slice(0, 1600)}
${quickBlock ? `${quickBlock}\n` : ""}${retryBlock}[대화 발췌] ${input.dialogueExcerpt.trim().slice(0, 7000)}
[내부 specialist 요약 — 사용자에게 그대로 노출·질문 문장으로 바꾸지 말 것]
${input.specialistDigest.slice(0, 4500) || "(없음)"}
[contributor roles] ${contributors}
[결정 축] ${input.decisionAxis}
${input.conflictHint ? `[조정 필요] ${input.conflictHint}\n` : ""}[직전 assistant 메시지]
${recentBlock}
[대기 연속성] ${waitingContinuity ? "yes — 이전 초안·질문에 대한 답을 이어가거나 초안을 갱신. 새 빈 질문 금지." : "no"}
[슬롯 스냅샷 — 초안 작성에 반영] ${slotsJson}`;

  const res = await postOpenAiChatCompletion({
    apiKey,
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.3,
    responseFormatJsonObject: true,
    maxTokens: input.quickActionKind ? 420 : 380,
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

export async function runCoordinatorSynthesisTurnOpenAI(
  input: CoordinatorSynthesisInput
): Promise<CoordinatorSynthesisResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { ok: false, code: "NO_KEY", message: "NO_KEY" };

  const model = resolveOpenAiModelFromEnv();
  const first = await callCoordinatorSynthesis(input, apiKey, model);
  if (!first.ok) return first;
  if (!shouldRejectCoordinatorMessage(first.assistantMessage)) return first;

  const priorHint = String(input.synthesisRetryHint ?? "").trim();
  const retry = await callCoordinatorSynthesis(
    {
      ...input,
      synthesisRetryHint: [
        priorHint,
        "[proposal-first-guard] 직전 출력이 question-first(빈 설계 질문)였습니다. 예상 흐름·액터·단계를 번호/불릿 초안으로 먼저 제시하고, 마지막에만 수정·선택을 요청하세요.",
      ]
        .filter(Boolean)
        .join("\n"),
    },
    apiKey,
    model
  );
  if (retry.ok && !shouldRejectCoordinatorMessage(retry.assistantMessage)) return retry;
  return first;
}
