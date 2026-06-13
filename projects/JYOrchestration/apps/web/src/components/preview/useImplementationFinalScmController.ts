"use client";

import { useCallback, type RefObject } from "react";
import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  buildImplementationExecutionBoardFromRequirementsState,
  buildIntegratedStageStepActionNotice,
} from "@/lib/prototype/implementationExecutionBoard";
import { buildImplementationExecutionBoardMessage } from "@/lib/prototype/implementationExecutionBoardMessage";
import {
  resolveCodeAgentWipForFinalScmIntegratedStage,
  validateFinalScmIntegratedStageReadiness,
  prepareCodeAgentWipForFinalScmIntegratedStage,
  isFinalScmPlatformExecutionCompleted,
  buildFinalScmIntegratedStageStartedNotice,
  buildFinalScmIntegratedStageCompletedNotice,
  buildFinalScmIntegratedStageFailedNotice,
} from "@/lib/prototype/implementationFinalScmIntegratedStage";
import {
  finalizeIntegratedStageStep,
  markIntegratedStepInProgress,
} from "@/lib/prototype/implementationIntegratedExecutionState";
import type { deriveImplementationPrototypeRunSyncSnapshot } from "@/lib/prototype/implementationPrototypeRunSync";
import type { ImplementationStageActionRunResult } from "@/lib/prototype/implementationStageActionPipeline";
import { readImplementationStageChatMessages } from "@/lib/prototype/implementationStageChatSnapshot";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import {
  buildPlatformScmOrchestrationPatchFromPersist,
  fetchPlatformScmExecutePersistPatch,
  fetchPlatformScmMergePersistPatch,
  shouldAttemptAutoPlatformScmMerge,
  validatePlatformScmMergeStepReadiness,
  type PlatformScmExecutePersistPatch,
  type PlatformScmMergePersistPatch,
} from "@/lib/prototype/prototypePlatformScmPanelClient";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { parseRequirementsStateJson, type RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

/**
 * Controls implementation-stage Final SCM and platform SCM actions.
 *
 * Scope:
 * - execute platform SCM push/PR step
 * - execute platform SCM merge step
 * - persist platform SCM orchestration patches
 * - finalize integrated final SCM stage
 * - auto-merge after platform SCM push when allowed
 *
 * Not scope:
 * - Cursor CodeTask execution
 * - GitHub verification internals
 * - Integration pipeline execution
 * - Preview entry/fallback
 * - board rendering
 */
export type ImplementationFinalScmControllerInput = Readonly<{
  readonly projectId: string;
  readonly parsedRequirementsState: RequirementsStateJson;
  readonly requirementsStateJsonRef: RefObject<unknown>;
  readonly orchestrationAwareRequirementsState: RequirementsStateJson;
  readonly executionSetupRow: ExecutionSetupSourceGenerationRow | null;
  readonly prototypeRunSyncSnapshot: ReturnType<typeof deriveImplementationPrototypeRunSyncSnapshot>;
  readonly applyImplementationOrchestrationResult: (
    input: {
      readonly messages?: readonly RequirementsMessage[];
      readonly orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
    },
    options?: { readonly persist?: boolean; readonly forcePersist?: boolean },
  ) => void;
  readonly persistChatToDb: (
    chat?: unknown,
    orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput,
    message?: unknown,
    options?: { readonly awaitServer?: boolean; readonly force?: boolean },
  ) => Promise<unknown> | void;
  readonly appendAiNoticeForImplementation: (message: string) => void;
  readonly appendImplementationTaskListAiMessage: (message: RequirementsMessage) => void;
}>;

export type ImplementationFinalScmControllerValue = Readonly<{
  readonly applyPlatformScmExecutorJson: (input: {
    readonly wip: CodeAgentWipExecutionV1;
    readonly finalizeIntegratedFinalScm?: boolean;
    readonly taskRowsCompleted?: boolean;
  }) => Promise<PlatformScmExecutePersistPatch>;
  readonly applyPlatformScmMergeExecutorJson: (input: {
    readonly wip: CodeAgentWipExecutionV1;
    readonly autoMergeOnly?: boolean;
  }) => Promise<PlatformScmMergePersistPatch>;
  readonly tryAutoPlatformScmMergeAfterPush: (wip: CodeAgentWipExecutionV1) => Promise<void>;
  readonly executePlatformScmAfterRequest: (wip: CodeAgentWipExecutionV1) => void;
  readonly runFinalScmIntegratedStageStep: () => ImplementationStageActionRunResult;
  readonly runPlatformScmMergeStep: () => ImplementationStageActionRunResult;
}>;

export function useImplementationFinalScmController(
  input: ImplementationFinalScmControllerInput,
): ImplementationFinalScmControllerValue {
  const applyPlatformScmExecutorJson = useCallback(
    async (executorInput: {
      readonly wip: CodeAgentWipExecutionV1;
      readonly finalizeIntegratedFinalScm?: boolean;
      readonly taskRowsCompleted?: boolean;
    }) => {
      const refState = parseRequirementsStateJson(input.requirementsStateJsonRef.current);
      return fetchPlatformScmExecutePersistPatch({
        projectId: input.projectId,
        wip: executorInput.wip,
        requirementsStateJson: input.requirementsStateJsonRef.current,
        promptTimeline: refState.promptTimeline ?? [],
        executionState: refState.implementationTaskExecutionStateV1,
        integratedExecutionState: refState.implementationIntegratedExecutionStateV1,
        taskRowsCompleted: executorInput.taskRowsCompleted,
        finalizeIntegratedFinalScm: executorInput.finalizeIntegratedFinalScm,
      });
    },
    [input.projectId, input.requirementsStateJsonRef],
  );

  const applyPlatformScmMergeExecutorJson = useCallback(
    async (mergeInput: {
      readonly wip: CodeAgentWipExecutionV1;
      readonly autoMergeOnly?: boolean;
    }) => {
      const refState = parseRequirementsStateJson(input.requirementsStateJsonRef.current);
      return fetchPlatformScmMergePersistPatch({
        projectId: input.projectId,
        wip: mergeInput.wip,
        requirementsStateJson: input.requirementsStateJsonRef.current,
        promptTimeline: refState.promptTimeline ?? [],
        executionState: refState.implementationTaskExecutionStateV1,
        qualityGateResults: refState.implementationQualityGateResultsV1,
        autoMergeOnly: mergeInput.autoMergeOnly,
      });
    },
    [input.projectId, input.requirementsStateJsonRef],
  );

  const persistPlatformScmOrchestrationPatch = useCallback(
    (persistPatch: PlatformScmExecutePersistPatch) => {
      const patch = buildPlatformScmOrchestrationPatchFromPersist(persistPatch);
      if (!patch) return;
      input.applyImplementationOrchestrationResult({
        messages:
          persistPatch.orchestration.chatPatch?.messages ??
          readImplementationStageChatMessages(input.requirementsStateJsonRef.current),
        orchestrationPatch: {
          ...patch.orchestrationPatch,
          ...(patch.executionState
            ? { implementationTaskExecutionStateV1: patch.executionState }
            : {}),
          ...(patch.integratedExecutionState
            ? { implementationIntegratedExecutionStateV1: patch.integratedExecutionState }
            : {}),
        },
      });
    },
    [input.applyImplementationOrchestrationResult, input.requirementsStateJsonRef],
  );

  const persistPlatformScmMergePatch = useCallback(
    (persistPatch: PlatformScmMergePersistPatch) => {
      const patch = buildPlatformScmOrchestrationPatchFromPersist(persistPatch);
      if (!patch) return;
      input.applyImplementationOrchestrationResult({
        messages:
          persistPatch.orchestration.chatPatch?.messages ??
          readImplementationStageChatMessages(input.requirementsStateJsonRef.current),
        orchestrationPatch: {
          ...patch.orchestrationPatch,
          ...(patch.executionState
            ? { implementationTaskExecutionStateV1: patch.executionState }
            : {}),
        },
      });
    },
    [input.applyImplementationOrchestrationResult, input.requirementsStateJsonRef],
  );

  const tryAutoPlatformScmMergeAfterPush = useCallback(
    async (wip: CodeAgentWipExecutionV1) => {
      if (!shouldAttemptAutoPlatformScmMerge(wip)) return;
      try {
        const mergePatch = await applyPlatformScmMergeExecutorJson({ wip, autoMergeOnly: true });
        persistPlatformScmMergePatch(mergePatch);
        if (mergePatch.orchestration.message) {
        }
      } catch {
        // auto-merge is best-effort after push/PR
      }
    },
    [applyPlatformScmMergeExecutorJson, persistPlatformScmMergePatch],
  );

  const executePlatformScmAfterRequest = useCallback(
    (wip: CodeAgentWipExecutionV1) => {
      void (async () => {
        try {
          const persistPatch = await applyPlatformScmExecutorJson({ wip });
          persistPlatformScmOrchestrationPatch(persistPatch);
          const updatedWip =
            persistPatch.orchestration.orchestrationPatch?.codeAgentWipExecutionV1 ?? wip;
          if (persistPatch.orchestration.kind === "completed") {
            await tryAutoPlatformScmMergeAfterPush(updatedWip);
          }
        } catch (error) {
        }
      })();
    },
    [applyPlatformScmExecutorJson, persistPlatformScmOrchestrationPatch, tryAutoPlatformScmMergeAfterPush],
  );

  const runFinalScmIntegratedStageStep = useCallback((): ImplementationStageActionRunResult => {
    const pid = input.projectId.trim();
    if (!pid) {
      const message = "프로젝트를 선택해 주세요.";
      return { outcome: "blocked", message };
    }

    const resolvedWip = resolveCodeAgentWipForFinalScmIntegratedStage({
      projectId: pid,
      existingWip: input.orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
      previewScope: input.parsedRequirementsState.implementationPreviewScopeV1 ?? null,
      codeTaskPlan: input.parsedRequirementsState.implementationCodeTaskPlanV1 ?? null,
      taskList: input.parsedRequirementsState.implementationTaskListV1 ?? null,
      codeTaskRuns: parseCodeTaskExecutionRunsV1(
        input.parsedRequirementsState.codeTaskExecutionRunsV1,
      ),
      taskCursorExecution: input.parsedRequirementsState.taskCursorExecutionV1 ?? null,
      taskCursorExecutionHistory: input.parsedRequirementsState.taskCursorExecutionHistoryV1 ?? null,
      autoQualityGate: input.parsedRequirementsState.implementationAutoQualityGateV1 ?? null,
      executionSetup: input.executionSetupRow,
    });
    if (!resolvedWip.ok) {
      return { outcome: "blocked", message: resolvedWip.message };
    }
    const wip = resolvedWip.wip;
    if (resolvedWip.synthesized) {
      input.applyImplementationOrchestrationResult({
        orchestrationPatch: { codeAgentWipExecutionV1: wip },
      });
      void input.persistChatToDb(undefined, { codeAgentWipExecutionV1: wip });
    }
    const readiness = validateFinalScmIntegratedStageReadiness(wip);
    if (!readiness.ok) {
      return { outcome: "blocked", message: readiness.message };
    }

    const taskList = input.parsedRequirementsState.implementationTaskListV1;
    if (!taskList) {
      const message = "구현 작업목록이 없어 통합 단계를 실행할 수 없습니다.";
      return { outcome: "blocked", message };
    }

    const boardBefore = buildImplementationExecutionBoardFromRequirementsState({
      projectId: pid,
      orchestration: input.parsedRequirementsState,
    });
    if (!boardBefore) {
      const message = "구현 실행 보드를 만들 수 없습니다.";
      return { outcome: "blocked", message };
    }
    const allTasksComplete = boardBefore.taskRows.every((row) => row.currentRole === "completed");

    if (isFinalScmPlatformExecutionCompleted(wip)) {
      const prior = input.parsedRequirementsState.implementationIntegratedExecutionStateV1;
      const done = finalizeIntegratedStageStep({
        state: prior,
        projectId: pid,
        step: "final_scm",
        taskRowsCompleted: allTasksComplete,
      });
      void input.persistChatToDb(undefined, {
        implementationIntegratedExecutionStateV1: done,
      });
      const actionNotice = buildIntegratedStageStepActionNotice({ step: "final_scm", integratedState: done });
      input.appendAiNoticeForImplementation(actionNotice);
      const nowIso = new Date().toISOString();
      const nextBoard = buildImplementationExecutionBoardFromRequirementsState({
        projectId: pid,
        orchestration: input.parsedRequirementsState,
        integratedExecutionState: done,
      })!;
      input.appendImplementationTaskListAiMessage(
        buildImplementationExecutionBoardMessage({
          board: nextBoard,
          nowIso,
          previewReady: input.prototypeRunSyncSnapshot.previewReady,
          codeAgentWipExecutionV1: wip,
          executionSetup: input.executionSetupRow,
        }),
      );
      return { outcome: "executed" };
    }

    const preparedWip = prepareCodeAgentWipForFinalScmIntegratedStage({ wip: wip! });
    const inProgressIntegrated = markIntegratedStepInProgress({
      state: input.parsedRequirementsState.implementationIntegratedExecutionStateV1,
      projectId: pid,
      step: "final_scm",
      resultSummary: "플랫폼 SCM push/PR 실행 중",
    });

    input.applyImplementationOrchestrationResult({
      orchestrationPatch: {
        codeAgentWipExecutionV1: preparedWip,
        implementationIntegratedExecutionStateV1: inProgressIntegrated,
      },
    });
    input.appendAiNoticeForImplementation(buildFinalScmIntegratedStageStartedNotice());

    void (async () => {
      try {
        const persistPatch = await applyPlatformScmExecutorJson({
          wip: preparedWip,
          finalizeIntegratedFinalScm: true,
          taskRowsCompleted: allTasksComplete,
        });
        const notice =
          persistPatch.orchestration.kind === "completed"
            ? buildFinalScmIntegratedStageCompletedNotice({
                message: persistPatch.orchestration.message,
                scm:
                  persistPatch.orchestration.orchestrationPatch?.codeAgentWipExecutionV1
                    ?.platformScmExecutionV1,
              })
            : buildFinalScmIntegratedStageFailedNotice(persistPatch.orchestration.message);

        if (persistPatch.orchestration.orchestrationPatch) {
          input.applyImplementationOrchestrationResult({
            messages:
              persistPatch.orchestration.chatPatch?.messages ??
              readImplementationStageChatMessages(input.requirementsStateJsonRef.current),
            orchestrationPatch: {
              ...persistPatch.orchestration.orchestrationPatch,
              ...(persistPatch.executionState
                ? { implementationTaskExecutionStateV1: persistPatch.executionState }
                : {}),
              ...(persistPatch.integratedExecutionState
                ? { implementationIntegratedExecutionStateV1: persistPatch.integratedExecutionState }
                : {}),
            },
          });
        }

        input.appendAiNoticeForImplementation(notice);

        if (persistPatch.orchestration.kind === "completed") {
          const updatedWip =
            persistPatch.orchestration.orchestrationPatch?.codeAgentWipExecutionV1 ?? preparedWip;
          await tryAutoPlatformScmMergeAfterPush(updatedWip);
        }

        const nowIso = new Date().toISOString();
        const refState = parseRequirementsStateJson(input.requirementsStateJsonRef.current);
        const nextBoard = buildImplementationExecutionBoardFromRequirementsState({
          projectId: pid,
          orchestration: refState,
          integratedExecutionState: persistPatch.integratedExecutionState,
        })!;
        input.appendImplementationTaskListAiMessage(
          buildImplementationExecutionBoardMessage({
            board: nextBoard,
            nowIso,
            previewReady: input.prototypeRunSyncSnapshot.previewReady,
            codeAgentWipExecutionV1:
              persistPatch.orchestration.orchestrationPatch?.codeAgentWipExecutionV1 ?? preparedWip,
            executionSetup: input.executionSetupRow,
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        input.appendAiNoticeForImplementation(buildFinalScmIntegratedStageFailedNotice(message));
      }
    })();

    return { outcome: "executed" };
  }, [
    input.projectId,
    input.orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
    input.parsedRequirementsState,
    input.applyImplementationOrchestrationResult,
    applyPlatformScmExecutorJson,
    tryAutoPlatformScmMergeAfterPush,
    input.appendImplementationTaskListAiMessage,
    input.prototypeRunSyncSnapshot.previewReady,
    input.executionSetupRow,
    input.persistChatToDb,
    input.appendAiNoticeForImplementation,
    input.requirementsStateJsonRef,
  ]);

  const runPlatformScmMergeStep = useCallback((): ImplementationStageActionRunResult => {
    const wip = input.orchestrationAwareRequirementsState.codeAgentWipExecutionV1;
    const readiness = validatePlatformScmMergeStepReadiness(wip);
    if (!readiness.ok) {
      return readiness.noOp
        ? { outcome: "no_op", message: readiness.message }
        : { outcome: "blocked", message: readiness.message };
    }
    void (async () => {
      try {
        const persistPatch = await applyPlatformScmMergeExecutorJson({ wip: wip!, autoMergeOnly: false });
        persistPlatformScmMergePatch(persistPatch);
      } catch (error) {
      }
    })();

    return { outcome: "executed" };
  }, [
    input.orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
    applyPlatformScmMergeExecutorJson,
    persistPlatformScmMergePatch,
  ]);

  return {
    applyPlatformScmExecutorJson,
    applyPlatformScmMergeExecutorJson,
    tryAutoPlatformScmMergeAfterPush,
    executePlatformScmAfterRequest,
    runFinalScmIntegratedStageStep,
    runPlatformScmMergeStep,
  };
}
