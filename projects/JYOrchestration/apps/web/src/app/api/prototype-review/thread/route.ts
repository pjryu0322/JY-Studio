import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  appendReviewMessage,
  getImprovementItems,
  getReviewThread,
  type PrototypeReviewRole,
} from "@/lib/prototype/prototypeReviewStore";

export async function GET(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const projectId = request.nextUrl.searchParams.get("projectId")?.trim() ?? "";
  const runId = request.nextUrl.searchParams.get("runId")?.trim() ?? "";
  if (!projectId || !runId) {
    return NextResponse.json({ success: false, message: "projectId와 runId가 필요합니다." }, { status: 400 });
  }

  try {
    await requireProjectPermission(projectId, userId, "canViewProject", "GET /api/prototype-review/thread");
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    throw error;
  }

  return NextResponse.json({
    success: true,
    data: { messages: getReviewThread(projectId, runId), improvementItems: getImprovementItems(projectId, runId) },
  });
}

export async function POST(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  let body: { projectId?: string; runId?: string; role?: string; content?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const projectId = String(body.projectId ?? "").trim();
  const runId = String(body.runId ?? "").trim();
  const content = String(body.content ?? "").trim();
  const roleRaw = String(body.role ?? "user").trim().toLowerCase();

  if (!projectId || !runId || !content) {
    return NextResponse.json({ success: false, message: "projectId, runId, content가 필요합니다." }, { status: 400 });
  }

  const role: PrototypeReviewRole =
    roleRaw === "planner" || roleRaw === "expert" ? (roleRaw as PrototypeReviewRole) : "user";

  try {
    await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/prototype-review/thread");
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    throw error;
  }

  const msg = appendReviewMessage(projectId, runId, role, content);
  return NextResponse.json({ success: true, data: { message: msg } });
}
