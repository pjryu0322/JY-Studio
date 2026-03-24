import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { RolePermissions, type ProjectRole } from "@/lib/auth/roles";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { resolveProjectRole } from "@/lib/rbac/resolveProjectRole";
import { listProjectMembers } from "@/lib/service/projectMemberService";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    const projectId = request.nextUrl.searchParams.get("projectId")?.trim() || "";
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(projectId, userId, "canViewProject", "GET /api/project/session-context");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const myRole = (await resolveProjectRole(projectId, userId)) as ProjectRole | null;
    const rows = await listProjectMembers(projectId);
    const projectRow = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerUserId: true },
    });
    const ownerUserId = projectRow?.ownerUserId ?? "";

    return NextResponse.json({
      success: true,
      data: {
        myRole,
        permissions: myRole ? RolePermissions[myRole] : null,
        ownerUserId,
        isProjectOwner: ownerUserId === userId,
        canManageMembers: myRole === "OWNER",
        currentUserId: userId,
        members: rows.map((m) => ({
          memberId: m.memberId,
          userId: m.userId,
          displayName: m.displayName,
          role: m.role,
          memberType: m.memberType,
          aiProvider: m.aiProvider,
          aiAgentKey: m.aiAgentKey,
          isOwner: m.isOwner,
          canManageMembers: myRole === "OWNER",
        })),
      },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("GET /api/project/session-context error:", error);
    return NextResponse.json(
      { success: false, message: "세션 컨텍스트를 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
