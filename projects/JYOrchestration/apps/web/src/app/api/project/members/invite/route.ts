import { NextRequest, NextResponse } from "next/server";
import type { ProjectRole } from "@/lib/auth/roles";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  inviteAiProjectMember,
  inviteHumanProjectMember,
  requireProjectOwnerMemberAdmin,
} from "@/lib/service/projectMemberService";

type InviteBody = {
  projectId?: string;
  memberType?: "HUMAN" | "AI";
  email?: string;
  userId?: string;
  displayName?: string;
  aiProvider?: string;
  aiAgentKey?: string;
  role?: ProjectRole;
};

function normalizeRole(value: unknown): ProjectRole | null {
  const role = String(value ?? "").trim().toUpperCase();
  if (role === "OWNER" || role === "EDITOR" || role === "REVIEWER" || role === "VIEWER") {
    return role;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    const body = (await request.json()) as InviteBody;
    const projectId = String(body.projectId ?? "").trim();
    const memberType = String(body.memberType ?? "HUMAN").trim().toUpperCase() as "HUMAN" | "AI";
    const role = normalizeRole(body.role);
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }
    if (!role) {
      return NextResponse.json({ success: false, message: "role이 올바르지 않습니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/project/members/invite");
      await requireProjectOwnerMemberAdmin(projectId, userId, "POST /api/project/members/invite");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    if (memberType === "AI") {
      const displayName = String(body.displayName ?? "").trim();
      if (!displayName) {
        return NextResponse.json(
          { success: false, message: "AI 멤버는 displayName이 필요합니다." },
          { status: 400 }
        );
      }
      const created = await inviteAiProjectMember({
        projectId,
        displayName,
        role,
        aiProvider: body.aiProvider ?? null,
        aiAgentKey: body.aiAgentKey ?? null,
        invitedByUserId: userId,
      });
      return NextResponse.json({
        success: true,
        data: created,
        message: "AI 멤버가 추가되었습니다.",
      });
    }

    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json(
        { success: false, message: "HUMAN 멤버는 이메일이 필요합니다." },
        { status: 400 }
      );
    }
    const member = await inviteHumanProjectMember({
      projectId,
      email,
      role,
      invitedByUserId: userId,
    });
    return NextResponse.json({
      success: true,
      data: member,
      message: "멤버가 초대(등록)되었습니다.",
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/project/members/invite error:", error);
    return NextResponse.json(
      { success: false, message: "멤버 초대 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
