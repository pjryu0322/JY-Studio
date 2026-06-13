"use client";

import { useCallback, useEffect, type MutableRefObject } from "react";
import { buildImplementationExecutionBoardFromRequirementsState } from "@/lib/prototype/implementationExecutionBoard";
import { buildImplementationBoardRefreshSyncKey } from "@/lib/prototype/implementationExecutionBoardMessage";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import { resolveOrchestrationAwareRequirementsState } from "@/lib/prototype/effectiveImplementationState";

/**
 * Controls implementation execution-board refresh synchronization.
 *
 * Scope:
 * - refresh board sync key after execution setup changes
 * - register board refresh callback ref
 * - run initial board refresh when execution setup is loaded
 * - expose execution setup changed handler
 *
 * Not scope:
 * - board rendering
 * - CodeTask execution
 * - Quick Run execution
 * - GitHub verification
 * - chat message rewriting
 */
export type ImplementationBoardRefreshControllerInput = Readonly<{
  readonly projectId: string;
  readonly orchestrationAwareRequirementsState: ReturnType<
    typeof resolveOrchestrationAwareRequirementsState
  >;
  readonly executionSetupRow: ExecutionSetupSourceGenerationRow | null;
  readonly executionSetupBoardSyncedKeyRef: MutableRefObject<string | null>;
  readonly refreshImplementationBoardRef: MutableRefObject<
    ((setup: ExecutionSetupSourceGenerationRow | null, source?: string) => void) | null
  >;
  readonly refreshExecutionEnvironmentStatus: () => Promise<ExecutionSetupSourceGenerationRow | null>;
}>;

export type ImplementationBoardRefreshControllerValue = Readonly<{
  readonly handleExecutionSetupChanged: () => Promise<void>;
}>;

export function useImplementationBoardRefreshController(
  input: ImplementationBoardRefreshControllerInput,
): ImplementationBoardRefreshControllerValue {
  const refreshImplementationBoardWithExecutionSetup = useCallback(
    (setup: ExecutionSetupSourceGenerationRow | null, _source = "board_refresh") => {
      const pid = input.projectId.trim();
      const taskList = input.orchestrationAwareRequirementsState.implementationTaskListV1;
      if (!pid || !taskList || !setup) return;

      const board = buildImplementationExecutionBoardFromRequirementsState({
        projectId: pid,
        orchestration: input.orchestrationAwareRequirementsState,
      });
      if (!board) return;

      // State-based board panel is the source of truth — env/setup refresh must not rewrite chat messages.
      input.executionSetupBoardSyncedKeyRef.current = buildImplementationBoardRefreshSyncKey({
        setup,
        previewContent: "",
        taskCount: taskList.tasks.length,
        codeAgentWipStatus:
          input.orchestrationAwareRequirementsState.codeAgentWipExecutionV1?.status ?? null,
      });
    },
    [input.projectId, input.orchestrationAwareRequirementsState, input.executionSetupBoardSyncedKeyRef],
  );

  input.refreshImplementationBoardRef.current = refreshImplementationBoardWithExecutionSetup;

  useEffect(() => {
    if (!input.executionSetupRow) return;
    input.refreshImplementationBoardRef.current?.(input.executionSetupRow, "execution_setup_loaded");
  }, [
    input.executionSetupRow,
    input.orchestrationAwareRequirementsState.implementationTaskListV1,
    input.refreshImplementationBoardRef,
  ]);

  const handleExecutionSetupChanged = useCallback(async () => {
    input.executionSetupBoardSyncedKeyRef.current = null;
    const row = await input.refreshExecutionEnvironmentStatus();
    if (!row) {
      return;
    }
    refreshImplementationBoardWithExecutionSetup(row, "execution_setup_saved");
  }, [
    input.executionSetupBoardSyncedKeyRef,
    input.refreshExecutionEnvironmentStatus,
    refreshImplementationBoardWithExecutionSetup,
  ]);

  return {
    handleExecutionSetupChanged,
  };
}
