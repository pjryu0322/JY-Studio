"use client";

import { useCallback, useEffect, type MutableRefObject } from "react";
import {
  useImplementationStageActionLegacyDispatchBundle,
  type ImplementationStageActionLegacyDispatchBundleInput,
} from "@/components/preview/useImplementationStageActionLegacyDispatchBundle";
import { useImplementationStageActionController } from "@/components/preview/useImplementationStageActionController";
import { useImplementationStageActionOrchestrator } from "@/components/preview/useImplementationStageActionOrchestrator";
import type { useImplementationBoardSelectionBridge } from "@/components/preview/useImplementationBoardSelectionBridge";
import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import type { ImplementationControlPlaneSnapshotV1 } from "@/lib/prototype/implementationControlPlaneSnapshot";
import type { ImplementationStageActionRunResult } from "@/lib/prototype/implementationStageActionPipeline";
import type { ImplementationStageBoardGateContext } from "@/lib/prototype/implementationStageActionPipeline";
import {
  resolveEffectiveImplementationState,
  type ImplementationStageActionId,
} from "@/lib/prototype/effectiveImplementationState";
import type { ImplementationStageActionRun } from "@/lib/prototype/implementationStageActionRun";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/promptTimelineState";

/**
 * Controls implementation-stage action adapter wiring.
 *
 * Scope:
 * - build legacy stage action dispatch bundle
 * - adapt board CodeTask execution requests to Quick Run
 * - adapt stage Preview action to integrated app Preview open
 * - wire Stage Action controller and orchestrator
 * - keep action adapter wiring outside the parent panel hook
 *
 * Not scope:
 * - individual action business logic
 * - Quick Run execution internals
 * - Preview open internals
 * - board rendering
 */
export type ImplementationStageActionAdapterControllerInput = Readonly<{
  readonly legacyDispatchInput: ImplementationStageActionLegacyDispatchBundleInput;
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
  readonly openImplementationPreview: (input: {
    readonly mode: "integrated_app_preview";
    readonly url: string;
  }) => void;
  readonly previewUrl: string | null | undefined;
  readonly appendUserNotice: (message: string) => void;
  readonly effectiveImplementationState: ReturnType<typeof resolveEffectiveImplementationState>;
  readonly implementationStageBoardGateContext: ImplementationStageBoardGateContext | null;
  readonly currentWip: CodeAgentWipExecutionV1 | null | undefined;
  readonly persistImplementationStageActionRun: (run: ImplementationStageActionRun) => void;
  readonly persistStageActionTimelineEntries: (
    entries: readonly RequirementsPromptTimelineEntry[],
  ) => void;
  readonly runImplementationStageActionRef: MutableRefObject<
    (
      actionId: ImplementationStageActionId,
    ) => ImplementationStageActionRunResult | Promise<ImplementationStageActionRunResult>
  >;
  readonly persistImplementationStageActionRunRef: MutableRefObject<
    (run: ImplementationStageActionRun) => void
  >;
}>;

export type ImplementationStageActionAdapterControllerValue = Readonly<{
  readonly executeImplementationStageAction: ReturnType<
    typeof useImplementationStageActionOrchestrator
  >["executeImplementationStageAction"];
  readonly runOrchestratedStageAction: ReturnType<
    typeof useImplementationStageActionOrchestrator
  >["runOrchestratedStageAction"];
}>;

export function useImplementationStageActionAdapterController(
  input: ImplementationStageActionAdapterControllerInput,
): ImplementationStageActionAdapterControllerValue {
  const legacyDispatch = useImplementationStageActionLegacyDispatchBundle(input.legacyDispatchInput);

  const executeCodeTasks = useCallback(
    async (executeInput: { readonly codeTaskIds: readonly string[]; readonly source: string }) => {
      if (!executeInput.codeTaskIds.length) {
        return { outcome: "blocked", message: "실행할 CodeTask를 선택해 주세요." };
      }
      return input.startImplementationQuickRun({ selectedCodeTaskIds: executeInput.codeTaskIds });
    },
    [input.startImplementationQuickRun],
  );

  const openPreviewFromStageAction = useCallback(() => {
    const url = String(
      input.implementationControlPlaneSnapshot?.preview.actualPreviewUrl ?? input.previewUrl ?? "",
    ).trim();
    if (!url) {
      input.appendUserNotice("Preview URL을 확인할 수 없습니다.");
      return;
    }
    input.openImplementationPreview({ mode: "integrated_app_preview", url });
  }, [
    input.implementationControlPlaneSnapshot,
    input.previewUrl,
    input.openImplementationPreview,
    input.appendUserNotice,
  ]);

  const { runImplementationStageAction } = useImplementationStageActionController({
    projectId: input.legacyDispatchInput.projectId,
    implementationControlPlaneSnapshot: input.implementationControlPlaneSnapshot,
    boardSelectionBridge: input.boardSelectionBridge,
    codeTaskDispatchPreferredTaskIdRef: input.codeTaskDispatchPreferredTaskIdRef,
    dbQueuedQuickRunDispatchRef: input.dbQueuedQuickRunDispatchRef,
    startImplementationQuickRun: input.startImplementationQuickRun,
    recoverQuickRunStuckGithubVerify: input.recoverQuickRunStuckGithubVerify,
    handleManualGithubVerifyRetry: input.handleManualGithubVerifyRetry,
    runIntegrationPipeline: input.runIntegrationPipeline,
    openPreview: openPreviewFromStageAction,
    executeCodeTasks,
    appendUserNotice: input.appendUserNotice,
    legacyDispatch,
  });

  const { executeImplementationStageAction, runOrchestratedStageAction } =
    useImplementationStageActionOrchestrator({
      projectId: input.legacyDispatchInput.projectId,
      effectiveImplementationState: input.effectiveImplementationState,
      implementationStageBoardGateContext: input.implementationStageBoardGateContext,
      currentWip: input.currentWip,
      runImplementationStageAction,
      persistImplementationStageActionRun: input.persistImplementationStageActionRun,
      persistStageActionTimelineEntries: input.persistStageActionTimelineEntries,
    });

  useEffect(() => {
    input.runImplementationStageActionRef.current = runImplementationStageAction;
    input.persistImplementationStageActionRunRef.current = input.persistImplementationStageActionRun;
  }, [
    runImplementationStageAction,
    input.persistImplementationStageActionRun,
    input.runImplementationStageActionRef,
    input.persistImplementationStageActionRunRef,
  ]);

  return {
    executeImplementationStageAction,
    runOrchestratedStageAction,
  };
}
