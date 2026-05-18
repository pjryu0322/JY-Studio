import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiFromEnv } from "@/lib/ai/openAiEnv";
import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";
import type { PrototypeReviewMessage } from "@/lib/prototype/prototypeReviewStore";

const REVIEW_AI_TRANSCRIPT_LABEL = getWorkspaceAiMember("prototype_review")?.title ?? "AI 검수자";

export async function openAiJsonCompletion<T>(system: string, user: string): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
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

export async function openAiTextCompletion(system: string, user: string): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
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
    temperature: 0.35,
  });
  if (!res.ok) {
    return { ok: false, message: res.message.slice(0, 500) || "OpenAI 요청에 실패했습니다." };
  }
  return { ok: true, text: res.text };
}

export function formatReviewTranscript(messages: readonly PrototypeReviewMessage[]): string {
  return messages
    .map((m) => {
      const who = m.role === "planner" ? REVIEW_AI_TRANSCRIPT_LABEL : m.role === "expert" ? "전문가" : "사용자";
      return `[${who}] ${m.content}`;
    })
    .join("\n");
}

export function formatRunContext(run: PrototypeRun | null): string {
  if (!run) return "(실행 정보 없음)";
  const preview = run.previewUrl || run.suggestedPreviewUrl || run.resultUrl || "(미등록)";
  return [
    `상태: ${run.status}`,
    `프리뷰 URL: ${preview}`,
    run.plannerSummary ? `플래너 요약: ${run.plannerSummary.slice(0, 800)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
