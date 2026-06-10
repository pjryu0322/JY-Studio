import { evaluateSelectedRunnableCodeTasksGateFromBoard } from "@/lib/prototype/implementationCodeTaskBoardState";

export function evaluateQuickRunExecutionSelectionGate(input: {
  readonly selectedCodeTaskIds: readonly string[];
  readonly runnableCodeTaskIdsFromBoard: readonly string[];
}): ReturnType<typeof evaluateSelectedRunnableCodeTasksGateFromBoard> {
  return evaluateSelectedRunnableCodeTasksGateFromBoard({
    selectedCodeTaskIds: input.selectedCodeTaskIds,
    runnableCodeTaskIds: input.runnableCodeTaskIdsFromBoard,
  });
}
