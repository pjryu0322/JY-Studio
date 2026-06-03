import type { ImplementationExecutionBoardV1 } from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { CodeTaskExecutionQueueV1 } from "@/lib/prototype/codeTaskExecutionQueue";
import { summarizeCodeTaskExecutionQueueRuns } from "@/lib/prototype/codeTaskExecutionRunUi";
import {
  formatRuntimeStateKo,
  isRuntimeInFlight,
  type ImplementationRuntimeStateV1,
  type RuntimeState,
} from "@/lib/prototype/implementationRuntimeState";

export type ImplementationExecutionOverview = Readonly<{
  readonly processTaskCount: number;
  readonly codeTaskCount: number;
  readonly inProgressCount: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly blockedCount: number;
  readonly currentTitle?: string;
  readonly isRunning: boolean;
  readonly runtimeState?: RuntimeState;
  readonly runtimeStateLabel?: string;
}>;

export type SelectedCodeTaskExecutionProgress = Readonly<{
  readonly done: number;
  readonly total: number;
}>;

export function resolveSelectedCodeTaskExecutionProgress(input: {
  readonly selectedCodeTaskIds: readonly string[];
  readonly queue?: CodeTaskExecutionQueueV1 | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
}): SelectedCodeTaskExecutionProgress | null {
  const total = input.selectedCodeTaskIds.length;
  if (!total) return null;
  const queue = input.queue;
  if (!queue || queue.status === "idle") return null;

  const summary = summarizeCodeTaskExecutionQueueRuns({
    runs: input.runs ?? [],
    selectedCodeTaskIds: input.selectedCodeTaskIds,
  });
  const terminalDone = summary.completed + summary.noCodeChange;

  if (queue.status === "running") {
    const position = Math.min(queue.currentIndex + 1, total);
    const done = Math.max(terminalDone, position);
    return { done: Math.min(done, total), total };
  }

  if (
    queue.status === "completed" ||
    queue.status === "completed_with_issues" ||
    queue.status === "failed" ||
    queue.status === "paused"
  ) {
    return { done: Math.min(terminalDone, total), total };
  }

  return null;
}

export function buildImplementationExecutionOverview(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly activeTaskId?: string | null;
  readonly activeCodeTaskTitle?: string | null;
  readonly runtime?: ImplementationRuntimeStateV1 | null;
  /** DB Runtime Engine (P2) — JSON보다 우선 */
  readonly dbRuntimeState?: RuntimeState | null;
}): ImplementationExecutionOverview {
  const processTaskCount = input.board.taskRows.length;
  const planCount = input.codeTaskPlan?.codeTaskCount ?? input.codeTaskPlan?.tasks.length ?? 0;
  const codeTaskCount = planCount > 0 ? planCount : processTaskCount;

  const inProgressCount = input.board.summary.inProgressTasks;
  const completedCount = input.board.summary.completedTasks;
  const failedCount =
    (input.board.summary.reworkRequiredTasks ?? 0) +
    input.board.taskRows.filter((row) => row.developerStatus === "failed").length;
  const blockedCount = input.board.summary.blockedByDependencyTasks ?? 0;

  const activeRow = input.activeTaskId
    ? input.board.taskRows.find((row) => row.taskId === input.activeTaskId)
    : undefined;
  const currentTitle =
    input.activeCodeTaskTitle?.trim() ||
    activeRow?.title?.trim() ||
    undefined;
  const runtimeState = input.dbRuntimeState ?? input.runtime?.runtimeState;
  const isRunning = isRuntimeInFlight(runtimeState) || inProgressCount > 0;

  return {
    processTaskCount,
    codeTaskCount,
    inProgressCount,
    completedCount,
    failedCount,
    blockedCount,
    ...(currentTitle ? { currentTitle } : {}),
    isRunning,
    ...(runtimeState ? { runtimeState, runtimeStateLabel: formatRuntimeStateKo(runtimeState) } : {}),
  };
}

export function formatImplementationExecutionOverviewLines(
  overview: ImplementationExecutionOverview,
  input?: {
    readonly selectedCodeTaskCount?: number;
    readonly selectedExecutionProgress?: SelectedCodeTaskExecutionProgress | null;
    readonly queueRunning?: boolean;
  },
): readonly string[] {
  const lines: string[] = [`전체 CodeTask: ${overview.codeTaskCount}개`];

  if (typeof input?.selectedCodeTaskCount === "number") {
    lines.push(`선택 CodeTask: ${input.selectedCodeTaskCount}개`);
  }

  const progress = input?.selectedExecutionProgress;
  const showSelectedProgress =
    progress && progress.total > 0 && (input?.queueRunning || overview.isRunning);
  if (showSelectedProgress) {
    lines.push(`선택 실행 진행: ${progress.done} / ${progress.total}`);
  }

  if (overview.currentTitle) {
    lines.push(`현재 CodeTask: ${overview.currentTitle}`);
  }

  if (overview.isRunning && overview.runtimeStateLabel) {
    lines.push(`상태: ${overview.runtimeStateLabel}`);
  } else if (
    typeof input?.selectedCodeTaskCount === "number" &&
    input.selectedCodeTaskCount > 0 &&
    !showSelectedProgress
  ) {
    lines.push("상태: 선택한 CodeTask 실행 대기");
  } else if (!overview.isRunning) {
    lines.push("상태: 대기");
  }

  if (overview.failedCount > 0) {
    lines.push(`실패: ${overview.failedCount}`);
  }
  if (overview.blockedCount > 0) {
    lines.push(`차단: ${overview.blockedCount}`);
  }

  return lines;
}
