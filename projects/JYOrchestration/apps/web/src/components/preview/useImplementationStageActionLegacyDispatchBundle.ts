"use client";

import { useMemo } from "react";
import {
  useImplementationStageActionLegacyDispatch,
  type ImplementationStageActionLegacyDispatchValue,
} from "@/components/preview/useImplementationStageActionLegacyDispatch";
import type { ImplementationStageActionExecutionDispatchDeps } from "@/lib/prototype/implementationStageActionExecutionDispatch";
import type { ImplementationStageActionReviewDispatchDeps } from "@/lib/prototype/implementationStageActionReviewDispatch";
import type { ImplementationStageActionSimpleDispatchDeps } from "@/lib/prototype/implementationStageActionSimpleDispatch";

/**
 * Builds the legacy implementation-stage action dispatch bundle.
 *
 * Scope:
 * - compose simple/review/execution legacy dispatch inputs
 * - keep legacy stage actions isolated from the parent panel hook
 * - return useImplementationStageActionLegacyDispatch result
 *
 * Not scope:
 * - Control Plane routed actions
 * - Quick Run job start internals
 * - GitHub verification internals
 * - Integration pipeline internals
 * - Preview deployment internals
 */
type SimpleLegacyBase = Omit<ImplementationStageActionSimpleDispatchDeps, "startImplementationQuickRun">;
type ReviewLegacyExtra = Omit<
  ImplementationStageActionReviewDispatchDeps,
  keyof SimpleLegacyBase
>;
type ExecutionLegacyExtra = Omit<
  ImplementationStageActionExecutionDispatchDeps,
  keyof ImplementationStageActionReviewDispatchDeps
>;

export type ImplementationStageActionLegacyDispatchBundleInput = Readonly<
  SimpleLegacyBase & ReviewLegacyExtra & ExecutionLegacyExtra
>;

export function useImplementationStageActionLegacyDispatchBundle(
  input: ImplementationStageActionLegacyDispatchBundleInput,
): ImplementationStageActionLegacyDispatchValue {
  const implementationStageActionLegacyDispatchInput = useMemo(() => {
    return {
      simple: {
        projectId: input.projectId,
        generateImplementationTaskList: input.generateImplementationTaskList,
        confirmQuickDesignForImplementation: input.confirmQuickDesignForImplementation,
        createImplementationSeedFromQuickDesignDraft: input.createImplementationSeedFromQuickDesignDraft,
        loadImplementationRuntimeDb: input.loadImplementationRuntimeDb,
        generateImplementationWorkPlanDraft: input.generateImplementationWorkPlanDraft,
        confirmImplementationTaskPlan: input.confirmImplementationTaskPlan,
        reviewDbIntegrationNeed: input.reviewDbIntegrationNeed,
        generateDataModelDraft: input.generateDataModelDraft,
        confirmMockImplementationMode: input.confirmMockImplementationMode,
        applyImplementationStageActionExecutionResult: input.applyImplementationStageActionExecutionResult,
        refreshExecutionEnvironmentStatus: input.refreshExecutionEnvironmentStatus,
        runImplementationQualityGate: input.runImplementationQualityGate,
        runIntegratedStageStep: input.runIntegratedStageStep,
        runFinalScmIntegratedStageStep: input.runFinalScmIntegratedStageStep,
        runPlatformScmMergeStep: input.runPlatformScmMergeStep,
      },
      review: {
        projectId: input.projectId,
        parsedRequirementsState: input.parsedRequirementsState,
        previewUrl: input.previewUrl,
        prototypeRunSyncSnapshot: input.prototypeRunSyncSnapshot,
        executionSetupRow: input.executionSetupRow,
        persistChatToDb: input.persistChatToDb,
        appendAiNoticeForImplementation: input.appendAiNoticeForImplementation,
        appendUserNotice: input.appendUserNotice,
        appendImplementationTaskListAiMessage: input.appendImplementationTaskListAiMessage,
        applyImplementationStageActionExecutionResult: input.applyImplementationStageActionExecutionResult,
      },
      execution: {
        projectId: input.projectId,
        parsedRequirementsState: input.parsedRequirementsState,
        pendingImplementationPatch: input.pendingImplementationPatch,
        effectiveImplementationState: input.effectiveImplementationState,
        executionSetupRow: input.executionSetupRow,
        executionArtifacts: input.executionArtifacts,
        orchestrationAwareRequirementsState: input.orchestrationAwareRequirementsState,
        requirementsStateJson: input.requirementsStateJson,
        persistChatToDb: input.persistChatToDb,
        appendAiNoticeForImplementation: input.appendAiNoticeForImplementation,
        appendUserNotice: input.appendUserNotice,
        appendImplementationTaskListAiMessage: input.appendImplementationTaskListAiMessage,
        applyImplementationOrchestrationResult: input.applyImplementationOrchestrationResult,
        applyPendingFromOrchestrationPatch: input.applyPendingFromOrchestrationPatch,
        implementationCursorGate: input.implementationCursorGate,
        prototypeRunSyncSnapshot: input.prototypeRunSyncSnapshot,
        previewUrl: input.previewUrl,
        implementationStageBoardGateContext: input.implementationStageBoardGateContext,
        boardManualPickTaskIdRef: input.boardManualPickTaskIdRef,
        codeTaskDispatchPreferredTaskIdRef: input.codeTaskDispatchPreferredTaskIdRef,
        pendingQuickRunQueueDispatchRef: input.pendingQuickRunQueueDispatchRef,
        quickRunCodeTaskContinuationRef: input.quickRunCodeTaskContinuationRef,
        requirementsStateJsonRef: input.requirementsStateJsonRef,
        dispatchNextQuickRunFromGithubVerify: input.dispatchNextQuickRunFromGithubVerify,
        appendImplementationExecutionNotice: input.appendImplementationExecutionNotice,
        enrichCodeTaskRunOrchestrationPatch: input.enrichCodeTaskRunOrchestrationPatch,
        applyImplementationRuntimeFetch: input.applyImplementationRuntimeFetch,
        persistedQueueDispatch: input.persistedQueueDispatch,
        wipChipHandlers: input.wipChipHandlers,
        setExecutionEnvironmentModalOpen: input.setExecutionEnvironmentModalOpen,
      },
    };
  }, [
    input.projectId,
    input.generateImplementationTaskList,
    input.confirmQuickDesignForImplementation,
    input.createImplementationSeedFromQuickDesignDraft,
    input.loadImplementationRuntimeDb,
    input.generateImplementationWorkPlanDraft,
    input.confirmImplementationTaskPlan,
    input.reviewDbIntegrationNeed,
    input.generateDataModelDraft,
    input.confirmMockImplementationMode,
    input.applyImplementationStageActionExecutionResult,
    input.refreshExecutionEnvironmentStatus,
    input.runImplementationQualityGate,
    input.runIntegratedStageStep,
    input.runFinalScmIntegratedStageStep,
    input.runPlatformScmMergeStep,
    input.parsedRequirementsState,
    input.previewUrl,
    input.prototypeRunSyncSnapshot,
    input.executionSetupRow,
    input.persistChatToDb,
    input.appendAiNoticeForImplementation,
    input.appendUserNotice,
    input.appendImplementationTaskListAiMessage,
    input.pendingImplementationPatch,
    input.effectiveImplementationState,
    input.executionArtifacts,
    input.orchestrationAwareRequirementsState,
    input.requirementsStateJson,
    input.applyImplementationOrchestrationResult,
    input.applyPendingFromOrchestrationPatch,
    input.implementationCursorGate,
    input.implementationStageBoardGateContext,
    input.boardManualPickTaskIdRef,
    input.codeTaskDispatchPreferredTaskIdRef,
    input.pendingQuickRunQueueDispatchRef,
    input.quickRunCodeTaskContinuationRef,
    input.requirementsStateJsonRef,
    input.dispatchNextQuickRunFromGithubVerify,
    input.appendImplementationExecutionNotice,
    input.enrichCodeTaskRunOrchestrationPatch,
    input.applyImplementationRuntimeFetch,
    input.persistedQueueDispatch,
    input.wipChipHandlers,
    input.setExecutionEnvironmentModalOpen,
  ]);

  return useImplementationStageActionLegacyDispatch(implementationStageActionLegacyDispatchInput);
}
