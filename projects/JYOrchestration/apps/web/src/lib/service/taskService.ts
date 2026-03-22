/**
 * Task / TaskRun 조회·집계 (projectId 스코프).
 * 실행 로직 변경 없이 데이터 접근만 담당.
 */
import { TaskHistoryActorType, TaskHistoryEventType } from "@/lib/history/taskHistoryConstants";
import {
  isTaskRunResultJson,
  type TaskRunResultJson,
} from "@/lib/integration/taskRunResultTypes";
import { prisma } from "@/lib/prisma";

/** TaskRun.resultJson 안전 파싱 (후속 Git·UI에서 재사용). */
export function parseTaskRunResultJson(raw: unknown): TaskRunResultJson | null {
  return isTaskRunResultJson(raw) ? raw : null;
}

export type { TaskRunExecutionResult } from "@/lib/integration/taskRunResultTypes";

export async function countTasksByProjectId(projectId: string): Promise<number> {
  return prisma.task.count({ where: { projectId } });
}

export async function countTaskRunsByProjectId(projectId: string): Promise<number> {
  return prisma.taskRun.count({
    where: { task: { projectId } },
  });
}

/**
 * `orderedTaskIds` must be a permutation of all task ids in the project.
 * Updates `order` to 0..n-1 in one transaction and appends TASK_REORDERED per task.
 */
export async function reorderTasksInProject(
  projectId: string,
  orderedTaskIds: string[],
  options: { actorUserId: string }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const existing = await prisma.task.findMany({
    where: { projectId },
    select: { id: true },
  });
  const idSet = new Set(existing.map((t) => t.id));
  if (orderedTaskIds.length !== idSet.size) {
    return { ok: false, message: "프로젝트의 Task 개수와 순서 목록이 일치하지 않습니다." };
  }
  for (const id of orderedTaskIds) {
    if (!idSet.has(id)) {
      return { ok: false, message: "다른 프로젝트의 Task id가 포함되어 있습니다." };
    }
  }

  const actorUserId = options.actorUserId;

  await prisma.$transaction(async (tx) => {
    for (let index = 0; index < orderedTaskIds.length; index++) {
      const id = orderedTaskIds[index];
      await tx.task.update({
        where: { id, projectId },
        data: { order: index },
      });
    }
    for (let index = 0; index < orderedTaskIds.length; index++) {
      const taskId = orderedTaskIds[index];
      await tx.taskHistory.create({
        data: {
          projectId,
          taskId,
          actorType: TaskHistoryActorType.USER,
          actorId: actorUserId,
          eventType: TaskHistoryEventType.TASK_REORDERED,
          summary: "Task 순서 변경",
          detailJson: {
            newOrder: index,
            orderedTaskIds,
          },
        },
      });
    }
  });

  return { ok: true };
}

export type CreateFollowUpTaskResult =
  | {
      ok: true;
      followUp: { id: string; parentTaskId: string | null; taskKind: string; order: number };
    }
  | { ok: false; message: string };

/**
 * Inserts a FOLLOW_UP task immediately after a DONE source task (same project / spec upload).
 * Shifts `order` for tasks in the project with order greater than the source's order.
 */
export async function createFollowUpTaskAfterDoneSource(params: {
  projectId: string;
  sourceTaskId: string;
  name: string;
  description: string | null;
  changeReason: string;
}): Promise<CreateFollowUpTaskResult> {
  const name = params.name.trim();
  const changeReason = params.changeReason.trim();
  if (!name) {
    return { ok: false, message: "작업명(name)이 필요합니다." };
  }
  if (!changeReason) {
    return { ok: false, message: "변경 사유(changeReason)가 필요합니다." };
  }

  const source = await prisma.task.findFirst({
    where: { id: params.sourceTaskId, projectId: params.projectId },
    select: {
      id: true,
      status: true,
      order: true,
      projectSpecUploadId: true,
    },
  });

  if (!source) {
    return { ok: false, message: "원본 Task를 찾을 수 없습니다." };
  }

  if (source.status !== "DONE") {
    return {
      ok: false,
      message: "완료(DONE) 상태의 Task만 보완(Follow-up) 작업을 생성할 수 있습니다.",
    };
  }

  const inserted = await prisma.$transaction(async (tx) => {
    const sourceOrder = source.order;
    await tx.task.updateMany({
      where: { projectId: params.projectId, order: { gt: sourceOrder } },
      data: { order: { increment: 1 } },
    });
    return tx.task.create({
      data: {
        projectId: params.projectId,
        projectSpecUploadId: source.projectSpecUploadId,
        name,
        description: params.description?.trim() || null,
        status: "TODO",
        order: sourceOrder + 1,
        parentTaskId: source.id,
        taskKind: "FOLLOW_UP",
        changeReason,
      },
      select: {
        id: true,
        parentTaskId: true,
        taskKind: true,
        order: true,
      },
    });
  });

  return {
    ok: true,
    followUp: {
      id: inserted.id,
      parentTaskId: inserted.parentTaskId,
      taskKind: inserted.taskKind,
      order: inserted.order,
    },
  };
}
