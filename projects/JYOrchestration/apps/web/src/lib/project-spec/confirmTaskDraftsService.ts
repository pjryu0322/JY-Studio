import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nodeTypeFromTitle, stripNodeTypePrefix } from "@/lib/project-spec/taskDraftHierarchy";

export type ConfirmTaskDraftsResult = {
  /** 생성된 실행 Task 개수 ([T] 노드만) */
  confirmedCount: number;
  taskIds: string[];
  /** CONFIRMED로 바뀐 TaskDraft 행 수(계층 노드 포함) */
  promotedDraftRows?: number;
};

type TaskDraftRow = Prisma.TaskDraftGetPayload<object>;

/**
 * 동일 트랜잭션 안에서 DRAFT → Task 반영 및 계층 초안 CONFIRMED 처리.
 * `drafts`는 모두 DRAFT 상태여야 한다.
 */
export async function confirmTaskDraftsInTransaction(
  tx: Prisma.TransactionClient,
  params: { projectId: string; drafts: TaskDraftRow[] }
): Promise<ConfirmTaskDraftsResult> {
  const { projectId, drafts } = params;
  if (drafts.length === 0) {
    return { confirmedCount: 0, taskIds: [], promotedDraftRows: 0 };
  }

  const executableDrafts = drafts.filter((d) => nodeTypeFromTitle(d.title) === "task");
  const hierarchyDrafts = drafts.filter((d) => nodeTypeFromTitle(d.title) !== "task");

  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: { ownerUserId: true },
  });
  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  const maxAgg = await tx.task.aggregate({
    where: { projectId },
    _max: { order: true },
  });
  let nextOrder = (maxAgg._max.order ?? 0) + 1;

  const taskIds: string[] = [];
  const draftIdToTaskId = new Map<string, string>();

  for (const d of executableDrafts) {
    const descParts: string[] = [];
    if (d.description?.trim()) descParts.push(d.description.trim());
    const ti = (d as { taskInput?: string | null }).taskInput?.trim();
    const to = (d as { taskOutput?: string | null }).taskOutput?.trim();
    if (ti) descParts.push(`Input:\n${ti}`);
    if (to) descParts.push(`Output:\n${to}`);
    const ac = Array.isArray(d.acceptanceCriteria) ? (d.acceptanceCriteria as string[]) : [];
    const acLines = ac.map((x) => String(x).trim()).filter(Boolean);
    if (acLines.length) descParts.push(`Acceptance criteria:\n- ${acLines.join("\n- ")}`);
    const sz = (d as { estimatedSize?: string | null }).estimatedSize?.trim();
    const ek = (d as { executionKind?: string | null }).executionKind?.trim();
    if (sz) descParts.push(`Estimated size: ${sz}`);
    if (ek) descParts.push(`Execution kind: ${ek}`);
    const merged =
      descParts.length > 0 ? descParts.join("\n\n").slice(0, 16_000) : (d.description ?? null);
    const mergedDescription = merged;

    // INSERT에 acceptanceCriteria를 넣지 않음: DB가 execution_loop 마이그레이션 전이면 P2022(컬럼 없음)가 난다.
    // 수용 기준은 이미 mergedDescription에 포함됨. 컬럼이 있으면 생성 직후 update로만 채운다.
    const baseCreate = {
      projectId,
      ownerUserId: project.ownerUserId,
      projectSpecUploadId: null as string | null,
      name: stripNodeTypePrefix(d.title),
      description: mergedDescription,
      status: "TODO" as const,
      order: nextOrder,
      taskKind: "PRIMARY" as const,
      changeReason: `TASK_DRAFT_CONFIRM:${d.id}`,
    };
    let created: { id: string };
    try {
      created = await tx.task.create({
        data: {
          ...baseCreate,
          sourceSpecVersionId: d.specVersionId,
        },
        select: { id: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") {
        created = await tx.task.create({
          data: baseCreate,
          select: { id: true },
        });
      } else {
        throw e;
      }
    }
    if (acLines.length > 0) {
      try {
        await tx.task.update({
          where: { id: created.id },
          data: { acceptanceCriteria: acLines as Prisma.InputJsonValue },
        });
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022")) {
          throw e;
        }
      }
    }
    nextOrder += 1;
    taskIds.push(created.id);
    draftIdToTaskId.set(d.id, created.id);
  }

  for (const d of executableDrafts) {
    const rawDeps = Array.isArray(d.dependsOnIds) ? (d.dependsOnIds as unknown[]) : [];
    const resolved = [
      ...new Set(
        rawDeps
          .map((x) => draftIdToTaskId.get(String(x ?? "").trim()))
          .filter((x): x is string => Boolean(x))
      ),
    ];
    if (resolved.length > 0) {
      try {
        await tx.task.update({
          where: { id: draftIdToTaskId.get(d.id)! },
          data: { dependsOnTaskIds: resolved as Prisma.InputJsonValue },
        });
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022")) {
          throw e;
        }
      }
    }

    await tx.taskDraft.update({
      where: { id: d.id },
      data: { status: "CONFIRMED" },
    });
  }

  for (const d of hierarchyDrafts) {
    await tx.taskDraft.update({
      where: { id: d.id },
      data: { status: "CONFIRMED" },
    });
  }

  return {
    confirmedCount: executableDrafts.length,
    taskIds,
    promotedDraftRows: drafts.length,
  };
}

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

  return prisma.$transaction(async (tx) => {
    const drafts = await tx.taskDraft.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    if (drafts.length === 0) {
      return { confirmedCount: 0, taskIds: [], promotedDraftRows: 0 };
    }

    const executableDrafts = drafts.filter((d) => nodeTypeFromTitle(d.title) === "task");
    if (executableDrafts.length === 0) {
      for (const d of drafts) {
        await tx.taskDraft.update({
          where: { id: d.id },
          data: { status: "CONFIRMED" },
        });
      }
      return { confirmedCount: 0, taskIds: [], promotedDraftRows: drafts.length };
    }

    return confirmTaskDraftsInTransaction(tx, { projectId, drafts });
  });
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
