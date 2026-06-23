import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { reorderWorkNotesForUser } from "@/lib/service/workNoteService";
import { isUserMemoScopeParam } from "@/lib/worknote/workNoteMemoScope";

export async function POST(request: Request) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  let body: { scope?: string; projectId?: string | null; orderedIds?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const scope = String(body.scope ?? "").trim().toLowerCase();
  const projectIdRaw = body.projectId;
  const projectId =
    projectIdRaw === null || projectIdRaw === undefined ? "" : String(projectIdRaw).trim();
  const orderedIds = Array.isArray(body.orderedIds)
    ? body.orderedIds.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];

  if (!orderedIds.length) {
    return NextResponse.json({ success: false, message: "orderedIds가 필요합니다." }, { status: 400 });
  }

  const isUserScope = isUserMemoScopeParam(scope);

  if (isUserScope) {
    if (projectId) {
      return NextResponse.json(
        { success: false, message: "USER 메모(scope=user)와 projectId는 함께 쓸 수 없습니다." },
        { status: 400 },
      );
    }
    const ok = await reorderWorkNotesForUser({ userId, projectId: null, orderedIds });
    if (!ok) {
      return NextResponse.json({ success: false, message: "순서를 저장하지 못했습니다." }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  }

  if (!projectId) {
    return NextResponse.json(
      { success: false, message: "projectId가 필요합니다. 사용자 메모는 scope=user 를 사용하세요." },
      { status: 400 },
    );
  }

  try {
    await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/work-notes/reorder");
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    throw error;
  }

  const ok = await reorderWorkNotesForUser({ userId, projectId, orderedIds });
  if (!ok) {
    return NextResponse.json({ success: false, message: "순서를 저장하지 못했습니다." }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
