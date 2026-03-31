import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireSessionUserId } from "@/lib/auth/requireSession";
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
  requireProjectPermissionById,
  requireTaskPermission,
} from "@/lib/service/taskOwnershipGuard";
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
      await requireProjectPermissionById(projectId, userId, "canViewExecution", "GET /api/task/run");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const proj = await prisma.project.findUnique({
      where: { id: projectId },
      select: { currentSpecVersionId: true },
    });
    const currentSpecId = proj?.currentSpecVersionId ?? null;

    const taskWhere =
      currentSpecId != null
        ? {
            projectId,
            taskKind: "PRIMARY",
            archivedAt: null,
            status: { notIn: ["BLOCKED", "CANCELLED"] },
            sourceSpecVersionId: currentSpecId,
          }
        : { projectId, id: { in: [] as string[] } };

    const runs = await prisma.taskRun.findMany({
      where: {
        task: taskWhere,
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
        message: "TaskRun 조회 �??�류가 발생?�습?�다.",
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
    const body = (await request.json()) as TaskRunBody;
    const taskPromptId = String(body.taskPromptId ?? "").trim();
    const taskIdForAction = String(body.taskId ?? "").trim();
    const action = String(body.action ?? "").trim();

    if (action === "force-fail-latest") {
      if (!taskIdForAction) {
        return NextResponse.json(
          { success: false, message: "taskId가 ?�요?�니??" },
          { status: 400 }
        );
      }

      const task = await prisma.task.findUnique({
        where: { id: taskIdForAction },
        select: { id: true, projectId: true },
      });

      if (!task) {
        return NextResponse.json(
          { success: false, message: "?�??Task�?찾을 ???�습?�다." },
          { status: 404 }
        );
      }

      const projectId = task.projectId;

      try {
        await requireTaskPermission(task.id, userId, "canRunTask", "POST /api/task/run:force-fail-latest");
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
          { success: false, message: "?�패 처리??TaskRun???�습?�다." },
          { status: 404 }
        );
      }

      if (latestRun.status === "FAILED") {
        return NextResponse.json(
          { success: false, message: "?��? FAILED ?�태?�니??" },
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
            message: "Git 반영 ?�청�??�결??Run?� 강제 ?�패?????�습?�다.",
          },
          { status: 400 }
        );
      }

      const updated = await prisma.taskRun.update({
        where: { id: latestRun.id },
        data: {
          status: "FAILED",
          resultText: "[FORCE_FAIL] ?�영??강제 ?�패",
          resultJson: {
            success: false,
            mode: "force-fail",
            updatedFiles: [],
            commitMessage: null,
            logs: [],
            error: "?�영??강제 ?�패",
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
          summary: "Task ?�행 강제 ?�패(?�영??",
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
        message: "최신 TaskRun??FAILED�??�환?�습?�다.",
      });
    }

    if (action === "abort-run") {
      if (!taskPromptId) {
        return NextResponse.json(
          { success: false, message: "taskPromptId가 ?�요?�니??" },
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
          { success: false, message: "?�??TaskPrompt�?찾을 ???�습?�다." },
          { status: 404 }
        );
      }

      const abortProjectId = promptForAbort.task.projectId;

      try {
        await requireTaskPermission(
          promptForAbort.taskId,
          userId,
          "canRunTask",
          "POST /api/task/run:abort-run"
        );
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
            message: "중단??PENDING ?�태 ?�행???�습?�다.",
          },
          { status: 400 }
        );
      }

      const [aborted] = await prisma.$transaction([
        prisma.taskRun.update({
          where: { id: pendingRun.id },
          data: {
            status: "FAILED",
            resultText: "[ABORTED] ?�용???�행 중단",
            resultJson: {
              success: false,
              mode: "abort-run",
              updatedFiles: [],
              commitMessage: null,
              logs: [],
              error: "?�용???�행 중단",
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
          summary: "Task ?�행 중단(취소)",
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
        message: "?�행??중단(FAILED) 처리?�었?�니??",
      });
    }

    if (!taskPromptId) {
      return NextResponse.json(
        {
          success: false,
          message: "taskPromptId가 ?�요?�니??",
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
          message: "?�??TaskPrompt�?찾을 ???�습?�다.",
        },
        { status: 404 }
      );
    }

    const projectId = prompt.task.projectId;

    try {
      await requireTaskPermission(prompt.taskId, userId, "canRunTask", "POST /api/task/run");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
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
            message: "READY_FOR_GIT ?�환 ?�??Run???�습?�다.",
          },
          { status: 404 }
        );
      }

      if (latestRun.status !== "DONE" && latestRun.status !== "READY_FOR_GIT") {
        return NextResponse.json(
          {
            success: false,
            message: "DONE ?�태 Run�?READY_FOR_GIT�??�환?????�습?�다.",
          },
          { status: 400 }
        );
      }

      const updated = await prisma.taskRun.update({
        where: { id: latestRun.id },
        data: {
          status: "READY_FOR_GIT",
          resultText: latestRun.resultText || "Mock ?�행 ?�료",
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
          summary: "Git 반영 준�??�인(READY_FOR_GIT)",
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
        message: "TaskRun??READY_FOR_GIT ?�태�??�환?�었?�니??",
      });
    }

    const taskGate = await prisma.task.findUnique({
      where: { id: prompt.taskId },
      select: { status: true },
    });

    if (taskGate?.status === "BLOCKED") {
      return NextResponse.json(
        {
          success: false,
          message: "BLOCKED ?�태??Task???�행?????�습?�다.",
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
            resultText: "Mock ?�행 ?�료",
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
        summary: "Task ?�행 ?�작",
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
        summary: "Task ?�행 ?�료",
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
        // 권한 ?�음: Run ?�공?� ?��?, ?�동 git-request ?�름?�로 ?�어�????�음
      } else if (auto.code === GIT_CHANGE_REQUEST_FROM_RUN_CODES.ALREADY_EXISTS) {
        // ?�시·?�시???�으�??��? ?�결??경우 조용??최신 Run�?반환
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
        console.error("Run ?�료 ???�동 Git ?�청 ?�패:", auto.code, auto.message);
      }
    }

    return NextResponse.json({
      success: true,
      data: serializeTaskRunRow(responseRun),
      message: "Task mock ?�행???�료?�었?�니??",
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
        message: "Task mock ?�행 �??�류가 발생?�습?�다.",
      },
      { status: 500 }
    );
  }
}
