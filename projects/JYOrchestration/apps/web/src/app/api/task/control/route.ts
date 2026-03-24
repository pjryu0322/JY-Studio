import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { TaskHistoryActorType, TaskHistoryEventType } from "@/lib/history/taskHistoryConstants";
import { prisma } from "@/lib/prisma";
import { requireTaskPermission } from "@/lib/service/taskOwnershipGuard";
import { appendTaskHistory } from "@/lib/service/taskHistoryService";

type ControlBody = {
  taskId?: string;
  action?: string;
};

function serializeTask<T extends { createdAt: Date; updatedAt: Date }>(row: T) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeRun<T extends { createdAt: Date; updatedAt: Date }>(row: T) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const taskSelect = {
  id: true,
  projectId: true,
  projectSpecUploadId: true,
  name: true,
  description: true,
  status: true,
  order: true,
  parentTaskId: true,
  taskKind: true,
  changeReason: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    const body = (await request.json()) as ControlBody;
    const taskId = String(body.taskId ?? "").trim();
    const action = String(body.action ?? "").trim();

    if (!taskId) {
      return NextResponse.json({ success: false, message: "taskId가 ?�요?�니??" }, { status: 400 });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true, status: true },
    });

    if (!task) {
      return NextResponse.json({ success: false, message: "?�??Task�?찾을 ???�습?�다." }, { status: 404 });
    }

    const projectId = task.projectId;

    try {
      await requireTaskPermission(task.id, userId, "canControlExecution", "POST /api/task/control");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    if (action === "block") {
      if (task.status === "BLOCKED") {
        return NextResponse.json({ success: false, message: "?��? BLOCKED ?�태?�니??" }, { status: 400 });
      }

      const updated = await prisma.task.update({
        where: { id: task.id },
        data: { status: "BLOCKED" },
        select: taskSelect,
      });

      try {
        await appendTaskHistory({
          projectId,
          taskId: task.id,
          actorType: TaskHistoryActorType.USER,
          actorId: userId,
          eventType: TaskHistoryEventType.MANUAL_BLOCKED,
          summary: "Task 차단(BLOCKED)",
          detailJson: { previousStatus: task.status },
        });
      } catch (historyError) {
        console.error("MANUAL_BLOCKED history append failed:", historyError);
      }

      return NextResponse.json({
        success: true,
        data: { task: serializeTask(updated) },
        message: "Task가 차단(BLOCKED)?�었?�니??",
      });
    }

    if (action === "unblock") {
      if (task.status !== "BLOCKED") {
        return NextResponse.json(
          { success: false, message: "BLOCKED ?�태??Task�?차단 ?�제?????�습?�다." },
          { status: 400 }
        );
      }

      const updated = await prisma.task.update({
        where: { id: task.id },
        data: { status: "TODO" },
        select: taskSelect,
      });

      try {
        await appendTaskHistory({
          projectId,
          taskId: task.id,
          actorType: TaskHistoryActorType.USER,
          actorId: userId,
          eventType: TaskHistoryEventType.MANUAL_APPROVED,
          summary: "Task 차단 ?�제",
          detailJson: { subAction: "unblock", previousStatus: "BLOCKED" },
        });
      } catch (historyError) {
        console.error("unblock history append failed:", historyError);
      }

      return NextResponse.json({
        success: true,
        data: { task: serializeTask(updated) },
        message: "Task 차단???�제?�었?�니??",
      });
    }

    if (action === "force-complete-latest") {
      const latestRun = await prisma.taskRun.findFirst({
        where: { taskId: task.id },
        orderBy: { createdAt: "desc" },
      });

      if (!latestRun) {
        return NextResponse.json(
          { success: false, message: "강제 ?�료??TaskRun???�습?�다." },
          { status: 404 }
        );
      }

      if (latestRun.status !== "FAILED" && latestRun.status !== "PENDING") {
        return NextResponse.json(
          {
            success: false,
            message: "FAILED ?�는 PENDING Run�?강제 ?�료?????�습?�다.",
          },
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
            message: "Git 반영 ?�청�??�결??Run?� 강제 ?�료?????�습?�다.",
          },
          { status: 400 }
        );
      }

      const [updatedRun, updatedTask] = await prisma.$transaction([
        prisma.taskRun.update({
          where: { id: latestRun.id },
          data: {
            status: "DONE",
            resultText: "[FORCE_COMPLETE] ?�영??강제 ?�료",
            resultJson: {
              success: true,
              mode: "force-complete",
              updatedFiles: [],
              commitMessage: null,
              logs: ["[FORCE_COMPLETE] ?�영??강제 ?�료"],
              error: null,
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
          where: { id: task.id },
          data: { status: "TODO" },
          select: taskSelect,
        }),
      ]);

      try {
        await appendTaskHistory({
          projectId,
          taskId: task.id,
          actorType: TaskHistoryActorType.USER,
          actorId: userId,
          eventType: TaskHistoryEventType.MANUAL_FORCED_COMPLETE,
          summary: "Task ?�행 강제 ?�료(?�영??",
          detailJson: {
            taskRunId: updatedRun.id,
            taskPromptId: updatedRun.taskPromptId,
            previousRunStatus: latestRun.status,
          },
        });
      } catch (historyError) {
        console.error("MANUAL_FORCED_COMPLETE history append failed:", historyError);
      }

      return NextResponse.json({
        success: true,
        data: {
          task: serializeTask(updatedTask),
          taskRun: serializeRun(updatedRun),
        },
        message: "최신 TaskRun??DONE?�로 ?�환?�습?�다.",
      });
    }

    return NextResponse.json(
      { success: false, message: "지?�하지 ?�는 action?�니??" },
      { status: 400 }
    );
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/task/control error:", error);
    return NextResponse.json(
      { success: false, message: "Task ?�어 ?�청 처리 �??�류가 발생?�습?�다." },
      { status: 500 }
    );
  }
}
