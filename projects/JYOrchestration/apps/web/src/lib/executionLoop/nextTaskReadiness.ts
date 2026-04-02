import { isExecutionLoopPaused } from "@/lib/executionLoop/loopControllerState";
import { loadWorkflowGraphTasks } from "@/lib/executionLoop/workflowState";
import { pickNextReadyTask, type TaskForPick } from "@/lib/executionLoop/pickNextReadyTask";
import { prisma } from "@/lib/prisma";
import {
  ensureTaskExecutionRunColumnsReady,
  withTaskExecutionRunSchemaHealRetry,
} from "@/lib/prisma/taskExecutionRunColumnsHeal";

export type NextTaskReadinessResult = {
  nextTaskReady: boolean;
  nextTaskId: string | null;
  nextTaskName: string | null;
  nextTaskBlockedReason: string | null;
};

/**
 * PR_OPENED 직후 등: 다음 PRIMARY Task 가 자동 루프에서 곧바로 시작 가능한지 파생 계산한다.
 * (코어 Task 상태는 추가하지 않음)
 */
export async function evaluateNextTaskReadiness(input: {
  projectId: string;
}): Promise<NextTaskReadinessResult> {
  const projectId = String(input.projectId ?? "").trim();
  if (!projectId) {
    return {
      nextTaskReady: false,
      nextTaskId: null,
      nextTaskName: null,
      nextTaskBlockedReason: "projectId가 없습니다.",
    };
  }

  if (isExecutionLoopPaused(projectId)) {
    return {
      nextTaskReady: false,
      nextTaskId: null,
      nextTaskName: null,
      nextTaskBlockedReason: "실행 루프가 일시정지 상태입니다.",
    };
  }

  const rows = await loadWorkflowGraphTasks(projectId);
  const pickRows: TaskForPick[] = rows.map((r) => ({
    id: r.id,
    order: r.order,
    status: r.status,
    dependsOnTaskIds: r.dependsOnTaskIds,
    executionWorkflowStatus: r.executionWorkflowStatus,
    taskKind: r.taskKind,
  }));
  const next = pickNextReadyTask(pickRows);

  if (!next) {
    return {
      nextTaskReady: false,
      nextTaskId: null,
      nextTaskName: null,
      nextTaskBlockedReason: null,
    };
  }

  const nextMeta = rows.find((r) => r.id === next.id);
  const nextName = nextMeta?.name ?? null;

  await ensureTaskExecutionRunColumnsReady();
  const activeBlocking = await withTaskExecutionRunSchemaHealRetry(() =>
    prisma.taskExecutionRun.findFirst({
      where: {
        projectId,
        archivedAt: null,
        status: { in: ["running", "awaiting_git_reflection", "reviewing"] },
      },
    })
  );
  if (activeBlocking) {
    return {
      nextTaskReady: false,
      nextTaskId: next.id,
      nextTaskName: nextName,
      nextTaskBlockedReason: "다른 Task 실행이 진행 중이어서 다음 Task를 바로 시작할 수 없습니다.",
    };
  }

  return {
    nextTaskReady: true,
    nextTaskId: next.id,
    nextTaskName: nextName,
    nextTaskBlockedReason: null,
  };
}
