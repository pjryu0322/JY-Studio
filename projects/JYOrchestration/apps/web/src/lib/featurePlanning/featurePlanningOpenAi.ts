import { recordOpenAiJsonChatRoundFromContext } from "@/lib/debug/promptTimelineStore";
import { stripJsonMarkdownFences } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";

export async function openAiChatJsonText(
  apiKey: string,
  model: string,
  system: string,
  user: string,
  trace?: { readonly label: string }
): Promise<{ ok: true; text: string } | { ok: false; code: string; message: string }> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    const err = { ok: false as const, code: `HTTP_${res.status}`, message: errText.slice(0, 500) || `HTTP ${res.status}` };
    recordOpenAiJsonChatRoundFromContext({
      label: trace?.label ?? "OpenAI (JSON)",
      model,
      system,
      user,
      ok: false,
      errorMessage: `${err.code}: ${err.message}`,
    });
    return err;
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
  let text = json.choices?.[0]?.message?.content?.trim();
  if (!text) {
    const err = { ok: false as const, code: "EMPTY", message: "AI 응답 본문이 비어 있습니다." };
    recordOpenAiJsonChatRoundFromContext({
      label: trace?.label ?? "OpenAI (JSON)",
      model,
      system,
      user,
      ok: false,
      errorMessage: err.message,
    });
    return err;
  }
  text = stripJsonMarkdownFences(text);
  recordOpenAiJsonChatRoundFromContext({
    label: trace?.label ?? "OpenAI (JSON)",
    model,
    system,
    user,
    ok: true,
    assistantText: text,
  });
  return { ok: true, text };
}

export function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
