import type { ImplementationExecutionBoardV1 } from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
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
  },
): readonly string[] {
  const progressDone = overview.completedCount + overview.inProgressCount;
  const lines = [
    `CodeTask 진행: ${progressDone} / ${overview.codeTaskCount}`,
    `실패: ${overview.failedCount}`,
    `차단: ${overview.blockedCount}`,
    ...(typeof input?.selectedCodeTaskCount === "number"
      ? [`선택됨: ${input.selectedCodeTaskCount}개`]
      : []),
    overview.currentTitle
      ? [`현재 CodeTask: ${overview.currentTitle}`]
      : overview.isRunning
        ? []
        : ["현재 CodeTask: 없음"],
    overview.runtimeStateLabel ? [`상태: ${overview.runtimeStateLabel}`] : [],
  ];
  return lines;
}
