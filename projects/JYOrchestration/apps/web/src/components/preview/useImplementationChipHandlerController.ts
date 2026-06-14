"use client";

import { useCallback } from "react";
import type { ImplementationStageActionOrchestratorValue } from "@/components/preview/useImplementationStageActionOrchestrator";
import {
  AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP,
  IMPLEMENTATION_GENERATION_REQUEST_CHIP,
  IMPLEMENTATION_ENV_SETTINGS_LABEL,
  PLANNING_ENV_SETTINGS_LABEL,
} from "@/lib/requirements/implementationUxLabels";
import {
  canConfirmImplementationWorkPlanFromEffectiveState,
  mapImplementationChipToAction,
  type EffectiveImplementationState,
} from "@/lib/prototype/effectiveImplementationState";
import type { ImplementationStageActionRunResult } from "@/lib/prototype/implementationStageActionPipeline";
import { tryHandlePrototypeExecutionChip } from "@/lib/prototype/prototypeExecutionImplementationChips";
import { buildWipChipHandlerSlice } from "@/lib/prototype/prototypeExecutionWipChipHandlers";
import {
  buildPrepareImplementationExecutionToast,
  evaluateImplementationCursorGate,
  formatImplementationCursorBlockedNotice,
} from "@/lib/prototype/prototypeExecutionTaskPlanActions";
import { tryHandleImplementationTaskListChip } from "@/lib/prototype/implementationTaskListEntryMessage";
import type { deriveImplementationPrototypeRunSyncSnapshot } from "@/lib/prototype/implementationPrototypeRunSync";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

/**
 * Controls implementation-stage chip/interview label handling.
 *
 * Scope:
 * - handle implementation task-list chips
 * - map implementation chips to stage actions
 * - fallback to prototype execution chip handlers
 * - expose onPickImplementationInterviewLabel
 *
 * Not scope:
 * - concrete stage action execution internals
 * - board rendering
 * - Quick Run internals
 * - GitHub verification internals
 * - Integration pipeline internals
 */
export type ImplementationChipHandlerControllerInput = Readonly<{
  readonly projectId: string;
  readonly parsedRequirementsState: RequirementsStateJson;
  readonly effectiveImplementationState: EffectiveImplementationState;
  readonly prototypeRunSyncSnapshot: ReturnType<typeof deriveImplementationPrototypeRunSyncSnapshot>;
  readonly previewUrl: string | null | undefined;
  readonly canRequestGenerationEnvOk: boolean;
  readonly implementationCursorGate: unknown;
  readonly wipChipHandlers: ReturnType<typeof buildWipChipHandlerSlice>;
  readonly executeImplementationStageAction: ImplementationStageActionOrchestratorValue["executeImplementationStageAction"];
  readonly generateImplementationTaskList: () => ImplementationStageActionRunResult;
  readonly generateImplementationWorkPlanDraft: () => ImplementationStageActionRunResult;
  readonly confirmImplementationTaskPlan: () => ImplementationStageActionRunResult;
  readonly reviewDbIntegrationNeed: () => ImplementationStageActionRunResult;
  readonly generateDataModelDraft: () => ImplementationStageActionRunResult;
  readonly confirmMockImplementationMode: () => ImplementationStageActionRunResult;
  readonly appendImplementationTaskListAiMessage: (message: RequirementsMessage) => void;
  readonly appendUserNotice: (message: string) => void;
  readonly appendAiNoticeForImplementation: (message: string) => void;
  readonly setExecutionEnvironmentModalOpen: (open: boolean) => void;
  readonly openDeveloperDashboard?: () => void;
  readonly showImplementationSeedReadinessCheck: () => void;
  readonly showRoleCheckDetails: () => void;
  readonly appendStatusQueryFromChip: (chip: string) => void;
  readonly confirmExecution: () => void;
  readonly onRefreshPrototypeStatus: () => void | Promise<void>;
}>;

export type ImplementationChipHandlerControllerValue = Readonly<{
  readonly handleImplementationChip: (label: string) => boolean;
  readonly onPickImplementationInterviewLabel: (label: string) => void;
}>;

export function useImplementationChipHandlerController(
  input: ImplementationChipHandlerControllerInput,
): ImplementationChipHandlerControllerValue {
  const handleImplementationChip = useCallback(
    (label: string) => {
      const trimmed = label.trim();
      if (
        trimmed === PLANNING_ENV_SETTINGS_LABEL ||
        trimmed === IMPLEMENTATION_ENV_SETTINGS_LABEL ||
        trimmed === "환경설정 보기"
      ) {
        input.setExecutionEnvironmentModalOpen(true);
        return true;
      }
      if (trimmed === IMPLEMENTATION_GENERATION_REQUEST_CHIP) {
        if (input.openDeveloperDashboard) {
          input.openDeveloperDashboard();
          return true;
        }
      }

      const taskList = input.parsedRequirementsState.implementationTaskListV1 ?? null;
      const chipHandled = tryHandleImplementationTaskListChip({
        label,
        projectId: input.projectId,
        taskList,
        executionState: input.parsedRequirementsState.implementationTaskExecutionStateV1,
        integratedExecutionState: input.parsedRequirementsState.implementationIntegratedExecutionStateV1,
        boardState: input.parsedRequirementsState.implementationExecutionBoardStateV1,
        qualityGateResults: input.parsedRequirementsState.implementationQualityGateResultsV1,
        prototypeSnapshot: input.prototypeRunSyncSnapshot,
        envOk: input.canRequestGenerationEnvOk,
        appendAiMessage: input.appendImplementationTaskListAiMessage,
        openEnvSettings: () => input.setExecutionEnvironmentModalOpen(true),
        openPrototypePreview: () => {
          const url = input.previewUrl ?? input.prototypeRunSyncSnapshot.previewUrl;
          if (url) window.open(url, "_blank", "noopener,noreferrer");
          else input.appendUserNotice("Preview URL이 아직 없습니다.");
        },
        returnToPlanningStage: () => {
          const pid = input.projectId.trim();
          if (!pid) return;
          window.location.assign(`/requirements?projectId=${encodeURIComponent(pid)}`);
        },
        generateTaskListFromSeed: () => {
          void input.generateImplementationTaskList();
        },
        showToast: input.appendUserNotice,
      });

      if (chipHandled) {
        if (
          label.trim() === AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP &&
          taskList?.tasks?.length &&
          (!input.parsedRequirementsState.cursorWorkItemsV1 ||
            input.parsedRequirementsState.cursorWorkItemsV1.length === 0)
        ) {
          void input.generateImplementationTaskList();
        }
        return true;
      }

      const actionId = mapImplementationChipToAction(label);
      if (actionId && input.executeImplementationStageAction(actionId, { label, source: "chat_chip" })) {
        return true;
      }

      return tryHandlePrototypeExecutionChip(label, {
        openEnvSettings: () => input.setExecutionEnvironmentModalOpen(true),
        showImplementationSeedReadinessCheck: input.showImplementationSeedReadinessCheck,
        returnToPlanningStage: () => {
          const pid = input.projectId.trim();
          if (!pid) return;
          window.location.assign(`/requirements?projectId=${encodeURIComponent(pid)}`);
        },
        focusComposerForScopeEdit: () => {},
        showRoleCheckDetails: input.showRoleCheckDetails,
        showScmCheckDetails: () => input.appendStatusQueryFromChip("scm_check_details"),
        showEnvironmentCheckDetails: () => input.appendStatusQueryFromChip("environment_check_details"),
        generateImplementationWorkPlanDraft: input.generateImplementationWorkPlanDraft,
        confirmImplementationTaskPlan: input.confirmImplementationTaskPlan,
        reviewDbIntegrationNeed: input.reviewDbIntegrationNeed,
        generateDataModelDraft: input.generateDataModelDraft,
        confirmMockImplementationMode: input.confirmMockImplementationMode,
        ...input.wipChipHandlers,
        prepareImplementationExecution: () => {
          const toast = buildPrepareImplementationExecutionToast(
            input.effectiveImplementationState.implementationTaskPlanV1,
          );
          if (toast) input.appendUserNotice(toast);
        },
        confirmExecution: () => input.confirmExecution(),
        refreshStatus: () => void input.onRefreshPrototypeStatus(),
        appendUserNotice: input.appendUserNotice,
        canConfirmImplementationTaskPlan: () => {
          const gate = canConfirmImplementationWorkPlanFromEffectiveState(
            input.effectiveImplementationState,
          );
          if (!gate.ok) {
            return false;
          }
          return true;
        },
        canRequestCodeAgentWipWork: () => {
          const gate = evaluateImplementationCursorGate(input.implementationCursorGate);
          if (!gate.allowed) {
            input.appendAiNoticeForImplementation(
              formatImplementationCursorBlockedNotice(input.implementationCursorGate),
            );
            return false;
          }
          return true;
        },
        canConfirmExecution: () => {
          if (!input.effectiveImplementationState.envOk || !input.effectiveImplementationState.designOk) {
            return false;
          }
          return true;
        },
      });
    },
    [
      input.projectId,
      input.parsedRequirementsState,
      input.prototypeRunSyncSnapshot,
      input.previewUrl,
      input.canRequestGenerationEnvOk,
      input.appendImplementationTaskListAiMessage,
      input.appendUserNotice,
      input.generateImplementationTaskList,
      input.executeImplementationStageAction,
      input.showImplementationSeedReadinessCheck,
      input.showRoleCheckDetails,
      input.appendStatusQueryFromChip,
      input.confirmImplementationTaskPlan,
      input.generateImplementationWorkPlanDraft,
      input.reviewDbIntegrationNeed,
      input.generateDataModelDraft,
      input.confirmMockImplementationMode,
      input.effectiveImplementationState,
      input.wipChipHandlers,
      input.implementationCursorGate,
      input.appendAiNoticeForImplementation,
      input.confirmExecution,
      input.onRefreshPrototypeStatus,
      input.setExecutionEnvironmentModalOpen,
      input.openDeveloperDashboard,
    ],
  );

  const onPickImplementationInterviewLabel = useCallback(
    (label: string) => {
      if (handleImplementationChip(label)) return;
    },
    [handleImplementationChip],
  );

  return { handleImplementationChip, onPickImplementationInterviewLabel };
}
