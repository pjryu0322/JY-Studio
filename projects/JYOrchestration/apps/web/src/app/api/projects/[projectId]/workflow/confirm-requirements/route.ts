import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { PROJECT_WORKFLOW_REQUIREMENTS_PENDING } from "@/lib/project/projectWorkflowStatus";
import { prisma } from "@/lib/prisma";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { projectMeetsRequirementsAnalysisComplete } from "@/lib/project/requirementsAnalysisGate";

/**
 * 요구사항 분석 필수 항목이 채워진 뒤, 사용자가 「요구사항 확정」을 눌렀을 때만 실행 계획·협업 등 다음 단계로 넘어갑니다.
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
      await requireProjectPermissionById(
        id,
        userId,
        "canGenerateTask",
        "POST workflow/confirm-requirements"
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const row = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        workflowStatus: true,
        description: true,
        specCoreGoals: true,
        specScopeIn: true,
        specScopeOut: true,
        specTargetUsers: true,
        specSuccessCriteria: true,
        confirmedSpecMarkdown: true,
      },
    });
    if (!row) {
      return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    if (row.workflowStatus !== PROJECT_WORKFLOW_REQUIREMENTS_PENDING) {
      const full = await prisma.project.findUnique({ where: { id } });
      return NextResponse.json({
        success: true,
        message: "이미 요구사항이 확정된 상태입니다.",
        data: full,
      });
    }

    const slice = {
      description: row.description,
      specCoreGoals: row.specCoreGoals,
      specScopeIn: row.specScopeIn,
      specScopeOut: row.specScopeOut,
      specTargetUsers: row.specTargetUsers,
      specSuccessCriteria: row.specSuccessCriteria,
      confirmedSpecMarkdown: row.confirmedSpecMarkdown,
    };

    if (!projectMeetsRequirementsAnalysisComplete(slice)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "필수 항목이 모두 채워지지 않았습니다. 개요·목표·범위·사용자/성공 기준을 저장한 뒤 다시 시도해 주세요.",
        },
        { status: 400 }
      );
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { workflowStatus: null },
    });

    return NextResponse.json({
      success: true,
      message: "요구사항이 확정되었습니다. 기능 정리·생성 준비 단계로 진행할 수 있습니다.",
      data: updated,
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST /api/projects/[projectId]/workflow/confirm-requirements error:", error);
    return NextResponse.json(
      { success: false, message: "처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
