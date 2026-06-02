import type { ImplementationExecutionBoardV1 } from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";

export type ImplementationExecutionOverview = Readonly<{
  readonly processTaskCount: number;
  readonly codeTaskCount: number;
  readonly inProgressCount: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly blockedCount: number;
  readonly currentTitle?: string;
  readonly isRunning: boolean;
}>;

export function buildImplementationExecutionOverview(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly activeTaskId?: string | null;
  readonly activeCodeTaskTitle?: string | null;
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
  const isRunning = inProgressCount > 0;

  return {
    processTaskCount,
    codeTaskCount,
    inProgressCount,
    completedCount,
    failedCount,
    blockedCount,
    ...(currentTitle ? { currentTitle } : {}),
    isRunning,
  };
}

export function formatImplementationExecutionOverviewLines(
  overview: ImplementationExecutionOverview,
  input?: {
    readonly selectedCodeTaskCount?: number;
  },
): readonly string[] {
  const progressDone = overview.completedCount + overview.inProgressCount;
  const lines = [
    `CodeTask 진행: ${progressDone} / ${overview.codeTaskCount}`,
    `실패: ${overview.failedCount}`,
    `차단: ${overview.blockedCount}`,
    `Process Task: ${overview.processTaskCount}개 그룹`,
    ...(typeof input?.selectedCodeTaskCount === "number"
      ? [`선택됨: ${input.selectedCodeTaskCount}개`]
      : []),
    overview.currentTitle
      ? [`현재 CodeTask: ${overview.currentTitle}`]
      : overview.isRunning
        ? []
        : ["현재 CodeTask: 없음"],
  ];
  return lines;
}
