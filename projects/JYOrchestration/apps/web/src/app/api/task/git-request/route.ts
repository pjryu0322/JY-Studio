import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import {
  requireExecutionPipelineRead,
} from "@/lib/service/projectAccessGuard";
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
          message: "projectId가 필요합니다.",
        },
        { status: 400 }
      );
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    try {
      await requireExecutionPipelineRead(projectId, userId);
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
        message: "Git 반영 요청 목록 조회 중 오류가 발생했습니다.",
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
          message: "taskRunId가 필요합니다.",
        },
        { status: 400 }
      );
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
      message: "Git 반영 요청이 등록되었습니다.",
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
        message: "Git 반영 요청 등록 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
