import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { mergeRequirementsStateJson, parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import type { Prisma } from "@prisma/client";

type RouteContext = { readonly params: Promise<{ projectId: string }> };

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(_request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(pid, userId, "canEditProject", "DELETE reference-selection");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const row = await prisma.project.findUnique({
      where: { id: pid },
      select: { requirementsStateJson: true },
    });
    const state = parseRequirementsStateJson(row?.requirementsStateJson);
    const next = mergeRequirementsStateJson(state, {
      referenceSelectionV1: null,
      referenceSelectionSummaryV1: null,
    });

    await prisma.project.update({
      where: { id: pid },
      data: { requirementsStateJson: next as Prisma.InputJsonValue },
    });

    return NextResponse.json({
      success: true,
      message: "참조 프로젝트 선택을 해제했습니다.",
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("DELETE reference-selection error:", error);
    return NextResponse.json({ success: false, message: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
