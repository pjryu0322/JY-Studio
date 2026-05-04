import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { appendReviewMessage, getReviewThread } from "@/lib/prototype/prototypeReviewStore";
import { PROTOTYPE_REVIEW_WELCOME_MESSAGE } from "@/lib/prototype/prototypeReviewWelcome";

/** 빈 스레드에 프로토타입 검토 전담 AI 환영 메시지 1회 주입(실행 runId 기준). */
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
    await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/prototype-review/bootstrap");
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    throw error;
  }

  const existing = getReviewThread(projectId, runId);
  if (existing.length > 0) {
    return NextResponse.json({ success: true, data: { seeded: false, messages: existing } });
  }

  appendReviewMessage(projectId, runId, "planner", PROTOTYPE_REVIEW_WELCOME_MESSAGE);
  return NextResponse.json({
    success: true,
    data: { seeded: true, messages: getReviewThread(projectId, runId) },
  });
}
