import type { Prisma } from "@prisma/client";

/**
 * 새 활성 Spec 버전이 정해진 직후: 그 버전이 아닌 Task(및 null 출처)와 연결 Run을 보관 처리.
 */
export async function archiveTasksNotMatchingSpecVersion(
  tx: Prisma.TransactionClient,
  projectId: string,
  activeSpecVersionId: string
): Promise<{ archivedTaskCount: number }> {
  const rows = await tx.task.findMany({
    where: {
      projectId,
      archivedAt: null,
      OR: [{ sourceSpecVersionId: { not: activeSpecVersionId } }, { sourceSpecVersionId: null }],
    },
    select: { id: true },
  });
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) {
    return { archivedTaskCount: 0 };
  }
  const now = new Date();
  await tx.task.updateMany({
    where: { id: { in: ids } },
    data: { archivedAt: now },
  });
  await tx.taskExecutionRun.updateMany({
    where: { taskId: { in: ids } },
    data: { archivedAt: now },
  });
  return { archivedTaskCount: ids.length };
}

/**
 * 롤백 등으로 활성 Spec이 특정 버전으로 바뀐 뒤: 해당 버전 Task는 복원, 나머지는 보관.
 */
export async function reconcileArchivedStateForActiveSpecVersion(
  tx: Prisma.TransactionClient,
  projectId: string,
  activeSpecVersionId: string
): Promise<void> {
  await tx.task.updateMany({
    where: { projectId, sourceSpecVersionId: activeSpecVersionId },
    data: { archivedAt: null },
  });
  await tx.task.updateMany({
    where: {
      projectId,
      OR: [{ sourceSpecVersionId: { not: activeSpecVersionId } }, { sourceSpecVersionId: null }],
    },
    data: { archivedAt: new Date() },
  });

  const archivedTaskIds = (
    await tx.task.findMany({
      where: { projectId, archivedAt: { not: null } },
      select: { id: true },
    })
  ).map((t) => t.id);
  const activeTaskIds = (
    await tx.task.findMany({
      where: { projectId, archivedAt: null },
      select: { id: true },
    })
  ).map((t) => t.id);

  if (archivedTaskIds.length > 0) {
    await tx.taskExecutionRun.updateMany({
      where: { taskId: { in: archivedTaskIds } },
      data: { archivedAt: new Date() },
    });
  }
  if (activeTaskIds.length > 0) {
    await tx.taskExecutionRun.updateMany({
      where: { taskId: { in: activeTaskIds } },
      data: { archivedAt: null },
    });
  }
}
