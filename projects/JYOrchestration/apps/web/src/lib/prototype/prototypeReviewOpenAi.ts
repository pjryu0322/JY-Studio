import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";
import type { PrototypeReviewMessage } from "@/lib/prototype/prototypeReviewStore";

const REVIEW_AI_TRANSCRIPT_LABEL = getWorkspaceAiMember("prototype_review")?.title ?? "AI 검수자";

export async function openAiJsonCompletion<T>(system: string, user: string): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  }
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { ok: false, message: errText.slice(0, 500) || "OpenAI 요청에 실패했습니다." };
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) return { ok: false, message: "모델 응답이 비어 있습니다." };
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return { ok: false, message: "모델 JSON 파싱에 실패했습니다." };
  }
}

export async function openAiTextCompletion(system: string, user: string): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  }
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { ok: false, message: errText.slice(0, 500) || "OpenAI 요청에 실패했습니다." };
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) return { ok: false, message: "모델 응답이 비어 있습니다." };
  return { ok: true, text };
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
