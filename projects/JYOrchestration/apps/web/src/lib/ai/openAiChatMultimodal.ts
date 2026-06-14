import { postOpenAiChatCompletion, type OpenAiChatMessage } from "@/lib/ai/openAiChatCompletions";

export type OpenAiMultimodalUserPart =
  | Readonly<{ type: "text"; text: string }>
  | Readonly<{ type: "image_url"; image_url: Readonly<{ url: string; detail?: "low" | "high" | "auto" }> }>;

export type OpenAiMultimodalMessage = Readonly<{
  role: "system" | "user" | "assistant";
  content: string | readonly OpenAiMultimodalUserPart[];
}>;

export async function postOpenAiChatCompletionMultimodal(input: Readonly<{
  apiKey: string;
  model: string;
  messages: readonly OpenAiMultimodalMessage[];
  temperature: number;
  maxTokens?: number;
  responseFormatJsonObject?: boolean;
}>): Promise<
  | Readonly<{ ok: true; text: string }>
  | Readonly<{ ok: false; code: string; message: string }>
> {
  const apiKey = String(input.apiKey ?? "").trim();
  if (!apiKey) return { ok: false, code: "NO_KEY", message: "OpenAI API 키가 비어 있습니다." };

  const body: Record<string, unknown> = {
    model: input.model,
    temperature: input.temperature,
    messages: input.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  };
  if (input.responseFormatJsonObject) {
    body.response_format = { type: "json_object" };
  }
  if (typeof input.maxTokens === "number" && input.maxTokens > 0) {
    body.max_tokens = Math.floor(input.maxTokens);
  }

  let res: Response;
  let rawText: string;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
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
    return { ok: false, code: "NETWORK", message: net.slice(0, 400) };
  }

  if (!res.ok) {
    return { ok: false, code: "HTTP", message: `HTTP ${res.status} ${rawText.slice(0, 300)}` };
  }

  let parsed: { choices?: Array<{ message?: { content?: string } }> };
  try {
    parsed = JSON.parse(rawText) as typeof parsed;
  } catch {
    return { ok: false, code: "PARSE", message: "OpenAI response parse failed" };
  }
  const text = String(parsed?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) return { ok: false, code: "EMPTY", message: "Empty model content" };
  return { ok: true, text };
}

export function buildVisionUserMessage(input: Readonly<{
  textPayload: string;
  imageDataUrl?: string;
  imageUrl?: string;
}>): OpenAiMultimodalMessage {
  const imageUrl = String(input.imageDataUrl ?? input.imageUrl ?? "").trim();
  if (!imageUrl) {
    return { role: "user", content: input.textPayload };
  }
  const parts: OpenAiMultimodalUserPart[] = [
    { type: "text", text: input.textPayload },
    { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
  ];
  return { role: "user", content: parts };
}

export function toLegacyOpenAiMessages(messages: readonly OpenAiMultimodalMessage[]): OpenAiChatMessage[] {
  return messages.map((m) => ({
    role: m.role,
    content: typeof m.content === "string" ? m.content : m.content.filter((p) => p.type === "text").map((p) => p.text).join("\n"),
  }));
}
