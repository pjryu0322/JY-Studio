import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { requireProjectOwnerMemberAdmin } from "@/lib/service/projectMemberService";
import { ensureStage2DefaultAiMembers } from "@/lib/service/stage2DefaultAiMembersService";

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await segmentData.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(pid, userId, "canViewProject", "POST stage2-default-ai-members");
      await requireProjectOwnerMemberAdmin(pid, userId, "POST stage2-default-ai-members");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const r = await ensureStage2DefaultAiMembers({ projectId: pid, actorUserId: userId });
    return NextResponse.json({
      success: true,
      data: r,
      message:
        r.created.length > 0
          ? `기본 AI 멤버 ${r.created.length}명을 추가했습니다.`
          : "추가할 기본 멤버가 없습니다(이미 등록됨).",
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST /api/projects/[projectId]/stage2-default-ai-members error:", error);
    return NextResponse.json({ success: false, message: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
