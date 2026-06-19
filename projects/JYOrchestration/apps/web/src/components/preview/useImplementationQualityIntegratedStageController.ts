"use client";

import { useCallback } from "react";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  buildImplementationExecutionBoardFromRequirementsState,
  buildIntegratedStageStepActionNotice,
  pickQualityGateTargetTaskIds,
} from "@/lib/prototype/implementationExecutionBoard";
import { buildImplementationExecutionBoardMessage } from "@/lib/prototype/implementationExecutionBoardMessage";
import { integrateCompletedCodeTasksForPreview } from "@/lib/prototype/implementationIntegrationService";
import { buildIntegrationScopeDetailLines } from "@/lib/prototype/implementationIntegrationScopeUi";
import {
  finalizeIntegratedStageStep,
  type ImplementationIntegratedStep,
} from "@/lib/prototype/implementationIntegratedExecutionState";
import type { deriveImplementationPrototypeRunSyncSnapshot } from "@/lib/prototype/implementationPrototypeRunSync";
import type { ImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";
import type { ImplementationStageActionRunResult } from "@/lib/prototype/implementationStageActionPipeline";
import { executeImplementationQualityGateCheck } from "@/lib/prototype/implementationQualityGate";
import {
  buildQualityGateBridgeTargetFromTaskCursor,
  buildQualityGateBridgeTargetFromWip,
} from "@/lib/prototype/bridgeCompletionPolicy";
import { buildTargetRepoE2eTimelineEntry } from "@/lib/prototype/targetRepoE2eDiagnostics";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import {
  shouldSyncExecutionStateAfterTaskCursorGithubVerify,
  syncTaskExecutionStateAfterGithubVerified,
} from "@/lib/prototype/prototypeExecutionTaskCursorActions";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

/**
 * Controls implementation-stage quality gates and non-Final-SCM integrated steps.
 *
 * Scope:
 * - run reviewer/security quality gate checks
 * - sync task execution state after GitHub verification when needed
 * - persist quality gate results and diagnostic timeline entries
 * - run integrated stage steps except Final SCM
 * - persist integration preview scope for completed CodeTask integration
 *
 * Not scope:
 * - Final SCM / platform SCM execution
 * - Quick Run internals
 * - GitHub verification internals
 * - Preview entry/fallback
 * - board rendering
 */
export type ImplementationQualityIntegratedStageControllerInput = Readonly<{
  readonly projectId: string;
  readonly parsedRequirementsState: RequirementsStateJson;
  readonly orchestrationAwareRequirementsState: RequirementsStateJson;
  readonly executionSetupRow: ExecutionSetupSourceGenerationRow | null;
  readonly prototypeRunSyncSnapshot: ReturnType<typeof deriveImplementationPrototypeRunSyncSnapshot>;
  readonly runFinalScmIntegratedStageStep: () => ImplementationStageActionRunResult;
  readonly persistChatToDb: (
    chat?: unknown,
    orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput,
    message?: unknown,
    options?: { readonly awaitServer?: boolean; readonly force?: boolean },
  ) => Promise<unknown> | void;
  readonly appendAiNoticeForImplementation: (message: string) => void;
  readonly appendImplementationTaskListAiMessage: (message: RequirementsMessage) => void;
}>;

export type ImplementationQualityIntegratedStageControllerValue = Readonly<{
  readonly runImplementationQualityGate: (
    role: "reviewer" | "security",
  ) => ImplementationStageActionRunResult;
  readonly runIntegratedStageStep: (
    step: ImplementationIntegratedStep,
  ) => ImplementationStageActionRunResult;
}>;

export function useImplementationQualityIntegratedStageController(
  input: ImplementationQualityIntegratedStageControllerInput,
): ImplementationQualityIntegratedStageControllerValue {
  const runImplementationQualityGate = useCallback(
    (role: "reviewer" | "security"): ImplementationStageActionRunResult => {
      const orchestration = input.orchestrationAwareRequirementsState;
      const taskList = orchestration.implementationTaskListV1;
      const pid = input.projectId.trim();
      if (!taskList || !pid) {
        const message = "구현 작업목록이 없어 점검을 실행할 수 없습니다.";
        return { outcome: "blocked", message };
      }

      const taskCursor = orchestration.taskCursorExecutionV1;
      let executionState = orchestration.implementationTaskExecutionStateV1;
      if (
        taskCursor &&
        shouldSyncExecutionStateAfterTaskCursorGithubVerify(taskCursor.status) &&
        executionState
      ) {
        executionState = syncTaskExecutionStateAfterGithubVerified({
          executionState,
          taskId: taskCursor.taskId,
          cursorWorkItems: orchestration.cursorWorkItemsV1 ?? [],
        });
      }

      const board = buildImplementationExecutionBoardFromRequirementsState({
        projectId: pid,
        orchestration: {
          ...orchestration,
          ...(executionState ? { implementationTaskExecutionStateV1: executionState } : {}),
        },
      });
      if (!board) {
        const message = "구현 작업 보드를 만들 수 없어 점검을 실행할 수 없습니다.";
        return { outcome: "blocked", message };
      }

      const pickedTargetTaskIds = pickQualityGateTargetTaskIds({
        role,
        board,
        taskCursorTaskId:
          taskCursor && shouldSyncExecutionStateAfterTaskCursorGithubVerify(taskCursor.status)
            ? taskCursor.taskId
            : null,
      });
      const targetTaskIds = pickedTargetTaskIds.length ? pickedTargetTaskIds : undefined;
      const bridgeTarget =
        buildQualityGateBridgeTargetFromTaskCursor(taskCursor) ??
        buildQualityGateBridgeTargetFromWip(orchestration.codeAgentWipExecutionV1);

      const outcome = executeImplementationQualityGateCheck({
        role,
        taskList,
        executionState,
        qualityGateResults: orchestration.implementationQualityGateResultsV1,
        projectId: pid,
        targetTaskIds,
        bridgeTarget,
      });
      if ("blocked" in outcome) {
        return { outcome: "blocked", message: outcome.blocked };
      }
      const qgTimeline =
        outcome.qualityGateResult.engineConnectionStatus === "pending_engine_connection"
          ? buildTargetRepoE2eTimelineEntry({
              action: "review_security_diff_engine_pending",
              projectId: pid,
              selectedTaskId: bridgeTarget?.selectedTaskId,
              repoFullName: bridgeTarget?.targetRepository,
              branchName: bridgeTarget?.branchName,
              commitSha: bridgeTarget?.commitSha,
              changedFilesCount: bridgeTarget?.changedFiles?.length,
              status: "pending_engine_connection",
            })
          : null;
      void input.persistChatToDb(undefined, {
        implementationTaskExecutionStateV1: outcome.executionState,
        implementationQualityGateResultsV1: outcome.qualityGateResults,
        ...(qgTimeline
          ? {
              promptTimeline: [...(orchestration.promptTimeline ?? []), qgTimeline],
            }
          : {}),
      });
      input.appendAiNoticeForImplementation(outcome.aiMessageContent);
      return { outcome: "executed" };
    },
    [
      input.orchestrationAwareRequirementsState,
      input.projectId,
      input.persistChatToDb,
      input.appendAiNoticeForImplementation,
    ],
  );

  const runIntegratedStageStep = useCallback(
    (step: ImplementationIntegratedStep): ImplementationStageActionRunResult => {
      if (step === "final_scm") {
        return input.runFinalScmIntegratedStageStep();
      }
      const pid = input.projectId.trim();
      if (!pid) {
        const message = "프로젝트를 선택해 주세요.";
        return { outcome: "blocked", message };
      }
      const taskList = input.parsedRequirementsState.implementationTaskListV1;
      if (!taskList) {
        const message = "구현 작업목록이 없어 통합 단계를 실행할 수 없습니다.";
        return { outcome: "blocked", message };
      }

      const boardBefore = buildImplementationExecutionBoardFromRequirementsState({
        projectId: pid,
        orchestration: input.parsedRequirementsState,
      })!;
      const allTasksComplete = boardBefore.taskRows.every((row) => row.currentRole === "completed");

      let previewScopePatch: {
        implementationPreviewScopeV1: ImplementationPreviewScopeV1;
      } | null = null;
      if (step === "refactor_common") {
        const integration = integrateCompletedCodeTasksForPreview({
          codeTaskPlan: input.parsedRequirementsState.implementationCodeTaskPlanV1 ?? null,
          taskList,
          codeTaskRuns:
            parseCodeTaskExecutionRunsV1(input.parsedRequirementsState.codeTaskExecutionRunsV1) ??
            [],
          taskCursorExecution: input.parsedRequirementsState.taskCursorExecutionV1 ?? null,
          taskCursorExecutionHistory:
            input.parsedRequirementsState.taskCursorExecutionHistoryV1 ?? null,
          autoQualityGate: input.parsedRequirementsState.implementationAutoQualityGateV1 ?? null,
        });
        if (!integration.ok) {
          return { outcome: "blocked", message: integration.message };
        }
        previewScopePatch = { implementationPreviewScopeV1: integration.previewScope };
      }

      if (step === "integrated_review") {
        void credentialsIncludeFetch(
          `/api/projects/${encodeURIComponent(pid)}/planning/stage-data-store/provision`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ target: "review" }),
          },
        ).catch(() => undefined);
      }

      const prior = input.parsedRequirementsState.implementationIntegratedExecutionStateV1;
      const done = finalizeIntegratedStageStep({
        state: prior,
        projectId: pid,
        step,
        taskRowsCompleted: previewScopePatch != null ? true : allTasksComplete,
      });
      void input.persistChatToDb(undefined, {
        implementationIntegratedExecutionStateV1: done,
        ...(previewScopePatch ?? {}),
      });

      const actionNotice = buildIntegratedStageStepActionNotice({ step, integratedState: done });
      const noticeLines = [actionNotice];
      if (previewScopePatch) {
        noticeLines.push(
          ...buildIntegrationScopeDetailLines(previewScopePatch.implementationPreviewScopeV1),
        );
      }
      input.appendAiNoticeForImplementation(noticeLines.join("\n"));

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
          codeAgentWipExecutionV1: input.orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
          executionSetup: input.executionSetupRow,
        }),
      );

      return { outcome: "executed" };
    },
    [
      input.parsedRequirementsState,
      input.projectId,
      input.persistChatToDb,
      input.appendImplementationTaskListAiMessage,
      input.appendAiNoticeForImplementation,
      input.prototypeRunSyncSnapshot.previewReady,
      input.orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
      input.executionSetupRow,
      input.runFinalScmIntegratedStageStep,
    ],
  );

  return { runImplementationQualityGate, runIntegratedStageStep };
}
