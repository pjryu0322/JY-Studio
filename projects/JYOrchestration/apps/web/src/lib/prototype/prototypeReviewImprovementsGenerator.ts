import { workspaceAiMemberSystemPrefix } from "@/lib/ai-member/platformAiMembers";
import { appendAiContextToSystemPrompt } from "@/lib/ai/knowledge/aiMemberContextInjection";
import type { PrototypeImprovementItem } from "@/lib/prototype/prototypeReviewStore";
import { getReviewThread } from "@/lib/prototype/prototypeReviewStore";
import { formatRunContext, formatReviewTranscript, openAiJsonCompletion } from "@/lib/prototype/prototypeReviewOpenAi";
import { getRun } from "@/lib/prototype/prototypeRunStore";

type ImprovementsJson = { items: Array<{ title?: string; detail?: string }> };

/**
 * 프로토타입 검토 스레드·실행 맥락으로 개선안 목록만 생성(저장·메시지 추가 없음).
 */
export async function generateImprovementItemsForRun(
  projectId: string,
  runId: string,
): Promise<{ ok: true; items: PrototypeImprovementItem[] } | { ok: false; message: string }> {
  const messages = getReviewThread(projectId, runId);
  const run = getRun(projectId, runId);

  let system = `${workspaceAiMemberSystemPrefix("prototype_review")}프로토타입 검토 대화를 바탕으로 실행 가능한 개선안 목록을 만든다.
반드시 JSON 한 개만 출력한다.
스키마: { "items": [ { "title": "짧은 제목", "detail": "무엇을 왜 바꿀지 1~2문장" } ] }
항목 3~8개, 한국어, 사용자에게 보여질 문구만.`;
  system = await appendAiContextToSystemPrompt({
    aiMemberId: "designer",
    baseSystem: system,
    projectId,
  });

  const userPayload = `[실행 맥락]
${formatRunContext(run)}

[대화]
${formatReviewTranscript(messages) || "(대화 없음 — 프리뷰·상태만으로 일반적인 개선 후보를 제안)"}`;

  const ai = await openAiJsonCompletion<ImprovementsJson>(system, userPayload);
  if (!ai.ok) {
    return { ok: false, message: ai.message };
  }

  const rawItems = Array.isArray(ai.data.items) ? ai.data.items : [];
  const items: PrototypeImprovementItem[] = rawItems
    .map((it) => ({
      title: String(it?.title ?? "").trim(),
      detail: String(it?.detail ?? "").trim(),
    }))
    .filter((it) => it.title);

  if (!items.length) {
    return { ok: false, message: "개선안을 생성하지 못했습니다. 대화를 조금 더 입력한 뒤 다시 시도해 주세요." };
  }

  return { ok: true, items };
}
