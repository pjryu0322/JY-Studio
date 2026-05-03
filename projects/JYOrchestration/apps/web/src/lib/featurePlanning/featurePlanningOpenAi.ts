import { stripJsonMarkdownFences } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";

export type OpenAiJsonChatTrace = {
  readonly label: string;
  /** true면 타임라인에 자동 기록하지 않음 — 호출 측에서 recordFeaturePlanningOpenAi 등으로 기록 */
  readonly skipTimeline?: boolean;
  /** 0~2 권장. 미지정 시 0.2 */
  readonly temperature?: number;
};

export async function openAiChatJsonText(
  apiKey: string,
  model: string,
  system: string,
  user: string,
  _trace?: OpenAiJsonChatTrace
): Promise<{ ok: true; text: string } | { ok: false; code: string; message: string }> {
  void _trace;
  const temp =
    typeof _trace?.temperature === "number" && Number.isFinite(_trace.temperature)
      ? Math.min(1.2, Math.max(0, _trace.temperature))
      : 0.2;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: temp,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { ok: false, code: `HTTP_${res.status}`, message: errText.slice(0, 500) || `HTTP ${res.status}` };
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
  let text = json.choices?.[0]?.message?.content?.trim();
  if (!text) {
    return { ok: false, code: "EMPTY", message: "AI 응답 본문이 비어 있습니다." };
  }
  text = stripJsonMarkdownFences(text);
  return { ok: true, text };
}

export function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
