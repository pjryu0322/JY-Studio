import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { appendReviewMessage, getReviewThread, setImprovementItems, type PrototypeImprovementItem } from "@/lib/prototype/prototypeReviewStore";
import { formatRunContext, formatReviewTranscript, openAiJsonCompletion } from "@/lib/prototype/prototypeReviewOpenAi";
import { getRun } from "@/lib/prototype/prototypeRunStore";

type ImprovementsJson = { items: Array<{ title?: string; detail?: string }> };

/** 개선안 보기: 구조화된 목록 생성 후 스레드에 저장 */
export async function POST(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  let body: { projectId?: string; runId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const projectId = String(body.projectId ?? "").trim();
  const runId = String(body.runId ?? "").trim();
  if (!projectId || !runId) {
    return NextResponse.json({ success: false, message: "projectId와 runId가 필요합니다." }, { status: 400 });
  }

  try {
    await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/prototype-review/improvements");
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    throw error;
  }

  const messages = getReviewThread(projectId, runId);
  const run = getRun(projectId, runId);

  const system = `당신은 JYOrchestration의 AI기획자다. 프로토타입 검토 대화를 바탕으로 실행 가능한 개선안 목록을 만든다.
반드시 JSON 한 개만 출력한다.
스키마: { "items": [ { "title": "짧은 제목", "detail": "무엇을 왜 바꿀지 1~2문장" } ] }
항목 3~8개, 한국어, 사용자에게 보여질 문구만.`;

  const userPayload = `[실행 맥락]
${formatRunContext(run)}

[대화]
${formatReviewTranscript(messages) || "(대화 없음 — 프리뷰·상태만으로 일반적인 개선 후보를 제안)"}`;

  const ai = await openAiJsonCompletion<ImprovementsJson>(system, userPayload);
  if (!ai.ok) {
    return NextResponse.json({ success: false, message: ai.message, code: "OPENAI_ERROR" }, { status: 200 });
  }

  const rawItems = Array.isArray(ai.data.items) ? ai.data.items : [];
  const items: PrototypeImprovementItem[] = rawItems
    .map((it) => ({
      title: String(it?.title ?? "").trim(),
      detail: String(it?.detail ?? "").trim(),
    }))
    .filter((it) => it.title);

  if (!items.length) {
    return NextResponse.json({ success: false, message: "개선안을 생성하지 못했습니다. 대화를 조금 더 입력한 뒤 다시 시도해 주세요." }, { status: 400 });
  }

  setImprovementItems(projectId, runId, items);
  appendReviewMessage(
    projectId,
    runId,
    "planner",
    `개선안 ${items.length}건을 정리했습니다. 화면에서 목록을 확인하고, 필요하면 「보완작업 생성」으로 작업 초안을 만드세요.`,
  );

  return NextResponse.json({
    success: true,
    data: { items, messages: getReviewThread(projectId, runId) },
  });
}
