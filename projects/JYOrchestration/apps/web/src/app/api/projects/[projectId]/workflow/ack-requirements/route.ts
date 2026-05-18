import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { PROJECT_WORKFLOW_REQUIREMENTS_PENDING } from "@/lib/project/projectWorkflowStatus";
import { prisma } from "@/lib/prisma";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { isServerDevWorkflowToolsEnabled } from "@/lib/env/devWorkflowTools";

/**
 * 요구사항 단계 강제 해제(개발 전용). 일반 사용자 UI에서는 노출하지 않습니다.
 * REQUIREMENTS_PENDING 일 때만 null 로 해제한다.
 */
export async function POST(
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

    try {
      await requireProjectPermissionById(id, userId, "canViewProject", "POST workflow/ack-requirements");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const row = await prisma.project.findUnique({
      where: { id },
      select: { id: true, workflowStatus: true },
    });
    if (!row) {
      return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    if (row.workflowStatus !== PROJECT_WORKFLOW_REQUIREMENTS_PENDING) {
      const full = await prisma.project.findUnique({ where: { id } });
      return NextResponse.json({
        success: true,
        message: "이미 다음 단계로 진행할 수 있는 상태입니다.",
        data: full,
      });
    }

    if (!isServerDevWorkflowToolsEnabled()) {
      return NextResponse.json(
        {
          success: false,
          message: "요구사항 분석을 완료한 뒤 실행 계획으로 이동할 수 있습니다. (개발 전용 강제 해제는 JY_DEV_WORKFLOW_TOOLS=1)",
        },
        { status: 403 }
      );
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { workflowStatus: null },
    });

    return NextResponse.json({
      success: true,
      message: "요구사항 단계를 완료했습니다. 실행 계획으로 이동할 수 있습니다.",
      data: updated,
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST /api/projects/[projectId]/workflow/ack-requirements error:", error);
    return NextResponse.json(
      { success: false, message: "처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
