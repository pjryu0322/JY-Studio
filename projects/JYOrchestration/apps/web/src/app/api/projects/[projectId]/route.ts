import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  GIT_APPROVAL_MODE_AUTO_APPLY,
  GIT_APPROVAL_MODE_MANUAL_APPROVAL,
  GIT_APPROVAL_MODE_NO_APPROVAL,
  GIT_PUSH_MODE_AUTO_PUSH,
  GIT_PUSH_MODE_MANUAL_PUSH,
  normalizeGitApprovalModeForStorage,
} from "@/lib/git-apply/retry";
import { prisma } from "@/lib/prisma";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

/** 승인(gitApprovalMode)과 push(gitPushMode)는 각각 독립 PATCH 가능 */
type PatchBody = { gitApprovalMode?: string; gitPushMode?: string };

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

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    try {
      await requireProjectPermissionById(
        id,
        userId,
        "canChangeGitPolicy",
        "PATCH /api/projects/[projectId]"
      );
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

    const rawApproval = body.gitApprovalMode;
    const rawPush = body.gitPushMode;
    const hasApproval = rawApproval !== undefined && String(rawApproval).trim() !== "";
    const hasPush = rawPush !== undefined && String(rawPush).trim() !== "";

    if (!hasApproval && !hasPush) {
      return NextResponse.json(
        {
          success: false,
          message: "gitApprovalMode 또는 gitPushMode 중 하나 이상을 지정해야 합니다.",
        },
        { status: 400 }
      );
    }

    const data: { gitApprovalMode?: string; gitPushMode?: string } = {};

    if (hasApproval) {
      const mode = String(rawApproval ?? "").trim();
      if (
        mode !== GIT_APPROVAL_MODE_NO_APPROVAL &&
        mode !== GIT_APPROVAL_MODE_AUTO_APPLY &&
        mode !== GIT_APPROVAL_MODE_MANUAL_APPROVAL
      ) {
        return NextResponse.json(
          {
            success: false,
            message: `gitApprovalMode는 "${GIT_APPROVAL_MODE_NO_APPROVAL}", "${GIT_APPROVAL_MODE_AUTO_APPLY}"(레거시), "${GIT_APPROVAL_MODE_MANUAL_APPROVAL}" 중 하나여야 합니다.`,
          },
          { status: 400 }
        );
      }
      data.gitApprovalMode = normalizeGitApprovalModeForStorage(mode);
    }

    if (hasPush) {
      const pm = String(rawPush ?? "").trim();
      if (pm !== GIT_PUSH_MODE_AUTO_PUSH && pm !== GIT_PUSH_MODE_MANUAL_PUSH) {
        return NextResponse.json(
          {
            success: false,
            message: `gitPushMode는 "${GIT_PUSH_MODE_AUTO_PUSH}" 또는 "${GIT_PUSH_MODE_MANUAL_PUSH}" 이어야 합니다.`,
          },
          { status: 400 }
        );
      }
      data.gitPushMode = pm;
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
      data,
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
