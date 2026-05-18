import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { ensureDefaultAiPlannerProjectMember, requireProjectOwnerMemberAdmin } from "@/lib/service/projectMemberService";
import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import { prisma } from "@/lib/prisma";

type Body = { projectId?: string };

/**
 * 아이디어 구체화 등에서 spec 단계 기본 AI(planner) 멤버가 없을 때 보강합니다.
 * 멤버 초대와 동일하게 프로젝트 OWNER만 호출할 수 있습니다.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/project/members/ensure-default-planner");
      await requireProjectOwnerMemberAdmin(projectId, userId, "POST /api/project/members/ensure-default-planner");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    await prisma.$transaction(async (tx) => {
      await ensureDefaultAiPlannerProjectMember(tx, { projectId, invitedByUserId: userId });
    });

    const plannerTitle = getWorkspaceAiMember("ideation")?.title ?? "AI 기획자";
    return NextResponse.json({ success: true, message: `기본 ${plannerTitle} 멤버가 준비되었습니다.` });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/project/members/ensure-default-planner error:", error);
    return NextResponse.json(
      {
        success: false,
        message: `기본 ${getWorkspaceAiMember("ideation")?.title ?? "AI 기획자"} 멤버를 준비하는 중 오류가 발생했습니다.`,
      },
      { status: 500 }
    );
  }
}
