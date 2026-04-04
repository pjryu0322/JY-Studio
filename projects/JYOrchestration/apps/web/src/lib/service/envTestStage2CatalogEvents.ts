import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";

/**
 * Stage 2 표준 카탈로그 이벤트(phase = 이벤트명).
 * 기존 env_test_stage2_* 로그와 병행 — 대시보드/외부 집계에서 phase 이름으로 필터 가능.
 */
export function logStage2CatalogEvent(input: {
  phase: string;
  projectId: string;
  taskId: string;
  userId?: string | null;
  executionId?: string | null;
  startTime?: string;
  endTime?: string;
  elapsedMs?: number;
  stage?: string;
  detail?: Record<string, unknown>;
}): void {
  appendTaskProgressLog({
    kind: "execution",
    phase: input.phase,
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.userId ?? undefined,
    detail: {
      executionId: input.executionId ?? undefined,
      stage: input.stage,
      startTime: input.startTime,
      endTime: input.endTime,
      elapsedMs: input.elapsedMs,
      ...input.detail,
    },
  });
}
