import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { appendReviewMessage, getReviewThread, setImprovementItems } from "@/lib/prototype/prototypeReviewStore";
import { generateImprovementItemsForRun } from "@/lib/prototype/prototypeReviewImprovementsGenerator";

/** 개선안 보기: 구조화된 목록 생성 후 스레드에 저장 */
export async function POST(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  let body: { projectId?: string; runId?: string; silentFollowup?: boolean };
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

  const gen = await generateImprovementItemsForRun(projectId, runId);
  if (!gen.ok) {
    const emptyItems = gen.message.includes("생성하지 못했습니다");
    return NextResponse.json(
      { success: false, message: gen.message, ...(!emptyItems ? { code: "OPENAI_ERROR" as const } : {}) },
      { status: emptyItems ? 400 : 200 },
    );
  }

  const items = gen.items;
  setImprovementItems(projectId, runId, items);
  const silent = Boolean(body.silentFollowup);
  appendReviewMessage(
    projectId,
    runId,
    "planner",
    silent
      ? `【AI개선안】프리뷰와 실행 맥락을 바탕으로 개선 후보 ${items.length}건을 제안합니다.\n아래 카드를 눌러 상세 내용을 확인한 뒤, 의견은 입력창에 자유롭게 남겨 주세요.`
      : `개선안 ${items.length}건을 정리했습니다. 대화창의 AI개선안 카드를 눌러 확인하고, 필요하면 「보완작업 생성」으로 작업 초안을 만드세요.`,
  );

  return NextResponse.json({
    success: true,
    data: { items, messages: getReviewThread(projectId, runId) },
  });
}
