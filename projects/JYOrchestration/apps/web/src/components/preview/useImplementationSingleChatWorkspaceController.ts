"use client";

import { useCallback, useMemo, useRef, type RefObject } from "react";
import type { PrototypeChatAction } from "@/lib/prototype/buildPrototypeChatMessages";
import { usePrototypeExecutionSingleChat } from "@/components/preview/usePrototypeExecutionSingleChat";
import type { PrototypeExecutionOperationalSendResult } from "@/lib/prototype/prototypeExecutionOperationalSendResult";
import { resolveImplementationOperationalSend } from "@/lib/prototype/implementationOperationalSend";
import { resolveImplementationWorkingQueueOperationalSend } from "@/lib/prototype/implementationWorkingQueueOperationalSend";
import {
  buildImplementationRoleCheckSummary,
  buildImplementationStatusQueryMessage,
  buildImplementationStatusQueryTimelineEntry,
  hasImplementationRoleCheckDetailsShown,
  implementationEntryChipsForBootstrap,
  type ImplementationOrchestrationSummaryInput,
} from "@/lib/prototype/implementationOrchestrationSummary";
import { collapseImplementationBoardChatMessagesForPanelView } from "@/lib/prototype/implementationExecutionBoardPanelView";
import { prioritizeImplementationChipsForState } from "@/lib/prototype/implementationStageNextActions";
import type { ImplementationStatusQueryIntent } from "@/lib/prototype/implementationStatusQueryIntent";
import { buildImplementationUserFeedbackOrchestrationPatch } from "@/lib/prototype/implementationUserFeedback";
import type { ImplementationStageActionRun } from "@/lib/prototype/implementationStageActionRun";
import {
  appendPromptTimeline,
  type PrototypeExecutionOrchestrationPersistInput,
} from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { mergePromptTimelineWithBootstrapEntries } from "@/lib/prototype/implementationIntentTimeline";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import type { EffectiveImplementationState, ImplementationStageActionId } from "@/lib/prototype/effectiveImplementationState";
import type { ImplementationStageActionRunResult } from "@/lib/prototype/implementationStageActionPipeline";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { displayedWorkspaceAiTitle } from "@/lib/ai-member/visibleAiOrchestrator";
import { VIRTUAL_AI_PLANNER_ID } from "@/lib/project/requirementsRoomState";
import type { ComposerAtAtPickerItem } from "@/lib/composer/composerAtAtPicker";
import { useImplementationComposerPendingAttachments } from "@/components/preview/useImplementationComposerPendingAttachments";
import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";
import { postPrototypeRegeneratePlan } from "@/lib/prototype/prototypeRunApiClient";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { buildDynamicServicePlanningSlotDefinitions } from "@/lib/requirements/singleChatOrchestrationSlots";
import type { ImplementationDerivedViewModelControllerValue } from "@/components/preview/useImplementationDerivedViewModelController";
import type { ImplementationControlPlaneSnapshotV1 } from "@/lib/prototype/implementationControlPlaneSnapshot";
import type { ImplementationExecutionBoardV1 } from "@/lib/prototype/implementationExecutionBoard";
import { resolveIntegrationPipelineUnlocked } from "@/lib/prototype/implementationCodeTaskIntegrationContext";
import {
  deriveImplementationChatAvailabilitySignals,
  implementationChatComposerPlaceholder,
  resolveImplementationChatAvailability,
  type ImplementationChatAvailability,
} from "@/lib/prototype/implementationChatAvailability";
import {
  buildImplementationChatAvailabilityBlockedOperationalResult,
  shouldBlockImplementationSupplementChat,
} from "@/lib/prototype/implementationChatAvailabilityGuard";

export type UseImplementationSingleChatWorkspaceControllerInput = Readonly<{
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly requirementsStateJson: unknown;
  readonly requirementsStateJsonRef: RefObject<unknown>;
  readonly parsedRequirementsState: ReturnType<typeof parseRequirementsStateJson>;
  readonly protoBusy: boolean;
  readonly setProtoBusy: (busy: boolean) => void;
  readonly latestRun: PrototypeRun | null;
  readonly setLatestRun: (run: PrototypeRun | null) => void;
  readonly canRequestGeneration: Readonly<{ envOk: boolean; designOk: boolean }>;
  readonly effectiveImplementationState: EffectiveImplementationState;
  readonly implementationBootstrapInput: ImplementationOrchestrationSummaryInput | null;
  readonly implementationStageBoardInput: ImplementationDerivedViewModelControllerValue["implementationStageBoardInput"];
  readonly planningSlotDefinitions: ReturnType<typeof buildDynamicServicePlanningSlotDefinitions>;
  readonly projectArtifacts: readonly ProjectArtifact[];
  readonly isDraftGenerationComplete: boolean;
  readonly isRunningState: boolean;
  readonly templatePlanningReady: boolean;
  readonly isPlannerRunning: boolean;
  readonly plannerCreatePending: boolean;
  readonly plannerContextPayload: Readonly<{
    projectDescription: string;
    actorFlowSummary: string;
    featureDraftTitles: readonly string[];
    ideationSummary: string;
  }>;
  readonly effectiveTemplate: string;
  readonly effectiveTemplateDefName: string;
  readonly ideationSummaryForChat: string;
  readonly actorFlowSummaryForChat: string;
  readonly executionEnvLoading: boolean;
  readonly startWorkPlanGenerationFromChat: () => void;
  readonly setPlannerPromptModalOpen: (open: boolean) => void;
  readonly setExecutionEnvironmentModalOpen: (open: boolean) => void;
  readonly handleChatIntent: (action: PrototypeChatAction) => void;
  readonly handleImplementationChip: (label: string) => boolean;
  readonly appendUserNotice: (message: string) => void;
  readonly applyPendingFromOrchestrationPatch: (patch: PrototypeExecutionOrchestrationPersistInput | undefined) => void;
  readonly applyImplementationOrchestrationResult: (input: {
    readonly messages?: readonly RequirementsMessage[];
    readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput;
  }) => void;
  readonly persistImplementationStageActionRun: (run: ImplementationStageActionRun) => void;
  readonly runImplementationStageActionRef: RefObject<
    (actionId: ImplementationStageActionId) => ImplementationStageActionRunResult | Promise<ImplementationStageActionRunResult>
  >;
  readonly startImplementationQuickRun: (options?: { readonly selectedCodeTaskIds?: readonly string[] }) => Promise<ImplementationStageActionRunResult>;
  readonly implementationBoard: ImplementationExecutionBoardV1 | null;
  readonly implementationControlPlaneSnapshot: ImplementationControlPlaneSnapshotV1 | null;
  readonly activeTaskCursorJob: import("@/lib/prototype/taskCursorExecutionJobTypes").TaskCursorJobSummary | null;
}>;

export function useImplementationSingleChatWorkspaceController(
  input: UseImplementationSingleChatWorkspaceControllerInput,
) {
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const prototypeAiTitle = displayedWorkspaceAiTitle("prototype_build");

  const prototypeComposerAtAtItems = useMemo((): readonly ComposerAtAtPickerItem[] => {
    return [
      {
        id: "prototype:picker:ai",
        label: prototypeAiTitle,
        targets: [{ id: VIRTUAL_AI_PLANNER_ID, name: prototypeAiTitle }],
      },
      {
        id: "prototype:picker:user",
        label: "사용자",
        targets: [{ id: "prototype:mention:user", name: "사용자" }],
      },
    ];
  }, [prototypeAiTitle]);

  const implementationVisibleActionLabels = useMemo(() => {
    const labels = input.implementationBootstrapInput
      ? implementationEntryChipsForBootstrap(input.implementationBootstrapInput)
      : [];
    return prioritizeImplementationChipsForState(
      labels,
      input.effectiveImplementationState,
      input.parsedRequirementsState.implementationTaskExecutionStateV1,
      input.implementationStageBoardInput,
    );
  }, [
    input.implementationBootstrapInput,
    input.effectiveImplementationState,
    input.parsedRequirementsState.implementationTaskExecutionStateV1,
    input.implementationStageBoardInput,
  ]);

  const implementationChatAvailability = useMemo((): ImplementationChatAvailability => {
    const boardInput = input.implementationStageBoardInput;
    const integrationPipelineUnlocked = resolveIntegrationPipelineUnlocked({
      codeTaskPlan: boardInput?.implementationCodeTaskPlanV1 ?? null,
      taskList: boardInput?.taskList ?? null,
      codeTaskRuns: boardInput?.codeTaskExecutionRunsV1 ?? null,
      taskCursorExecution: boardInput?.taskCursorExecutionV1 ?? null,
      taskCursorExecutionHistory: boardInput?.taskCursorExecutionHistoryV1 ?? null,
      autoQualityGate: boardInput?.implementationAutoQualityGateV1 ?? null,
    });
    const previewReady =
      input.implementationControlPlaneSnapshot?.preview.ready === true ||
      boardInput?.previewReady === true;
    const previewUrl = input.implementationControlPlaneSnapshot?.preview.actualPreviewUrl ?? null;
    const taskCursorStatus = boardInput?.taskCursorExecutionV1?.status?.trim() ?? "";
    return resolveImplementationChatAvailability(
      deriveImplementationChatAvailabilitySignals({
        board: input.implementationBoard,
        previewReady,
        previewUrl,
        integrationPipelineUnlocked,
        activeTaskCursorRunning: Boolean(input.activeTaskCursorJob),
        taskCursorGithubVerifying: taskCursorStatus === "github_verifying",
        implementationStarted: Boolean(
          input.parsedRequirementsState.implementationSeedV1 ||
            input.parsedRequirementsState.implementationTaskListV1 ||
            input.implementationBootstrapInput,
        ),
      }),
    );
  }, [
    input.implementationBoard,
    input.implementationControlPlaneSnapshot,
    input.implementationStageBoardInput,
    input.activeTaskCursorJob,
    input.parsedRequirementsState.implementationSeedV1,
    input.parsedRequirementsState.implementationTaskListV1,
    input.implementationBootstrapInput,
  ]);

  const isMessageInputBlocked = useMemo(() => {
    if (!implementationChatAvailability.canChat) return true;
    if (input.plannerCreatePending) return true;
    if (input.protoBusy) return true;
    if (input.isPlannerRunning) return true;
    const r = input.latestRun;
    if (r?.status === "WORK_UNITS_READY" && r.workUnitsExecutionConfirmed !== true && (r.workUnits?.length ?? 0) > 0) {
      return false;
    }
    const s = r?.status;
    if (!s) return false;
    const blocked: readonly string[] = [
      "PLANNER_ANALYZING",
      "CURSOR_REQUESTED",
      "CURSOR_RUNNING",
      "COMMIT_DETECTED",
      "PUSH_CONFIRMED",
      "AI_REVIEWING",
      "PR_OPENED",
      "MERGED",
      "DEPLOY_CONFIGURING",
      "DEPLOYING",
    ];
    return blocked.includes(s);
  }, [
    implementationChatAvailability.canChat,
    input.plannerCreatePending,
    input.protoBusy,
    input.isPlannerRunning,
    input.latestRun,
  ]);

  const chatPlaceholder = useMemo(() => {
    if (!implementationChatAvailability.canChat) {
      return implementationChatComposerPlaceholder(implementationChatAvailability);
    }
    if (isMessageInputBlocked) {
      return `${prototypeAiTitle}가 작업 중입니다. 잠시 기다려 주세요.`;
    }
    if (input.isDraftGenerationComplete) {
      return "완료된 실행입니다. 새로 시작하려면 툴바의 실행 설정을 이용해 주세요.";
    }
    if (input.isRunningState) {
      return "실행 중에는 작업계획을 수정할 수 없습니다.";
    }
    if (
      input.latestRun?.id &&
      input.latestRun.status === "WORK_UNITS_READY" &&
      input.latestRun.workUnitsExecutionConfirmed !== true
    ) {
      return "수정 요청을 입력한 뒤 전송하면 작업계획을 다시 만듭니다.";
    }
    if (
      input.templatePlanningReady &&
      (!input.latestRun?.id || (input.latestRun.workUnits?.length ?? 0) === 0) &&
      !input.isPlannerRunning
    ) {
      return "작업계획 생성 전 추가 지시가 있으면 입력 후 전송하세요.";
    }
    return "메시지를 입력하세요.";
  }, [
    prototypeAiTitle,
    implementationChatAvailability,
    input.templatePlanningReady,
    isMessageInputBlocked,
    input.isRunningState,
    input.isDraftGenerationComplete,
    input.latestRun,
    input.isPlannerRunning,
  ]);

  const buildStatusQueryOperationalResult = useCallback(
    (intent: ImplementationStatusQueryIntent): PrototypeExecutionOperationalSendResult | null => {
      if (intent === "none" || !input.implementationBootstrapInput) return null;
      const prior = resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJsonRef.current).messages ?? [];
      if (intent === "role_check_details" && hasImplementationRoleCheckDetailsShown(prior)) {
        input.appendUserNotice("역할별 점검 결과가 이미 표시되어 있습니다.");
        return "handled";
      }
      const roleCheckSummary = buildImplementationRoleCheckSummary(input.implementationBootstrapInput);
      const aiMessage = buildImplementationStatusQueryMessage({
        intent,
        summaryInput: input.implementationBootstrapInput,
        roleCheckSummary,
      });
      if (!aiMessage) return null;
      let timeline = input.parsedRequirementsState.promptTimeline;
      timeline = appendPromptTimeline(
        timeline,
        buildImplementationStatusQueryTimelineEntry({
          query: intent,
          summaryInput: input.implementationBootstrapInput,
          roleCheckSummary,
        }),
      );
      return {
        kind: "status_query",
        aiMessage,
        timelineEntries: timeline,
      };
    },
    [
      input.implementationBootstrapInput,
      input.requirementsStateJsonRef,
      input.parsedRequirementsState.promptTimeline,
      input.appendUserNotice,
    ],
  );

  const onPersistStateJson = useCallback(
    (patch: {
      messages: readonly RequirementsMessage[];
      slots: readonly import("@/lib/prototype/prototypeExecutionSingleChatTypes").PrototypeExecutionInterviewSlot[];
      answers: Readonly<Record<string, string>>;
      currentSlotKey: string | null;
      readonly bootstrapTimeline?: readonly import("@/lib/requirements/requirementsStateJson").RequirementsPromptTimelineEntry[];
      readonly orchestration?: PrototypeExecutionOrchestrationPersistInput;
    }) => {
      input.applyPendingFromOrchestrationPatch(patch.orchestration);
      const parsed = parseRequirementsStateJson(input.requirementsStateJsonRef.current);
      const timeline = mergePromptTimelineWithBootstrapEntries({
        baseTimeline: parsed.promptTimeline,
        orchestrationTimeline: patch.orchestration?.promptTimeline,
        bootstrapTimeline: patch.bootstrapTimeline,
      });
      const orchestrationPatch: PrototypeExecutionOrchestrationPersistInput = {
        ...(patch.orchestration ?? {}),
        ...(timeline?.length ? { promptTimeline: timeline } : {}),
      };
      input.applyImplementationOrchestrationResult({
        messages: patch.messages,
        orchestrationPatch,
      });
    },
    [input.applyImplementationOrchestrationResult, input.applyPendingFromOrchestrationPatch, input.requirementsStateJsonRef],
  );

  const onOperationalSend = useCallback(
    async (text: string, userMsg: RequirementsMessage): Promise<PrototypeExecutionOperationalSendResult> => {
      if (shouldBlockImplementationSupplementChat(implementationChatAvailability)) {
        const nowIso = new Date().toISOString();
        return buildImplementationChatAvailabilityBlockedOperationalResult({
          availability: implementationChatAvailability,
          nowIso,
        });
      }

      const run = input.latestRun;
      if (run?.id && run.status === "WORK_UNITS_READY" && run.workUnitsExecutionConfirmed !== true) {
        input.setProtoBusy(true);
        try {
          const r = await postPrototypeRegeneratePlan(run.id, {
            projectId: input.projectId,
            userFeedback: text,
            plannerContext: input.plannerContextPayload,
          });
          if (r.success && r.data?.run) input.setLatestRun(r.data.run);
          if (r.message) input.appendUserNotice(r.message);
        } finally {
          input.setProtoBusy(false);
        }
        return "handled";
      }

      const pid = input.projectId.trim();

      const workingQueueResult = await resolveImplementationWorkingQueueOperationalSend({
        text,
        userMsg,
        projectId: pid,
        requirementsStateJson: input.requirementsStateJsonRef.current,
        isDraftGenerationComplete: input.isDraftGenerationComplete,
        parsedRequirementsState: input.parsedRequirementsState,
        implementationBootstrapInput: input.implementationBootstrapInput,
        latestPreviewUrl:
          input.parsedRequirementsState.implementationPreviewRuntimeV1?.previewUrl ??
          input.parsedRequirementsState.implementationPreviewScopeV1?.previewUrl ??
          null,
        hasRunnableCodeTasks: (input.parsedRequirementsState.implementationTaskListV1?.tasks?.length ?? 0) > 0,
        implementationMode: input.isRunningState ? "running" : "ready",
        previewReady: Boolean(
          input.parsedRequirementsState.implementationPreviewRuntimeV1?.previewUrl ??
            input.parsedRequirementsState.implementationPreviewScopeV1?.previewUrl,
        ),
        chatAvailability: implementationChatAvailability,
      });
      if (workingQueueResult) {
        if (
          typeof workingQueueResult === "object" &&
          workingQueueResult.kind === "start_implementation_quick_run"
        ) {
          void input.startImplementationQuickRun();
          return "handled";
        }
        return workingQueueResult;
      }

      return resolveImplementationOperationalSend(
        {
          text,
          userMsg,
          isDraftGenerationComplete: input.isDraftGenerationComplete,
          isRunningState: input.isRunningState,
          envOk: input.canRequestGeneration.envOk,
          designOk: input.canRequestGeneration.designOk,
          routeParams: {
            text,
            visibleActionLabels: implementationVisibleActionLabels,
            envOk: input.canRequestGeneration.envOk,
            templatePlanningReady: input.templatePlanningReady,
            implementationSeedReady: Boolean(input.parsedRequirementsState.implementationSeedV1),
            hasWorkUnits: (input.latestRun?.workUnits?.length ?? 0) > 0,
            isPlannerRunning: input.isPlannerRunning,
            plannerCreatePending: input.plannerCreatePending,
            protoBusy: input.protoBusy,
            projectName: input.projectName || "프로젝트",
            projectDescription: input.projectDescription,
          },
          requirementsStateJson: input.requirementsStateJsonRef.current,
          projectId: pid,
          projectArtifacts: input.projectArtifacts,
          orchestration: input.parsedRequirementsState.singleChatOrchestrationV1,
          slotDefinitions: input.planningSlotDefinitions,
          implementationSeedV1: input.parsedRequirementsState.implementationSeedV1,
          implementationWorkPlanDraftV1: input.parsedRequirementsState.implementationWorkPlanDraftV1,
          promptTimeline: input.parsedRequirementsState.promptTimeline,
          stageActionOrchestrator: pid
            ? {
                projectId: pid,
                effectiveState: input.effectiveImplementationState,
                execute: (actionId) => input.runImplementationStageActionRef.current(actionId),
              }
            : undefined,
          chatAvailability: implementationChatAvailability,
        },
        {
          appendNotice: input.appendUserNotice,
          showToast: input.appendUserNotice,
          focusChatInput: () => queueMicrotask(() => chatInputRef.current?.focus()),
          startWorkPlanGeneration: input.startWorkPlanGenerationFromChat,
          openPlannerPrompt: () => input.setPlannerPromptModalOpen(true),
          openEnvSettings: () => input.setExecutionEnvironmentModalOpen(true),
          buildStatusQueryResult: buildStatusQueryOperationalResult,
          persistRequirementPatch: (patch) => {
            const resolved = resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJsonRef.current);
            const orchPatch = buildImplementationUserFeedbackOrchestrationPatch({
              requirementsStateJson: input.requirementsStateJsonRef.current,
              patch,
              nowIso: patch.createdAt,
            });
            input.applyImplementationOrchestrationResult({
              messages: resolved.messages,
              orchestrationPatch: orchPatch,
            });
          },
        },
      );
    },
    [input, implementationVisibleActionLabels, buildStatusQueryOperationalResult, implementationChatAvailability],
  );

  const composerPendingAttachments = useImplementationComposerPendingAttachments({
    projectId: input.projectId,
    chatInputRef,
    onAttachmentStaged: input.appendUserNotice,
    captureAttachEnabled: implementationChatAvailability.canChat,
  });

  const readPendingComposerAttachments = useCallback(
    () => composerPendingAttachments.pendingAttachments,
    [composerPendingAttachments.pendingAttachments],
  );

  const executionSingleChat = usePrototypeExecutionSingleChat({
    projectId: input.projectId,
    projectName: input.projectName || "프로젝트",
    projectDescription: input.projectDescription,
    requirementsStateJson: input.requirementsStateJson,
    mergedBuiltMessages: [],
    conversationSurfaceEnabled: true,
    envOk: input.canRequestGeneration.envOk,
    templateName: input.effectiveTemplateDefName || input.effectiveTemplate,
    ideationSummary: input.ideationSummaryForChat,
    actorFlowSummary: input.actorFlowSummaryForChat,
    protoBusy: input.protoBusy,
    inputBlocked: isMessageInputBlocked,
    onOperationalSend,
    onOperationalAfterPersist: (action) => {
      if (action === "start_prototype_work_plan") {
        input.startWorkPlanGenerationFromChat();
      }
    },
    onOperationalStageActionRun: (run) => {
      input.persistImplementationStageActionRun(run);
      if ((run.status === "failed" || run.status === "blocked" || run.status === "no_op") && run.message) {
        input.appendUserNotice(run.message);
      }
    },
    onPersistStateJson,
    implementationBootstrapInput: input.implementationBootstrapInput ?? undefined,
    envLoading: input.executionEnvLoading,
    readPendingComposerAttachments,
    clearPendingComposerAttachments: composerPendingAttachments.clearPendingAttachments,
    onComposerSendValidationError: input.appendUserNotice,
  });

  const prioritizedChatMessages = useMemo(() => {
    const prioritized = executionSingleChat.chatMessages.map((m) => {
      const suggestions = (m.meta as { interviewSuggestions?: unknown } | undefined)?.interviewSuggestions;
      if (!Array.isArray(suggestions) || suggestions.length < 2) return m;
      return {
        ...m,
        meta: {
          ...m.meta,
          interviewSuggestions: prioritizeImplementationChipsForState(
            suggestions as readonly string[],
            input.effectiveImplementationState,
            input.parsedRequirementsState.implementationTaskExecutionStateV1,
            input.implementationStageBoardInput,
          ),
        },
      };
    });
    return collapseImplementationBoardChatMessagesForPanelView(prioritized, false);
  }, [
    executionSingleChat.chatMessages,
    input.effectiveImplementationState,
    input.parsedRequirementsState.implementationTaskExecutionStateV1,
    input.implementationStageBoardInput,
  ]);

  const onInterviewSuggestionPick = useCallback(
    (label: string) => {
      if (input.handleImplementationChip(label)) return;
      const picked = executionSingleChat.handleInterviewSuggestionPick(label);
      if (picked.kind === "action") input.handleChatIntent(picked.action);
    },
    [input.handleImplementationChip, input.handleChatIntent, executionSingleChat],
  );

  return {
    chatInputRef,
    prototypeComposerAtAtItems,
    isMessageInputBlocked,
    chatPlaceholder,
    executionSingleChat,
    prioritizedChatMessages,
    onInterviewSuggestionPick,
    composerPendingAttachments,
    implementationChatAvailability,
  };
}
