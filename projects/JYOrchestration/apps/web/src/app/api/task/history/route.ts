import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/requestUser";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { requireProjectMember } from "@/lib/service/projectAccessGuard";
import {
  listTaskHistoryByTaskId,
  serializeTaskHistoryRow,
} from "@/lib/service/taskHistoryService";

export async function GET(request: NextRequest) {
  try {
    const taskId = request.nextUrl.searchParams.get("taskId")?.trim() || "";
    const projectIdParam = request.nextUrl.searchParams.get("projectId")?.trim() || "";

    if (!taskId) {
      return NextResponse.json(
        { success: false, message: "taskId가 필요합니다." },
        { status: 400 }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });

    if (!task) {
      return NextResponse.json(
        { success: false, message: "대상 Task를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (projectIdParam && projectIdParam !== task.projectId) {
      return NextResponse.json(
        { success: false, message: "projectId가 Task와 일치하지 않습니다." },
        { status: 400 }
      );
    }

    const projectId = task.projectId;
    const userId = getCurrentUserIdFromRequest(request);
    try {
      await requireProjectMember(projectId, userId);
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const rows = await listTaskHistoryByTaskId(taskId);

    return NextResponse.json({
      success: true,
      data: rows.map(serializeTaskHistoryRow),
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("GET /api/task/history error:", error);
    return NextResponse.json(
      { success: false, message: "Task 이력 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
