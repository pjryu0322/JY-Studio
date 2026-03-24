import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { resolveProjectRole } from "@/lib/rbac/resolveProjectRole";
import { requireProjectOwnedByUser } from "@/lib/service/taskOwnershipGuard";
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
      await requireProjectOwnedByUser(projectId, userId, "GET /api/project/session-context");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const myRole = await resolveProjectRole(projectId, userId);
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
        ownerUserId,
        isProjectOwner: ownerUserId === userId,
        members: rows.map((m) => ({ userId: m.userId, role: m.role })),
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
