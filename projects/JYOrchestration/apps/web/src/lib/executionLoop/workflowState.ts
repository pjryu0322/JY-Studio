/**
 * DAG 실행 루프용 Task 워크플로 상태 (Prisma 동기화).
 * runExecutionLoop와 수동 승인 API 등에서 공유한다.
 */

import { computeWorkflowUpdates } from "@/lib/executionLoop/recomputeWorkflowReadiness";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";
import { prisma } from "@/lib/prisma";

export async function loadWorkflowGraphTasks(projectId: string) {
  return prisma.task.findMany({
    where: {
      projectId,
      taskKind: "PRIMARY",
      status: { notIn: ["BLOCKED", "CANCELLED"] },
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      projectId: true,
      name: true,
      description: true,
      status: true,
      order: true,
      dependsOnTaskIds: true,
      acceptanceCriteria: true,
      executionWorkflowStatus: true,
      loopRetryCount: true,
    },
  });
}

async function ensureLinearFallbackDeps(projectId: string): Promise<void> {
  const rows = await prisma.task.findMany({
    where: { projectId, taskKind: "PRIMARY", status: "TODO" },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, dependsOnTaskIds: true },
  });
  const anyDeps = rows.some(
    (r) => Array.isArray(r.dependsOnTaskIds) && (r.dependsOnTaskIds as string[]).length > 0
  );
  if (anyDeps) return;
  let prev: string | null = null;
  for (const r of rows) {
    if (prev) {
      await prisma.task.update({
        where: { id: r.id },
        data: { dependsOnTaskIds: [prev] },
      });
    }
    prev = r.id;
  }
}

export async function refreshWorkflowStates(projectId: string): Promise<void> {
  const rows = await loadWorkflowGraphTasks(projectId);
  const upd = computeWorkflowUpdates(
    rows.map((r) => ({
      id: r.id,
      dependsOnTaskIds: r.dependsOnTaskIds,
      executionWorkflowStatus: r.executionWorkflowStatus,
    }))
  );
  for (const r of rows) {
    const next = upd.get(r.id);
    if (next && next !== r.executionWorkflowStatus) {
      await prisma.task.update({
        where: { id: r.id },
        data: { executionWorkflowStatus: next },
      });
    }
  }
}

export async function initializeLoopParticipants(projectId: string): Promise<void> {
  await ensureLinearFallbackDeps(projectId);
  const rows = await prisma.task.findMany({
    where: { projectId, taskKind: "PRIMARY", status: "TODO" },
    orderBy: [{ order: "asc" }],
    select: { id: true, executionWorkflowStatus: true },
  });
  if (rows.length === 0) return;
  const allFresh = rows.every((r) => r.executionWorkflowStatus == null);
  if (allFresh) {
    for (const r of rows) {
      await prisma.task.update({
        where: { id: r.id },
        data: { executionWorkflowStatus: EXECUTION_WORKFLOW.PENDING },
      });
    }
  }
  await refreshWorkflowStates(projectId);
}

export async function updateTaskOrchestrationSnapshot(
  taskId: string,
  data: {
    branch?: string | null;
    commitStatus?: string | null;
    pushStatus?: string | null;
    commitSha?: string | null;
    changedFileCount?: number | null;
  }
): Promise<void> {
  const patch: Record<string, string | number | null> = {};
  if (data.branch !== undefined) patch.lastOrchestrationBranch = data.branch;
  if (data.commitStatus !== undefined) patch.lastOrchestrationCommitStatus = data.commitStatus;
  if (data.pushStatus !== undefined) patch.lastOrchestrationPushStatus = data.pushStatus;
  if (data.commitSha !== undefined) patch.lastOrchestrationCommitSha = data.commitSha;
  if (data.changedFileCount !== undefined) patch.lastOrchestrationChangedFileCount = data.changedFileCount;
  if (Object.keys(patch).length === 0) return;
  await prisma.task.update({
    where: { id: taskId },
    data: patch,
  });
}
