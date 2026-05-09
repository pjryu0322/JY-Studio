import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { getPlatformAiMemberById } from "@/lib/ai/platformAiMembers";
import { MESSENGER_DEFAULT_AI_CATALOG_KEY } from "@/lib/messenger/messengerConstants";
import type { ProjectFromChatDraftPayloadV1 } from "@/lib/messenger/projectFromChatDraftTypes";
import { resolveUserOpenAiApiKey } from "@/lib/messenger/resolveUserOpenAiKey";

const MESSENGER_AI_SYSTEM = `당신은 플랫폼의「AI 기획자」입니다. 사용자는 아직 프로젝트로 승격되지 않은 자유 대화방에서 아이디어를 탐색합니다.
규칙:
- 한국어로 답합니다.
- 과장된 약속이나 내부 오케스트레이션·슬롯·프로토타입 패키지 용어는 쓰지 마세요.
- 2~6문단 이내로 짧게, 다음 행동을 한 줄로 제안하세요.
- 사용자가 명확히 하고 싶어 하는 목표를 하나 짚어 짧은 질문으로 이어가도 됩니다.`;

function stripJsonFences(text: string): string {
  let s = String(text ?? "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  return s;
}

export type MessengerAiTurnResult =
  | { ok: true; text: string; model: string }
  | { ok: false; code: string; message: string };

export async function runMessengerAiTurn(input: {
  userId: string;
  transcript: readonly { role: "user" | "assistant"; content: string }[];
}): Promise<MessengerAiTurnResult> {
  const { key, source } = await resolveUserOpenAiApiKey(input.userId);
  if (!key) {
    return {
      ok: false,
      code: "NO_KEY",
      message:
        source === "missing"
          ? "OpenAI API 키가 없습니다. 설정에서 연동하거나 사용자 기본 키를 등록해 주세요."
          : "OpenAI API 키를 사용할 수 없습니다.",
    };
  }
  const model = resolveOpenAiModelFromEnv();
  const ai = getPlatformAiMemberById(MESSENGER_DEFAULT_AI_CATALOG_KEY);
  const persona = ai?.persona ? `\n페르소나(참고): ${ai.persona}` : "";
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: `${MESSENGER_AI_SYSTEM}${persona}` },
    ...input.transcript.map((m) => ({ role: m.role, content: m.content })),
  ];
  const res = await postOpenAiChatCompletion({
    apiKey: key,
    model,
    messages,
    temperature: 0.5,
    maxTokens: 900,
  });
  if (!res.ok) return { ok: false, code: res.code, message: res.message };
  const text = String(res.text ?? "").trim();
  if (!text) return { ok: false, code: "EMPTY", message: "모델 응답이 비어 있습니다." };
  return { ok: true, text, model };
}

const PROJECT_DRAFT_SYSTEM = `당신은 제품 기획자입니다. 아래 대화를 바탕으로 프로젝트 초안을 JSON 한 개로만 출력하세요.
스키마(필수 키, 한국어 문자열 위주):
{
  "version": 1,
  "titleCandidates": string[3],
  "chosenTitle": string,
  "description": string,
  "problem": string,
  "targetUsers": string,
  "valueProposition": string,
  "mvpScope": string,
  "explicitExclusions": string,
  "featureCandidates": string[],
  "openQuestions": string[],
  "assumptions": string[],
  "confirmedFacts": string[],
  "recommendedAiMembers": string[],
  "nextSteps": string[]
}
확정된 사실과 AI 가정을 섞지 말고, assumptions에는 가정만, confirmedFacts에는 사용자가 말한 사실만 넣으세요.`;

export type MessengerDraftResult =
  | { ok: true; payload: ProjectFromChatDraftPayloadV1; model: string }
  | { ok: false; code: string; message: string };

export async function runMessengerProjectDraft(input: {
  userId: string;
  transcript: string;
}): Promise<MessengerDraftResult> {
  const { key, source } = await resolveUserOpenAiApiKey(input.userId);
  if (!key) {
    return {
      ok: false,
      code: "NO_KEY",
      message: source === "missing" ? "OpenAI API 키가 없습니다." : "OpenAI API 키를 사용할 수 없습니다.",
    };
  }
  const model = resolveOpenAiModelFromEnv();
  const res = await postOpenAiChatCompletion({
    apiKey: key,
    model,
    messages: [
      { role: "system", content: PROJECT_DRAFT_SYSTEM },
      {
        role: "user",
        content: `대화 로그:\n---\n${input.transcript.slice(0, 24_000)}\n---\n위만 근거로 JSON을 채우세요.`,
      },
    ],
    temperature: 0.3,
    maxTokens: 2500,
    responseFormatJsonObject: true,
  });
  if (!res.ok) return { ok: false, code: res.code, message: res.message };
  const raw = stripJsonFences(res.text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, code: "JSON", message: "초안 JSON 파싱에 실패했습니다." };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, code: "JSON", message: "초안 형식이 올바르지 않습니다." };
  }
  const o = parsed as Record<string, unknown>;
  if (Number(o.version) !== 1) {
    return { ok: false, code: "JSON", message: "version은 1이어야 합니다." };
  }
  const payload: ProjectFromChatDraftPayloadV1 = {
    version: 1,
    titleCandidates: Array.isArray(o.titleCandidates) ? o.titleCandidates.map((x) => String(x)) : [],
    chosenTitle: String(o.chosenTitle ?? "").trim(),
    description: String(o.description ?? "").trim(),
    problem: String(o.problem ?? "").trim(),
    targetUsers: String(o.targetUsers ?? "").trim(),
    valueProposition: String(o.valueProposition ?? "").trim(),
    mvpScope: String(o.mvpScope ?? "").trim(),
    explicitExclusions: String(o.explicitExclusions ?? "").trim(),
    featureCandidates: Array.isArray(o.featureCandidates) ? o.featureCandidates.map((x) => String(x)) : [],
    openQuestions: Array.isArray(o.openQuestions) ? o.openQuestions.map((x) => String(x)) : [],
    assumptions: Array.isArray(o.assumptions) ? o.assumptions.map((x) => String(x)) : [],
    confirmedFacts: Array.isArray(o.confirmedFacts) ? o.confirmedFacts.map((x) => String(x)) : [],
    recommendedAiMembers: Array.isArray(o.recommendedAiMembers) ? o.recommendedAiMembers.map((x) => String(x)) : [],
    nextSteps: Array.isArray(o.nextSteps) ? o.nextSteps.map((x) => String(x)) : [],
  };
  if (!payload.chosenTitle) {
    return { ok: false, code: "JSON", message: "chosenTitle이 비어 있습니다." };
  }
  return { ok: true, payload, model };
}
