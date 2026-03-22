import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/requestUser";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import {
  requireExecutionPipelineRead,
  requireGitChangeRequestCreate,
} from "@/lib/service/projectAccessGuard";

type CreateGitRequestBody = {
  taskRunId?: string;
};

type MockFileChange = {
  path: string;
  type: "MODIFY" | "CREATE";
};

function buildMockFileChanges(): MockFileChange[] {
  return [
    {
      path: "apps/web/src/app/page.tsx",
      type: "MODIFY",
    },
    {
      path: "apps/web/src/app/projects/[projectId]/page.tsx",
      type: "MODIFY",
    },
  ];
}

function buildMockDiff(taskId: string, resultText: string | null): string {
  const summary = (resultText || "Mock 실행 결과를 기반으로 코드 변경안을 구성합니다.").slice(0, 140);
  return [
    "--- a/page.tsx",
    "+++ b/page.tsx",
    "@@ -1,3 +1,6 @@",
    `+// taskId: ${taskId}`,
    `+// source summary: ${summary}`,
    '+console.log("task applied");',
    "",
  ].join("\n");
}

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

    const userId = getCurrentUserIdFromRequest(request);
    await requireExecutionPipelineRead(projectId, userId);

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
    const userId = getCurrentUserIdFromRequest(request);
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
        resultText: true,
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

    await requireGitChangeRequestCreate(run.task.projectId, userId);

    const files = buildMockFileChanges();
    const diffText = buildMockDiff(run.taskId, run.resultText);
    const commitMessage = `feat: apply task ${run.taskId}`;

    const saved = await prisma.gitChangeRequest.create({
      data: {
        projectId: run.task.projectId,
        taskId: run.taskId,
        taskRunId: run.id,
        status: "REQUESTED",
        files,
        diffText,
        commitMessage,
        applyStatus: "PENDING",
      },
      select: {
        id: true,
        projectId: true,
        taskId: true,
        taskRunId: true,
        status: true,
        files: true,
        diffText: true,
        commitMessage: true,
        applyStatus: true,
        applyLog: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: saved,
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
