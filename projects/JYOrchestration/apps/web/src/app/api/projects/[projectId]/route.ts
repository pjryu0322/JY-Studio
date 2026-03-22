import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/requestUser";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  GIT_APPROVAL_MODE_AUTO_APPLY,
  GIT_APPROVAL_MODE_MANUAL_APPROVAL,
} from "@/lib/git-apply/retry";
import { prisma } from "@/lib/prisma";
import { requireProjectGitApprovalModeUpdate } from "@/lib/service/projectAccessGuard";

type PatchBody = { gitApprovalMode?: string };

export async function PATCH(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await segmentData.params;
    const id = String(projectId ?? "").trim();
    if (!id) {
      return NextResponse.json(
        { success: false, message: "projectId가 필요합니다." },
        { status: 400 }
      );
    }

    const userId = getCurrentUserIdFromRequest(request);
    try {
      await requireProjectGitApprovalModeUpdate(id, userId);
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    let body: PatchBody;
    try {
      body = (await request.json()) as PatchBody;
    } catch {
      return NextResponse.json(
        { success: false, message: "요청 본문이 올바른 JSON이 아닙니다." },
        { status: 400 }
      );
    }

    const mode = String(body.gitApprovalMode ?? "").trim();
    if (mode !== GIT_APPROVAL_MODE_AUTO_APPLY && mode !== GIT_APPROVAL_MODE_MANUAL_APPROVAL) {
      return NextResponse.json(
        {
          success: false,
          message: `gitApprovalMode는 "${GIT_APPROVAL_MODE_AUTO_APPLY}" 또는 "${GIT_APPROVAL_MODE_MANUAL_APPROVAL}" 이어야 합니다.`,
        },
        { status: 400 }
      );
    }

    const existing = await prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "프로젝트를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { gitApprovalMode: mode },
    });

    return NextResponse.json({
      success: true,
      message: "Git 반영 정책이 저장되었습니다.",
      data: updated,
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("PATCH /api/projects/[projectId] error:", error);
    return NextResponse.json(
      { success: false, message: "프로젝트 설정 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
