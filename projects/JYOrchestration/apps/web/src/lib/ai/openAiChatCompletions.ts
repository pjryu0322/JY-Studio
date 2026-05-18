import { DEFAULT_OPENAI_MODEL } from "@/lib/ai/openAiEnv";

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

/** OpenAI HTTP 오류 본문 요약(프롬프트 전체는 넣지 않음) */
export function summarizeOpenAiHttpErrorBody(status: number, rawText: string): string {
  const slice = String(rawText ?? "").trim().slice(0, 500);
  try {
    const j = JSON.parse(rawText) as { error?: { message?: string; type?: string; code?: string | number } };
    const e = j?.error;
    if (e && typeof e.message === "string") {
      const parts = [
        `type=${String(e.type ?? "?")}`,
        typeof e.code !== "undefined" ? `code=${String(e.code)}` : null,
        e.message.trim().slice(0, 400),
      ].filter(Boolean);
      return `HTTP ${status} · ${parts.join(" · ")}`.slice(0, 800);
    }
  } catch {
    /* ignore */
  }
  return `HTTP ${status} · ${slice || "(empty body)"}`.slice(0, 800);
}

export type OpenAiChatRole = "system" | "user" | "assistant";

export type OpenAiChatMessage = Readonly<{
  role: OpenAiChatRole;
  content: string;
}>;

/** 응답 body `usage` — `returnUsage: true`일 때만 채워짐 */
export type OpenAiChatCompletionUsage = Readonly<{
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}>;

export type PostOpenAiChatCompletionInput = Readonly<{
  apiKey: string;
  model: string;
  messages: readonly OpenAiChatMessage[];
  temperature: number;
  /** true면 `response_format: { type: "json_object" }` */
  responseFormatJsonObject?: boolean;
  /** OpenAI `max_tokens` */
  maxTokens?: number;
  /** true면 응답 JSON의 `usage`를 파싱해 `usage` 필드로 반환 */
  returnUsage?: boolean;
}>;

export type PostOpenAiChatCompletionOk = Readonly<{
  ok: true;
  text: string;
  usage?: OpenAiChatCompletionUsage | null;
}>;
export type PostOpenAiChatCompletionErr = Readonly<{ ok: false; code: string; message: string }>;

/**
 * OpenAI Chat Completions 단일 진입점 — URL·헤더·응답 파싱·HTTP 에러 처리 공통.
 */
export async function postOpenAiChatCompletion(
  input: PostOpenAiChatCompletionInput,
): Promise<PostOpenAiChatCompletionOk | PostOpenAiChatCompletionErr> {
  const apiKey = String(input.apiKey ?? "").trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OpenAI API 키가 비어 있습니다." };
  }
  const model = String(input.model ?? "").trim() || DEFAULT_OPENAI_MODEL;

  const body: Record<string, unknown> = {
    model,
    temperature: input.temperature,
    messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
  };
  if (input.responseFormatJsonObject === true) {
    body.response_format = { type: "json_object" };
  }
  if (typeof input.maxTokens === "number" && Number.isFinite(input.maxTokens) && input.maxTokens > 0) {
    body.max_tokens = Math.floor(input.maxTokens);
  }

  const reqMeta = `model=${model} responseFormatJsonObject=${input.responseFormatJsonObject === true} maxTokens=${typeof input.maxTokens === "number" && Number.isFinite(input.maxTokens) ? Math.floor(input.maxTokens) : "(default)"}`;

  let res: Response;
  let rawText: string;
  try {
    res = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    rawText = await res.text().catch(() => "");
  } catch (e) {
    const net = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "NETWORK", message: `fetch failed (${net.slice(0, 240)}) · ${reqMeta}`.slice(0, 800) };
  }

  if (!res.ok) {
    return {
      ok: false,
      code: `HTTP_${res.status}`,
      message: `${summarizeOpenAiHttpErrorBody(res.status, rawText)} · ${reqMeta}`.slice(0, 1200),
    };
  }

  let json: {
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  try {
    json = JSON.parse(rawText) as typeof json;
  } catch {
    return { ok: false, code: "PARSE", message: "OpenAI 응답 본문을 JSON으로 파싱할 수 없습니다." };
  }

  const text = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) {
    return { ok: false, code: "EMPTY", message: "모델 응답 본문이 비어 있습니다." };
  }

  if (input.returnUsage !== true) {
    return { ok: true, text };
  }

  const u = json.usage;
  const usage =
    typeof u?.prompt_tokens === "number" &&
    typeof u?.completion_tokens === "number" &&
    typeof u?.total_tokens === "number"
      ? ({
          promptTokens: u.prompt_tokens,
          completionTokens: u.completion_tokens,
          totalTokens: u.total_tokens,
        } as const)
      : null;

  return { ok: true, text, usage };
}
