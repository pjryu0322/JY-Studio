import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiFromEnv } from "@/lib/ai/openAiEnv";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";

export type ScreenPlanningLlmResult =
  | {
      readonly ok: true;
      readonly assistantMessage: string;
      readonly model: string;
      readonly promptText: string;
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
      readonly promptText?: string;
    };

function buildScreenPlanningSystemPrompt(): string {
  return [
    "당신은 Project SingleChat의 AI 기획자다.",
    "현재 요청은 service-flow update가 아니라 화면 구성 제안이다.",
    "",
    "목표:",
    "- 앞서 정리한 service flow와 최근 대화 맥락을 기준으로 화면 구성을 제안한다.",
    "- 최소 3개, 권장 4~6개 화면을 번호 목록으로 제안한다.",
    "- 각 화면은 목적, 주요 UI 요소, 사용자가 확인/수정할 정보가 포함되어야 한다.",
    "- service-flow analyze, APPLY_PROPOSAL, 대안 Viewer, flow update 문구를 쓰지 않는다.",
    "- 응답은 사용자에게 바로 보이는 한국어 텍스트다.",
    "- 마지막에 '다음: 이 화면 구성을 기준으로 기능 범위를 정리할 수 있습니다.'로 마무리한다.",
  ].join("\n");
}

function buildScreenPlanningUserPrompt(input: {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly recentMessages: string;
  readonly userMessage: string;
}): string {
  const steps = (input.flow?.steps ?? [])
    .slice(0, 8)
    .map((s, i) => `${i + 1}. ${s.title}: ${s.purpose ?? ""}`)
    .join("\n");
  const actors = (input.flow?.actors ?? [])
    .slice(0, 8)
    .map((a) => `- ${a.name}`)
    .join("\n");
  return [
    `프로젝트: ${input.projectName || "(이름 없음)"}`,
    input.projectDescription ? `설명: ${input.projectDescription.slice(0, 2000)}` : "",
    actors ? `액터:\n${actors}` : "",
    steps ? `서비스 흐름 단계:\n${steps}` : "서비스 흐름 단계: (아직 없음)",
    input.recentMessages ? `최근 대화:\n${input.recentMessages.slice(0, 8000)}` : "",
    `사용자 요청: ${input.userMessage.slice(0, 500)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function runScreenPlanningLlm(input: {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly recentMessages: string;
  readonly userMessage: string;
}): Promise<ScreenPlanningLlmResult> {
  const env = resolveOpenAiFromEnv();
  if (!env.ok) {
    return { ok: false, code: "NO_KEY", message: env.message };
  }

  const system = buildScreenPlanningSystemPrompt();
  const user = buildScreenPlanningUserPrompt(input);
  const promptText = `${system}\n\n---\n\n${user}`;

  const res = await postOpenAiChatCompletion({
    apiKey: env.apiKey,
    model: env.model,
    temperature: 0.35,
    maxTokens: 1200,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  if (!res.ok) {
    return { ok: false, code: res.code, message: res.message, promptText };
  }

  const assistantMessage = String(res.text ?? "").trim();
  if (!assistantMessage) {
    return { ok: false, code: "EMPTY", message: "화면 구성 응답이 비어 있습니다.", promptText };
  }

  return { ok: true, assistantMessage, model: env.model, promptText };
}
