import { ENV_TEST_STAGE2_TASK_KIND, ENV_TEST_TASK_KIND } from "@/lib/execution/envTestTaskKind";
import { CURSOR_AGENT_MAX_POLL_MS } from "@/lib/execution/cursorExecutionAdapter";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";
import { refreshWorkflowStates } from "@/lib/executionLoop/workflowState";
import { prisma } from "@/lib/prisma";

/**
 * `lastLoopRunAt` 기준으로 오래된 `running` 워크플로를 정리한다.
 * (요청 타임아웃·프로세스 중단·HMR 등으로 Cursor 이후 DB 갱신이 안 된 경우)
 *
 * 기본 임계값 = Cursor 최대 폴링(45분) + 10분 버퍼.
 * `EXECUTION_LOOP_STALE_RUNNING_MS`로 덮어쓸 수 있음(최소 3분).
 */
function staleRunningThresholdMs(): number {
  const raw = process.env.EXECUTION_LOOP_STALE_RUNNING_MS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 180_000) return n;
  }
  return CURSOR_AGENT_MAX_POLL_MS + 10 * 60 * 1000;
}

export async function reclaimStaleRunningWorkflowTasks(projectId: string): Promise<number> {
  const thresholdMs = staleRunningThresholdMs();
  const cutoff = new Date(Date.now() - thresholdMs);
  const stale = await prisma.task.findMany({
    where: {
      projectId,
      executionWorkflowStatus: EXECUTION_WORKFLOW.RUNNING,
      lastLoopRunAt: { lte: cutoff },
      /** ENV_TEST 계열은 Cursor 장시간 폴링으로 running이 길어질 수 있어 reclaim 대상에서 제외한다. */
      taskKind: { notIn: [ENV_TEST_TASK_KIND, ENV_TEST_STAGE2_TASK_KIND] },
    },
    select: { id: true },
  });
  if (stale.length === 0) return 0;

  for (const t of stale) {
    await prisma.$transaction(async (tx) => {
      await tx.taskExecutionRun.updateMany({
        where: { taskId: t.id, status: "running" },
        data: {
          status: "failed",
          runError: `stale_running_reclaimed: ${thresholdMs}ms 이상 running 유지`,
          evaluationDecision: "failed",
          evaluationReason: "stale_running_reclaimed",
        },
      });
      await tx.task.update({
        where: { id: t.id },
        data: {
          executionWorkflowStatus: EXECUTION_WORKFLOW.READY,
          lastEvalResult: "interrupted",
          lastEvalSummary:
            "이전 실행이 비정상 종료된 것으로 보입니다(오래된 running). 다시 「실행 시작」을 눌러 주세요.",
        },
      });
    });
  }

  console.warn("[execution-loop] reclaimed stale RUNNING workflow tasks", {
    projectId,
    count: stale.length,
    thresholdMs,
  });
  await refreshWorkflowStates(projectId);
  return stale.length;
}
