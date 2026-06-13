"use client";

import { useCallback, type MutableRefObject } from "react";
import type { useImplementationBoardSelectionBridge } from "@/components/preview/useImplementationBoardSelectionBridge";
import type { ImplementationStageActionOrchestratorValue } from "@/components/preview/useImplementationStageActionOrchestrator";
import { resolveTaskCursorExecutionEnvGate } from "@/lib/prototype/implementationBoardEnvDetailView";
import { updateBoardCheckedCodeTaskIds } from "@/lib/prototype/implementationBoardCheckedIds";
import type { ImplementationStageActionClickInput } from "@/lib/prototype/implementationStageActionBinding";
import type { ImplementationStageActionRunResult } from "@/lib/prototype/implementationStageActionPipeline";
import type { ImplementationStageBoardGateContext } from "@/lib/prototype/implementationStageActionPipeline";
import type { ImplementationStageActionId } from "@/lib/prototype/effectiveImplementationState";
import {
  resolveTaskRowUserRestartCapability,
} from "@/lib/prototype/implementationExecutionBoard";
import { updateBoardSelectedTaskIds } from "@/lib/prototype/implementationExecutionBoardState";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

/**
 * Controls implementation execution-board user interactions.
 *
 * Scope:
 * - restart a board task after capability/env checks
 * - persist selected board task ids
 * - persist checked CodeTask ids
 * - bridge board action clicks to the stage action orchestrator
 *
 * Not scope:
 * - concrete CodeTask execution
 * - Quick Run internals
 * - GitHub verification internals
 * - Integration pipeline internals
 * - board rendering
 */
export type ImplementationBoardInteractionControllerInput = Readonly<{
  readonly projectId: string;
  readonly implementationStageBoardGateContext: ImplementationStageBoardGateContext | null;
  readonly parsedRequirementsState: RequirementsStateJson;
  readonly orchestrationAwareRequirementsState: RequirementsStateJson;
  readonly orchestrationAwareRequirementsStateRef: MutableRefObject<RequirementsStateJson>;
  readonly executionSetupRow: ExecutionSetupSourceGenerationRow | null;
  readonly boardSelectionBridge: ReturnType<typeof useImplementationBoardSelectionBridge>;
  readonly boardManualPickTaskIdRef: MutableRefObject<string | null>;
  readonly runOrchestratedStageAction: ImplementationStageActionOrchestratorValue["runOrchestratedStageAction"];
  readonly runImplementationStageActionRef: MutableRefObject<
    (
      actionId: ImplementationStageActionId,
    ) => ImplementationStageActionRunResult | Promise<ImplementationStageActionRunResult>
  >;
  readonly executeImplementationStageAction: ImplementationStageActionOrchestratorValue["executeImplementationStageAction"];
  readonly applyImplementationOrchestrationResult: (
    input: {
      readonly orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
    },
    options?: { readonly persist?: boolean; readonly forcePersist?: boolean },
  ) => void;
  readonly applyPendingFromOrchestrationPatchRef: MutableRefObject<
    (patch: PrototypeExecutionOrchestrationPersistInput | undefined) => void
  >;
  readonly appendAiNoticeForImplementation: (message: string) => void;
}>;

export type ImplementationBoardInteractionControllerValue = Readonly<{
  readonly handleRestartBoardTask: (taskId: string) => void;
  readonly handleBoardSelectedTaskIdsChange: (selectedTaskIds: readonly string[]) => void;
  readonly handleBoardSelectedCodeTaskIdsChange: (selectedCodeTaskIds: readonly string[]) => void;
  readonly handleImplementationBoardAction: (input: ImplementationStageActionClickInput) => void;
}>;

export function useImplementationBoardInteractionController(
  input: ImplementationBoardInteractionControllerInput,
): ImplementationBoardInteractionControllerValue {
  const handleRestartBoardTask = useCallback(
    (taskId: string) => {
      const pid = input.projectId.trim();
      const board = input.implementationStageBoardGateContext?.board;
      if (!pid || !board) {
        return;
      }
      const row = board.taskRows.find((item) => item.taskId === taskId);
      if (!row) {
        return;
      }
      const taskCursorExecution =
        parseTaskCursorExecutionV1(input.orchestrationAwareRequirementsState.taskCursorExecutionV1) ??
        null;
      const capability = resolveTaskRowUserRestartCapability({
        row,
        board,
        taskCursorExecution,
      });
      if (!capability.canRestart) {
        return;
      }
      const envGate = resolveTaskCursorExecutionEnvGate({ setup: input.executionSetupRow });
      if (envGate.blocked) {
        input.appendAiNoticeForImplementation(envGate.message ?? "환경설정 점검이 필요합니다.");
        return;
      }

      input.boardManualPickTaskIdRef.current = taskId;
      input.runOrchestratedStageAction({
        actionId: "REQUEST_TASK_CURSOR_EXECUTION",
        execute: () => input.runImplementationStageActionRef.current("REQUEST_TASK_CURSOR_EXECUTION"),
      });
    },
    [
      input.projectId,
      input.implementationStageBoardGateContext,
      input.orchestrationAwareRequirementsState.taskCursorExecutionV1,
      input.executionSetupRow,
      input.boardManualPickTaskIdRef,
      input.runOrchestratedStageAction,
      input.runImplementationStageActionRef,
      input.appendAiNoticeForImplementation,
    ],
  );

  const handleBoardSelectedTaskIdsChange = useCallback(
    (selectedTaskIds: readonly string[]) => {
      const pid = input.projectId.trim();
      if (!pid) return;
      const nowIso = new Date().toISOString();
      const nextBoardState = updateBoardSelectedTaskIds({
        state: input.parsedRequirementsState.implementationExecutionBoardStateV1,
        projectId: pid,
        selectedTaskIds,
        nowIso,
      });
      input.applyImplementationOrchestrationResult({
        orchestrationPatch: {
          implementationExecutionBoardStateV1: nextBoardState,
        },
      });
    },
    [
      input.projectId,
      input.parsedRequirementsState.implementationExecutionBoardStateV1,
      input.applyImplementationOrchestrationResult,
    ],
  );

  const handleBoardSelectedCodeTaskIdsChange = useCallback(
    (selectedCodeTaskIds: readonly string[]) => {
      const pid = input.projectId.trim();
      if (!pid) return;
      input.boardSelectionBridge.recordPersistedBoardSelection(selectedCodeTaskIds);
      const nowIso = new Date().toISOString();
      const nextBoardState = updateBoardCheckedCodeTaskIds({
        state:
          input.orchestrationAwareRequirementsStateRef.current.implementationExecutionBoardStateV1,
        projectId: pid,
        checkedCodeTaskIds: selectedCodeTaskIds,
        nowIso,
      });
      input.applyPendingFromOrchestrationPatchRef.current({
        implementationExecutionBoardStateV1: nextBoardState,
      });
      input.applyImplementationOrchestrationResult(
        {
          orchestrationPatch: {
            implementationExecutionBoardStateV1: nextBoardState,
          },
        },
        { persist: true, forcePersist: true },
      );
    },
    [
      input.projectId,
      input.boardSelectionBridge,
      input.orchestrationAwareRequirementsStateRef,
      input.applyPendingFromOrchestrationPatchRef,
      input.applyImplementationOrchestrationResult,
    ],
  );

  const handleImplementationBoardAction = useCallback(
    (clickInput: ImplementationStageActionClickInput) => {
      input.executeImplementationStageAction(clickInput.actionId, {
        label: clickInput.label,
        source: clickInput.source,
        buttonIndex: clickInput.buttonIndex,
      });
    },
    [input.executeImplementationStageAction],
  );

  return {
    handleRestartBoardTask,
    handleBoardSelectedTaskIdsChange,
    handleBoardSelectedCodeTaskIdsChange,
    handleImplementationBoardAction,
  };
}
