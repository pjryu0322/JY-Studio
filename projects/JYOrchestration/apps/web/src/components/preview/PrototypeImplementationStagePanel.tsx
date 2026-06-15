"use client";

import { useMemo } from "react";
import { ImplementationExecutionBoardPanel } from "@/components/preview/ImplementationExecutionBoardPanel";
import { ImplementationExecutionBoardBootstrapPanel } from "@/components/preview/ImplementationExecutionBoardBootstrapPanel";
import { ImplementationExecutionBoardModal } from "@/components/preview/ImplementationExecutionBoardModal";
import { ImplementationWorkingQueueModal } from "@/components/preview/ImplementationWorkingQueueModal";
import { ImplementationChatLockedNotice } from "@/components/preview/ImplementationChatLockedNotice";
import { ImplementationResetScopeDialog } from "@/components/preview/ImplementationResetScopeDialog";
import { ImplementationStageGlobalToolbar } from "@/components/preview/ImplementationStageGlobalToolbar";
import { PrototypeExecutionChatPanel } from "@/components/preview/PrototypeExecutionChatPanel";
import { FixedToast } from "@/components/ui/FixedToast";
import { ImplementationExecutionLogModal } from "@/components/preview/ImplementationExecutionLogModal";
import { PrototypeImplementationStageOverlays } from "@/components/preview/PrototypeImplementationStageOverlays";
import { resolveImplementationRuntimeStateForRead } from "@/lib/runtime/implementationRuntime/implementationRuntimeUiSnapshot";
import { resolveCheckedCodeTaskIdsFromBoardBridge } from "@/lib/prototype/implementationBoardCodeTaskSelection";
import { isNextPublicDevWorkflowToolsEnabled } from "@/lib/env/devWorkflowTools";
import type { ImplementationWorkingQueueItem } from "@/lib/prototype/implementationWorkingQueueTypes";
import {
  parseImplementationPreviewRegionCapturesFromState,
  resolveWorkingQueueItemPreviewImageUrl,
} from "@/lib/prototype/implementationWorkingQueuePreviewThumbnail";
import type {
  PrototypeImplementationStageHost,
  UsePrototypeImplementationStagePanelResult,
} from "@/components/preview/usePrototypeImplementationStagePanel";

export type PrototypeImplementationStagePanelProps = Readonly<{
  host: PrototypeImplementationStageHost;
  stage: UsePrototypeImplementationStagePanelResult;
}>;

export function PrototypeImplementationStagePanel({
  host,
  stage,
}: PrototypeImplementationStagePanelProps) {
  const {
    onPickImplementationInterviewLabel,
    executionConversationIconToolbar,
    implementationBoard,
    implementationStageBoardInput,
    prototypeRunSyncSnapshot,
    effectiveCodeTaskExecutionQueueV1,
    boardSelectionBridge,
    activeTaskCursorJob,
    handleRestartBoardTask,
    handleBoardSelectedTaskIdsChange,
    handleBoardSelectedCodeTaskIdsChange,
    handleCopyCodeTaskCursorPrompt,
    handleCopyDeveloperPromptsFromHeader,
    handleManualGithubVerifyRetry,
    handleRecheckCodeTaskGithubVerify,
    githubRecheckBusyCodeTaskId,
    handleRetryFailedCodeTask,
    orchestrationAwareRequirementsState,
    orchestrationAwareRequirementsStateRef,
    implementationRuntimeDbBundle,
    runIntegrationPipeline,
    integrationPipelineBusy,
    mergeIntegrationPullRequest,
    integrationMergeBusy,
    integrationPipelineClientResult,
    openImplementationPreview,
    startImplementationQuickRun,
    implementationControlPlaneSnapshot,
    implementationBootstrapShell,
    implementationNoticeSuccessToast,
    implementationNoticeErrorToast,
    implementationExecutionLogModalOpen,
    setImplementationExecutionLogModalOpen,
    onClearImplementationExecutionLog,
    latestRunForDevTools,
    executionSlotsForDevTools,
    implementationDeveloperDashboardOpen,
    setImplementationDeveloperDashboardOpen,
    implementationWorkingQueueOpen,
    setImplementationWorkingQueueOpen,
    implementationWorkingQueue,
    implementationToolbarPreviewEntry,
    implementationSingleChatWorkspace,
    implementationChatAvailability,
    implementationResetScopeDialogOpen,
    onCloseImplementationResetDialog,
    onConfirmImplementationResetScope,
    resetImplementationSessionBusy,
    implementationResetConversationOnlyDisabled,
    implementationResetCodeTaskDisabled,
  } = stage;

  const { projectId, projectName, protoBusy } = host;
  const {
    chatInputRef,
    prototypeComposerAtAtItems,
    isMessageInputBlocked,
    chatPlaceholder,
    executionSingleChat,
    prioritizedChatMessages,
    onInterviewSuggestionPick,
    composerPendingAttachments,
  } = implementationSingleChatWorkspace;

  const resolveWorkingQueuePreviewImageUrl = useMemo(() => {
    const regionCaptures = parseImplementationPreviewRegionCapturesFromState(orchestrationAwareRequirementsState);
    return (item: ImplementationWorkingQueueItem) =>
      resolveWorkingQueueItemPreviewImageUrl(item, {
        regionCaptures,
        messages: prioritizedChatMessages,
      });
  }, [orchestrationAwareRequirementsState, prioritizedChatMessages]);

  const boardPanel =
    implementationBoard && implementationStageBoardInput ? (
      <ImplementationExecutionBoardPanel
        board={implementationBoard}
        taskList={implementationStageBoardInput.taskList}
        executionSetup={host.executionSetupRow}
        codeAgentWipExecutionV1={orchestrationAwareRequirementsState.codeAgentWipExecutionV1}
        taskCursorExecutionV1={orchestrationAwareRequirementsState.taskCursorExecutionV1}
        taskCursorExecutionHistoryV1={orchestrationAwareRequirementsState.taskCursorExecutionHistoryV1}
        implementationAutoQualityGateV1={orchestrationAwareRequirementsState.implementationAutoQualityGateV1}
        implementationQuickRunV1={orchestrationAwareRequirementsState.implementationQuickRunV1}
        runtimeCodeTaskQueueView={effectiveCodeTaskExecutionQueueV1}
        codeTaskExecutionRunsV1={orchestrationAwareRequirementsState.codeTaskExecutionRunsV1}
        implementationCodeTaskGithubPollingV1={
          orchestrationAwareRequirementsState.implementationCodeTaskGithubPollingV1
        }
        implementationPreviewScopeV1={orchestrationAwareRequirementsState.implementationPreviewScopeV1}
        implementationPreviewRuntimeV1={orchestrationAwareRequirementsState.implementationPreviewRuntimeV1}
        qualityGateResults={orchestrationAwareRequirementsState.implementationQualityGateResultsV1}
        boardState={orchestrationAwareRequirementsState.implementationExecutionBoardStateV1}
        previewReady={prototypeRunSyncSnapshot.previewReady}
        boardInput={implementationStageBoardInput}
        promptTimeline={orchestrationAwareRequirementsState.promptTimeline}
        activeTaskCursorJob={activeTaskCursorJob}
        onRestartTask={handleRestartBoardTask}
        onSelectedTaskIdsChange={handleBoardSelectedTaskIdsChange}
        onSelectedCodeTaskIdsChange={handleBoardSelectedCodeTaskIdsChange}
        liveCheckedCodeTaskIdsRef={boardSelectionBridge.liveCheckedCodeTaskIdsRef}
        liveRunnableCodeTaskIdsRef={boardSelectionBridge.liveRunnableCodeTaskIdsRef}
        onCodeTaskSelectionSummaryChange={boardSelectionBridge.onCodeTaskSelectionSummaryChange}
        onCopyCodeTaskCursorPrompt={handleCopyCodeTaskCursorPrompt}
        onCopyDeveloperPromptsFromHeader={handleCopyDeveloperPromptsFromHeader}
        onRetryGithubVerify={() => void handleManualGithubVerifyRetry()}
        onRecheckCodeTaskGithubVerify={(input) => void handleRecheckCodeTaskGithubVerify(input)}
        githubRecheckBusyCodeTaskId={githubRecheckBusyCodeTaskId}
        onRetryFailedCodeTask={(codeTaskId) => void handleRetryFailedCodeTask(codeTaskId)}
        projectId={projectId.trim()}
        implementationRuntimeStateV1={resolveImplementationRuntimeStateForRead({
          raw: orchestrationAwareRequirementsState as Record<string, unknown>,
          projectId: projectId.trim(),
          dbBundle: implementationRuntimeDbBundle,
        })}
        implementationRuntimeDbBundle={implementationRuntimeDbBundle}
        implementationCodeTaskPlanV1={orchestrationAwareRequirementsState.implementationCodeTaskPlanV1}
        codeTaskPromptContextMapV1={orchestrationAwareRequirementsState.codeTaskPromptContextMapV1}
        cursorWorkItemsV1={orchestrationAwareRequirementsState.cursorWorkItemsV1}
        onRunIntegrationPipeline={runIntegrationPipeline}
        integrationPipelineBusy={integrationPipelineBusy}
        codeTaskIntegrationPlanV1={orchestrationAwareRequirementsState.codeTaskIntegrationPlanV1}
        implementationIntegrationStepsV1={orchestrationAwareRequirementsState.implementationIntegrationStepsV1}
        onMergeIntegrationPullRequest={mergeIntegrationPullRequest}
        integrationMergeBusy={integrationMergeBusy}
        integrationPipelinePreviewReady={integrationPipelineClientResult?.previewReady}
        integrationPipelineStatus={integrationPipelineClientResult?.status}
        onOpenImplementationPreview={openImplementationPreview}
        controlPlaneSnapshot={implementationControlPlaneSnapshot}
        onExecuteSelectedCodeTasks={() => {
          const cp = implementationControlPlaneSnapshot;
          if (
            cp?.action.primaryAction === "execute_selected_runnable_codetasks" &&
            cp.action.enabled &&
            cp.action.codeTaskIds.length > 0
          ) {
            void startImplementationQuickRun({ selectedCodeTaskIds: cp.action.codeTaskIds });
            return;
          }
          const imp = orchestrationAwareRequirementsStateRef.current;
          const selected = resolveCheckedCodeTaskIdsFromBoardBridge({
            bridge: boardSelectionBridge.getBridgeSnapshot(),
            requirementsState: imp,
          });
          void startImplementationQuickRun({ selectedCodeTaskIds: selected });
        }}
      />
    ) : implementationBootstrapShell ? (
      <ImplementationExecutionBoardBootstrapPanel
        body={implementationBootstrapShell.body}
        actionLabels={implementationBootstrapShell.actionLabels}
        onAction={onPickImplementationInterviewLabel}
      />
    ) : null;

  return (
    <>
      <div
        className="jyo-prototype-stage-shell"
        style={{
          flex: 1,
          minHeight: 0,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <ImplementationStageGlobalToolbar>{executionConversationIconToolbar}</ImplementationStageGlobalToolbar>
        {!implementationChatAvailability.canChat ? (
          <ImplementationChatLockedNotice
            title={implementationChatAvailability.title}
            message={implementationChatAvailability.message}
            status={implementationChatAvailability.status}
          />
        ) : null}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <PrototypeExecutionChatPanel
            conversationStatus={executionSingleChat.conversationStatus}
            chatMessages={prioritizedChatMessages}
            headerIconToolbar={null}
            input={executionSingleChat.input}
            onInputChange={executionSingleChat.setInput}
            onSend={() => void executionSingleChat.sendMessage()}
            busy={protoBusy}
            inputDisabled={isMessageInputBlocked}
            composerPlaceholder={chatPlaceholder}
            textAreaRef={chatInputRef}
            targetPickerItems={prototypeComposerAtAtItems}
            replyTo={executionSingleChat.replyTo}
            onClearReplyTo={() => executionSingleChat.setReplyTo(null)}
            onSetReplyTo={(id, preview) => executionSingleChat.setReplyTo({ id, preview })}
            onInterviewSuggestionPick={onInterviewSuggestionPick}
            aiInvokePending={executionSingleChat.aiInvokePending}
            composerPendingAttachments={composerPendingAttachments.pendingAttachments}
            onRemoveComposerAttachment={composerPendingAttachments.removePendingAttachment}
          />
        </div>
        {isNextPublicDevWorkflowToolsEnabled() ? (
          <details style={{ fontSize: 11, color: "#475569", flexShrink: 0, margin: "0 18px 12px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 900, color: "#334155" }}>
              내부 오케스트레이션 (개발)
            </summary>
            <pre
              style={{
                marginTop: 8,
                fontSize: 10,
                lineHeight: 1.35,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: 8,
              }}
            >
              {JSON.stringify(
                {
                  executionSlots: executionSlotsForDevTools,
                  plannerSource: latestRunForDevTools?.plannerSource ?? null,
                  plannerError: latestRunForDevTools?.plannerError ?? null,
                },
                null,
                2,
              )}
            </pre>
          </details>
        ) : null}
      </div>

      <ImplementationExecutionBoardModal
        open={implementationDeveloperDashboardOpen}
        onClose={() => setImplementationDeveloperDashboardOpen(false)}
      >
        {boardPanel}
      </ImplementationExecutionBoardModal>

      <ImplementationWorkingQueueModal
        open={implementationWorkingQueueOpen}
        onClose={() => setImplementationWorkingQueueOpen(false)}
        queue={implementationWorkingQueue.queue}
        onApproveItem={implementationWorkingQueue.approveItem}
        onDeferItem={implementationWorkingQueue.deferItem}
        onRejectItem={implementationWorkingQueue.rejectItem}
        resolvePreviewImageUrl={resolveWorkingQueuePreviewImageUrl}
      />

      <ImplementationResetScopeDialog
        open={implementationResetScopeDialogOpen}
        busy={resetImplementationSessionBusy}
        conversationOnlyDisabled={implementationResetConversationOnlyDisabled}
        codeTaskResetDisabled={implementationResetCodeTaskDisabled}
        onClose={onCloseImplementationResetDialog}
        onConfirm={(scope) => void onConfirmImplementationResetScope(scope)}
      />

      <PrototypeImplementationStageOverlays host={host} stage={stage} />

      {implementationNoticeSuccessToast ? (
        <FixedToast tone="success">{implementationNoticeSuccessToast}</FixedToast>
      ) : null}
      {implementationNoticeErrorToast ? (
        <FixedToast tone="error" role="alert" aria-live="assertive">
          {implementationNoticeErrorToast}
        </FixedToast>
      ) : null}

      <ImplementationExecutionLogModal
        open={implementationExecutionLogModalOpen}
        onClose={() => setImplementationExecutionLogModalOpen(false)}
        promptTimeline={orchestrationAwareRequirementsState.promptTimeline}
        exportBaseName={projectName || "project"}
        onClearExecutionLog={onClearImplementationExecutionLog}
      />
    </>
  );
}
