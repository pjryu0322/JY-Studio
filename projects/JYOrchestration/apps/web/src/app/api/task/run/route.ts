import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type TaskRunBody = {
  taskPromptId?: string;
  action?: string;
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

    const runs = await prisma.taskRun.findMany({
      where: {
        task: {
          projectId,
        },
      },
      orderBy: [{ taskId: "asc" }, { createdAt: "desc" }],
      distinct: ["taskId"],
      select: {
        id: true,
        taskId: true,
        taskPromptId: true,
        status: true,
        resultText: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: runs.map((run) => ({
        ...run,
        createdAt: run.createdAt.toISOString(),
        updatedAt: run.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("GET /api/task/run error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "TaskRun 조회 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TaskRunBody;
    const taskPromptId = String(body.taskPromptId ?? "").trim();
    const action = String(body.action ?? "").trim();

    if (!taskPromptId) {
      return NextResponse.json(
        {
          success: false,
          message: "taskPromptId가 필요합니다.",
        },
        { status: 400 }
      );
    }

    const prompt = await prisma.taskPrompt.findUnique({
      where: { id: taskPromptId },
      select: {
        id: true,
        taskId: true,
      },
    });

    if (!prompt) {
      return NextResponse.json(
        {
          success: false,
          message: "대상 TaskPrompt를 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    if (action === "mark-ready-for-git") {
      const latestRun = await prisma.taskRun.findFirst({
        where: {
          taskPromptId: prompt.id,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (!latestRun) {
        return NextResponse.json(
          {
            success: false,
            message: "READY_FOR_GIT 전환 대상 Run이 없습니다.",
          },
          { status: 404 }
        );
      }

      if (latestRun.status !== "DONE" && latestRun.status !== "READY_FOR_GIT") {
        return NextResponse.json(
          {
            success: false,
            message: "DONE 상태 Run만 READY_FOR_GIT로 전환할 수 있습니다.",
          },
          { status: 400 }
        );
      }

      const updated = await prisma.taskRun.update({
        where: { id: latestRun.id },
        data: {
          status: "READY_FOR_GIT",
          resultText: latestRun.resultText || "Mock 실행 완료",
        },
        select: {
          id: true,
          taskId: true,
          taskPromptId: true,
          status: true,
          resultText: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          ...updated,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
        message: "TaskRun이 READY_FOR_GIT 상태로 전환되었습니다.",
      });
    }

    const run = await prisma.taskRun.create({
      data: {
        taskId: prompt.taskId,
        taskPromptId: prompt.id,
        status: "PENDING",
      },
    });

    const completed = await prisma.taskRun.update({
      where: { id: run.id },
      data: {
        status: "DONE",
        resultText: "Mock 실행 완료",
      },
      select: {
        id: true,
        taskId: true,
        taskPromptId: true,
        status: true,
        resultText: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...completed,
        createdAt: completed.createdAt.toISOString(),
        updatedAt: completed.updatedAt.toISOString(),
      },
      message: "Task mock 실행이 완료되었습니다.",
    });
  } catch (error) {
    console.error("POST /api/task/run error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Task mock 실행 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
