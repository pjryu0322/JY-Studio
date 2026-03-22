import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentUserIdFromRequest } from "@/lib/auth/requestUser";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { TaskHistoryActorType, TaskHistoryEventType } from "@/lib/history/taskHistoryConstants";
import type { TaskRunExecutionResult } from "@/lib/integration/taskRunResultTypes";
import { taskRunExecutionResultToStoredJson } from "@/lib/integration/taskRunResultTypes";
import { prisma } from "@/lib/prisma";
import {
  createGitChangeRequestFromExecutionResult,
  GIT_CHANGE_REQUEST_FROM_RUN_CODES,
} from "@/lib/service/gitChangeRequestFromTaskRun";
import {
  requireExecutionPipelineRead,
  requireReadyForGitTransition,
  requireTaskRun,
} from "@/lib/service/projectAccessGuard";
import { appendTaskHistory } from "@/lib/service/taskHistoryService";
import {
  isRunExecutionConflictError,
  RunExecutionConflictError,
} from "@/lib/production/runExecutionErrors";

type TaskRunBody = {
  taskPromptId?: string;
  taskId?: string;
  action?: string;
};

function serializeTaskRunRow<T extends { createdAt: Date; updatedAt: Date }>(row: T) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
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
    try {
      await requireExecutionPipelineRead(projectId, userId);
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
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
        resultJson: true,
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
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
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
    const userId = getCurrentUserIdFromRequest(request);
    const body = (await request.json()) as TaskRunBody;
    const taskPromptId = String(body.taskPromptId ?? "").trim();
    const taskIdForAction = String(body.taskId ?? "").trim();
    const action = String(body.action ?? "").trim();

    if (action === "force-fail-latest") {
      if (!taskIdForAction) {
        return NextResponse.json(
          { success: false, message: "taskId가 필요합니다." },
          { status: 400 }
        );
      }

      const task = await prisma.task.findUnique({
        where: { id: taskIdForAction },
        select: { id: true, projectId: true },
      });

      if (!task) {
        return NextResponse.json(
          { success: false, message: "대상 Task를 찾을 수 없습니다." },
          { status: 404 }
        );
      }

      const projectId = task.projectId;

      try {
        await requireTaskRun(projectId, userId);
      } catch (error) {
        const denied = rbacErrorResponse(error);
        if (denied) {
          return denied;
        }
        throw error;
      }

      const latestRun = await prisma.taskRun.findFirst({
        where: { taskId: task.id },
        orderBy: { createdAt: "desc" },
      });

      if (!latestRun) {
        return NextResponse.json(
          { success: false, message: "실패 처리할 TaskRun이 없습니다." },
          { status: 404 }
        );
      }

      if (latestRun.status === "FAILED") {
        return NextResponse.json(
          { success: false, message: "이미 FAILED 상태입니다." },
          { status: 400 }
        );
      }

      const linkedGit = await prisma.gitChangeRequest.findFirst({
        where: { taskRunId: latestRun.id },
        select: { id: true },
      });

      if (linkedGit) {
        return NextResponse.json(
          {
            success: false,
            message: "Git 반영 요청과 연결된 Run은 강제 실패할 수 없습니다.",
          },
          { status: 400 }
        );
      }

      const updated = await prisma.taskRun.update({
        where: { id: latestRun.id },
        data: {
          status: "FAILED",
          resultText: "[FORCE_FAIL] 운영자 강제 실패",
          resultJson: {
            success: false,
            mode: "force-fail",
            updatedFiles: [],
            commitMessage: null,
            logs: [],
            error: "운영자 강제 실패",
          } as Prisma.InputJsonValue,
        },
        select: {
          id: true,
          taskId: true,
          taskPromptId: true,
          status: true,
          resultText: true,
          resultJson: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      try {
        await appendTaskHistory({
          projectId,
          taskId: task.id,
          actorType: TaskHistoryActorType.USER,
          actorId: userId,
          eventType: TaskHistoryEventType.RUN_FAILED,
          summary: "Task 실행 강제 실패(운영자)",
          detailJson: {
            taskRunId: updated.id,
            taskPromptId: updated.taskPromptId,
            mode: "force-fail-latest",
          },
        });
      } catch (historyError) {
        console.error("RUN_FAILED (force) history append failed:", historyError);
      }

      return NextResponse.json({
        success: true,
        data: serializeTaskRunRow(updated),
        message: "최신 TaskRun을 FAILED로 전환했습니다.",
      });
    }

    if (action === "abort-run") {
      if (!taskPromptId) {
        return NextResponse.json(
          { success: false, message: "taskPromptId가 필요합니다." },
          { status: 400 }
        );
      }

      const promptForAbort = await prisma.taskPrompt.findUnique({
        where: { id: taskPromptId },
        select: {
          id: true,
          taskId: true,
          task: { select: { projectId: true } },
        },
      });

      if (!promptForAbort) {
        return NextResponse.json(
          { success: false, message: "대상 TaskPrompt를 찾을 수 없습니다." },
          { status: 404 }
        );
      }

      const abortProjectId = promptForAbort.task.projectId;

      try {
        await requireTaskRun(abortProjectId, userId);
      } catch (error) {
        const denied = rbacErrorResponse(error);
        if (denied) {
          return denied;
        }
        throw error;
      }

      const pendingRun = await prisma.taskRun.findFirst({
        where: {
          taskPromptId: promptForAbort.id,
          status: "PENDING",
        },
        orderBy: { createdAt: "desc" },
      });

      if (!pendingRun) {
        return NextResponse.json(
          {
            success: false,
            message: "중단할 PENDING 상태 실행이 없습니다.",
          },
          { status: 400 }
        );
      }

      const [aborted] = await prisma.$transaction([
        prisma.taskRun.update({
          where: { id: pendingRun.id },
          data: {
            status: "FAILED",
            resultText: "[ABORTED] 사용자 실행 중단",
            resultJson: {
              success: false,
              mode: "abort-run",
              updatedFiles: [],
              commitMessage: null,
              logs: [],
              error: "사용자 실행 중단",
            } as Prisma.InputJsonValue,
          },
          select: {
            id: true,
            taskId: true,
            taskPromptId: true,
            status: true,
            resultText: true,
            resultJson: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.task.update({
          where: { id: promptForAbort.taskId },
          data: { status: "CANCELLED" },
          select: { id: true },
        }),
      ]);

      try {
        await appendTaskHistory({
          projectId: abortProjectId,
          taskId: promptForAbort.taskId,
          actorType: TaskHistoryActorType.USER,
          actorId: userId,
          eventType: TaskHistoryEventType.MANUAL_CANCELLED,
          summary: "Task 실행 중단(취소)",
          detailJson: {
            taskRunId: aborted.id,
            taskPromptId: promptForAbort.id,
            mode: "abort-run",
            taskStatusAfter: "CANCELLED",
          },
        });
      } catch (historyError) {
        console.error("MANUAL_CANCELLED (abort) history append failed:", historyError);
      }

      return NextResponse.json({
        success: true,
        data: serializeTaskRunRow(aborted),
        message: "실행이 중단(FAILED) 처리되었습니다.",
      });
    }

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
        task: {
          select: {
            projectId: true,
            project: { select: { autoCreateGitRequest: true } },
          },
        },
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

    const projectId = prompt.task.projectId;

    if (action === "mark-ready-for-git") {
      try {
        await requireReadyForGitTransition(projectId, userId);
      } catch (error) {
        const denied = rbacErrorResponse(error);
        if (denied) {
          return denied;
        }
        throw error;
      }
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
          resultJson: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await prisma.task.update({
        where: { id: prompt.taskId },
        data: { status: "DONE" },
      });

      try {
        await appendTaskHistory({
          projectId,
          taskId: prompt.taskId,
          actorType: TaskHistoryActorType.USER,
          actorId: userId,
          eventType: TaskHistoryEventType.MANUAL_APPROVED,
          summary: "Git 반영 준비 승인(READY_FOR_GIT)",
          detailJson: {
            taskRunId: updated.id,
            taskPromptId: prompt.id,
            mode: "mark-ready-for-git",
          },
        });
      } catch (historyError) {
        console.error("MANUAL_APPROVED (mark-ready) history append failed:", historyError);
      }

      return NextResponse.json({
        success: true,
        data: serializeTaskRunRow(updated),
        message: "TaskRun이 READY_FOR_GIT 상태로 전환되었습니다.",
      });
    }

    try {
      await requireTaskRun(projectId, userId);
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const taskGate = await prisma.task.findUnique({
      where: { id: prompt.taskId },
      select: { status: true },
    });

    if (taskGate?.status === "BLOCKED") {
      return NextResponse.json(
        {
          success: false,
          message: "BLOCKED 상태의 Task는 실행할 수 없습니다.",
        },
        { status: 400 }
      );
    }

    if (taskGate?.status === "CANCELLED") {
      await prisma.task.update({
        where: { id: prompt.taskId },
        data: { status: "TODO" },
      });
    }

    const executionResult: TaskRunExecutionResult = {
      success: true,
      mode: "mock",
      updatedFiles: [
        {
          path: `projects/${prompt.taskId}/mock-output.ts`,
          changeType: "MODIFY",
        },
      ],
      commitMessage: `feat: apply task ${prompt.taskId}`,
      logs: ["mock execution completed"],
      error: null,
    };

    const storedExecutionJson = taskRunExecutionResultToStoredJson(executionResult);

    let completed;
    try {
      completed = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          "SELECT id FROM tasks WHERE id = $1::uuid FOR UPDATE",
          prompt.taskId
        );

        const pending = await tx.taskRun.findFirst({
          where: { taskId: prompt.taskId, status: "PENDING" },
          select: { id: true },
        });
        if (pending) {
          throw new RunExecutionConflictError();
        }

        const run = await tx.taskRun.create({
          data: {
            taskId: prompt.taskId,
            taskPromptId: prompt.id,
            status: "PENDING",
          },
        });

        const doneRow = await tx.taskRun.update({
          where: { id: run.id },
          data: {
            status: "DONE",
            resultText: "Mock 실행 완료",
            resultJson: storedExecutionJson as Prisma.InputJsonValue,
          },
          select: {
            id: true,
            taskId: true,
            taskPromptId: true,
            status: true,
            resultText: true,
            resultJson: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        await tx.task.update({
          where: { id: prompt.taskId },
          data: { status: "DONE" },
        });

        return doneRow;
      });
    } catch (inner) {
      if (isRunExecutionConflictError(inner)) {
        return NextResponse.json(
          {
            success: false,
            code: inner.errorCode,
            message: inner.message,
          },
          { status: inner.httpStatus }
        );
      }
      throw inner;
    }

    try {
      await appendTaskHistory({
        projectId,
        taskId: prompt.taskId,
        actorType: TaskHistoryActorType.USER,
        actorId: userId,
        eventType: TaskHistoryEventType.RUN_STARTED,
        summary: "Task 실행 시작",
        detailJson: {
          taskPromptId: prompt.id,
          taskRunId: completed.id,
          mode: "mock",
        },
      });
    } catch (historyError) {
      console.error("RUN_STARTED history append failed:", historyError);
    }

    try {
      await appendTaskHistory({
        projectId,
        taskId: prompt.taskId,
        actorType: TaskHistoryActorType.SYSTEM,
        actorId: null,
        eventType: TaskHistoryEventType.RUN_COMPLETED,
        summary: "Task 실행 완료",
        detailJson: {
          taskRunId: completed.id,
          taskPromptId: prompt.id,
          status: completed.status,
          resultText: completed.resultText,
          hasStructuredResult: completed.resultJson != null,
          updatedFiles: executionResult.updatedFiles,
          commitMessage: executionResult.commitMessage,
        },
      });
    } catch (historyError) {
      console.error("RUN_COMPLETED history append failed:", historyError);
    }

    let responseRun = completed;
    const shouldAutoCreateGitRequest =
      executionResult.success === true &&
      executionResult.updatedFiles.length > 0 &&
      prompt.task.project.autoCreateGitRequest === true;

    if (shouldAutoCreateGitRequest) {
      const auto = await createGitChangeRequestFromExecutionResult({
        projectId,
        taskId: prompt.taskId,
        taskRunId: completed.id,
        actorUserId: userId,
        executionResult,
      });
      if (auto.ok) {
        const refreshed = await prisma.taskRun.findUnique({
          where: { id: completed.id },
          select: {
            id: true,
            taskId: true,
            taskPromptId: true,
            status: true,
            resultText: true,
            resultJson: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        if (refreshed) {
          responseRun = refreshed;
        }
      } else if (auto.httpStatus === 403) {
        // 권한 없음: Run 성공은 유지, 수동 git-request 흐름으로 이어갈 수 있음
      } else if (auto.code === GIT_CHANGE_REQUEST_FROM_RUN_CODES.ALREADY_EXISTS) {
        // 동시·재시도 등으로 이미 연결된 경우 조용히 최신 Run만 반환
        const refreshed = await prisma.taskRun.findUnique({
          where: { id: completed.id },
          select: {
            id: true,
            taskId: true,
            taskPromptId: true,
            status: true,
            resultText: true,
            resultJson: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        if (refreshed) {
          responseRun = refreshed;
        }
      } else {
        console.error("Run 완료 후 자동 Git 요청 실패:", auto.code, auto.message);
      }
    }

    return NextResponse.json({
      success: true,
      data: serializeTaskRunRow(responseRun),
      message: "Task mock 실행이 완료되었습니다.",
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
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
