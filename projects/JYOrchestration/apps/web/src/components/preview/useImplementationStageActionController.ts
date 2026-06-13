"use client";

import { useCallback } from "react";
import type { MutableRefObject } from "react";
import type { useImplementationBoardSelectionBridge } from "@/components/preview/useImplementationBoardSelectionBridge";
import type { useImplementationStageActionLegacyDispatch } from "@/components/preview/useImplementationStageActionLegacyDispatch";
import type { ImplementationStageActionId } from "@/lib/prototype/effectiveImplementationState";
import type { ImplementationControlPlaneSnapshotV1 } from "@/lib/prototype/implementationControlPlaneSnapshot";
import {
  isImplementationStageControlPlaneRoutedAction,
  resolveImplementationStageActionCodeTaskIds,
  routeImplementationStageControlPlaneAction,
} from "@/lib/prototype/implementationStageActionControlPlaneRouting";
import type { ImplementationStageActionRunResult } from "@/lib/prototype/implementationStageActionPipeline";
import { dispatchSimpleImplementationStageAction } from "@/lib/prototype/implementationStageActionSimpleDispatch";
import { dispatchReviewAndConfirmationStageAction } from "@/lib/prototype/implementationStageActionReviewDispatch";
import { dispatchExecutionStageAction } from "@/lib/prototype/implementationStageActionExecutionDispatch";

/**
 * Controls implementation-stage user/action dispatch.
 *
 * Scope:
 * - route implementation stage actions to the correct controller
 * - execute selected/runnable CodeTask actions
 * - bridge primary Control Plane actions to runtime dispatch
 * - keep runImplementationStageActionRef stable for legacy callers
 *
 * Not scope:
 * - Quick Run job start internals
 * - GitHub verification internals
 * - Integration pipeline internals
 * - Preview deployment internals
 * - board rendering
 */
export type ImplementationStageActionControllerInput = Readonly<{
  readonly projectId: string;
  readonly implementationControlPlaneSnapshot: ImplementationControlPlaneSnapshotV1 | null;
  readonly boardSelectionBridge: ReturnType<typeof useImplementationBoardSelectionBridge>;
  readonly codeTaskDispatchPreferredTaskIdRef: MutableRefObject<string | null>;
  readonly dbQueuedQuickRunDispatchRef: MutableRefObject<string | null>;
  readonly startImplementationQuickRun: (options?: {
    readonly selectedCodeTaskIds?: readonly string[];
  }) => Promise<ImplementationStageActionRunResult>;
  readonly recoverQuickRunStuckGithubVerify: (options?: { readonly force?: boolean }) => Promise<boolean>;
  readonly handleManualGithubVerifyRetry: () => Promise<void>;
  readonly runIntegrationPipeline: () => void;
  readonly openPreview: () => void;
  readonly executeCodeTasks: (input: {
    readonly codeTaskIds: readonly string[];
    readonly source: string;
  }) => Promise<ImplementationStageActionRunResult>;
  readonly appendUserNotice: (message: string) => void;
  readonly legacyDispatch: ReturnType<typeof useImplementationStageActionLegacyDispatch>;
}>;

export type ImplementationStageActionControllerValue = Readonly<{
  readonly runImplementationStageAction: (
    action: ImplementationStageActionId | (string & {}),
    options?: {
      readonly selectedCodeTaskIds?: readonly string[];
    },
  ) => Promise<ImplementationStageActionRunResult>;
}>;

export function useImplementationStageActionController(
  input: ImplementationStageActionControllerInput,
): ImplementationStageActionControllerValue {
  const runResolvedQuickRun = useCallback(
    async (options?: { readonly selectedCodeTaskIds?: readonly string[] }) => {
      const bridgeSummary = input.boardSelectionBridge.getBridgeSnapshot().livePanelSummary;
      const codeTaskIds = resolveImplementationStageActionCodeTaskIds({
        implementationControlPlaneSnapshot: input.implementationControlPlaneSnapshot,
        selectedCodeTaskIdsFromOptions: options?.selectedCodeTaskIds,
        selectedRunnableFromBridge: bridgeSummary.selectedRunnableCodeTaskIds,
        allRunnableFromSnapshot: input.implementationControlPlaneSnapshot?.board.runnableCodeTaskIds ?? [],
      });
      if (!codeTaskIds.length) {
        const message = "실행할 CodeTask를 선택해 주세요.";
        input.appendUserNotice(message);
        return { outcome: "blocked", message } satisfies ImplementationStageActionRunResult;
      }
      return input.startImplementationQuickRun({ selectedCodeTaskIds: codeTaskIds });
    },
    [
      input.boardSelectionBridge,
      input.implementationControlPlaneSnapshot,
      input.startImplementationQuickRun,
      input.appendUserNotice,
    ],
  );

  const runImplementationStageAction = useCallback(
    async (
      actionId: ImplementationStageActionId | (string & {}),
      options?: { readonly selectedCodeTaskIds?: readonly string[] },
    ): Promise<ImplementationStageActionRunResult> => {
      const actionKey = String(actionId);

      if (isImplementationStageControlPlaneRoutedAction(actionKey)) {
        const bridgeSummary = input.boardSelectionBridge.getBridgeSnapshot().livePanelSummary;
        const codeTaskIds = resolveImplementationStageActionCodeTaskIds({
          implementationControlPlaneSnapshot: input.implementationControlPlaneSnapshot,
          selectedCodeTaskIdsFromOptions: options?.selectedCodeTaskIds,
          selectedRunnableFromBridge: bridgeSummary.selectedRunnableCodeTaskIds,
          allRunnableFromSnapshot: input.implementationControlPlaneSnapshot?.board.runnableCodeTaskIds ?? [],
          preferAllRunnable: actionKey === "execute_all_runnable_codetasks",
        });
        return routeImplementationStageControlPlaneAction({
          action: actionKey,
          codeTaskIds,
          startImplementationQuickRun: input.startImplementationQuickRun,
          runIntegrationPipeline: input.runIntegrationPipeline,
          openPreview: input.openPreview,
          executeCodeTasks: input.executeCodeTasks,
          appendUserNotice: input.appendUserNotice,
        });
      }

      if (actionKey === "START_IMPLEMENTATION_QUICK_RUN") {
        return runResolvedQuickRun(options);
      }

      const legacy = input.legacyDispatch;

      const simple = dispatchSimpleImplementationStageAction(actionId as ImplementationStageActionId, {
        ...legacy.simple,
        startImplementationQuickRun: () => {
          void runResolvedQuickRun();
        },
      });
      if (simple) return simple;

      const reviewOrConfirmation = dispatchReviewAndConfirmationStageAction(
        actionId as ImplementationStageActionId,
        legacy.review,
      );
      if (reviewOrConfirmation) return reviewOrConfirmation;

      const execution = dispatchExecutionStageAction(
        actionId as ImplementationStageActionId,
        legacy.execution,
      );
      if (execution) return execution;

      return { outcome: "blocked", message: "지원하지 않는 구현단계 action입니다." };
    },
    [input, runResolvedQuickRun],
  );

  return { runImplementationStageAction };
}
