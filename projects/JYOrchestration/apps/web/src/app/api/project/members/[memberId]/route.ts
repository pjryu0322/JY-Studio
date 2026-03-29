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
import {
  parseProjectAiActionApprovalMode,
  parseProjectAiActionApplyMode,
} from "@/lib/ai-member/aiMemberActionApprovalPolicy";
import { parseAiMemberRole, parseOrchestrationStage } from "@/lib/ai-member/aiMemberOrchestration";

type PatchBody = {
  role?: ProjectRole;
  displayName?: string;
  aiOrchestrationRole?: string | null;
  orchestrationStage?: string | null;
  aiModelOverride?: string | null;
  orchestrationEnabled?: boolean;
  aiActionApprovalModeOverride?: string | null;
  aiActionApplyModeOverride?: string | null;
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
      select: { projectId: true, userId: true, role: true, memberType: true },
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

    if (target.memberType !== "AI") {
      if (
        body.aiOrchestrationRole !== undefined ||
        body.orchestrationStage !== undefined ||
        body.aiModelOverride !== undefined ||
        body.orchestrationEnabled !== undefined ||
        body.aiActionApprovalModeOverride !== undefined ||
        body.aiActionApplyModeOverride !== undefined
      ) {
        return NextResponse.json(
          { success: false, message: "오케스트레이션·AI 액션 정책 필드는 AI 멤버만 수정할 수 있습니다." },
          { status: 400 }
        );
      }
    }

    let aiOrchestrationRole: string | null | undefined;
    if (body.aiOrchestrationRole !== undefined) {
      if (body.aiOrchestrationRole === null || String(body.aiOrchestrationRole).trim() === "") {
        aiOrchestrationRole = null;
      } else {
        const parsed = parseAiMemberRole(body.aiOrchestrationRole);
        if (!parsed) {
          return NextResponse.json(
            { success: false, message: "aiOrchestrationRole 값이 올바르지 않습니다." },
            { status: 400 }
          );
        }
        aiOrchestrationRole = parsed;
      }
    }

    let aiActionApprovalModeOverride: ReturnType<typeof parseProjectAiActionApprovalMode> | null | undefined;
    if (body.aiActionApprovalModeOverride !== undefined) {
      const raw = body.aiActionApprovalModeOverride;
      if (raw === null || String(raw).trim() === "") {
        aiActionApprovalModeOverride = null;
      } else {
        const parsed = parseProjectAiActionApprovalMode(raw);
        if (!parsed) {
          return NextResponse.json(
            { success: false, message: "aiActionApprovalModeOverride 값이 올바르지 않습니다." },
            { status: 400 }
          );
        }
        aiActionApprovalModeOverride = parsed;
      }
    }

    let aiActionApplyModeOverride: ReturnType<typeof parseProjectAiActionApplyMode> | null | undefined;
    if (body.aiActionApplyModeOverride !== undefined) {
      const raw = body.aiActionApplyModeOverride;
      if (raw === null || String(raw).trim() === "") {
        aiActionApplyModeOverride = null;
      } else {
        const parsed = parseProjectAiActionApplyMode(raw);
        if (!parsed) {
          return NextResponse.json(
            { success: false, message: "aiActionApplyModeOverride 값이 올바르지 않습니다." },
            { status: 400 }
          );
        }
        aiActionApplyModeOverride = parsed;
      }
    }

    let orchestrationStage: string | null | undefined;
    if (body.orchestrationStage !== undefined) {
      if (body.orchestrationStage === null || String(body.orchestrationStage).trim() === "") {
        orchestrationStage = null;
      } else {
        const parsed = parseOrchestrationStage(body.orchestrationStage);
        if (!parsed) {
          return NextResponse.json(
            { success: false, message: "orchestrationStage 값이 올바르지 않습니다." },
            { status: 400 }
          );
        }
        orchestrationStage = parsed;
      }
    }

    const updated = await updateProjectMember({
      memberId,
      role: role ?? undefined,
      displayName: body.displayName,
      ...(target.memberType === "AI"
        ? {
            ...(aiOrchestrationRole !== undefined ? { aiOrchestrationRole } : {}),
            ...(orchestrationStage !== undefined ? { orchestrationStage } : {}),
            ...(body.aiModelOverride !== undefined
              ? {
                  aiModelOverride:
                    body.aiModelOverride === null || !String(body.aiModelOverride).trim()
                      ? null
                      : String(body.aiModelOverride).trim(),
                }
              : {}),
            ...(body.orchestrationEnabled !== undefined
              ? { orchestrationEnabled: body.orchestrationEnabled }
              : {}),
            ...(aiActionApprovalModeOverride !== undefined
              ? { aiActionApprovalModeOverride }
              : {}),
            ...(aiActionApplyModeOverride !== undefined ? { aiActionApplyModeOverride } : {}),
          }
        : {}),
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
