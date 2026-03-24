import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { requireTaskPermission } from "@/lib/service/taskOwnershipGuard";
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
        { success: false, message: "taskId? ?????." },
        { status: 400 }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });

    if (!task) {
      return NextResponse.json(
        { success: false, message: "?? Task? ?? ? ????." },
        { status: 404 }
      );
    }

    if (projectIdParam && projectIdParam !== task.projectId) {
      return NextResponse.json(
        { success: false, message: "projectId? Task? ???? ????." },
        { status: 400 }
      );
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    try {
      await requireTaskPermission(taskId, userId, "canViewExecution", "GET /api/task/history");
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
      { success: false, message: "Task ?? ?? ? ??? ??????." },
      { status: 500 }
    );
  }
}
