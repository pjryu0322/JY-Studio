/**
 * 실행 큐 (스텁). 향후 병렬 실행·스케줄링 확장용.
 * 현재는 인-프로세스 즉시 실행만 사용하며 큐는 사용하지 않는다.
 */

export type ExecutionQueueJobType = "git-apply" | "pipeline" | "cursor";

export type ExecutionQueueJob = {
  id: string;
  projectId: string;
  type: ExecutionQueueJobType;
  payload: unknown;
  enqueuedAt: string;
};

export type EnqueueResult =
  | { queued: true; jobId: string }
  | { queued: false; reason: string };

/** 스텁: 항상 큐 미사용(즉시 실행 경로만 존재) */
export async function enqueueExecution(
  job: Omit<ExecutionQueueJob, "id" | "enqueuedAt">
): Promise<EnqueueResult> {
  void job;
  return {
    queued: false,
    reason: "stub: execution queue not enabled; use synchronous API routes",
  };
}

export function getExecutionQueueStubStatus(): {
  pending: number;
  running: number;
  mode: "stub";
} {
  return { pending: 0, running: 0, mode: "stub" };
}
