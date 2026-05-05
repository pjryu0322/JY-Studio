import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { deleteWorkNoteForOwner, getWorkNoteProjectIdForUser, patchWorkNoteForOwner } from "@/lib/service/workNoteService";

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const { id } = await ctx.params;
  const noteId = String(id ?? "").trim();
  if (!noteId) {
    return NextResponse.json({ success: false, message: "id가 필요합니다." }, { status: 400 });
  }

  let body: { title?: string; content?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }
  if (typeof body.title !== "string" || typeof body.content !== "string") {
    return NextResponse.json({ success: false, message: "title·content(문자열)가 필요합니다." }, { status: 400 });
  }

  const existing = await getWorkNoteProjectIdForUser(noteId, userId);
  if (!existing) {
    return NextResponse.json({ success: false, message: "메모를 찾을 수 없습니다." }, { status: 404 });
  }

  const proj = existing.projectId?.trim() ?? "";
  if (proj) {
    try {
      await requireProjectPermission(proj, userId, "canViewProject", "PATCH /api/work-notes/[id]");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }
  }

  const note = await patchWorkNoteForOwner({ id: noteId, userId, title: body.title, content: body.content });
  if (!note) {
    return NextResponse.json({ success: false, message: "메모를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: { note } });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const { id } = await ctx.params;
  const noteId = String(id ?? "").trim();
  if (!noteId) {
    return NextResponse.json({ success: false, message: "id가 필요합니다." }, { status: 400 });
  }

  const existing = await getWorkNoteProjectIdForUser(noteId, userId);
  if (!existing) {
    return NextResponse.json({ success: false, message: "메모를 찾을 수 없습니다." }, { status: 404 });
  }

  const proj = existing.projectId?.trim() ?? "";
  if (proj) {
    try {
      await requireProjectPermission(proj, userId, "canViewProject", "DELETE /api/work-notes/[id]");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }
  }

  const ok = await deleteWorkNoteForOwner({ id: noteId, userId });
  if (!ok) {
    return NextResponse.json({ success: false, message: "메모를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: { deleted: true } });
}
