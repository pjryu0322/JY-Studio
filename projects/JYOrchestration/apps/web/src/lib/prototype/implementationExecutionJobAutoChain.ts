import type { ImplementationExecutionBoardV1 } from "@/lib/prototype/implementationExecutionBoard";
import {
  buildImplementationExecutionJobIdempotencyKey,
  findActiveImplementationExecutionJob,
  findLatestJobByProcessTaskId,
  isTerminalImplementationExecutionJobStatus,
  type ImplementationExecutionJobV1,
} from "@/lib/prototype/implementationExecutionJob";
import { pickNextRunnableProcessTaskId } from "@/lib/prototype/implementationExecutionJobSelection";

export type ImplementationExecutionJobAutoChainDecision =
  | Readonly<{ readonly kind: "start"; readonly taskId: string; readonly idempotencyKey: string }>
  | Readonly<{ readonly kind: "none" }>;

/** Job이 terminal일 때만 다음 실행 후보 1건을 계산한다. */
export function resolveImplementationExecutionJobAutoChainDecision(input: {
  readonly board: ImplementationExecutionBoardV1 | null | undefined;
  readonly jobs: readonly ImplementationExecutionJobV1[] | null | undefined;
  readonly projectId: string;
  readonly allowedTaskIds?: readonly string[] | null;
}): ImplementationExecutionJobAutoChainDecision {
  const board = input.board;
  if (!board) return { kind: "none" };

  if (findActiveImplementationExecutionJob(input.jobs, input.projectId)) {
    return { kind: "none" };
  }

  const latest = [...(input.jobs ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!latest || !isTerminalImplementationExecutionJobStatus(latest.status)) {
    return { kind: "none" };
  }

  const exclude = [latest.processTaskId];
  const nextTaskId = pickNextRunnableProcessTaskId({
    board,
    jobs: input.jobs,
    allowedTaskIds: input.allowedTaskIds,
    excludeTaskIds: exclude,
  });
  if (!nextTaskId) return { kind: "none" };

  const attemptNo =
    (findLatestJobByProcessTaskId(input.jobs, nextTaskId)?.attemptNo ?? 0) + 1;
  return {
    kind: "start",
    taskId: nextTaskId,
    idempotencyKey: buildImplementationExecutionJobIdempotencyKey({
      projectId: input.projectId,
      processTaskId: nextTaskId,
      attemptNo,
    }),
  };
}
