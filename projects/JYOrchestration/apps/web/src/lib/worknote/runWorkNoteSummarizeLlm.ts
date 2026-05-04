import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { workspaceAiMemberSystemPrefix } from "@/lib/ai-member/platformAiMembers";

function stripJsonMarkdownFences(text: string): string {
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  return s.trim();
}

export type WorkNoteSummarizeOk = {
  readonly ok: true;
  readonly summary: string;
  readonly requestType: string;
  readonly priority: string;
  readonly priorityReason?: string;
};
export type WorkNoteSummarizeErr = { readonly ok: false; readonly code: string; readonly message: string };

/**
 * 작업메모 본문(플레인)을 한국어 요약 JSON으로 받는다.
 */
export async function runWorkNoteSummarizeLlm(input: {
  readonly apiKey: string;
  readonly model: string;
  readonly plainText: string;
}): Promise<WorkNoteSummarizeOk | WorkNoteSummarizeErr> {
  const plain = input.plainText.trim();
  if (!plain) {
    return { ok: false, code: "EMPTY", message: "요약할 내용이 없습니다." };
  }

  const systemBody = [
    "당신은 업무 메모를 정리하는 편집자다.",
    "입력은 사용자의 작업 메모(플레인 텍스트)다.",
    "한국어로만 응답한다.",
    "인사·메타 설명 없이 JSON만 출력한다.",
    "summary: 핵심만 불릿(- ) 또는 짧은 문단, 400자 이내 권장(최대 2000자).",
    "requestType: 메모가 드러내는 요청/의도를 한 줄로 분류(예: 버그수정, 기능추가, 확인질문, 일정조율, 기타).",
    "priority: P0|P1|P2|P3 중 하나. 메모 근거가 없으면 P2.",
    "priorityReason: 우선순위 근거를 한두 문장(메모에 근거가 없으면 빈 문자열).",
    "추측·새 사실 추가 금지. 메모에 없는 내용은 쓰지 않는다.",
    '출력은 JSON 한 개만: {"summary":"…","requestType":"…","priority":"P1","priorityReason":"…"}',
  ].join("\n");
  const system = `${workspaceAiMemberSystemPrefix("memo")}${systemBody}`;

  const user = `다음 메모를 요약해 주세요.\n\n---\n${plain}\n---`;

  const res = await postOpenAiChatCompletion({
    apiKey: input.apiKey,
    model: input.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.25,
    responseFormatJsonObject: true,
  });

  if (!res.ok) {
    return { ok: false, code: res.code, message: res.message };
  }

  let text = res.text;
  if (!text) {
    return { ok: false, code: "EMPTY", message: "AI 응답이 비어 있습니다." };
  }
  text = stripJsonMarkdownFences(text);
  let root: unknown;
  try {
    root = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, code: "PARSE", message: "AI JSON을 해석할 수 없습니다." };
  }
  if (!root || typeof root !== "object") {
    return { ok: false, code: "SCHEMA", message: "요약 JSON 형식이 올바르지 않습니다." };
  }
  const summary = typeof (root as { summary?: unknown }).summary === "string" ? (root as { summary: string }).summary.trim() : "";
  if (!summary) {
    return { ok: false, code: "SCHEMA", message: "요약(summary)이 비어 있습니다." };
  }
  const requestType =
    typeof (root as { requestType?: unknown }).requestType === "string"
      ? (root as { requestType: string }).requestType.trim().slice(0, 200)
      : "";
  const priorityRaw =
    typeof (root as { priority?: unknown }).priority === "string"
      ? (root as { priority: string }).priority.trim().toUpperCase()
      : "";
  const allowed = new Set(["P0", "P1", "P2", "P3"]);
  const priority = allowed.has(priorityRaw) ? priorityRaw : "P2";
  const priorityReason =
    typeof (root as { priorityReason?: unknown }).priorityReason === "string"
      ? (root as { priorityReason: string }).priorityReason.trim().slice(0, 500)
      : undefined;
  return {
    ok: true,
    summary: summary.slice(0, 4000),
    requestType: requestType || "기타",
    priority,
    ...(priorityReason ? { priorityReason } : {}),
  };
}
