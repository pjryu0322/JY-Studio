import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    const run = await prisma.taskRun.findUnique({
      where: { id: taskRunId },
      select: {
        id: true,
        status: true,
        taskId: true,
        task: {
          select: {
            projectId: true,
          },
        },
      },
    });

    if (!run) {
      return NextResponse.json(
        {
          success: false,
          message: "대상 TaskRun을 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    if (run.status !== "READY_FOR_GIT") {
      return NextResponse.json(
        {
          success: false,
          message: "READY_FOR_GIT 상태의 TaskRun만 요청 등록할 수 있습니다.",
        },
        { status: 400 }
      );
    }

    const saved = await prisma.gitChangeRequest.create({
      data: {
        projectId: run.task.projectId,
        taskId: run.taskId,
        taskRunId: run.id,
        status: "REQUESTED",
      },
      select: {
        id: true,
        projectId: true,
        taskId: true,
        taskRunId: true,
        status: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: saved,
      message: "Git 반영 요청이 등록되었습니다.",
    });
  } catch (error) {
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
