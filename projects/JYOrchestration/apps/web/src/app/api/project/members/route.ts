import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { listProjectMembers } from "@/lib/service/projectMemberService";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId")?.trim() || "";
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    try {
      await requireProjectPermission(projectId, userId, "canViewProject", "GET /api/project/members");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const members = await listProjectMembers(projectId);
    return NextResponse.json({
      success: true,
      data: members.map((m) => ({
        memberId: m.memberId,
        projectId: m.projectId,
        userId: m.userId,
        email: m.email,
        displayName: m.displayName,
        role: m.role,
        memberType: m.memberType,
        aiProvider: m.aiProvider,
        aiAgentKey: m.aiAgentKey,
        invitedByUserId: m.invitedByUserId,
        invitedByName: m.invitedByName,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
        isOwner: m.isOwner,
      })),
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("GET /api/project/members error:", error);
    return NextResponse.json(
      { success: false, message: "프로젝트 멤버 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
