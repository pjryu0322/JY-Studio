import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { workspaceAiMemberSystemPrefix } from "@/lib/ai-member/platformAiMembers";

export const MESSENGER_CONVERSATION_SUMMARIZE_SYSTEM_PROMPT = `당신은 프로젝트 생성 전 대화방의 AI기획자 대화 내용을 정리하는 편집자입니다.
입력은 사용자와 AI기획자의 대화입니다.
목표는 업무 우선순위 분류가 아니라, 아이디어 탐색 내용을 다음 대화에 이어가기 좋게 정리하는 것입니다.

규칙:
- 한국어로만 작성합니다.
- 없는 내용을 추측하지 않습니다.
- AI가 제안했지만 사용자가 선택하지 않은 내용은 "논의된 대안"으로만 분리합니다.
- 사용자가 명시적으로 선호한 방향은 "사용자가 선택/선호한 방향"에 넣습니다.
- "요청 분류", "우선순위", "P1/P2/P3"를 출력하지 않습니다.
- 프로젝트가 확정된 것처럼 쓰지 않습니다.
- 실행하지 않은 다음 행동을 약속하지 않습니다.

출력 Markdown:
현재 아이디어
- ...

사용자가 선택/선호한 방향
- ...

논의된 대안
- ...

남은 쟁점
- ...

다음에 이어서 논의할 수 있는 항목
- ...`;

export type MessengerConversationSummarizeOk = {
  readonly ok: true;
  readonly summaryMarkdown: string;
};
export type MessengerConversationSummarizeErr = { readonly ok: false; readonly code: string; readonly message: string };

export async function runMessengerConversationSummarizeLlm(input: {
  readonly apiKey: string;
  readonly model: string;
  readonly plainText: string;
}): Promise<MessengerConversationSummarizeOk | MessengerConversationSummarizeErr> {
  const plain = input.plainText.trim();
  if (!plain) {
    return { ok: false, code: "EMPTY", message: "요약할 내용이 없습니다." };
  }

  const system = `${workspaceAiMemberSystemPrefix("ideation")}${MESSENGER_CONVERSATION_SUMMARIZE_SYSTEM_PROMPT}`;
  const user = `다음 대화를 정리해 주세요.\n\n---\n${plain}\n---`;

  const res = await postOpenAiChatCompletion({
    apiKey: input.apiKey,
    model: input.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.25,
    maxTokens: 2000,
  });

  if (!res.ok) {
    return { ok: false, code: res.code, message: res.message };
  }

  const summaryMarkdown = String(res.text ?? "").trim();
  if (!summaryMarkdown) {
    return { ok: false, code: "EMPTY", message: "AI 응답이 비어 있습니다." };
  }

  return { ok: true, summaryMarkdown: summaryMarkdown.slice(0, 12_000) };
}
