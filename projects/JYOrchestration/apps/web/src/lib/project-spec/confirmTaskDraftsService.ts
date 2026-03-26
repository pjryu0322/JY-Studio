import { prisma } from "@/lib/prisma";

export type ConfirmTaskDraftsResult = {
  confirmedCount: number;
  taskIds: string[];
};

/**
 * DRAFT 상태 Task 초안을 실제 Task로 반영한다. 기존 Task는 삭제하지 않는다.
 */
export async function confirmTaskDraftsToTasks(params: {
  projectId: string;
  userId: string;
  draftIds?: string[];
  confirmAll?: boolean;
}): Promise<ConfirmTaskDraftsResult> {
  const { projectId, draftIds, confirmAll } = params;

  const where: { projectId: string; status: string; id?: { in: string[] } } = {
    projectId,
    status: "DRAFT",
  };

  if (draftIds && draftIds.length > 0) {
    where.id = { in: draftIds };
  } else if (!confirmAll) {
    throw new Error("DRAFT_IDS_OR_CONFIRM_ALL_REQUIRED");
  }

  const drafts = await prisma.taskDraft.findMany({
    where,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  if (drafts.length === 0) {
    return { confirmedCount: 0, taskIds: [] };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerUserId: true },
  });
  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  const maxAgg = await prisma.task.aggregate({
    where: { projectId },
    _max: { order: true },
  });
  let nextOrder = (maxAgg._max.order ?? 0) + 1;

  const taskIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const d of drafts) {
      const created = await tx.task.create({
        data: {
          projectId,
          ownerUserId: project.ownerUserId,
          projectSpecUploadId: null,
          sourceSpecVersionId: d.specVersionId,
          name: d.title,
          description: d.description,
          status: "TODO",
          order: nextOrder,
          taskKind: "PRIMARY",
          changeReason: `TASK_DRAFT_CONFIRM:${d.id}`,
        },
        select: { id: true },
      });
      nextOrder += 1;
      taskIds.push(created.id);

      await tx.taskDraft.update({
        where: { id: d.id },
        data: { status: "CONFIRMED" },
      });
    }
  });

  return { confirmedCount: drafts.length, taskIds };
}

export async function deleteTaskDraft(params: {
  projectId: string;
  draftId: string;
}): Promise<{ deleted: boolean }> {
  const row = await prisma.taskDraft.findFirst({
    where: { id: params.draftId, projectId: params.projectId, status: "DRAFT" },
    select: { id: true },
  });
  if (!row) {
    return { deleted: false };
  }
  await prisma.taskDraft.delete({ where: { id: row.id } });
  return { deleted: true };
}
