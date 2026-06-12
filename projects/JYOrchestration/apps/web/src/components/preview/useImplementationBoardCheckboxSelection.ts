import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  logImplementationBoardSelectionSummaryResolved,
  listRunnableCodeTaskIdsFromBoardNodes,
  listUserCheckboxSelectableCodeTaskIdsFromBoardNodes,
  pruneCheckedCodeTaskIdsToSelectableBoardRows,
  summarizeCodeTaskBoardRowsFromTreeNodes,
  type ImplementationCodeTaskBoardStateV1,
} from "@/lib/prototype/implementationCodeTaskBoardState";
import { resolveCodeTaskTreeSelectAllHeaderState } from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";

export function useImplementationBoardCheckedCodeTaskIds(input: {
  readonly projectId: string;
  readonly boardProjectId: string;
  readonly checkedFromBoard: readonly string[];
  readonly onSelectedCodeTaskIdsChange?: (selectedCodeTaskIds: readonly string[]) => void;
  readonly liveCheckedCodeTaskIdsRef?: React.MutableRefObject<readonly string[] | null>;
}): Readonly<{
  readonly checkedCodeTaskIds: readonly string[];
  readonly commitCheckedCodeTaskIds: (nextSelectedCodeTaskIds: readonly string[]) => void;
}> {
  const [checkedCodeTaskIds, setCheckedCodeTaskIds] = useState<readonly string[]>([]);
  const selectionHydratedForProjectRef = useRef<string | null>(null);

  useEffect(() => {
    const pid = (input.projectId || input.boardProjectId).trim();
    if (!pid) return;
    if (selectionHydratedForProjectRef.current === pid) return;
    selectionHydratedForProjectRef.current = pid;
    setCheckedCodeTaskIds(input.checkedFromBoard);
  }, [input.projectId, input.boardProjectId, input.checkedFromBoard]);

  if (input.liveCheckedCodeTaskIdsRef) {
    input.liveCheckedCodeTaskIdsRef.current = checkedCodeTaskIds;
  }

  const commitCheckedCodeTaskIds = (nextSelectedCodeTaskIds: readonly string[]) => {
    const next = [...new Set(nextSelectedCodeTaskIds.map((id) => id.trim()).filter(Boolean))];
    setCheckedCodeTaskIds(next);
    input.onSelectedCodeTaskIdsChange?.(next);
  };

  return { checkedCodeTaskIds, commitCheckedCodeTaskIds };
}

export function useImplementationBoardCodeTaskSelectionSummary(input: {
  readonly projectId: string;
  readonly boardProjectId: string;
  readonly checkedCodeTaskIds: readonly string[];
  readonly taskTreeNodes: readonly {
    readonly codeTaskId: string;
    readonly boardState: ImplementationCodeTaskBoardStateV1;
  }[];
  readonly onCodeTaskSelectionSummaryChange?: (
    summary: ReturnType<typeof summarizeCodeTaskBoardRowsFromTreeNodes>,
  ) => void;
  readonly liveRunnableCodeTaskIdsRef?: React.MutableRefObject<readonly string[] | null>;
}): Readonly<{
  readonly codeTaskSelectionSummary: ReturnType<typeof summarizeCodeTaskBoardRowsFromTreeNodes>;
  readonly runnableCodeTaskIdsFromBoard: readonly string[];
  readonly userSelectableCodeTaskIdsFromBoard: readonly string[];
  readonly selectAllHeaderState: ReturnType<typeof resolveCodeTaskTreeSelectAllHeaderState>;
}> {
  const runnableCodeTaskIdsFromBoard = useMemo(
    () => listRunnableCodeTaskIdsFromBoardNodes(input.taskTreeNodes),
    [input.taskTreeNodes],
  );

  if (input.liveRunnableCodeTaskIdsRef) {
    input.liveRunnableCodeTaskIdsRef.current = runnableCodeTaskIdsFromBoard;
  }

  const userSelectableCodeTaskIdsFromBoard = useMemo(
    () => listUserCheckboxSelectableCodeTaskIdsFromBoardNodes(input.taskTreeNodes),
    [input.taskTreeNodes],
  );

  const codeTaskSelectionSummary = useMemo(
    () =>
      summarizeCodeTaskBoardRowsFromTreeNodes({
        nodes: input.taskTreeNodes,
        checkedCodeTaskIds: input.checkedCodeTaskIds,
      }),
    [input.taskTreeNodes, input.checkedCodeTaskIds],
  );

  useEffect(() => {
    logImplementationBoardSelectionSummaryResolved({
      projectId: input.projectId || input.boardProjectId,
      summary: codeTaskSelectionSummary,
    });
  }, [input.projectId, input.boardProjectId, codeTaskSelectionSummary]);

  useLayoutEffect(() => {
    input.onCodeTaskSelectionSummaryChange?.(codeTaskSelectionSummary);
  }, [codeTaskSelectionSummary, input.onCodeTaskSelectionSummaryChange]);

  const selectAllHeaderState = useMemo(
    () =>
      resolveCodeTaskTreeSelectAllHeaderState({
        selectedCodeTaskIds: input.checkedCodeTaskIds,
        userSelectableCodeTaskIds: userSelectableCodeTaskIdsFromBoard,
      }),
    [input.checkedCodeTaskIds, userSelectableCodeTaskIdsFromBoard],
  );

  return {
    codeTaskSelectionSummary,
    runnableCodeTaskIdsFromBoard,
    userSelectableCodeTaskIdsFromBoard,
    selectAllHeaderState,
  };
}

export function usePruneNonSelectableCheckedCodeTaskIds(input: {
  readonly taskTreeNodes: readonly {
    readonly codeTaskId: string;
    readonly boardState: ImplementationCodeTaskBoardStateV1;
  }[];
  readonly checkedCodeTaskIds: readonly string[];
  readonly commitCheckedCodeTaskIds: (nextSelectedCodeTaskIds: readonly string[]) => void;
}): void {
  useLayoutEffect(() => {
    const pruned = pruneCheckedCodeTaskIdsToSelectableBoardRows({
      nodes: input.taskTreeNodes,
      checkedCodeTaskIds: input.checkedCodeTaskIds,
    });
    const currentKey = input.checkedCodeTaskIds.join("\0");
    const prunedKey = pruned.join("\0");
    if (currentKey !== prunedKey) {
      input.commitCheckedCodeTaskIds(pruned);
    }
  }, [input.taskTreeNodes, input.checkedCodeTaskIds, input.commitCheckedCodeTaskIds]);
}
