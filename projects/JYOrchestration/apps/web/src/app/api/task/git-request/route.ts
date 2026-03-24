import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { createGitChangeRequestForTaskRun } from "@/lib/service/gitChangeRequestFromTaskRun";

type CreateGitRequestBody = {
  taskRunId?: string;
};

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId")?.trim() || "";
    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          message: "projectId가 ?�요?�니??",
        },
        { status: 400 }
      );
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    try {
      await requireProjectPermissionById(projectId, userId, "canViewProject", "GET /api/task/git-request");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const requests = await prisma.gitChangeRequest.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        projectId: true,
        taskId: true,
        taskRunId: true,
        status: true,
        requestNote: true,
        files: true,
        diffText: true,
        commitMessage: true,
        applyStatus: true,
        applyLog: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: requests.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("GET /api/task/git-request error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Git 반영 ?�청 목록 조회 �??�류가 발생?�습?�다.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    const body = (await request.json()) as CreateGitRequestBody;
    const taskRunId = String(body.taskRunId ?? "").trim();
    if (!taskRunId) {
      return NextResponse.json(
        {
          success: false,
          message: "taskRunId가 ?�요?�니??",
        },
        { status: 400 }
      );
    }

    const runRow = await prisma.taskRun.findUnique({
      where: { id: taskRunId },
      select: { task: { select: { projectId: true } } },
    });
    if (!runRow) {
      return NextResponse.json(
        { success: false, message: "?�??TaskRun??찾을 ???�습?�다." },
        { status: 404 }
      );
    }

    try {
      await requireProjectPermissionById(
        runRow.task.projectId,
        userId,
        "canRegisterGitRequest",
        "POST /api/task/git-request"
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const result = await createGitChangeRequestForTaskRun({
      taskRunId,
      actorUserId: userId,
      source: "api",
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          code: result.code,
          message: result.message,
        },
        { status: result.httpStatus }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: "Git 반영 ?�청???�록?�었?�니??",
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/task/git-request error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Git 반영 ?�청 ?�록 �??�류가 발생?�습?�다.",
      },
      { status: 500 }
    );
  }
}
