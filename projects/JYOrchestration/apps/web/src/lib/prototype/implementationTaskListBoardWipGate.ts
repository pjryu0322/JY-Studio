import {
  buildImplementationExecutionBoardFromOrchestration,
  filterCursorWorkItemsForExecutableTask,
  pickFirstExecutableDeveloperTaskId,
  type ImplementationExecutionBoardV1,
} from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";
import type { ImplementationIntegratedExecutionStateV1 } from "@/lib/prototype/implementationIntegratedExecutionState";
import type { ImplementationQualityGateResultV1 } from "@/lib/prototype/implementationQualityGate";
import {
  collectCursorWorkItemGateMissing,
  type CursorWorkItem,
} from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import {
  hasImplementationTaskListReady,
  type ImplementationTaskListV1,
} from "@/lib/requirements/implementationTaskList";

export type TaskListBoardWipGateResult = Readonly<{
  readonly allowed: boolean;
  readonly missing: readonly string[];
  readonly board?: ImplementationExecutionBoardV1;
  readonly selectedTaskId?: string | null;
  readonly selectedWorkItems?: readonly CursorWorkItem[];
}>;

export function hasTaskListForWipOrchestration(
  taskList?: ImplementationTaskListV1 | null,
): boolean {
  return hasImplementationTaskListReady(taskList);
}

export function shouldUseTaskListBoardWipGate(input: {
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
}): boolean {
  return hasImplementationTaskListReady(input.taskList) && Boolean(input.executionState);
}

export function evaluateTaskListBoardWipGate(input: {
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1;
  readonly executionState: ImplementationTaskExecutionStateV1;
  readonly workItems?: readonly CursorWorkItem[] | null;
  readonly integratedExecutionState?: ImplementationIntegratedExecutionStateV1 | null;
  readonly boardState?: ImplementationExecutionBoardStateV1 | null;
  readonly qualityGateResults?: readonly ImplementationQualityGateResultV1[] | null;
  /** @deprecated WIP draft creation no longer requires env; kept for call-site compatibility */
  readonly envOk?: boolean;
}): TaskListBoardWipGateResult {
  const board = buildImplementationExecutionBoardFromOrchestration({
    projectId: input.projectId,
    taskList: input.taskList,
    executionState: input.executionState,
    integratedExecutionState: input.integratedExecutionState,
    boardState: input.boardState,
    qualityGateResults: input.qualityGateResults,
  });

  const selectedTaskId = pickFirstExecutableDeveloperTaskId(board);
  if (!selectedTaskId) {
    return { allowed: false, missing: ["실행 가능한 AI 개발자 작업이 없습니다."], board };
  }

  const items = input.workItems ?? [];
  if (!items.length) {
    return {
      allowed: false,
      missing: ["Cursor WorkItem이 없습니다."],
      board,
      selectedTaskId,
    };
  }

  const scoped = filterCursorWorkItemsForExecutableTask({ board, workItems: items });
  if (!scoped.selectedWorkItems.length) {
    return {
      allowed: false,
      missing: [
        scoped.blockedReason ?? "선택된 작업에 해당하는 Cursor WorkItem이 없습니다.",
      ],
      board,
      selectedTaskId: scoped.selectedTaskId,
    };
  }

  const missing: string[] = [];
  for (const item of scoped.selectedWorkItems) {
    missing.push(...collectCursorWorkItemGateMissing(item));
    if (item.blocked) missing.push("차단된 task 존재");
  }

  const uniq = [...new Set(missing)];
  return {
    allowed: uniq.length === 0,
    missing: uniq,
    board,
    selectedTaskId: scoped.selectedTaskId,
    selectedWorkItems: scoped.selectedWorkItems,
  };
}
