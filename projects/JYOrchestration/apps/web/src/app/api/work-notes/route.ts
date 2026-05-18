import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { createWorkNoteForUser, listWorkNotesForUser } from "@/lib/service/workNoteService";
import { isUserMemoScopeParam } from "@/lib/worknote/workNoteMemoScope";

export async function GET(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const scope = String(request.nextUrl.searchParams.get("scope") ?? "").trim().toLowerCase();
  const projectId = request.nextUrl.searchParams.get("projectId")?.trim() ?? "";

  if (isUserMemoScopeParam(scope)) {
    if (projectId) {
      return NextResponse.json(
        { success: false, message: "USER 메모(scope=user|personal)와 projectId는 함께 쓸 수 없습니다." },
        { status: 400 }
      );
    }
    const notes = await listWorkNotesForUser({ userId, projectId: null });
    return NextResponse.json({ success: true, data: { notes } });
  }

  if (!projectId) {
    return NextResponse.json(
      { success: false, message: "projectId가 필요합니다. 사용자 메모는 ?scope=user 를 사용하세요." },
      { status: 400 }
    );
  }

  try {
    await requireProjectPermission(projectId, userId, "canViewProject", "GET /api/work-notes");
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    throw error;
  }

  const notes = await listWorkNotesForUser({ userId, projectId });
  return NextResponse.json({ success: true, data: { notes } });
}

export async function POST(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  let body: { projectId?: string | null; scope?: string; title?: string; content?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title : "";
  const content = typeof body.content === "string" ? body.content : "";
  const scope = String(body.scope ?? "").trim().toLowerCase();
  const rawPid = body.projectId;
  const projectId = rawPid === null || rawPid === undefined ? "" : String(rawPid).trim();

  const isUserScope = isUserMemoScopeParam(scope);

  if (isUserScope) {
    if (projectId) {
      return NextResponse.json(
        { success: false, message: "USER 메모에는 projectId를 넣을 수 없습니다." },
        { status: 400 }
      );
    }
    const note = await createWorkNoteForUser({ projectId: null, userId, title, content });
    return NextResponse.json({ success: true, data: { note } });
  }

  if (!projectId) {
    return NextResponse.json(
      { success: false, message: "projectId가 필요합니다. 사용자 메모는 body에 scope:\"user\" 를 넣으세요." },
      { status: 400 }
    );
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
