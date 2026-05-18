import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
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
  const modelFinal = String(model ?? "").trim() || resolveOpenAiModelFromEnv();
  const raw = await postOpenAiChatCompletion({
    apiKey,
    model: modelFinal,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: temp,
    responseFormatJsonObject: true,
  });
  if (!raw.ok) {
    return { ok: false, code: raw.code, message: raw.message };
  }
  let text = raw.text;
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
