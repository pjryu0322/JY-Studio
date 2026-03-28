import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { TaskHistoryActorType, TaskHistoryEventType } from "@/lib/history/taskHistoryConstants";
import { prisma } from "@/lib/prisma";
import { requireTaskPermission } from "@/lib/service/taskOwnershipGuard";
import { appendTaskHistory } from "@/lib/service/taskHistoryService";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";
import { refreshWorkflowStates } from "@/lib/executionLoop/workflowState";

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

    if (action === "workflow-approve-sensitive") {
      const full = await prisma.task.findUnique({
        where: { id: taskId },
        select: {
          id: true,
          projectId: true,
          executionWorkflowStatus: true,
          lastEvalSummary: true,
        },
      });
      if (!full) {
        return NextResponse.json({ success: false, message: "Task를 찾을 수 없습니다." }, { status: 404 });
      }
      if (full.executionWorkflowStatus !== EXECUTION_WORKFLOW.AWAITING_HUMAN) {
        return NextResponse.json(
          {
            success: false,
            message: "awaiting_human 상태의 Task만 민감 작업 승인을 적용할 수 있습니다.",
          },
          { status: 400 }
        );
      }

      const prevSummary = full.lastEvalSummary?.trim() ?? "";
      const updated = await prisma.task.update({
        where: { id: task.id },
        data: {
          executionWorkflowStatus: EXECUTION_WORKFLOW.DONE,
          status: "DONE",
          lastEvalResult: "done",
          lastEvalSummary: prevSummary
            ? `${prevSummary}\n(운영자 민감 작업 승인)`
            : "(운영자 민감 작업 승인)",
        },
        select: taskSelect,
      });

      const latestRun = await prisma.taskExecutionRun.findFirst({
        where: {
          taskId: task.id,
          status: "reviewing",
          evaluationReason: { startsWith: "policy_sensitive_awaiting_human" },
        },
        orderBy: { createdAt: "desc" },
      });
      if (latestRun) {
        await prisma.taskExecutionRun.update({
          where: { id: latestRun.id },
          data: { status: "done", evaluationDecision: "done" },
        });
      }

      await refreshWorkflowStates(projectId);

      try {
        await appendTaskHistory({
          projectId,
          taskId: task.id,
          actorType: TaskHistoryActorType.USER,
          actorId: userId,
          eventType: TaskHistoryEventType.WORKFLOW_SENSITIVE_HUMAN_APPROVED,
          summary: "민감 Task 사람 승인 — DAG 진행 허용",
          detailJson: { taskExecutionRunId: latestRun?.id ?? null },
        });
      } catch (historyError) {
        console.error("WORKFLOW_SENSITIVE_HUMAN_APPROVED history append failed:", historyError);
      }

      return NextResponse.json({
        success: true,
        data: { task: serializeTask(updated) },
        message: "민감 작업이 승인되었습니다. 실행 루프를 다시 돌리면 후속 Task가 진행됩니다.",
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
