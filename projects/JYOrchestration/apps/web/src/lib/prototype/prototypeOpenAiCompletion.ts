import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiFromEnv } from "@/lib/ai/openAiEnv";

export async function openAiJsonCompletion<T>(
  system: string,
  user: string,
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  const cred = resolveOpenAiFromEnv();
  if (!cred.ok) {
    return { ok: false, message: cred.message };
  }
  const res = await postOpenAiChatCompletion({
    apiKey: cred.apiKey,
    model: cred.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.3,
    responseFormatJsonObject: true,
  });
  if (!res.ok) {
    return { ok: false, message: res.message.slice(0, 500) || "OpenAI 요청에 실패했습니다." };
  }
  try {
    return { ok: true, data: JSON.parse(res.text) as T };
  } catch {
    return { ok: false, message: "모델 JSON 파싱에 실패했습니다." };
  }
}
