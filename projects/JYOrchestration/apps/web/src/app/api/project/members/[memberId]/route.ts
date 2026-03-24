import { NextRequest, NextResponse } from "next/server";
import type { ProjectRole } from "@/lib/auth/roles";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import {
  deleteProjectMember,
  requireProjectOwnerMemberAdmin,
  updateProjectMember,
} from "@/lib/service/projectMemberService";

type PatchBody = {
  role?: ProjectRole;
  displayName?: string;
};

function normalizeRole(value: unknown): ProjectRole | null {
  const role = String(value ?? "").trim().toUpperCase();
  if (role === "OWNER" || role === "EDITOR" || role === "REVIEWER" || role === "VIEWER") {
    return role;
  }
  return null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    const { memberId } = await context.params;
    const body = (await request.json()) as PatchBody;
    const target = await prisma.projectMember.findUnique({
      where: { id: memberId },
      select: { projectId: true, userId: true, role: true },
    });
    if (!target) {
      return NextResponse.json({ success: false, message: "멤버를 찾을 수 없습니다." }, { status: 404 });
    }

    try {
      await requireProjectOwnerMemberAdmin(target.projectId, userId, "PATCH /api/project/members/[memberId]");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const project = await prisma.project.findUnique({
      where: { id: target.projectId },
      select: { ownerUserId: true },
    });
    if (project?.ownerUserId && target.userId === project.ownerUserId && body.role && body.role !== "OWNER") {
      return NextResponse.json(
        { success: false, message: "프로젝트 실소유자 역할은 OWNER로 유지되어야 합니다." },
        { status: 400 }
      );
    }

    const role = body.role === undefined ? undefined : normalizeRole(body.role);
    if (body.role !== undefined && !role) {
      return NextResponse.json({ success: false, message: "유효하지 않은 role 입니다." }, { status: 400 });
    }

    const updated = await updateProjectMember({
      memberId,
      role: role ?? undefined,
      displayName: body.displayName,
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("PATCH /api/project/members/[memberId] error:", error);
    return NextResponse.json(
      { success: false, message: "멤버 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    const { memberId } = await context.params;
    const target = await prisma.projectMember.findUnique({
      where: { id: memberId },
      select: { projectId: true, userId: true },
    });
    if (!target) {
      return NextResponse.json({ success: false, message: "멤버를 찾을 수 없습니다." }, { status: 404 });
    }
    try {
      await requireProjectOwnerMemberAdmin(target.projectId, userId, "DELETE /api/project/members/[memberId]");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const project = await prisma.project.findUnique({
      where: { id: target.projectId },
      select: { ownerUserId: true },
    });
    if (project?.ownerUserId === target.userId) {
      return NextResponse.json(
        { success: false, message: "프로젝트 실소유자 멤버는 제거할 수 없습니다." },
        { status: 400 }
      );
    }
    if (target.userId === userId) {
      return NextResponse.json(
        { success: false, message: "자기 자신의 OWNER 멤버를 제거할 수 없습니다." },
        { status: 400 }
      );
    }

    await deleteProjectMember({ memberId });
    return NextResponse.json({ success: true });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("DELETE /api/project/members/[memberId] error:", error);
    return NextResponse.json(
      { success: false, message: "멤버 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
