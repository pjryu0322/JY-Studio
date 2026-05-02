import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { createWorkNoteForUser, listWorkNotesForUser } from "@/lib/service/workNoteService";

export async function GET(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const projectId = request.nextUrl.searchParams.get("projectId")?.trim() ?? "";
  if (!projectId) {
    return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
  }

  try {
    await requireProjectPermission(projectId, userId, "canViewProject", "GET /api/work-notes");
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    throw error;
  }

  const notes = await listWorkNotesForUser({ projectId, userId });
  return NextResponse.json({ success: true, data: { notes } });
}

export async function POST(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  let body: { projectId?: string; title?: string; content?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const projectId = String(body.projectId ?? "").trim();
  const title = typeof body.title === "string" ? body.title : "";
  const content = typeof body.content === "string" ? body.content : "";

  if (!projectId) {
    return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
  }

  try {
    await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/work-notes");
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    throw error;
  }

  const note = await createWorkNoteForUser({ projectId, userId, title, content });
  return NextResponse.json({ success: true, data: { note } });
}
