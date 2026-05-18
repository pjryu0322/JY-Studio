import { NextRequest, NextResponse } from "next/server";
import type { ProjectRole } from "@/lib/auth/roles";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { inviteAiProjectMember, requireProjectOwnerMemberAdmin } from "@/lib/service/projectMemberService";
import { createHumanProjectMemberInvite } from "@/lib/service/projectMemberInviteService";
import { parseAiMemberRole, parseOrchestrationStage } from "@/lib/ai-member/aiMemberOrchestration";
import { prisma } from "@/lib/prisma";

type InviteBody = {
  projectId?: string;
  memberType?: "HUMAN" | "AI";
  email?: string;
  userId?: string;
  displayName?: string;
  aiProvider?: string;
  aiAgentKey?: string;
  role?: ProjectRole;
  aiOrchestrationRole?: string;
  orchestrationStage?: string;
  aiModelOverride?: string;
  orchestrationEnabled?: boolean;
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
      const orchRoleRaw = body.aiOrchestrationRole;
      const orchStageRaw = body.orchestrationStage;
      const aiOrchestrationRole =
        orchRoleRaw !== undefined && String(orchRoleRaw).trim()
          ? parseAiMemberRole(orchRoleRaw)
          : null;
      if (orchRoleRaw !== undefined && String(orchRoleRaw).trim() && !aiOrchestrationRole) {
        return NextResponse.json(
          { success: false, message: "aiOrchestrationRole 값이 올바르지 않습니다." },
          { status: 400 }
        );
      }
      const orchestrationStage =
        orchStageRaw !== undefined && String(orchStageRaw).trim()
          ? parseOrchestrationStage(orchStageRaw)
          : null;
      if (orchStageRaw !== undefined && String(orchStageRaw).trim() && !orchestrationStage) {
        return NextResponse.json(
          { success: false, message: "orchestrationStage 값이 올바르지 않습니다." },
          { status: 400 }
        );
      }
      const created = await inviteAiProjectMember({
        projectId,
        displayName,
        role,
        aiProvider: body.aiProvider ?? null,
        aiAgentKey: body.aiAgentKey ?? null,
        aiOrchestrationRole: aiOrchestrationRole ?? undefined,
        orchestrationStage: orchestrationStage ?? undefined,
        aiModelOverride: body.aiModelOverride != null ? String(body.aiModelOverride) : undefined,
        orchestrationEnabled:
          typeof body.orchestrationEnabled === "boolean" ? body.orchestrationEnabled : undefined,
        invitedByUserId: userId,
      });
      return NextResponse.json({
        success: true,
        data: created,
        message: "AI 멤버가 추가되었습니다.",
      });
    }

    const userIdTarget = String(body.userId ?? "").trim();
    let email = String(body.email ?? "").trim().toLowerCase();
    if (userIdTarget) {
      const u = await prisma.user.findUnique({
        where: { id: userIdTarget },
        select: { email: true },
      });
      if (!u?.email) {
        return NextResponse.json({ success: false, message: "선택한 사용자를 찾을 수 없습니다." }, { status: 400 });
      }
      email = u.email.trim().toLowerCase();
    }
    if (!email) {
      return NextResponse.json(
        { success: false, message: "HUMAN 멤버는 이메일 또는 userId가 필요합니다." },
        { status: 400 }
      );
    }
    const inviteResult = await createHumanProjectMemberInvite({
      projectId,
      email,
      role,
      invitedByUserId: userId,
    });
    if (inviteResult.outcome === "USER_NOT_FOUND") {
      return NextResponse.json({
        success: true,
        outcome: "USER_NOT_FOUND",
        message: "가입하지 않은 사용자입니다. 초대 링크를 전달해 주세요.",
      });
    }
    if (inviteResult.outcome === "ALREADY_MEMBER") {
      return NextResponse.json({
        success: true,
        outcome: "ALREADY_MEMBER",
        message: "이미 이 프로젝트의 멤버입니다.",
      });
    }
    return NextResponse.json({
      success: true,
      outcome: "INVITE_SENT",
      message: "프로젝트 초대가 전송되었습니다.",
      data: { inviteId: inviteResult.inviteId, notificationId: inviteResult.notificationId },
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
