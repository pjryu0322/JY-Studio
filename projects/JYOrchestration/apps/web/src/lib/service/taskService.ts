/**
 * Task / TaskRun 조회·집계 (projectId 스코프).
 * 실행 로직 변경 없이 데이터 접근만 담당.
 */
import { TaskHistoryActorType, TaskHistoryEventType } from "@/lib/history/taskHistoryConstants";
import { prisma } from "@/lib/prisma";

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
