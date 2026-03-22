import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/requestUser";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { requireTaskGenerate } from "@/lib/service/projectAccessGuard";
import { reorderTasksInProject } from "@/lib/service/taskService";

type ReorderBody = {
  projectId?: string;
  /** Preferred: full permutation of task ids in new order */
  orderedTaskIds?: string[];
  /** @deprecated use orderedTaskIds */
  taskIds?: string[];
};

function normalizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((id) => String(id ?? "").trim()).filter((id) => id.length > 0);
}

export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserIdFromRequest(request);
    const body = (await request.json()) as ReorderBody;
    const projectId = String(body.projectId ?? "").trim();
    const orderedTaskIds =
      normalizeIdList(body.orderedTaskIds).length > 0
        ? normalizeIdList(body.orderedTaskIds)
        : normalizeIdList(body.taskIds);

    if (!projectId) {
      return NextResponse.json(
        { success: false, message: "projectId가 필요합니다." },
        { status: 400 }
      );
    }
    if (orderedTaskIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "orderedTaskIds 배열이 필요합니다." },
        { status: 400 }
      );
    }

    try {
      await requireTaskGenerate(projectId, userId);
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const result = await reorderTasksInProject(projectId, orderedTaskIds, { actorUserId: userId });
    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }

    const tasks = await prisma.task.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        projectId: true,
        projectSpecUploadId: true,
        name: true,
        description: true,
        status: true,
        order: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: tasks.map((task) => ({
        ...task,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      })),
      message: "Task 순서가 저장되었습니다.",
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/task/reorder error:", error);
    return NextResponse.json(
      { success: false, message: "Task 순서 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
