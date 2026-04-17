import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { PROJECT_LIFECYCLE_DELETED } from "@/lib/project/projectLifecycle";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { resolveProjectRole } from "@/lib/rbac/resolveProjectRole";
import {
  GIT_APPROVAL_MODE_AUTO_APPLY,
  GIT_APPROVAL_MODE_MANUAL_APPROVAL,
  GIT_APPROVAL_MODE_NO_APPROVAL,
  GIT_PUSH_MODE_AUTO_PUSH,
  GIT_PUSH_MODE_MANUAL_PUSH,
  normalizeGitApprovalModeForStorage,
} from "@/lib/git-apply/retry";
import { prisma } from "@/lib/prisma";
import { findProjectScalarsByIdSafe } from "@/lib/service/projectFindForApi";
import { softDeleteProjectByOwner } from "@/lib/service/projectService";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

/** 승인(gitApprovalMode)과 push(gitPushMode)는 각각 독립 PATCH 가능 */
type PatchBody = { gitApprovalMode?: string; gitPushMode?: string };

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await segmentData.params;
    const id = String(projectId ?? "").trim();
    if (!id) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    const project = await findProjectScalarsByIdSafe(id);
    if (!project) {
      return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    const role = await resolveProjectRole(id, userId);
    if (!role) {
      return NextResponse.json({ success: false, message: "프로젝트 접근 권한이 없습니다." }, { status: 403 });
    }

    if (project.status === PROJECT_LIFECYCLE_DELETED && role !== "OWNER") {
      return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "프로젝트 조회에 성공했습니다.",
      data: project,
    });
  } catch (error) {
    console.error("GET /api/projects/[projectId] error:", error);
    return NextResponse.json(
      { success: false, message: "프로젝트 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await segmentData.params;
    const id = String(projectId ?? "").trim();
    if (!id) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    const result = await softDeleteProjectByOwner(id, userId);
    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
      }
      return NextResponse.json(
        { success: false, message: "프로젝트 소유자만 삭제할 수 있습니다." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.alreadyDeleted ? "이미 삭제된 프로젝트입니다." : "프로젝트가 삭제 처리되었습니다.",
      data: result.project,
    });
  } catch (error) {
    console.error("DELETE /api/projects/[projectId] error:", error);
    return NextResponse.json(
      { success: false, message: "프로젝트 삭제 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

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
