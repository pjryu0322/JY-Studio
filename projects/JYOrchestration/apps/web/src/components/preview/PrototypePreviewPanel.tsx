"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  buildPrototypeChatMessages,
  buildTimelineArchiveMessages,
  isPrototypeDeployPhase,
  mergeTimelineArchiveIntoLive,
  type PrototypeChatAction,
  type PrototypePrePlanGate,
} from "@/lib/prototype/buildPrototypeChatMessages";
import {
  PrototypeExecutionChatPanel,
  PROTOTYPE_INLINE_TEMPLATE_AI_VALUE,
} from "@/components/preview/PrototypeExecutionChatPanel";
import { WorkspaceHubChromeIconButton } from "@/components/workspace/WorkspaceHubChromeIconButton";

import type { ArtifactBoardAction } from "@/lib/artifacts/buildArtifactBoardItems";
import { RecommendationEvidenceDrawer } from "@/components/recommendation/RecommendationEvidenceDrawer";
import { useProjectRecommendationEvidence } from "@/lib/recommendation/useProjectRecommendationEvidence";
import { buildArtifactHubBundle } from "@/lib/requirements/artifactHubBundle";
import { DB_INTEGRATION_REVIEW_CHIP } from "@/lib/prototype/implementationDbStrategy";
import {
  buildImplementationArtifactsTimelineEntry,
  derivedHubEntryToDeliverableAsset,
} from "@/lib/prototype/implementationArtifacts";
import { buildImplementationSlotsInterviewUi } from "@/lib/prototype/prototypeExecutionImplementationChrome";
import {
  AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP,
  IMPLEMENTATION_ARTIFACT_HUB_LABEL,
  IMPLEMENTATION_GENERATION_REQUEST_CHIP,
  IMPLEMENTATION_PROGRESS_LABEL,
  IMPLEMENTATION_SLOTS_DETAIL_ARIA_LABEL,
} from "@/lib/requirements/implementationUxLabels";
import { RequirementsArtifactHubDrawer } from "@/components/requirements/RequirementsArtifactHubDrawer";
import { RequirementsDeliverableViewerModal } from "@/components/requirements/RequirementsDeliverableViewerModal";
import type { ProjectArtifactHubEntry } from "@/lib/requirements/projectArtifactHub";
import { projectArtifactToDeliverableAsset } from "@/lib/requirements/projectArtifactViewer";
import { buildPrototypeExecutionPlanningOrchestrationView } from "@/lib/prototype/prototypeExecutionPlanningOrchestration";
import {
  IMPLEMENTATION_MODE_PARTICIPANT_COUNT,
  IMPLEMENTATION_MODE_PRIMARY_MEMBERS,
} from "@/lib/requirements/modeOrchestrationConfig";
import {
  buildImplementationBootstrapInput,
  isPrototypeExecutionEnvLoading,
  pickExecutionStateArtifacts,
  toPrototypeChatEnvSnapshot,
} from "@/lib/prototype/prototypeExecutionEnvSnapshot";
import {
  buildImplementationWipDraftLifecycleTimelineEntry,
  CODE_AGENT_WIP_WORK_REQUEST_CHIP,
} from "@/lib/prototype/codeAgentWipExecution";
import { buildCursorBridgeOrchestrationResult } from "@/lib/prototype/prototypeExecutionCursorBridgeActions";
import { fetchExecutionSetup } from "@/components/project-spec/api";
import {
  evaluateExecutionSetupSourceGenerationReadiness,
  mapExecutionSetupDtoToSourceGenerationRow,
} from "@/lib/prototype/executionSetupSourceGeneration";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import {
  buildExecutionSetupAvailabilityTimelineEntry,
  evaluateCursorExecutionAvailability,
} from "@/lib/prototype/cursorExecutionAvailability";
import { buildQualityGateBridgeTargetFromWip } from "@/lib/prototype/bridgeCompletionPolicy";
import {
  buildTargetRepoE2eTimelineEntry,
  buildCursorApiDirectTimelineEntry,
  formatTargetRepoE2eDiagnosticLines,
  isCursorBridgeConfiguredForSourceGeneration,
} from "@/lib/prototype/targetRepoE2eDiagnostics";
import { CURSOR_API_NOT_CONFIGURED_MESSAGE } from "@/lib/prototype/cursorExecutionAvailability";
import { toCodeAgentTargetRepositorySnapshot } from "@/lib/prototype/projectTargetRepository";
import { tryHandlePrototypeExecutionChip } from "@/lib/prototype/prototypeExecutionImplementationChips";
import {
  buildWipChipHandlerSlice,
  executeCodeAgentWipWorkRequest,
} from "@/lib/prototype/prototypeExecutionWipChipHandlers";
import {
  buildDataModelDraftResult,
  buildDbIntegrationReviewResult,
  buildMockImplementationModeResult,
} from "@/lib/prototype/prototypeExecutionDbStrategyActions";
import {
  ensureImplementationArtifactsFromTaskList,
  ensureImplementationTaskPlan,
  ensureMockImplementationReady,
} from "@/lib/prototype/implementationAutoProgress";
import { buildGenerateImplementationWorkPlanDraftResult } from "@/lib/prototype/prototypeExecutionWorkPlanDraftActions";
import { buildPlanningImplementationSeedCheckResult } from "@/lib/requirements/planningImplementationSeedActions";
import { buildDynamicServicePlanningSlotDefinitions } from "@/lib/requirements/singleChatOrchestrationSlots";
import {
  canConfirmImplementationWorkPlanFromEffectiveState,
  mapImplementationChipToAction,
  mergePendingImplementationPatch,
  mergePendingImplementationPatchFromOrchestration,
  resolveOrchestrationAwareRequirementsState,
  resolveEffectiveImplementationState,
  shouldClearPendingImplementationPatch,
  type ImplementationStageActionId,
  type PendingImplementationPatch,
} from "@/lib/prototype/effectiveImplementationState";
import {
  buildImplementationStageActionFocusComposerResult,
  buildImplementationStageActionOpenArtifactsResult,
  buildImplementationStageActionOpenEnvSettingsResult,
  buildImplementationStageActionShowStatusResult,
  type ImplementationStageActionExecutionResult,
  type ImplementationStageActionRunResult,
} from "@/lib/prototype/implementationStageActionPipeline";
import { orchestrateImplementationStageAction } from "@/lib/prototype/implementationStageActionOrchestrator";
import {
  buildImplementationStageActionRunLogPatch,
  type ImplementationStageActionRun,
} from "@/lib/prototype/implementationStageActionRun";
import { prioritizeImplementationChipsForState } from "@/lib/prototype/implementationStageNextActions";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import {
  buildConfirmImplementationTaskPlanResult,
  buildImplementationCursorGateContext,
  buildPrepareImplementationExecutionToast,
  evaluateImplementationCursorGate,
  formatImplementationCursorBlockedNotice,
} from "@/lib/prototype/prototypeExecutionTaskPlanActions";
import {
  appendPromptTimeline,
  buildPrototypeExecutionOrchestrationPersistPatch,
  type PrototypeExecutionOrchestrationPersistInput,
} from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import {
  buildImplementationRoleCheckSummary,
  buildImplementationStatusQueryMessage,
  buildImplementationStatusQueryTimelineEntry,
  hasImplementationRoleCheckDetailsShown,
  implementationEntryChipsForBootstrap,
  sanitizeImplementationConversationMessages,
} from "@/lib/prototype/implementationOrchestrationSummary";
import type { ImplementationStatusQueryIntent } from "@/lib/prototype/implementationStatusQueryIntent";
import { resolveImplementationOperationalSend } from "@/lib/prototype/implementationOperationalSend";
import {
  appendCreateWorkPlanBootstrapCtaRouteTimeline,
  mergePromptTimelineWithBootstrapEntries,
} from "@/lib/prototype/implementationIntentTimeline";
import { buildImplementationUserFeedbackOrchestrationPatch } from "@/lib/prototype/implementationUserFeedback";
import { summarizeImplementationSeedStatus } from "@/lib/requirements/implementationSeed";
import { buildGenerateImplementationTaskListFromSeedResult } from "@/lib/prototype/implementationTaskListGeneration";
import {
  buildCreateImplementationSeedFromQuickDesignDraftResult,
  runConfirmQuickDesignForImplementationFromState,
} from "@/lib/prototype/implementationQuickDesignDraftBridge";
import {
  buildImplementationEntryCursorWorkItemsRecovery,
  buildImplementationEntryCursorWorkItemsRegeneratedTimelineEntry,
  deriveImplementationEntryState,
} from "@/lib/prototype/implementationEntryState";
import { hasImplementationTaskListReady } from "@/lib/requirements/implementationTaskList";
import {
  buildImplementationExecutionBoardFromRequirementsState,
  buildIntegratedStageStepActionNotice,
  buildReworkRequestRegistrationNotice,
  countTaskListWipCandidateTasks,
  formatTaskScopedWipExecutionBlockedNotice,
  isImplementationReadyForReviewStage,
  pickFirstExecutableDeveloperTaskId,
  pickQualityGateTargetTaskIds,
  pickTaskIdForReworkRequest,
  selectCursorWorkItemsForWipExecution,
} from "@/lib/prototype/implementationExecutionBoard";
import { buildImplementationReviewStageReadyMarker } from "@/lib/prototype/implementationReviewStageReady";
import {
  buildInitialReviewStageUserTestSession,
  isReviewStageEntryReady,
  markReviewStageReturnedToImplementation,
  markReviewStageUserTestCompleted,
  markReviewStageUserTestStarted,
} from "@/lib/prototype/reviewStageUserTest";
import {
  canCompleteReviewStage,
  buildReviewFeedbackConvertNotice,
  convertReviewFeedbackToImplementationRework,
  getActiveReviewFeedbackItems,
} from "@/lib/prototype/reviewStageUserFeedback";
import {
  buildReviewStageEntryMessage,
  buildReviewStageViewFeedbackMessage,
  REVIEW_STAGE_ADD_FEEDBACK_GUIDE,
} from "@/lib/prototype/reviewStageMessage";
import {
  buildImplementationExecutionBoardMessage,
  replaceLatestImplementationBoardMessageWithSetup,
  tryAppendImplementationUserConfirmationBoardMessage,
} from "@/lib/prototype/implementationExecutionBoardMessage";
import {
  appendReworkRequest,
  markReworkRequestsAcceptedForTask,
  resolveAllPendingUserConfirmations,
} from "@/lib/prototype/implementationExecutionBoardState";
import { tryHandleImplementationTaskListChip } from "@/lib/prototype/implementationTaskListEntryMessage";
import {
  buildInitialImplementationTaskExecutionStateFromTaskList,
  markDeveloperTasksFailedForWip,
  syncDeveloperTaskExecutionFromCodeAgentWip,
} from "@/lib/prototype/implementationTaskExecutionState";
import { hasTaskListForWipOrchestration, shouldUseTaskListBoardWipGate } from "@/lib/prototype/implementationTaskListBoardWipGate";
import {
  finalizeIntegratedStageStep,
  type ImplementationIntegratedStep,
} from "@/lib/prototype/implementationIntegratedExecutionState";
import { buildImplementationStageBoardGateContext } from "@/lib/prototype/implementationStageActionPipeline";
import {
  buildCursorWorkItemsFromImplementationTaskList,
  validateTaskScopedWorkItems,
} from "@/lib/prototype/implementationCursorWorkItems";
import { buildPrototypeRunExecutionSyncPatch, deriveImplementationPrototypeRunSyncSnapshot } from "@/lib/prototype/implementationPrototypeRunSync";
import { executeImplementationQualityGateCheck } from "@/lib/prototype/implementationQualityGate";
import {
  appendPromptTimelineEntries,
  buildImplementationWipGenerationTimelineEntry,
  buildTaskListDerivedWipOrchestration,
  canUseTaskListForWipOrchestration,
  mergeTaskListWipRuntimeState,
  prepareWipRequestRuntime,
} from "@/lib/prototype/implementationTaskListWipPrep";
import type { PrototypeExecutionOperationalSendResult } from "@/components/preview/usePrototypeExecutionSingleChat";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import { usePrototypeExecutionSingleChat } from "@/components/preview/usePrototypeExecutionSingleChat";
import { buildDisplayedPlannerUserMessage, workUnitProgressAllMerged } from "@/components/preview/prototypePreviewPanelHelpers";
import {
  isPrototypeTemplatePlanningReady,
  shouldLockInlineChatTemplateSelection,
} from "@/lib/prototype/prototypeRunUiHelpers";
import { PrototypePreviewDraggableShell } from "@/components/preview/PrototypePreviewDraggableShell";
import { PrototypeTemplateChangeModal } from "@/components/preview/PrototypeTemplateChangeModal";
import type {
  PrototypeWorkspaceActor as PrototypePreviewActor,
  PrototypeWorkspaceFlowStep as PrototypePreviewFlowStep,
  PrototypeWorkspaceIdeationAsset,
} from "@/components/preview/prototypeWorkspaceTypes";
import { patchSpecWorkspaceRequest } from "@/lib/project/specWorkspaceClient";
import { VIRTUAL_AI_PLANNER_ID } from "@/lib/project/requirementsRoomState";
import type { ComposerAtAtPickerItem } from "@/lib/composer/composerAtAtPicker";
import {
  isPrototypeExecutionEnvOk,
  loadPrototypeExecutionEnvStatus,
} from "@/lib/prototype/prototypeExecutionEnvOk";
import { buildCursorPrototypePromptPackage } from "@/lib/prototype/buildCursorPrototypePrompt";
import {
  buildPrototypeKnowledgePackQueryBlob,
  fetchPrototypePreviewKnowledgePackInnerMarkdown,
} from "@/lib/knowledge-packs/knowledgePackPrototypePreviewContext";
import { analyzePrototypeContext } from "@/lib/prototype/prototypeContextAnalyzer";
import { registerPlatformPopupFromOpenedUrl } from "@/lib/platform/platformPopupRegistry";
import {
  defaultPrototypeGenerationRecord,
  loadPrototypeGenerationRecord,
  savePrototypeGenerationRecord,
  type PrototypeGenerationLocalRecord,
} from "@/lib/prototype/prototypeGenerationLocalStore";
import {
  fetchLatestPrototypeRun,
  postCreatePrototypeRun,
  postPrototypeConfirmExecution,
  postPrototypeRegeneratePlan,
  postPrototypeRetryWorkUnit,
  postPrototypeRunRefresh,
} from "@/lib/prototype/prototypeRunApiClient";
import { workUnitProgressFromRun } from "@/lib/prototype/prototypePlannerService";
import type { PrototypeRun, PrototypeRunStatusReason } from "@/lib/prototype/prototypeRunTypes";
import { buildPrototypePlannerInstructionBlock } from "@/lib/prototype/prototypePlannerLlm";
import { computePrototypeExecutionSlots } from "@/lib/prototype/prototypeExecutionSlots";
import { PROTOTYPE_TEMPLATES, type PrototypeTemplateType } from "@/lib/templates/prototypeTemplates";
import { isNextPublicDevWorkflowToolsEnabled } from "@/lib/env/devWorkflowTools";
import { PrototypeTemplateMockPreview } from "@/components/preview/PrototypeTemplateMockPreview";
import { ProjectExecutionEnvironmentModal } from "@/components/project/ProjectExecutionEnvironmentModal";
import type { Project } from "@/components/project-spec/types";
import { projectExecutionSettingsHref } from "@/lib/project/projectExecutionSettingsHref";
import {
  mergeRequirementsStateJson,
  parseRequirementsStateJson,
  type PrototypeWorkspaceTimelineCardV1,
  type RequirementsPromptTimelineEntry,
} from "@/lib/requirements/requirementsStateJson";
import { buildImplementationConversationResetStateJson } from "@/lib/requirements/requirementsWorkspaceHelpers";
import type { SpecWorkspaceProjectPatchResponseBody } from "@/lib/types/specWorkspaceProjectPatch";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import { resolveEnabledCatalogKeysForScreen } from "@/lib/workspace-ai/workspaceScreenKeys";
import type { WorkspaceAiGraphMemberWire } from "@/lib/workspace-ai/workspaceAiGraphWire";
import { WorkspaceParticipantsModal } from "@/components/workspace/WorkspaceParticipantsModal";
import { WorkspaceConversationHubIconRow } from "@/components/workspace/WorkspaceConversationHubIconRow";
import {
  buildConversationMarkdown,
  confirmResetConversation,
  downloadConversationMarkdownFile,
} from "@/lib/chat/conversationMarkdown";
import { buildConversationContentHtmlForWorkNoteSummary } from "@/lib/worknote/buildConversationContentHtmlForWorkNoteSummary";
import { postWorkNoteSummarize } from "@/lib/worknote/workNotesSummarizeApi";
import type { ParticipantOption } from "@/components/workspace/workspaceParticipantTypes";
import { buildWorkspaceAiParticipantOptions } from "@/lib/ai-member/platformAiMembers";
import { displayedWorkspaceAiTitle } from "@/lib/ai-member/visibleAiOrchestrator";

type EnvBadge = "ok" | "needs" | "error" | "loading";
type EnvStatus = Readonly<{
  git: EnvBadge;
  github: EnvBadge;
  cursor: EnvBadge;
  connectionTest: EnvBadge;
  runnable: EnvBadge;
  message: string | null;
}>;

function githubPagesSettingsUrlFromSuggestedPreview(suggested: string | null | undefined): string | null {
  const s = String(suggested ?? "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    const host = u.hostname.toLowerCase();
    const m = /^([^.]+)\.github\.io$/i.exec(host);
    if (!m) return null;
    const owner = m[1];
    const pathSeg = u.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean)[0];
    if (!pathSeg) return `https://github.com/${owner}/${owner}/settings/pages`;
    return `https://github.com/${owner}/${pathSeg}/settings/pages`;
  } catch {
    return null;
  }
}

function isLikelyPreviewUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  return /^https?:\/\//i.test(u);
}

export function PrototypePreviewPanel({
  projectId,
  projectName,
  projectDescription,
  requirementsStateJson,
  ideationAssets,
  flowSteps,
  actors,
  featureDraftTitles,
  checklistGapLabels,
  designFingerprint,
  onRequirementsStateJsonChange,
}: {
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly requirementsStateJson: unknown;
  readonly onRequirementsStateJsonChange?: (next: unknown) => void;
  readonly ideationAssets: ReadonlyArray<PrototypeWorkspaceIdeationAsset>;
  readonly flowSteps: ReadonlyArray<PrototypePreviewFlowStep>;
  readonly actors: ReadonlyArray<PrototypePreviewActor>;
  readonly featureDraftTitles?: readonly string[];
  readonly checklistGapLabels: readonly string[];
  readonly designFingerprint: string;
}) {
  // Avoid hydration mismatch: do not read sessionStorage in initial render.
  const [record, setRecord] = useState<PrototypeGenerationLocalRecord>(() => defaultPrototypeGenerationRecord());
  const [toast, setToast] = useState<string | null>(null);
  const toastClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [templatePreviewOpen, setTemplatePreviewOpen] = useState(false);
  const [templateChangeOpen, setTemplateChangeOpen] = useState(false);
  const [plannerPromptModalOpen, setPlannerPromptModalOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [templateOverride, setTemplateOverride] = useState<PrototypeTemplateType | null>(null);
  const [envStatus, setEnvStatus] = useState<EnvStatus>({
    git: "loading",
    github: "loading",
    cursor: "loading",
    connectionTest: "loading",
    runnable: "loading",
    message: null,
  });
  const [latestRun, setLatestRun] = useState<PrototypeRun | null>(null);
  const [automationAvailable, setAutomationAvailable] = useState(false);
  const [automationBlockReason, setAutomationBlockReason] = useState<PrototypeRunStatusReason>(null);
  const [protoBusy, setProtoBusy] = useState(false);
  const [implementationResetBusy, setImplementationResetBusy] = useState(false);
  const [implementationConversationResetNonce, setImplementationConversationResetNonce] = useState(0);
  /** postCreate 호출 직후~응답 전: 입력 잠금·진행 UI용 */
  const [plannerCreatePending, setPlannerCreatePending] = useState(false);
  const [pendingImplementationPatch, setPendingImplementationPatch] =
    useState<PendingImplementationPatch>({});
  const [executionSetupRow, setExecutionSetupRow] =
    useState<ExecutionSetupSourceGenerationRow | null>(null);
  const [plannerProgressStep, setPlannerProgressStep] = useState(1);
  const planProgressStartedAtRef = useRef(0);
  /** 작업계획 생성 중복 클릭 방지 — state와 달리 동기적으로 잠금 */
  const planRequestInFlightRef = useRef(false);
  // --- chat-led UX (transient, state-derived) ---
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  /** DB에 저장하는 타임라인 카드(작업계획·WorkUnit 완료), 재실행 후에도 유지 */
  const [timelineCards, setTimelineCards] = useState<readonly PrototypeWorkspaceTimelineCardV1[]>([]);
  const lastTimelineSnapRef = useRef<string>("");
  /** 작업계획 API 호출 전: 생성 버튼 → 프롬프트/작업 시작 대기 */
  const [prePlanGate, setPrePlanGate] = useState<PrototypePrePlanGate>("idle");
  const prePlannerNotesRef = useRef("");
  const appendExecutionNoticeRef = useRef<(text: string) => void>(() => {});
  /** [확정]까지 눌러야 true — 콤보만으로는 true가 되지 않음 */
  const [templateConfirmed, setTemplateConfirmed] = useState(false);
  /** 콤보에서의 선택(미확정 포함). AI 추천 행은 `PROTOTYPE_INLINE_TEMPLATE_AI_VALUE` */
  const [draftPickerValue, setDraftPickerValue] = useState<string>(PROTOTYPE_INLINE_TEMPLATE_AI_VALUE);
  const [protoMembersModalOpen, setProtoMembersModalOpen] = useState(false);
  const [executionEnvironmentModalOpen, setExecutionEnvironmentModalOpen] = useState(false);
  const [artifactHubOpen, setArtifactHubOpen] = useState(false);
  const [executionAiSummaryBusy, setExecutionAiSummaryBusy] = useState(false);
  const [deliverableViewerOpen, setDeliverableViewerOpen] = useState(false);
  const [deliverableViewerIds, setDeliverableViewerIds] = useState<readonly string[]>([]);
  const [deliverableViewerFocusId, setDeliverableViewerFocusId] = useState<string | null>(null);
  const [viewerDerivedAssets, setViewerDerivedAssets] = useState<
    readonly import("@/lib/requirements/ideationDeliverables").IdeationDeliverableAsset[]
  >([]);
  const [workspaceAiGraph, setWorkspaceAiGraph] = useState<WorkspaceAiGraphMemberWire[] | null>(null);
  /** 추천·병합 지식팩 컨텍스트(프로토타입 프롬프트 미리보기용, 실패 시 비움) */
  const [knowledgePackContextText, setKnowledgePackContextText] = useState<string | undefined>(undefined);
  const prototypeAiTitle = displayedWorkspaceAiTitle("prototype_build");
  const prototypeComposerAtAtItems = useMemo((): readonly ComposerAtAtPickerItem[] => {
    return [
      { id: "prototype:picker:ai", label: prototypeAiTitle, targets: [{ id: VIRTUAL_AI_PLANNER_ID, name: prototypeAiTitle }] },
      { id: "prototype:picker:user", label: "사용자", targets: [{ id: "prototype:mention:user", name: "사용자" }] },
    ];
  }, [prototypeAiTitle]);

  const refreshRecord = useCallback(() => {
    setRecord(loadPrototypeGenerationRecord(projectId));
  }, [projectId]);

  useEffect(() => {
    // Load browser sessionStorage after mount (prevents SSR/client divergence).
    refreshRecord();
  }, [refreshRecord]);

  useEffect(() => {
    const pid = projectId.trim();
    if (!pid) {
      setWorkspaceAiGraph(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await credentialsIncludeFetch(`/api/project/workspace-ai?projectId=${encodeURIComponent(pid)}`);
        const json = (await res.json()) as { success?: boolean; data?: { members?: WorkspaceAiGraphMemberWire[] } };
        if (cancelled) return;
        if (!res.ok || !json.success || !json.data?.members) {
          setWorkspaceAiGraph(null);
          return;
        }
        setWorkspaceAiGraph(json.data.members);
      } catch {
        if (!cancelled) setWorkspaceAiGraph(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") queueMicrotask(() => refreshRecord());
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshRecord]);

  const refreshLatestRun = useCallback(async () => {
    if (!projectId.trim()) return;
    const r = await fetchLatestPrototypeRun(projectId);
    if (r.success && r.data) {
      setLatestRun(r.data.run);
      setAutomationAvailable(r.data.automationAvailable);
      setAutomationBlockReason(r.data.automationBlockReason);
    }
  }, [projectId]);

  useEffect(() => {
    const t = window.setTimeout(() => void refreshLatestRun(), 0);
    return () => window.clearTimeout(t);
  }, [refreshLatestRun]);

  const analysis = useMemo(
    () =>
      analyzePrototypeContext({
        projectName,
        projectDescription,
        ideationAssets,
        flowSteps,
        actors,
        checklistMissingLabels: checklistGapLabels,
      }),
    [projectName, projectDescription, ideationAssets, flowSteps, actors, checklistGapLabels],
  );

  useEffect(() => {
    const r = loadPrototypeGenerationRecord(projectId);
    const raw = r.selectedTemplate;
    const normalized = raw && PROTOTYPE_TEMPLATES.some((t) => t.id === raw) ? (raw as PrototypeTemplateType) : null;
    if (normalized) {
      setTemplateOverride(normalized);
      setDraftPickerValue(normalized);
    } else {
      setTemplateOverride(null);
      setDraftPickerValue(PROTOTYPE_INLINE_TEMPLATE_AI_VALUE);
    }
    setTemplateConfirmed(r.templateCommittedToPlan === true);
    /**
     * 채팅 로그 우선순위:
     * 1) DB(Project.requirementsStateJson) 영구 저장
     * 2) 로컬(sessionStorage) — DB 미연동/오프라인 대비
     */
    const db = parseRequirementsStateJson(requirementsStateJson);
    const tc = db.prototypeWorkspaceTimelineCardsV1;
    setTimelineCards(Array.isArray(tc) && tc.length ? [...tc] : []);
    lastTimelineSnapRef.current = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on project switch
  }, [projectId]);

  const reloadExecutionSetupRow = useCallback(async () => {
    const pid = projectId.trim();
    if (!pid) {
      setExecutionSetupRow(null);
      return null;
    }
    const res = await fetchExecutionSetup(pid);
    const data = res.res.ok && res.json.success ? res.json.data : null;
    const row = mapExecutionSetupDtoToSourceGenerationRow(data);
    setExecutionSetupRow(row);
    return row;
  }, [projectId]);

  useEffect(() => {
    void reloadExecutionSetupRow();
  }, [reloadExecutionSetupRow]);

  const lastPersistedChatFingerprintRef = useRef<string>("");
  const persistChatToDb = useCallback(
    async (
      chatPatch?: {
        messages: readonly import("@/lib/requirements/requirementsMessage").RequirementsMessage[];
        slots: readonly import("@/lib/prototype/prototypeExecutionSingleChatTypes").PrototypeExecutionInterviewSlot[];
        answers: Readonly<Record<string, string>>;
        currentSlotKey: string | null;
      },
      orchestrationPatch?: Omit<PrototypeExecutionOrchestrationPersistInput, "chat">,
    ) => {
      const pid = projectId.trim();
      if (!pid) return;
      const tc = [...timelineCards].slice(-300);
      const fingerprint = JSON.stringify({
        c: chatPatch?.messages?.map((m) => [m.id, m.createdAt]) ?? [],
        t: tc.map((c) => [c.id, c.at]),
        o: orchestrationPatch
          ? [
              orchestrationPatch.implementationTaskPlanV1?.createdAt,
              orchestrationPatch.cursorWorkItemsV1?.length,
              orchestrationPatch.codeAgentWipExecutionV1?.status,
              orchestrationPatch.codeAgentWipExecutionV1?.requestedAt,
              orchestrationPatch.codeAgentWipExecutionV1?.selectedTaskId,
              orchestrationPatch.codeAgentWipExecutionV1?.bridgeExecutionStatus,
              orchestrationPatch.promptTimeline?.length,
              orchestrationPatch.implementationTaskExecutionStateV1?.updatedAt,
              orchestrationPatch.implementationTaskExecutionStateV1?.summary,
            ]
          : null,
      });
      if (fingerprint === lastPersistedChatFingerprintRef.current) return;
      lastPersistedChatFingerprintRef.current = fingerprint;

      const merged =
        chatPatch || orchestrationPatch
          ? buildPrototypeExecutionOrchestrationPersistPatch(requirementsStateJson, {
              ...(chatPatch ? { chat: chatPatch } : {}),
              ...(orchestrationPatch ?? {}),
            })
          : mergeRequirementsStateJson(parseRequirementsStateJson(requirementsStateJson), {
              prototypeWorkspaceTimelineCardsV1: tc,
              lastSavedAt: new Date().toISOString(),
            });

      if (orchestrationPatch) {
        onRequirementsStateJsonChange?.(merged);
      } else {
        queueMicrotask(() => {
          onRequirementsStateJsonChange?.(merged);
        });
      }
      void patchSpecWorkspaceRequest(pid, { requirementsStateJson: merged }).catch(() => {});
    },
    [projectId, timelineCards, requirementsStateJson, onRequirementsStateJsonChange],
  );

  const persistExecutionStateFromPrototypeRun = useCallback(
    (run: import("@/lib/prototype/prototypeRunTypes").PrototypeRun | null | undefined) => {
      if (!run) return;
      const parsed = parseRequirementsStateJson(requirementsStateJson);
      const sync = buildPrototypeRunExecutionSyncPatch({
        currentState: parsed.implementationTaskExecutionStateV1,
        latestRun: run,
        workUnits: run.workUnits,
      });
      if (!sync.changed || !sync.nextState) return;
      void persistChatToDb(undefined, { implementationTaskExecutionStateV1: sync.nextState });
    },
    [requirementsStateJson, persistChatToDb],
  );

  useEffect(() => {
    const t = window.setTimeout(() => void persistChatToDb(), 1200);
    return () => window.clearTimeout(t);
  }, [persistChatToDb]);

  const effectiveTemplate = useMemo((): PrototypeTemplateType => {
    if (templateConfirmed) return templateOverride ?? analysis.recommendedTemplate;
    if (draftPickerValue === PROTOTYPE_INLINE_TEMPLATE_AI_VALUE) return analysis.recommendedTemplate;
    return draftPickerValue as PrototypeTemplateType;
  }, [templateConfirmed, templateOverride, draftPickerValue, analysis.recommendedTemplate]);
  const effectiveTemplateDef = useMemo(
    () => PROTOTYPE_TEMPLATES.find((t) => t.id === effectiveTemplate) ?? null,
    [effectiveTemplate],
  );
  const effectiveAnalysis = useMemo(
    () => ({ ...analysis, recommendedTemplate: effectiveTemplate }),
    [analysis, effectiveTemplate],
  );

  const actorName = useCallback(
    (id: string) => actors.find((a) => a.id === id)?.name ?? id,
    [actors],
  );

  const plannerContextPayload = useMemo(
    () => ({
      projectDescription: projectDescription.trim(),
      actorFlowSummary: flowSteps.map((s) => `${s.title}: ${String(s.purpose ?? "").trim()}`).join("\n"),
      featureDraftTitles: featureDraftTitles ?? [],
      ideationSummary: ideationAssets
        .map((a) => `${String(a.title ?? "").trim()}: ${String(a.content ?? "").trim()}`.trim())
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 12_000),
    }),
    [projectDescription, flowSteps, featureDraftTitles, ideationAssets],
  );

  const knowledgePackQueryBlob = useMemo(
    () =>
      buildPrototypeKnowledgePackQueryBlob({
        projectName,
        projectDescription,
        ideationAssets,
        flowSteps,
        featureDraftTitles,
      }),
    [projectName, projectDescription, ideationAssets, flowSteps, featureDraftTitles],
  );

  useEffect(() => {
    const pid = projectId.trim();
    if (!pid || knowledgePackQueryBlob.trim().length < 12) {
      setKnowledgePackContextText(undefined);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const inner = await fetchPrototypePreviewKnowledgePackInnerMarkdown(credentialsIncludeFetch, {
            projectId: pid,
            queryBlob: knowledgePackQueryBlob,
          });
          setKnowledgePackContextText(inner);
        } catch {
          setKnowledgePackContextText(undefined);
        }
      })();
    }, 800);
    return () => window.clearTimeout(t);
  }, [projectId, knowledgePackQueryBlob]);

  const promptPackage = useMemo(() => {
    const stepsForPrompt = flowSteps.map((s) => ({
      title: s.title,
      purpose: s.purpose,
      primaryActorId: s.primaryActorId,
      ownerName: actorName(s.primaryActorId),
    }));
    return buildCursorPrototypePromptPackage({
      analysis: effectiveAnalysis,
      projectName: projectName.trim() || "프로젝트",
      projectDescription: projectDescription.trim(),
      actors: actors.map((a) => ({ name: a.name, kind: a.kind, description: a.description })),
      flowSteps: stepsForPrompt,
      featureDraftTitles,
      knowledgePackContextText,
    });
  }, [
    effectiveAnalysis,
    projectName,
    projectDescription,
    actors,
    flowSteps,
    featureDraftTitles,
    actorName,
    knowledgePackContextText,
  ]);

  const ownersOk = flowSteps.length > 0 && flowSteps.every((s) => String(s.primaryActorId ?? "").trim());
  const ideaOk = projectDescription.trim().length > 24 || ideationAssets.some((a) => String(a.content ?? a.title ?? "").trim().length > 20);
  const actorsOk = actors.length >= 1;
  const flowOk = flowSteps.length >= 3;

  const ownerAssignedRatio = useMemo(() => {
    if (!flowSteps.length) return 0;
    const n = flowSteps.filter((s) => String(s.primaryActorId ?? "").trim()).length;
    return Math.round((n / flowSteps.length) * 100);
  }, [flowSteps]);

  const canRequestGeneration = useMemo(() => {
    const designOk = ideaOk && actorsOk && flowOk && ownerAssignedRatio >= 60;
    const envOk = isPrototypeExecutionEnvOk(envStatus);
    return { designOk, envOk, ok: designOk && envOk };
  }, [
    ideaOk,
    actorsOk,
    flowOk,
    ownerAssignedRatio,
    envStatus.runnable,
    envStatus.git,
    envStatus.github,
    envStatus.cursor,
    envStatus.connectionTest,
  ]);

  const templatePlanningReady = useMemo(
    () =>
      isPrototypeTemplatePlanningReady({
        templateConfirmed,
        envOk: canRequestGeneration.envOk,
        draftPickerValue,
      }),
    [templateConfirmed, canRequestGeneration.envOk, draftPickerValue],
  );

  const executionSlots = useMemo(() => computePrototypeExecutionSlots(latestRun), [latestRun]);

  const sortedWorkUnitsForSidebar = useMemo(
    () => [...(latestRun?.workUnits ?? [])].sort((a, b) => a.order - b.order),
    [latestRun?.workUnits],
  );

  const previewUrl = useMemo(() => {
    const fromServer =
      latestRun?.previewUrl && isLikelyPreviewUrl(latestRun.previewUrl) ? latestRun.previewUrl.trim() : null;
    if (fromServer) return fromServer;
    return record.previewUrl && isLikelyPreviewUrl(record.previewUrl) ? record.previewUrl.trim() : null;
  }, [latestRun?.previewUrl, record.previewUrl]);

  const showToast = useCallback((msg: string, displayMs = 3200) => {
    if (toastClearTimerRef.current) clearTimeout(toastClearTimerRef.current);
    setToast(msg);
    toastClearTimerRef.current = setTimeout(() => {
      setToast(null);
      toastClearTimerRef.current = null;
    }, displayMs);
  }, []);

  const prototypeScreenCatalogIds = useMemo(() => {
    if (!workspaceAiGraph) return undefined;
    return resolveEnabledCatalogKeysForScreen(workspaceAiGraph, "prototype_build");
  }, [workspaceAiGraph]);


  useEffect(
    () => () => {
      if (toastClearTimerRef.current) clearTimeout(toastClearTimerRef.current);
    },
    [],
  );

  async function postPrototypeRunCancel(runId: string, input: { projectId: string; reason?: string }) {
    const res = await fetch(`/api/prototype-runs/${encodeURIComponent(runId)}/cancel`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return (await res.json()) as { success: boolean; data?: { run: PrototypeRun }; message?: string };
  }

  async function postPrototypeRunResume(runId: string, input: { projectId: string; mode: "resume" | "restart" }) {
    const res = await fetch(`/api/prototype-runs/${encodeURIComponent(runId)}/resume`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return (await res.json()) as { success: boolean; data?: { run: PrototypeRun }; message?: string };
  }

  const onCursorAutoRequest = async () => {
    if (!canRequestGeneration.designOk || !automationAvailable) return;
    if ((latestRun?.workUnits?.length ?? 0) === 0) return;
    setProtoBusy(true);
    try {
      const res = await postCreatePrototypeRun({
        projectId,
        selectedTemplate: effectiveTemplate,
        promptSnapshot: promptPackage.slice(0, 50_000),
        startCursorAgent: true,
        plannerContext: plannerContextPayload,
      });
      if (res.success && res.data?.run) {
        setLatestRun(res.data.run);
        persistExecutionStateFromPrototypeRun(res.data.run);
        setAutomationAvailable(res.data.automationAvailable);
        setAutomationBlockReason(res.data.automationBlockReason);
        showToast(res.data.message ?? "Cursor 자동 생성을 요청했습니다.");
        savePrototypeGenerationRecord(projectId, {
          runStatus: "awaiting_preview",
          fingerprintAtRequest: designFingerprint,
          lastRequestedAt: new Date().toISOString(),
          lastError: null,
          selectedTemplate: effectiveTemplate,
          lastPromptSnapshot: promptPackage.slice(0, 30_000),
        });
        refreshRecord();
      } else {
        showToast(res.message ?? "자동 생성 요청에 실패했습니다.");
      }
    } finally {
      setProtoBusy(false);
      void refreshLatestRun();
    }
  };

  const runPlannerCreate = useCallback(
    async (prePlanUserNote?: string) => {
      if (!canRequestGeneration.designOk) return;
      if (!projectId.trim()) {
        appendExecutionNoticeRef.current("프로젝트 정보가 없어 작업계획 요청을 보낼 수 없습니다.");
        return;
      }
      const note = String(prePlanUserNote ?? "").trim();
      const plannerCtx =
        note.length > 0
          ? {
              ...plannerContextPayload,
              ideationSummary: `${plannerContextPayload.ideationSummary}\n\n[사용자 사전 지시]\n${note}`,
            }
          : plannerContextPayload;
      setProtoBusy(true);
      try {
        const res = await postCreatePrototypeRun({
          projectId,
          selectedTemplate: effectiveTemplate,
          promptSnapshot: promptPackage.slice(0, 50_000),
          startCursorAgent: false,
          plannerContext: plannerCtx,
        });
        if (res.success && res.data?.run) {
          /** 응답 직후 진행 말풍선이 잠깐 보일 때 단계를 모두 완료로 스냅 */
          setPlannerProgressStep(5);
          setLatestRun(res.data.run);
          persistExecutionStateFromPrototypeRun(res.data.run);
          setAutomationAvailable(res.data.automationAvailable);
          setAutomationBlockReason(res.data.automationBlockReason);
          const wuN = res.data.run.workUnits?.length ?? 0;
          const serverMsg = res.data.message?.trim();
          /**
           * “현재 실행이 진행 중입니다.”는 사용자가 이미 눌렀다는 의미뿐이라 UX에 도움되지 않음.
           * 대신 즉시 refresh를 호출해, 타임라인/플래너 진행 카드를 최신 상태로 갱신한다.
           */
          if (serverMsg === "현재 실행이 진행 중입니다.") {
            const rr = await postPrototypeRunRefresh(res.data.run.id, { projectId });
            if (rr.success && rr.data?.run) {
              setLatestRun(rr.data.run);
              persistExecutionStateFromPrototypeRun(rr.data.run);
            }
            return;
          }
          /** 서버가 메시지 없이 같은 run만 돌려준 경우(플래너 진행 중 중복 요청 등)는 타임라인 카드만 유지 */
          if (wuN === 0 && serverMsg) appendExecutionNoticeRef.current(serverMsg);
        } else {
          appendExecutionNoticeRef.current(res.message?.trim() || "작업계획 생성에 실패했습니다.");
        }
      } catch {
        appendExecutionNoticeRef.current("네트워크 오류로 작업계획 요청에 실패했습니다.");
      } finally {
        setProtoBusy(false);
        void refreshLatestRun();
      }
    },
    [canRequestGeneration.designOk, projectId, effectiveTemplate, promptPackage, plannerContextPayload, refreshLatestRun, persistExecutionStateFromPrototypeRun],
  );

  /**
   * 동기 진입점: `async`로 두면 클릭 직후 첫 줄이 한 박자 늦게 실행되어 연타 시 API가 여러 번 나갈 수 있음.
   * ref·flushSync·pending은 이 함수 본문이 끝나기 전에 모두 반영됨.
   */
  const startWorkPlanGenerationFromChat = useCallback(() => {
    if (planRequestInFlightRef.current) return;
    if (protoBusy) return;
    if (!canRequestGeneration.envOk) {
      appendExecutionNoticeRef.current("먼저 환경 검증과 연결 테스트를 완료해 주세요.");
      return;
    }
    if (!templatePlanningReady) {
      appendExecutionNoticeRef.current(
        "선택한 템플릿을 적용하려면 [확정]을 눌러 주세요. AI 추천 템플릿을 사용할 경우 별도 확정 없이 진행할 수 있습니다.",
      );
      return;
    }
    if (!canRequestGeneration.designOk) {
      appendExecutionNoticeRef.current("기획 산출물·설계 readiness가 완료된 뒤 작업계획을 생성할 수 있습니다.");
      return;
    }
    planRequestInFlightRef.current = true;
    const extra = prePlannerNotesRef.current.trim();
    prePlannerNotesRef.current = "";
    planProgressStartedAtRef.current = Date.now();
    flushSync(() => {
      setPlannerProgressStep(1);
      setPlannerCreatePending(true);
    });
    void (async () => {
      try {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
        await runPlannerCreate(extra || undefined);
      } finally {
        planRequestInFlightRef.current = false;
        setPlannerCreatePending(false);
      }
    })();
  }, [protoBusy, templatePlanningReady, canRequestGeneration.designOk, canRequestGeneration.envOk, runPlannerCreate]);

  const applyToolbarTemplateSelection = useCallback(
    (next: string) => {
      if (protoBusy) return;
      if (shouldLockInlineChatTemplateSelection(latestRun)) return;
      const recommendedId = analysis.recommendedTemplate;
      const resolvedId =
        next === PROTOTYPE_INLINE_TEMPLATE_AI_VALUE ? recommendedId : (next as PrototypeTemplateType);

      if (resolvedId === recommendedId) {
        setTemplateOverride(null);
        setDraftPickerValue(PROTOTYPE_INLINE_TEMPLATE_AI_VALUE);
        setTemplateConfirmed(false);
        savePrototypeGenerationRecord(projectId, { selectedTemplate: null, templateCommittedToPlan: false });
      } else {
        setTemplateOverride(resolvedId);
        setDraftPickerValue(resolvedId);
        setTemplateConfirmed(true);
        savePrototypeGenerationRecord(projectId, { selectedTemplate: resolvedId, templateCommittedToPlan: true });
        setPrePlanGate("need_create_click");
      }
      refreshRecord();
      setTemplateChangeOpen(false);
    },
    [analysis.recommendedTemplate, latestRun, projectId, protoBusy, refreshRecord],
  );

  const applyChatTemplateIntent = useCallback(
    (next: PrototypeTemplateType | null) => {
      const recommendedId = analysis.recommendedTemplate;
      const resolvedId = next ?? recommendedId;
      const nextDraft =
        resolvedId === recommendedId ? PROTOTYPE_INLINE_TEMPLATE_AI_VALUE : resolvedId;
      setDraftPickerValue(nextDraft);
      setTemplateConfirmed((c) => {
        if (c) savePrototypeGenerationRecord(projectId, { templateCommittedToPlan: false });
        return false;
      });
    },
    [analysis.recommendedTemplate, projectId],
  );

  useEffect(() => {
    if (!templatePlanningReady) {
      setPrePlanGate("idle");
      return;
    }
    /** 이미 실행이 시작된 상태라면(플래너 포함) “작업계획 생성” 버튼을 노출하지 않음 */
    if (latestRun?.id && latestRun.status !== "DRAFT" && latestRun.status !== "PROMPT_READY") {
      setPrePlanGate("idle");
      return;
    }
    const wu = (latestRun?.workUnits?.length ?? 0) > 0;
    if (latestRun?.id && wu) {
      setPrePlanGate("idle");
      return;
    }
    setPrePlanGate("need_create_click");
  }, [templatePlanningReady, latestRun?.id, latestRun?.status, latestRun?.workUnits?.length]);

  const onRefreshPrototypeStatus = async () => {
    if (!latestRun?.id) {
      await refreshLatestRun();
      showToast("최신 실행 정보를 불러왔습니다.");
      return;
    }
    setProtoBusy(true);
    try {
      const res = await postPrototypeRunRefresh(latestRun.id, { projectId });
      if (res.success && res.data?.run) {
        setLatestRun(res.data.run);
        persistExecutionStateFromPrototypeRun(res.data.run);
        showToast(res.data.userMessage?.trim() || "상태를 갱신했습니다.");
      } else {
        showToast(res.message ?? "갱신에 실패했습니다.");
      }
    } finally {
      setProtoBusy(false);
      void refreshLatestRun();
    }
  };

  /**
   * 자동 상태 폴링:
   * Prototype 파이프라인은 서버가 background worker로 run을 갱신하는 구조가 아니라,
   * `/refresh` 호출 시 Cursor agent poll → run store update 를 수행한다.
   * 따라서 실행 중에는 UI가 주기적으로 refresh를 호출해야 “멈춘 것처럼” 보이지 않는다.
   */
  const autoRefreshInFlightRef = useRef(false);
  useEffect(() => {
    const rid = latestRun?.id;
    const s = latestRun?.status;
    if (!rid || !s) return;
    if (protoBusy) return;
    const runningStatuses: readonly string[] = [
      // WORK_UNITS_READY is the "between units" state; if execution is confirmed,
      // we must keep polling so the next WorkUnit auto-starts without user clicking refresh.
      "PLANNER_ANALYZING",
      "CURSOR_REQUESTED",
      "CURSOR_RUNNING",
      "COMMIT_DETECTED",
      "PUSH_CONFIRMED",
      "AI_REVIEWING",
      "REWORK_REQUIRED",
      "PR_OPENED",
      "MERGED",
      "DEPLOY_CONFIGURING",
      "DEPLOYING",
    ];
    const shouldAutoRefreshWorkUnitsReady =
      s === "WORK_UNITS_READY" &&
      (latestRun?.workUnits?.length ?? 0) > 0 &&
      latestRun?.runSchemaVersion >= 2 &&
      latestRun?.workUnitsExecutionConfirmed === true;
    if (!runningStatuses.includes(s) && !shouldAutoRefreshWorkUnitsReady) return;

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (autoRefreshInFlightRef.current) return;
      autoRefreshInFlightRef.current = true;
      void postPrototypeRunRefresh(rid, { projectId })
        .then((res) => {
          if (res.success && res.data?.run) {
            setLatestRun(res.data.run);
            persistExecutionStateFromPrototypeRun(res.data.run);
          }
        })
        .finally(() => {
          autoRefreshInFlightRef.current = false;
        });
    };
    tick();
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, [
    latestRun?.id,
    latestRun?.status,
    latestRun?.workUnitsExecutionConfirmed,
    latestRun?.workUnits?.length,
    latestRun?.runSchemaVersion,
    projectId,
    protoBusy,
    persistExecutionStateFromPrototypeRun,
  ]);

  const loadEnv = useCallback(async () => {
    if (!projectId.trim()) return;
    const status = await loadPrototypeExecutionEnvStatus(projectId);
    setEnvStatus(status);
  }, [projectId]);

  useEffect(() => {
    const t = window.setTimeout(() => void loadEnv(), 0);
    return () => window.clearTimeout(t);
  }, [loadEnv]);

  const canStartPrototypeAutomation = useMemo(
    () => automationAvailable && canRequestGeneration.designOk && canRequestGeneration.envOk,
    [automationAvailable, canRequestGeneration.designOk, canRequestGeneration.envOk],
  );

  const awaitingExecutionConfirm = useMemo(() => {
    const r = latestRun;
    if (!r) return false;
    return (
      r.status === "WORK_UNITS_READY" &&
      r.workUnits.length > 0 &&
      r.runSchemaVersion >= 2 &&
      r.workUnitsExecutionConfirmed !== true
    );
  }, [latestRun]);

  const isRunningState = useMemo(() => {
    const s = latestRun?.status;
    if (!s) return false;
    if (s === "BLOCKED") return false;
    const prog = latestRun ? workUnitProgressFromRun(latestRun) : null;
    const allWuMerged = latestRun ? workUnitProgressAllMerged(latestRun) : false;
    const mid =
      prog &&
      !prog.allMerged &&
      (s === "MERGED" || s === "PR_OPENED" || s === "DEPLOYING" || s === "CURSOR_REQUESTED" || s === "CURSOR_RUNNING");
    const wuReadyRunning =
      s === "WORK_UNITS_READY" &&
      !awaitingExecutionConfirm &&
      (latestRun.workUnits?.length ?? 0) > 0;
    const deployAfterUnits =
      allWuMerged && (s === "MERGED" || s === "DEPLOY_CONFIGURING" || s === "DEPLOYING");
    return (
      deployAfterUnits ||
      s === "DEPLOY_CONFIGURING" ||
      s === "DEPLOYING" ||
      s === "PLANNER_ANALYZING" ||
      wuReadyRunning ||
      s === "CURSOR_REQUESTED" ||
      s === "CURSOR_RUNNING" ||
      s === "COMMIT_DETECTED" ||
      s === "PUSH_CONFIRMED" ||
      s === "AI_REVIEWING" ||
      Boolean(mid)
    );
  }, [latestRun, awaitingExecutionConfirm]);

  /** `plannerStatus`만 RUNNING으로 남는 불일치 시에도 UI가 막히지 않도록 실행 단계(status)만 사용 */
  const isPlannerRunning = useMemo(() => latestRun?.status === "PLANNER_ANALYZING", [latestRun?.status]);

  useEffect(() => {
    const active = isPlannerRunning || plannerCreatePending;
    const hasUnits = (latestRun?.workUnits?.length ?? 0) > 0;
    if (!active || hasUnits) return;
    const tick = () => {
      const elapsed = Date.now() - planProgressStartedAtRef.current;
      const step = Math.min(5, 1 + Math.floor(elapsed / 2000));
      setPlannerProgressStep(step);
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [isPlannerRunning, plannerCreatePending, latestRun?.workUnits?.length]);

  /** 전송·Enter: 플래너/파이프라인 작업 중에는 입력 비활성 (계획 확정 전 수정 요청만 허용) */
  const isMessageInputBlocked = useMemo(() => {
    if (plannerCreatePending) return true;
    if (protoBusy) return true;
    if (isPlannerRunning) return true;
    const r = latestRun;
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
  }, [plannerCreatePending, protoBusy, isPlannerRunning, latestRun]);

  const hasCompletedWorkPlan = useMemo(
    () => (latestRun?.workUnits?.length ?? 0) > 0,
    [latestRun?.workUnits],
  );

  const canStartFullPrototypePipeline = useMemo(
    () => canStartPrototypeAutomation && hasCompletedWorkPlan && !isPlannerRunning,
    [canStartPrototypeAutomation, hasCompletedWorkPlan, isPlannerRunning],
  );

  const isCancelled = latestRun?.status === "CANCELLED";
  const workPipelineFailed = latestRun?.status === "FAILED";
  const deployFailedOnly = latestRun?.status === "DEPLOY_FAILED";
  /** 초안 생성 완료(정식 배포 URL 확정 전). 배포 완료 후에는 타임라인 완료 카드 대신 일반 상태로 둠 */
  const isDraftGenerationComplete = useMemo(
    () => latestRun?.status === "PREVIEW_READY" && !String(latestRun?.publicUrl ?? "").trim(),
    [latestRun?.status, latestRun?.publicUrl],
  );
  const isCompleted = isDraftGenerationComplete;
  const deployPhase = useMemo(() => isPrototypeDeployPhase(latestRun), [latestRun]);

  const plannerUserMessagePreview = useMemo(
    () =>
      buildDisplayedPlannerUserMessage({
        projectName: projectName.trim() || "프로젝트",
        plannerContext: plannerContextPayload,
        selectedTemplate: effectiveTemplate,
        promptSnapshot: promptPackage.slice(0, 50_000),
        userFeedback: "",
        latestRun,
      }),
    [projectName, plannerContextPayload, effectiveTemplate, promptPackage, latestRun],
  );

  const plannerCombinedInputPreview = useMemo(
    () => `${buildPrototypePlannerInstructionBlock()}\n\n${plannerUserMessagePreview}`,
    [plannerUserMessagePreview],
  );

  const confirmExecution = useCallback(() => {
    const rid = latestRun?.id;
    if (!rid) return;
    void (async () => {
      setProtoBusy(true);
      try {
        const r = await postPrototypeConfirmExecution(rid, { projectId });
        if (r.success && r.data?.run) {
          setLatestRun(r.data.run);
          persistExecutionStateFromPrototypeRun(r.data.run);
        }
        if (r.message) showToast(r.message);
        await postPrototypeRunRefresh(rid, { projectId }).then((x) => {
          if (x.success && x.data?.run) {
            setLatestRun(x.data.run);
            persistExecutionStateFromPrototypeRun(x.data.run);
          }
        });
      } finally {
        setProtoBusy(false);
        void refreshLatestRun();
      }
    })();
  }, [latestRun?.id, projectId, refreshLatestRun, persistExecutionStateFromPrototypeRun]);

  const regeneratePlan = useCallback(() => {
    const rid = latestRun?.id;
    if (!rid) return;
    void (async () => {
      setProtoBusy(true);
      try {
        const r = await postPrototypeRegeneratePlan(rid, {
          projectId,
          userFeedback: undefined,
          plannerContext: plannerContextPayload,
        });
        if (r.success && r.data?.run) setLatestRun(r.data.run);
        if (r.message) showToast(r.message);
      } finally {
        setProtoBusy(false);
        void refreshLatestRun();
      }
    })();
  }, [latestRun?.id, plannerContextPayload, projectId, refreshLatestRun]);

  const retryWorkUnit = useCallback(
    (mode: "same_prompt" | "regenerate_prompt" | "skip_admin") => (runId: string, order: number) => {
      void (async () => {
        setProtoBusy(true);
        try {
          const r = await postPrototypeRetryWorkUnit(runId, { projectId, workUnitOrder: order, mode });
          if (r.success && r.data?.run) setLatestRun(r.data.run);
          if (r.message) showToast(r.message);
          await postPrototypeRunRefresh(runId, { projectId }).then((x) => {
            if (x.success && x.data?.run) setLatestRun(x.data.run);
          });
        } finally {
          setProtoBusy(false);
          void refreshLatestRun();
        }
      })();
    },
    [projectId, refreshLatestRun],
  );

  const pagesSettingsHref = useMemo(
    () => githubPagesSettingsUrlFromSuggestedPreview(latestRun?.suggestedPreviewUrl),
    [latestRun?.suggestedPreviewUrl],
  );

  const envSettingsHref = useMemo(
    () => `${projectExecutionSettingsHref(projectId, { envNote: "prototype" })}#execution-setup-panel`,
    [projectId],
  );

  const executionEnvironmentModalProject = useMemo((): Project | null => {
    const pid = projectId.trim();
    if (!pid) return null;
    return {
      id: pid,
      name: projectName,
      description: projectDescription || null,
      projectType: "prototype",
      status: "active",
    };
  }, [projectId, projectName, projectDescription]);

  const executionEnvSnapshot = useMemo(
    () =>
      toPrototypeChatEnvSnapshot({
        git: envStatus.git,
        github: envStatus.github,
        cursor: envStatus.cursor,
        connectionTest: envStatus.connectionTest,
      }),
    [envStatus],
  );

  const executionEnvLoading = useMemo(() => isPrototypeExecutionEnvLoading(executionEnvSnapshot), [executionEnvSnapshot]);

  const parsedRequirementsState = useMemo(
    () => parseRequirementsStateJson(requirementsStateJson),
    [requirementsStateJson],
  );

  const orchestrationAwareRequirementsState = useMemo(
    () =>
      resolveOrchestrationAwareRequirementsState({
        base: parsedRequirementsState,
        pendingPatch: pendingImplementationPatch,
      }),
    [parsedRequirementsState, pendingImplementationPatch],
  );

  const prototypeRunSyncSnapshot = useMemo(
    () =>
      deriveImplementationPrototypeRunSyncSnapshot({
        latestRun,
        workUnits: latestRun?.workUnits,
      }),
    [latestRun],
  );

  const implementationStageBoardGateContext = useMemo(() => {
    const pid = projectId.trim();
    const taskList = orchestrationAwareRequirementsState.implementationTaskListV1;
    if (!pid || !taskList) return null;
    return buildImplementationStageBoardGateContext({
      projectId: pid,
      taskList,
      executionState: orchestrationAwareRequirementsState.implementationTaskExecutionStateV1,
      integratedExecutionState:
        orchestrationAwareRequirementsState.implementationIntegratedExecutionStateV1,
      boardState: orchestrationAwareRequirementsState.implementationExecutionBoardStateV1,
      qualityGateResults: orchestrationAwareRequirementsState.implementationQualityGateResultsV1,
      previewReady: prototypeRunSyncSnapshot.previewReady,
      implementationReviewStageReadyV1:
        orchestrationAwareRequirementsState.implementationReviewStageReadyV1,
      codeAgentWipExecutionV1: orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
    });
  }, [projectId, orchestrationAwareRequirementsState, prototypeRunSyncSnapshot.previewReady]);

  const persistedDraftUpdatedAtRef = useRef<string | null | undefined>(undefined);
  const persistedTaskPlanCreatedAtRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    setPendingImplementationPatch({});
  }, [projectId]);

  useEffect(() => {
    const nextDraftAt = parsedRequirementsState.implementationWorkPlanDraftV1?.updatedAt ?? null;
    const nextTaskAt = parsedRequirementsState.implementationTaskPlanV1?.createdAt ?? null;
    if (
      shouldClearPendingImplementationPatch({
        prevPersistedDraftUpdatedAt: persistedDraftUpdatedAtRef.current,
        nextPersistedDraftUpdatedAt: nextDraftAt,
        prevPersistedTaskPlanCreatedAt: persistedTaskPlanCreatedAtRef.current,
        nextPersistedTaskPlanCreatedAt: nextTaskAt,
      })
    ) {
      setPendingImplementationPatch({});
    }
    persistedDraftUpdatedAtRef.current = nextDraftAt;
    persistedTaskPlanCreatedAtRef.current = nextTaskAt;
  }, [
    parsedRequirementsState.implementationWorkPlanDraftV1?.updatedAt,
    parsedRequirementsState.implementationTaskPlanV1?.createdAt,
  ]);

  const effectiveImplementationState = useMemo(
    () =>
      resolveEffectiveImplementationState({
        parsedRequirementsState,
        pendingPatch: pendingImplementationPatch,
        envOk: canRequestGeneration.envOk,
        designOk: canRequestGeneration.designOk,
        latestRun,
        plannerRunning: isPlannerRunning,
        plannerCreatePending,
        protoBusy,
      }),
    [
      parsedRequirementsState,
      pendingImplementationPatch,
      canRequestGeneration.envOk,
      canRequestGeneration.designOk,
      latestRun,
      isPlannerRunning,
      plannerCreatePending,
      protoBusy,
    ],
  );

  const applyPendingFromOrchestrationPatch = useCallback(
    (patch: PrototypeExecutionOrchestrationPersistInput | undefined) => {
      const incoming = mergePendingImplementationPatchFromOrchestration(patch);
      if (!incoming) return;
      setPendingImplementationPatch((prev) => mergePendingImplementationPatch(prev, incoming));
    },
    [],
  );

  const executionArtifacts = useMemo(
    () => pickExecutionStateArtifacts(parsedRequirementsState),
    [parsedRequirementsState],
  );

  const planningSlotDefinitions = useMemo(
    () =>
      buildDynamicServicePlanningSlotDefinitions({
        projectName: projectName.trim() || "프로젝트",
        projectDescription: projectDescription ?? "",
      }),
    [projectName, projectDescription],
  );

  const implementationBootstrapInput = useMemo(
    () =>
      buildImplementationBootstrapInput({
        envLoading: executionEnvLoading,
        projectId,
        env: executionEnvSnapshot,
        envOk: canRequestGeneration.envOk,
        envSettingsHref,
        featureDraftTitles: featureDraftTitles ?? [],
        projectArtifacts: executionArtifacts.projectArtifacts,
        artifactOrchestrationV1: executionArtifacts.artifactOrchestrationV1,
        designOk: canRequestGeneration.designOk,
        orchestration: parsedRequirementsState.singleChatOrchestrationV1,
        slotDefinitions: planningSlotDefinitions,
        implementationSeedV1: orchestrationAwareRequirementsState.implementationSeedV1,
        implementationTaskListV1: orchestrationAwareRequirementsState.implementationTaskListV1,
        implementationTaskPlanV1: orchestrationAwareRequirementsState.implementationTaskPlanV1,
        cursorWorkItemsV1: orchestrationAwareRequirementsState.cursorWorkItemsV1,
        fastPlanDraftV1: parsedRequirementsState.fastPlanDraftV1,
        promptTimeline: orchestrationAwareRequirementsState.promptTimeline,
      }),
    [
      executionEnvLoading,
      projectId,
      executionEnvSnapshot,
      canRequestGeneration.envOk,
      canRequestGeneration.designOk,
      envSettingsHref,
      featureDraftTitles,
      executionArtifacts,
      parsedRequirementsState.singleChatOrchestrationV1,
      orchestrationAwareRequirementsState.implementationSeedV1,
      orchestrationAwareRequirementsState.implementationTaskListV1,
      orchestrationAwareRequirementsState.implementationTaskPlanV1,
      orchestrationAwareRequirementsState.cursorWorkItemsV1,
      parsedRequirementsState.fastPlanDraftV1,
      orchestrationAwareRequirementsState.promptTimeline,
      planningSlotDefinitions,
    ],
  );

  useEffect(() => {
    const pid = projectId.trim();
    const taskList = parsedRequirementsState.implementationTaskListV1;
    if (!pid || !hasImplementationTaskListReady(taskList)) return;
    if ((parsedRequirementsState.cursorWorkItemsV1?.length ?? 0) > 0) return;

    const recovery = buildImplementationEntryCursorWorkItemsRecovery({
      projectId: pid,
      taskList: taskList!,
      existingCursorWorkItems: parsedRequirementsState.cursorWorkItemsV1,
    });
    if (!recovery.regenerated) return;

    const nowIso = new Date().toISOString();
    void persistChatToDb(resolvePrototypeExecutionSingleChatFromState(requirementsStateJson), {
      cursorWorkItemsV1: [...recovery.cursorWorkItems],
      promptTimeline: [
        ...(parsedRequirementsState.promptTimeline ?? []),
        buildImplementationEntryCursorWorkItemsRegeneratedTimelineEntry({
          projectId: pid,
          taskCount: taskList!.tasks.length,
          developerTaskCount: taskList!.roleSummary?.developer ?? 0,
          nowIso,
        }),
      ],
    });
  }, [
    projectId,
    parsedRequirementsState.implementationTaskListV1,
    parsedRequirementsState.cursorWorkItemsV1,
    parsedRequirementsState.promptTimeline,
    requirementsStateJson,
    persistChatToDb,
  ]);

  const implementationSeedReady = useMemo(() => {
    const summary = summarizeImplementationSeedStatus({
      orchestration: parsedRequirementsState.singleChatOrchestrationV1,
      definitions: planningSlotDefinitions,
      lifecycleStatus: parsedRequirementsState.implementationSeedV1?.lifecycleStatus,
    });
    return summary.ready || Boolean(parsedRequirementsState.implementationSeedV1?.readiness?.ready);
  }, [
    parsedRequirementsState.singleChatOrchestrationV1,
    parsedRequirementsState.implementationSeedV1,
    planningSlotDefinitions,
  ]);

  const implementationVisibleActionLabels = useMemo(() => {
    const labels = implementationBootstrapInput
      ? implementationEntryChipsForBootstrap(implementationBootstrapInput)
      : [];
    const pid = projectId.trim();
    const taskList = parsedRequirementsState.implementationTaskListV1;
    const boardInput =
      pid && taskList
        ? {
            projectId: pid,
            taskList,
            executionState: orchestrationAwareRequirementsState.implementationTaskExecutionStateV1,
            integratedExecutionState:
              orchestrationAwareRequirementsState.implementationIntegratedExecutionStateV1,
            boardState: orchestrationAwareRequirementsState.implementationExecutionBoardStateV1,
            qualityGateResults: orchestrationAwareRequirementsState.implementationQualityGateResultsV1,
            previewReady: prototypeRunSyncSnapshot.previewReady,
            implementationReviewStageReadyV1:
              orchestrationAwareRequirementsState.implementationReviewStageReadyV1,
            reviewStageUserTestSessionV1:
              orchestrationAwareRequirementsState.reviewStageUserTestSessionV1,
            reviewStageUserFeedbackListV1:
              orchestrationAwareRequirementsState.reviewStageUserFeedbackListV1,
            codeAgentWipExecutionV1: orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
          }
        : null;
    return prioritizeImplementationChipsForState(
      labels,
      effectiveImplementationState,
      orchestrationAwareRequirementsState.implementationTaskExecutionStateV1,
      boardInput,
    );
  }, [
    implementationBootstrapInput,
    effectiveImplementationState,
    orchestrationAwareRequirementsState,
    projectId,
    prototypeRunSyncSnapshot.previewReady,
  ]);

  const runImplementationStageActionRef = useRef<
    (actionId: ImplementationStageActionId) => ImplementationStageActionRunResult
  >(() => ({ outcome: "blocked", message: "구현단계 action을 준비하는 중입니다." }));
  const persistImplementationStageActionRunRef = useRef<(run: ImplementationStageActionRun) => void>(() => {});

  const derivedChatMessages = useMemo(
    () =>
      buildPrototypeChatMessages({
        omitEnvReadinessCard: true,
        env: executionEnvSnapshot,
        canRequestGenerationEnvOk: canRequestGeneration.envOk,
        canRequestGenerationDesignOk: canRequestGeneration.designOk,
        envSettingsHref,
        templateChipTemplates: [],
        recommendedTemplateId: analysis.recommendedTemplate,
        templateConfirmed,
        templatePlanningReady,
        prePlanGate,
        latestRun,
        awaitingExecutionConfirm,
        isPlannerRunning,
        isRunningState,
        isCancelled,
        isFailed: workPipelineFailed,
        isDeployFailed: deployFailedOnly,
        isCompleted,
        isDeployPhase: deployPhase,
        automationAvailable,
        previewUrl,
        pagesSettingsHref,
        pagesDeployWorkflowRunUrl: latestRun?.pagesDeployWorkflowRunUrl ?? null,
        protoBusy,
        plannerCreatePending,
        plannerProgressStep,
        projectId,
      }),
    [
      executionEnvSnapshot,
      canRequestGeneration.envOk,
      canRequestGeneration.designOk,
      envSettingsHref,
      analysis.recommendedTemplate,
      templateConfirmed,
      templatePlanningReady,
      prePlanGate,
      latestRun,
      awaitingExecutionConfirm,
      isPlannerRunning,
      plannerCreatePending,
      plannerProgressStep,
      isRunningState,
      isCancelled,
      workPipelineFailed,
      deployFailedOnly,
      isCompleted,
      deployPhase,
      automationAvailable,
      previewUrl,
      pagesSettingsHref,
      protoBusy,
      projectId,
    ],
  );

  const timelineCardsForMerge = useMemo(() => {
    if (!awaitingExecutionConfirm || !latestRun?.id) return timelineCards;
    return timelineCards.filter((c) => !(c.kind === "plan_ready" && c.runId === latestRun.id));
  }, [timelineCards, awaitingExecutionConfirm, latestRun?.id]);

  const mergedChatMessages = useMemo(
    () => mergeTimelineArchiveIntoLive(derivedChatMessages, buildTimelineArchiveMessages(timelineCardsForMerge)),
    [derivedChatMessages, timelineCardsForMerge],
  );

  const ideationSummaryForChat = useMemo(
    () =>
      ideationAssets
        .map((a) => `${String(a.title ?? "").trim()}: ${String(a.content ?? "").trim()}`.trim())
        .filter(Boolean)
        .join("\n")
        .slice(0, 8000),
    [ideationAssets],
  );

  const actorFlowSummaryForChat = useMemo(
    () => flowSteps.map((s) => `${s.title}: ${String(s.purpose ?? "").trim()}`).join("\n").slice(0, 8000),
    [flowSteps],
  );

  const buildStatusQueryOperationalResult = useCallback(
    (intent: ImplementationStatusQueryIntent): PrototypeExecutionOperationalSendResult | null => {
      if (intent === "none" || !implementationBootstrapInput) return null;
      const prior = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson).messages ?? [];
      if (intent === "role_check_details" && hasImplementationRoleCheckDetailsShown(prior)) {
        showToast("역할별 점검 결과가 이미 표시되어 있습니다.");
        return "handled";
      }
      const roleCheckSummary = buildImplementationRoleCheckSummary(implementationBootstrapInput);
      const aiMessage = buildImplementationStatusQueryMessage({
        intent,
        summaryInput: implementationBootstrapInput,
        roleCheckSummary,
      });
      if (!aiMessage) return "handled";
      return {
        kind: "status_query",
        aiMessage,
        timelineEntries: [
          buildImplementationStatusQueryTimelineEntry({
            query: intent,
            summaryInput: implementationBootstrapInput,
            roleCheckSummary,
          }),
        ],
      };
    },
    [implementationBootstrapInput, requirementsStateJson, showToast],
  );

  const implementationOperationalHandlers = useMemo(
    () => ({
      appendNotice: (message: string) => appendExecutionNoticeRef.current(message),
      showToast,
      focusChatInput: () => {
        queueMicrotask(() => chatInputRef.current?.focus());
      },
      startWorkPlanGeneration: () => startWorkPlanGenerationFromChat(),
      openPlannerPrompt: () => setPlannerPromptModalOpen(true),
      openEnvSettings: () => setExecutionEnvironmentModalOpen(true),
      openArtifactHub: () => setArtifactHubOpen(true),
      buildStatusQueryResult: buildStatusQueryOperationalResult,
      persistRequirementPatch: (patch: import("@/lib/prototype/implementationUserFeedback").ImplementationUserFeedbackPatchV1) => {
        const resolved = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
        const orchPatch = buildImplementationUserFeedbackOrchestrationPatch({
          requirementsStateJson,
          patch,
          nowIso: patch.createdAt,
        });
        void persistChatToDb(
          {
            messages: resolved.messages ?? [],
            slots: resolved.slots ?? [],
            answers: resolved.answers ?? {},
            currentSlotKey: resolved.currentSlotKey ?? null,
          },
          orchPatch,
        );
      },
    }),
    [
      showToast,
      buildStatusQueryOperationalResult,
      requirementsStateJson,
      persistChatToDb,
      startWorkPlanGenerationFromChat,
    ],
  );

  const executionSingleChat = usePrototypeExecutionSingleChat({
    projectId,
    projectName: projectName || "프로젝트",
    projectDescription,
    requirementsStateJson,
    mergedBuiltMessages: mergedChatMessages,
    envOk: canRequestGeneration.envOk,
    templateName: effectiveTemplateDef?.nameKo ?? effectiveTemplate,
    ideationSummary: ideationSummaryForChat,
    actorFlowSummary: actorFlowSummaryForChat,
    protoBusy,
    inputBlocked: isMessageInputBlocked,
    implementationBootstrapInput,
    envLoading: executionEnvLoading,
    conversationResetNonce: implementationConversationResetNonce,
    onPersistStateJson: (patch) => {
      applyPendingFromOrchestrationPatch(patch.orchestration);
      const parsed = parseRequirementsStateJson(requirementsStateJson);
      const timeline = mergePromptTimelineWithBootstrapEntries({
        baseTimeline: parsed.promptTimeline,
        orchestrationTimeline: patch.orchestration?.promptTimeline,
        bootstrapTimeline: patch.bootstrapTimeline,
      });
      void persistChatToDb(
        {
          messages: patch.messages,
          slots: patch.slots,
          answers: patch.answers,
          currentSlotKey: patch.currentSlotKey,
        },
        {
          ...(patch.orchestration ?? {}),
          ...(timeline.length ? { promptTimeline: timeline } : {}),
        },
      );
    },
    onOperationalSend: async (text, userMsg) => {
      const run = latestRun;
      if (run?.id && run.status === "WORK_UNITS_READY" && run.workUnitsExecutionConfirmed !== true) {
        setProtoBusy(true);
        try {
          const r = await postPrototypeRegeneratePlan(run.id, {
            projectId,
            userFeedback: text,
            plannerContext: plannerContextPayload,
          });
          if (r.success && r.data?.run) setLatestRun(r.data.run);
          if (r.message) showToast(r.message);
        } finally {
          setProtoBusy(false);
          void refreshLatestRun();
        }
        return "handled";
      }

      const pid = projectId.trim();
      return resolveImplementationOperationalSend(
        {
          text,
          userMsg,
          isDraftGenerationComplete,
          isRunningState,
          envOk: canRequestGeneration.envOk,
          designOk: canRequestGeneration.designOk,
          requirementsStateJson,
          projectId: pid,
          projectArtifacts: executionArtifacts.projectArtifacts,
          orchestration: parsedRequirementsState.singleChatOrchestrationV1,
          slotDefinitions: planningSlotDefinitions,
          implementationSeedV1: parsedRequirementsState.implementationSeedV1,
          implementationWorkPlanDraftV1: effectiveImplementationState.implementationWorkPlanDraftV1,
          promptTimeline: parsedRequirementsState.promptTimeline,
          stageActionOrchestrator: pid
            ? {
                projectId: pid,
                effectiveState: effectiveImplementationState,
                execute: (actionId) => runImplementationStageActionRef.current(actionId),
              }
            : undefined,
          routeParams: {
            text,
            visibleActionLabels: implementationVisibleActionLabels,
            envOk: canRequestGeneration.envOk,
            templatePlanningReady,
            implementationSeedReady,
            hasWorkUnits: (latestRun?.workUnits?.length ?? 0) > 0,
            isPlannerRunning,
            plannerCreatePending,
            protoBusy,
            projectName: projectName || "프로젝트",
            projectDescription,
            latestRunStatus: latestRun?.status ?? null,
            enableLlmClassifier: true,
          },
        },
        implementationOperationalHandlers,
      );
    },
    onOperationalAfterPersist: (action) => {
      if (action === "start_prototype_work_plan") {
        startWorkPlanGenerationFromChat();
      }
    },
    onOperationalStageActionRun: (run) => {
      persistImplementationStageActionRun(run);
      if ((run.status === "failed" || run.status === "blocked" || run.status === "no_op") && run.message) {
        showToast(run.message);
      }
    },
  });

  appendExecutionNoticeRef.current = executionSingleChat.appendAiNotice;

  const prioritizedChatMessages = useMemo(
    () =>
      executionSingleChat.chatMessages.map((m) => {
        const suggestions = (m.meta as any)?.interviewSuggestions;
        if (!Array.isArray(suggestions) || suggestions.length < 2) return m;
        return {
          ...m,
          meta: {
            ...m.meta,
            interviewSuggestions: prioritizeImplementationChipsForState(
              suggestions as readonly string[],
              effectiveImplementationState,
            ),
          },
        };
      }),
    [executionSingleChat.chatMessages, effectiveImplementationState],
  );
  // CTA priority is display-only. Persisted order is used for export/summary/evidence.

  /** Shared persist path for implementation stage actions (expand to full applyImplementationStageActionResult later). */
  const applyImplementationOrchestrationResult = useCallback(
    (input: {
      readonly messages: readonly RequirementsMessage[];
      readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput;
    }) => {
      const resolved = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
      const chatPatch = {
        messages: input.messages,
        slots: resolved.slots ?? [],
        answers: resolved.answers ?? {},
        currentSlotKey: resolved.currentSlotKey ?? null,
      };
      const mergedRequirementsState = buildPrototypeExecutionOrchestrationPersistPatch(requirementsStateJson, {
        chat: chatPatch,
        ...input.orchestrationPatch,
      });
      applyPendingFromOrchestrationPatch(input.orchestrationPatch);
      onRequirementsStateJsonChange?.(mergedRequirementsState);
      executionSingleChat.applyPersistedMessages(input.messages);
      void persistChatToDb(chatPatch, input.orchestrationPatch);
    },
    [
      requirementsStateJson,
      executionSingleChat,
      persistChatToDb,
      applyPendingFromOrchestrationPatch,
      onRequirementsStateJsonChange,
    ],
  );

  const implementationCursorGate = useMemo(
    () =>
      buildImplementationCursorGateContext(
        {
          ...parsedRequirementsState,
          implementationTaskPlanV1: effectiveImplementationState.implementationTaskPlanV1,
        },
        {
          envOk: effectiveImplementationState.envOk,
          designOk: effectiveImplementationState.designOk,
        },
        { projectId: projectId.trim() || undefined },
      ),
    [parsedRequirementsState, effectiveImplementationState, projectId],
  );

  const confirmImplementationTaskPlan = useCallback((): ImplementationStageActionRunResult => {
    const pid = projectId.trim();
    if (!pid) return { outcome: "blocked", message: "프로젝트를 선택해 주세요." };
    const result = buildConfirmImplementationTaskPlanResult({
      projectId: pid,
      requirementsStateJson,
      projectArtifacts: executionArtifacts.projectArtifacts,
      artifactOrchestrationV1: executionArtifacts.artifactOrchestrationV1,
      featureDraftTitles: featureDraftTitles ?? [],
      implementationWorkPlanDraftV1: effectiveImplementationState.implementationWorkPlanDraftV1,
      envOk: effectiveImplementationState.envOk,
      designOk: effectiveImplementationState.designOk,
      promptTimeline: parsedRequirementsState.promptTimeline,
    });
    if (result.kind === "blocked") {
      showToast(result.message);
      return { outcome: "blocked", message: result.message };
    }
    if (result.kind === "already_confirmed") {
      const message = "이미 구현 작업안이 확정되었습니다.";
      showToast(message);
      return { outcome: "no_op", message };
    }
    applyImplementationOrchestrationResult({
      messages: result.chatPatch.messages,
      orchestrationPatch: result.orchestrationPatch,
    });
    return { outcome: "executed" };
  }, [
    projectId,
    requirementsStateJson,
    executionArtifacts,
    featureDraftTitles,
    effectiveImplementationState,
    parsedRequirementsState.promptTimeline,
    applyImplementationOrchestrationResult,
    showToast,
  ]);

  const generateImplementationWorkPlanDraft = useCallback((): ImplementationStageActionRunResult => {
    const pid = projectId.trim();
    if (!pid) return { outcome: "blocked", message: "프로젝트를 선택해 주세요." };
    const result = buildGenerateImplementationWorkPlanDraftResult({
      requirementsStateJson,
      projectId: pid,
      projectArtifacts: executionArtifacts.projectArtifacts,
      orchestration: parsedRequirementsState.singleChatOrchestrationV1,
      slotDefinitions: planningSlotDefinitions,
      implementationSeedV1: parsedRequirementsState.implementationSeedV1,
      envOk: canRequestGeneration.envOk,
      designOk: canRequestGeneration.designOk,
      promptTimeline: parsedRequirementsState.promptTimeline,
    });
    if (result.kind === "blocked") {
      showToast(result.message);
      return { outcome: "blocked", message: result.message };
    }
    if (result.kind === "already_exists") {
      const message = "이미 구현 작업안 초안이 생성되었습니다.";
      showToast(message);
      return { outcome: "no_op", message };
    }
    const orchestrationPatch = {
      ...result.orchestrationPatch,
      promptTimeline: appendCreateWorkPlanBootstrapCtaRouteTimeline({
        promptTimeline: result.orchestrationPatch.promptTimeline ?? parsedRequirementsState.promptTimeline,
      }),
    };
    applyImplementationOrchestrationResult({
      messages: result.messages,
      orchestrationPatch,
    });
    return { outcome: "executed" };
  }, [
    projectId,
    requirementsStateJson,
    executionArtifacts.projectArtifacts,
    canRequestGeneration.envOk,
    canRequestGeneration.designOk,
    parsedRequirementsState.promptTimeline,
    parsedRequirementsState.singleChatOrchestrationV1,
    parsedRequirementsState.implementationSeedV1,
    planningSlotDefinitions,
    applyImplementationOrchestrationResult,
    showToast,
  ]);

  const appendStatusQueryFromChip = useCallback(
    (intent: ImplementationStatusQueryIntent) => {
      const result = buildStatusQueryOperationalResult(intent);
      if (!result) {
        showToast("환경 정보를 불러오는 중입니다.");
        return;
      }
      if (result === "handled" || result === "continue") return;
      if (result.kind !== "status_query") return;
      const resolved = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
      const nextMessages = [...(resolved.messages ?? []), result.aiMessage];
      executionSingleChat.applyPersistedMessages(nextMessages);
      let timeline = parsedRequirementsState.promptTimeline;
      for (const entry of result.timelineEntries ?? []) {
        timeline = appendPromptTimeline(timeline, entry);
      }
      void persistChatToDb(
        {
          messages: nextMessages,
          slots: resolved.slots ?? [],
          answers: resolved.answers ?? {},
          currentSlotKey: resolved.currentSlotKey ?? null,
        },
        { promptTimeline: timeline },
      );
    },
    [
      buildStatusQueryOperationalResult,
      executionSingleChat,
      requirementsStateJson,
      parsedRequirementsState.promptTimeline,
      persistChatToDb,
      showToast,
    ],
  );

  const showRoleCheckDetails = useCallback(() => {
    appendStatusQueryFromChip("role_check_details");
  }, [appendStatusQueryFromChip]);

  const appendImplementationTaskListAiMessage = useCallback(
    (message: RequirementsMessage) => {
      const resolved = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
      const nextMessages = [...(resolved.messages ?? []), message];
      executionSingleChat.applyPersistedMessages(nextMessages);
      void persistChatToDb({
        messages: nextMessages,
        slots: resolved.slots ?? [],
        answers: resolved.answers ?? {},
        currentSlotKey: resolved.currentSlotKey ?? null,
      });
    },
    [requirementsStateJson, executionSingleChat, persistChatToDb],
  );

  const refreshImplementationBoardWithExecutionSetup = useCallback(
    (setup: ExecutionSetupSourceGenerationRow | null, source = "board_refresh") => {
      const pid = projectId.trim();
      const taskList = orchestrationAwareRequirementsState.implementationTaskListV1;
      if (!pid || !taskList || !setup) return;
      const board = buildImplementationExecutionBoardFromRequirementsState({
        projectId: pid,
        orchestration: orchestrationAwareRequirementsState,
      });
      if (!board) return;
      const resolved = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
      const nowIso = new Date().toISOString();
      const nextMessages = replaceLatestImplementationBoardMessageWithSetup({
        messages: resolved.messages ?? [],
        board,
        nowIso,
        previewReady: prototypeRunSyncSnapshot.previewReady,
        hasExecutionState: true,
        boardState: orchestrationAwareRequirementsState.implementationExecutionBoardStateV1,
        taskList,
        envOk: canRequestGeneration.envOk,
        codeAgentWipExecutionV1: orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
        executionSetup: setup,
      });
      executionSingleChat.applyPersistedMessages(nextMessages);
      void persistChatToDb(
        {
          messages: nextMessages,
          slots: resolved.slots ?? [],
          answers: resolved.answers ?? {},
          currentSlotKey: resolved.currentSlotKey ?? null,
        },
        {
          promptTimeline: [
            ...(orchestrationAwareRequirementsState.promptTimeline ?? []),
            buildExecutionSetupAvailabilityTimelineEntry({
              action:
                source === "execution_setup_saved"
                  ? "execution_setup_saved_and_board_refreshed"
                  : "execution_setup_availability_computed",
              projectId: pid,
              setup,
              source,
            }),
          ],
        },
      );
    },
    [
      projectId,
      orchestrationAwareRequirementsState,
      requirementsStateJson,
      executionSingleChat,
      persistChatToDb,
      prototypeRunSyncSnapshot.previewReady,
      canRequestGeneration.envOk,
    ],
  );

  useEffect(() => {
    if (!executionSetupRow) return;
    refreshImplementationBoardWithExecutionSetup(executionSetupRow, "execution_setup_loaded");
  }, [executionSetupRow, refreshImplementationBoardWithExecutionSetup]);

  const handleExecutionSetupChanged = useCallback(async () => {
    await loadEnv();
    const row = await reloadExecutionSetupRow();
    if (row) {
      refreshImplementationBoardWithExecutionSetup(row, "execution_setup_saved");
    }
  }, [loadEnv, reloadExecutionSetupRow, refreshImplementationBoardWithExecutionSetup]);

  const applyDbStrategyResult = useCallback(
    (
      result:
        | ReturnType<typeof buildDbIntegrationReviewResult>
        | ReturnType<typeof buildDataModelDraftResult>
        | ReturnType<typeof buildMockImplementationModeResult>,
    ): ImplementationStageActionRunResult => {
      if (result.kind === "blocked") {
        showToast(result.message);
        return { outcome: "blocked", message: result.message };
      }
      applyImplementationOrchestrationResult({
        messages: result.messages,
        orchestrationPatch: result.orchestrationPatch,
      });
      return { outcome: "executed" };
    },
    [applyImplementationOrchestrationResult, showToast],
  );

  const reviewDbIntegrationNeed = useCallback((): ImplementationStageActionRunResult => {
    let slots = parsedRequirementsState.implementationSlotsV1;
    if (!slots) {
      const ensured = ensureImplementationTaskPlan({
        requirementsStateJson,
        effectiveState: effectiveImplementationState,
        ensureDraftInput: {
          requirementsStateJson,
          projectId: projectId.trim(),
          projectArtifacts: executionArtifacts.projectArtifacts,
          orchestration: parsedRequirementsState.singleChatOrchestrationV1,
          slotDefinitions: planningSlotDefinitions,
          envOk: canRequestGeneration.envOk,
          promptTimeline: parsedRequirementsState.promptTimeline,
        },
        confirmTaskPlanInput: {
          projectId: projectId.trim(),
          requirementsStateJson,
          projectArtifacts: executionArtifacts.projectArtifacts,
          artifactOrchestrationV1: parsedRequirementsState.artifactOrchestrationV1,
          featureDraftTitles: parsedRequirementsState.featureDraftTitles,
          envOk: canRequestGeneration.envOk,
          designOk: true,
          promptTimeline: parsedRequirementsState.promptTimeline,
        },
      });

      if (!ensured.ok || !ensured.patch) {
        const message = ensured.message ?? "구현 작업안을 자동으로 준비할 수 없습니다.";
        showToast(message);
        return { outcome: "blocked", message };
      }

      const current = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
      applyImplementationOrchestrationResult({
        messages: ensured.messages ?? (current.messages ?? []),
        orchestrationPatch: ensured.patch,
      });
      slots = ensured.patch.implementationSlotsV1 as typeof slots;
    }

    return applyDbStrategyResult(
      buildDbIntegrationReviewResult({
        requirementsStateJson,
        implementationSlotsV1: slots,
        implementationDbStrategyV1: parsedRequirementsState.implementationDbStrategyV1,
        implementationTaskPlanV1: effectiveImplementationState.implementationTaskPlanV1,
        projectArtifacts: executionArtifacts.projectArtifacts,
        promptTimeline: parsedRequirementsState.promptTimeline,
      }),
    );
  }, [
    applyDbStrategyResult,
    requirementsStateJson,
    projectId,
    parsedRequirementsState.implementationSlotsV1,
    parsedRequirementsState.implementationDbStrategyV1,
    effectiveImplementationState.implementationTaskPlanV1,
    effectiveImplementationState,
    parsedRequirementsState.promptTimeline,
    executionArtifacts.projectArtifacts,
    parsedRequirementsState.singleChatOrchestrationV1,
    parsedRequirementsState.artifactOrchestrationV1,
    parsedRequirementsState.featureDraftTitles,
    planningSlotDefinitions,
    canRequestGeneration.envOk,
    applyImplementationOrchestrationResult,
    showToast,
  ]);

  const generateDataModelDraft = useCallback((): ImplementationStageActionRunResult => {
    return applyDbStrategyResult(
      buildDataModelDraftResult({
        requirementsStateJson,
        implementationSlotsV1: parsedRequirementsState.implementationSlotsV1,
        implementationDbStrategyV1: parsedRequirementsState.implementationDbStrategyV1,
        promptTimeline: parsedRequirementsState.promptTimeline,
      }),
    );
  }, [
    applyDbStrategyResult,
    requirementsStateJson,
    parsedRequirementsState.implementationSlotsV1,
    parsedRequirementsState.implementationDbStrategyV1,
    parsedRequirementsState.promptTimeline,
  ]);

  const confirmMockImplementationMode = useCallback((): ImplementationStageActionRunResult => {
    let slots = parsedRequirementsState.implementationSlotsV1;
    if (!slots) {
      const taskListEnsured = ensureImplementationArtifactsFromTaskList({
        requirementsStateJson,
        effectiveState: effectiveImplementationState,
        projectId: projectId.trim(),
        projectArtifacts: executionArtifacts.projectArtifacts,
        artifactOrchestrationV1: parsedRequirementsState.artifactOrchestrationV1,
        envOk: canRequestGeneration.envOk,
        designOk: true,
        envCursorBadge: canRequestGeneration.envOk ? "ok" : "needs",
        promptTimeline: parsedRequirementsState.promptTimeline,
      });
      if (taskListEnsured.ok && taskListEnsured.patch) {
        const current = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
        applyImplementationOrchestrationResult({
          messages: taskListEnsured.messages ?? (current.messages ?? []),
          orchestrationPatch: taskListEnsured.patch,
        });
        slots = taskListEnsured.patch.implementationSlotsV1 as typeof slots;
      }
    }
    if (!slots) {
      const ensured = ensureMockImplementationReady({
        requirementsStateJson,
        effectiveState: effectiveImplementationState,
        ensureTaskPlanInput: {
          requirementsStateJson,
          effectiveState: effectiveImplementationState,
          ensureDraftInput: {
            requirementsStateJson,
            projectId: projectId.trim(),
            projectArtifacts: executionArtifacts.projectArtifacts,
            orchestration: parsedRequirementsState.singleChatOrchestrationV1,
            slotDefinitions: planningSlotDefinitions,
            envOk: canRequestGeneration.envOk,
            promptTimeline: parsedRequirementsState.promptTimeline,
          },
          confirmTaskPlanInput: {
            projectId: projectId.trim(),
            requirementsStateJson,
            projectArtifacts: executionArtifacts.projectArtifacts,
            artifactOrchestrationV1: parsedRequirementsState.artifactOrchestrationV1,
            featureDraftTitles: parsedRequirementsState.featureDraftTitles,
            envOk: canRequestGeneration.envOk,
            designOk: true,
            promptTimeline: parsedRequirementsState.promptTimeline,
          },
        },
        promptTimeline: parsedRequirementsState.promptTimeline,
      });

      if (!ensured.ok || !ensured.patch) {
        const message = ensured.message ?? "구현 작업안을 자동으로 준비할 수 없습니다.";
        showToast(message);
        return { outcome: "blocked", message };
      }

      const current = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
      applyImplementationOrchestrationResult({
        messages: ensured.messages ?? (current.messages ?? []),
        orchestrationPatch: ensured.patch,
      });
      slots = ensured.patch.implementationSlotsV1 as typeof slots;
    }

    return applyDbStrategyResult(
      buildMockImplementationModeResult({
        requirementsStateJson,
        implementationSlotsV1: slots,
        implementationDbStrategyV1: parsedRequirementsState.implementationDbStrategyV1,
        promptTimeline: parsedRequirementsState.promptTimeline,
      }),
    );
  }, [
    applyDbStrategyResult,
    requirementsStateJson,
    projectId,
    parsedRequirementsState.implementationSlotsV1,
    parsedRequirementsState.implementationDbStrategyV1,
    parsedRequirementsState.promptTimeline,
    effectiveImplementationState,
    executionArtifacts.projectArtifacts,
    parsedRequirementsState.singleChatOrchestrationV1,
    parsedRequirementsState.artifactOrchestrationV1,
    parsedRequirementsState.featureDraftTitles,
    planningSlotDefinitions,
    canRequestGeneration.envOk,
    applyImplementationOrchestrationResult,
    showToast,
  ]);

  const wipChipHandlers = useMemo(
    () =>
      buildWipChipHandlerSlice({
        projectId,
        requirementsStateJson,
        baseRequirementsState: parsedRequirementsState,
        pendingPatch: pendingImplementationPatch,
        parsedState: orchestrationAwareRequirementsState,
        envOk: effectiveImplementationState.envOk,
        designOk: effectiveImplementationState.designOk,
        cursorApiConfigured: evaluateCursorExecutionAvailability({ setup: executionSetupRow }).ready,
        applyMessages: executionSingleChat.applyPersistedMessages,
        appendNotice: (text) => executionSingleChat.appendAiNotice(text),
        persistOrchestration: (chat, orch) => {
          if (chat && orch) {
            applyImplementationOrchestrationResult({
              messages: chat.messages,
              orchestrationPatch: orch,
            });
            return;
          }
          applyPendingFromOrchestrationPatch(orch);
          void persistChatToDb(chat, orch);
        },
        focusComposer: () => queueMicrotask(() => chatInputRef.current?.focus()),
        showToast,
      }),
    [
      projectId,
      requirementsStateJson,
      parsedRequirementsState,
      pendingImplementationPatch,
      orchestrationAwareRequirementsState,
      effectiveImplementationState.envOk,
      effectiveImplementationState.designOk,
      executionSetupRow,
      executionSingleChat,
      persistChatToDb,
      applyPendingFromOrchestrationPatch,
      applyImplementationOrchestrationResult,
      showToast,
    ],
  );

  const persistStageActionTimelineEntries = useCallback(
    (
      entries: readonly RequirementsPromptTimelineEntry[],
      runLogPatch?: { readonly implementationStageActionRunLogV1: unknown },
    ) => {
      if (!entries.length && !runLogPatch) return;
      let timeline = parsedRequirementsState.promptTimeline;
      for (const entry of entries) {
        timeline = appendPromptTimeline(timeline, entry);
      }
      const resolved = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
      void persistChatToDb(
        {
          messages: resolved.messages ?? [],
          slots: resolved.slots ?? [],
          answers: resolved.answers ?? {},
          currentSlotKey: resolved.currentSlotKey ?? null,
        },
        { promptTimeline: timeline, ...(runLogPatch ?? {}) },
      );
    },
    [parsedRequirementsState.promptTimeline, requirementsStateJson, persistChatToDb],
  );

  const persistImplementationStageActionRun = useCallback(
    (run: ImplementationStageActionRun) => {
      const runLogPatch = buildImplementationStageActionRunLogPatch({
        currentLog: parsedRequirementsState.implementationStageActionRunLogV1,
        run,
      });
      persistStageActionTimelineEntries(run.timelineEntries, runLogPatch);
    },
    [
      parsedRequirementsState.implementationStageActionRunLogV1,
      persistStageActionTimelineEntries,
    ],
  );

  const applyImplementationStageActionExecutionResult = useCallback(
    (result: ImplementationStageActionExecutionResult) => {
      if (result.timelineEntries?.length) {
        persistStageActionTimelineEntries(result.timelineEntries);
      }
      switch (result.kind) {
        case "blocked":
          showToast(result.message);
          break;
        case "focus_composer":
          showToast(result.message);
          queueMicrotask(() => chatInputRef.current?.focus());
          break;
        case "open_env_settings":
          setExecutionEnvironmentModalOpen(true);
          break;
        case "open_artifacts":
          setArtifactHubOpen(true);
          break;
        case "show_status":
          if (result.intent === "role") showRoleCheckDetails();
          else if (result.intent === "scm") appendStatusQueryFromChip("scm_check_details");
          else appendStatusQueryFromChip("environment_check_details");
          break;
        case "handled":
          break;
      }
    },
    [showToast, showRoleCheckDetails, appendStatusQueryFromChip, persistStageActionTimelineEntries],
  );

  const showImplementationSeedReadinessCheck = useCallback(() => {
    const pid = projectId.trim();
    if (!pid) return;
    const result = buildPlanningImplementationSeedCheckResult({
      projectId: pid,
      orchestration: parsedRequirementsState.singleChatOrchestrationV1,
      definitions: planningSlotDefinitions,
      promptTimeline: parsedRequirementsState.promptTimeline,
    });
    const resolved = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
    const nextMessages = [...(resolved.messages ?? []), result.message];
    applyImplementationOrchestrationResult({
      messages: nextMessages,
      orchestrationPatch: result.orchestrationPatch,
    });
  }, [
    projectId,
    parsedRequirementsState.singleChatOrchestrationV1,
    parsedRequirementsState.promptTimeline,
    planningSlotDefinitions,
    requirementsStateJson,
    applyImplementationOrchestrationResult,
  ]);

  const runImplementationQualityGate = useCallback(
    (role: "reviewer" | "security"): ImplementationStageActionRunResult => {
      const taskList = parsedRequirementsState.implementationTaskListV1;
      const pid = projectId.trim();
      if (!taskList || !pid) {
        const message = "구현 작업목록이 없어 점검을 실행할 수 없습니다.";
        showToast(message);
        return { outcome: "blocked", message };
      }
      const board = buildImplementationExecutionBoardFromRequirementsState({
        projectId: pid,
        orchestration: parsedRequirementsState,
      });
      if (!board) {
        const message = "구현 작업 보드를 만들 수 없어 점검을 실행할 수 없습니다.";
        showToast(message);
        return { outcome: "blocked", message };
      }
      const targetTaskIds = pickQualityGateTargetTaskIds({ role, board });
      const outcome = executeImplementationQualityGateCheck({
        role,
        taskList,
        executionState: parsedRequirementsState.implementationTaskExecutionStateV1,
        qualityGateResults: parsedRequirementsState.implementationQualityGateResultsV1,
        projectId: pid,
        targetTaskIds,
        bridgeTarget: buildQualityGateBridgeTargetFromWip(
          parsedRequirementsState.codeAgentWipExecutionV1,
        ),
      });
      if ("blocked" in outcome) {
        showToast(outcome.blocked);
        return { outcome: "blocked", message: outcome.blocked };
      }
      const bridgeTarget = buildQualityGateBridgeTargetFromWip(
        parsedRequirementsState.codeAgentWipExecutionV1,
      );
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
      void persistChatToDb(undefined, {
        implementationTaskExecutionStateV1: outcome.executionState,
        implementationQualityGateResultsV1: outcome.qualityGateResults,
        ...(qgTimeline
          ? {
              promptTimeline: [
                ...(parsedRequirementsState.promptTimeline ?? []),
                qgTimeline,
              ],
            }
          : {}),
      });
      executionSingleChat.appendAiNotice(outcome.aiMessageContent);
      return { outcome: "executed" };
    },
    [parsedRequirementsState, projectId, persistChatToDb, executionSingleChat, showToast],
  );

  const runIntegratedStageStep = useCallback(
    (step: ImplementationIntegratedStep): ImplementationStageActionRunResult => {
      const pid = projectId.trim();
      if (!pid) {
        const message = "프로젝트를 선택해 주세요.";
        showToast(message);
        return { outcome: "blocked", message };
      }
      const taskList = parsedRequirementsState.implementationTaskListV1;
      if (!taskList) {
        const message = "구현 작업목록이 없어 통합 단계를 실행할 수 없습니다.";
        showToast(message);
        return { outcome: "blocked", message };
      }

      const boardBefore = buildImplementationExecutionBoardFromRequirementsState({
        projectId: pid,
        orchestration: parsedRequirementsState,
      })!;
      const allTasksComplete = boardBefore.taskRows.every((row) => row.currentRole === "completed");

      const prior = parsedRequirementsState.implementationIntegratedExecutionStateV1;
      const done = finalizeIntegratedStageStep({
        state: prior,
        projectId: pid,
        step,
        taskRowsCompleted: allTasksComplete,
      });
      void persistChatToDb(undefined, {
        implementationIntegratedExecutionStateV1: done,
      });

      const actionNotice = buildIntegratedStageStepActionNotice({ step, integratedState: done });
      executionSingleChat.appendAiNotice(actionNotice);

      const nowIso = new Date().toISOString();
      const nextBoard = buildImplementationExecutionBoardFromRequirementsState({
        projectId: pid,
        orchestration: parsedRequirementsState,
        integratedExecutionState: done,
      })!;
      appendImplementationTaskListAiMessage(
        buildImplementationExecutionBoardMessage({
          board: nextBoard,
          nowIso,
          previewReady: prototypeRunSyncSnapshot.previewReady,
          codeAgentWipExecutionV1: orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
          executionSetup: executionSetupRow,
        }),
      );

      return { outcome: "executed" };
    },
    [
      parsedRequirementsState,
      projectId,
      persistChatToDb,
      executionSingleChat,
      showToast,
      appendImplementationTaskListAiMessage,
      prototypeRunSyncSnapshot.previewReady,
      orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
      executionSetupRow,
    ],
  );

  const createImplementationSeedFromQuickDesignDraft = useCallback((): ImplementationStageActionRunResult => {
    const pid = projectId.trim();
    if (!pid) return { outcome: "blocked", message: "프로젝트를 선택해 주세요." };
    const result = buildCreateImplementationSeedFromQuickDesignDraftResult({
      projectId: pid,
      projectName: projectName || "프로젝트",
      fastPlanDraftV1: parsedRequirementsState.fastPlanDraftV1,
      orchestration: parsedRequirementsState.singleChatOrchestrationV1,
      slotDefinitions: planningSlotDefinitions,
      promptTimeline: parsedRequirementsState.promptTimeline,
    });
    if (result.kind === "blocked") {
      showToast(result.message);
      return { outcome: "blocked", message: result.message };
    }
    const resolved = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
    applyImplementationOrchestrationResult({
      messages: [...(resolved.messages ?? []), ...result.messages],
      orchestrationPatch: result.orchestrationPatch,
    });
    showToast("Quick Design 초안을 기준으로 구현 Seed를 생성했습니다.");
    return { outcome: "executed" };
  }, [
    projectId,
    projectName,
    parsedRequirementsState.fastPlanDraftV1,
    parsedRequirementsState.singleChatOrchestrationV1,
    parsedRequirementsState.promptTimeline,
    planningSlotDefinitions,
    requirementsStateJson,
    applyImplementationOrchestrationResult,
    showToast,
  ]);

  const confirmQuickDesignForImplementation = useCallback((): ImplementationStageActionRunResult => {
    const pid = projectId.trim();
    if (!pid) return { outcome: "blocked", message: "프로젝트를 선택해 주세요." };
    void (async () => {
      setProtoBusy(true);
      try {
        const resolved = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
        const result = await runConfirmQuickDesignForImplementationFromState({
          projectId: pid,
          projectName: projectName || "프로젝트",
          projectDescription: projectDescription ?? "",
          requirementsStateJson,
          conversationMessages: resolved.messages ?? [],
          slotDefinitions: planningSlotDefinitions,
          envOkOverride: canRequestGeneration.envOk,
        });
        if (result.kind === "blocked") {
          showToast(result.message);
          return;
        }
        applyImplementationOrchestrationResult({
          messages: result.messages,
          orchestrationPatch: result.orchestrationPatch as PrototypeExecutionOrchestrationPersistInput,
        });
        showToast(result.flow.userFacingSummary);
      } finally {
        setProtoBusy(false);
      }
    })();
    return { outcome: "executed" };
  }, [
    projectId,
    projectName,
    projectDescription,
    requirementsStateJson,
    planningSlotDefinitions,
    canRequestGeneration.envOk,
    applyImplementationOrchestrationResult,
    showToast,
  ]);

  const generateImplementationTaskList = useCallback((): ImplementationStageActionRunResult => {
    const pid = projectId.trim();
    const seed = parsedRequirementsState.implementationSeedV1;
    const result = buildGenerateImplementationTaskListFromSeedResult({
      projectId: pid,
      seed,
      existingTaskList: parsedRequirementsState.implementationTaskListV1,
      existingExecutionState: parsedRequirementsState.implementationTaskExecutionStateV1,
      existingCursorWorkItems: parsedRequirementsState.cursorWorkItemsV1,
      priorTimeline: parsedRequirementsState.promptTimeline,
      projectArtifacts: executionArtifacts.projectArtifacts,
      artifactOrchestrationV1: parsedRequirementsState.artifactOrchestrationV1,
      envOk: canRequestGeneration.envOk,
      designOk: effectiveImplementationState.designOk,
      envCursorBadge: canRequestGeneration.envOk ? "ok" : "needs",
      previewReady: prototypeRunSyncSnapshot.previewReady,
    });
    if (!result.ok) {
      showToast(result.message);
      return { outcome: "blocked", message: result.message };
    }
    void persistChatToDb(
      resolvePrototypeExecutionSingleChatFromState(requirementsStateJson),
      result.patch,
    );
    for (const message of result.messages) {
      appendImplementationTaskListAiMessage(message);
    }
    showToast(
      result.alreadyExisted
        ? "구현 작업목록이 이미 있습니다. 작업 보드를 표시합니다."
        : "구현 작업목록을 생성했습니다.",
    );
    return { outcome: "executed" };
  }, [
    projectId,
    parsedRequirementsState,
    executionArtifacts,
    canRequestGeneration,
    effectiveImplementationState.designOk,
    prototypeRunSyncSnapshot.previewReady,
    persistChatToDb,
    requirementsStateJson,
    appendImplementationTaskListAiMessage,
    showToast,
  ]);

  const runImplementationStageAction = useCallback(
    (actionId: ImplementationStageActionId): ImplementationStageActionRunResult => {
      switch (actionId) {
        case "GENERATE_IMPLEMENTATION_TASK_LIST":
          return generateImplementationTaskList();
        case "CONFIRM_QUICK_DESIGN_FOR_IMPLEMENTATION":
          return confirmQuickDesignForImplementation();
        case "CREATE_IMPLEMENTATION_SEED_FROM_QUICK_DESIGN_DRAFT":
          return createImplementationSeedFromQuickDesignDraft();
        case "RETURN_TO_PLANNING_STAGE":
        case "START_QUICK_DESIGN_FROM_IMPLEMENTATION": {
          const pid = projectId.trim();
          if (pid) {
            window.location.assign(`/requirements?projectId=${encodeURIComponent(pid)}`);
          }
          return { outcome: "executed" };
        }
        case "GENERATE_IMPLEMENTATION_WORK_PLAN":
          return generateImplementationWorkPlanDraft();
        case "CONFIRM_IMPLEMENTATION_WORK_PLAN":
          return confirmImplementationTaskPlan();
        case "EDIT_IMPLEMENTATION_SCOPE":
          applyImplementationStageActionExecutionResult(
            buildImplementationStageActionFocusComposerResult(
              "아래 입력란에 수정·범위 조정 요청을 적고 전송해 주세요.",
            ),
          );
          return { outcome: "executed" };
        case "REVIEW_DB_INTEGRATION":
          return reviewDbIntegrationNeed();
        case "GENERATE_DATA_MODEL_DRAFT":
          return generateDataModelDraft();
        case "CONFIRM_MOCK_IMPLEMENTATION":
          return confirmMockImplementationMode();
        case "SHOW_ARTIFACTS":
          applyImplementationStageActionExecutionResult(buildImplementationStageActionOpenArtifactsResult());
          return { outcome: "executed" };
        case "OPEN_ENV_SETTINGS":
          applyImplementationStageActionExecutionResult(buildImplementationStageActionOpenEnvSettingsResult());
          return { outcome: "executed" };
        case "SHOW_ROLE_CHECK":
          applyImplementationStageActionExecutionResult(
            buildImplementationStageActionShowStatusResult("role"),
          );
          return { outcome: "executed" };
        case "SHOW_SCM_CHECK":
          applyImplementationStageActionExecutionResult(
            buildImplementationStageActionShowStatusResult("scm"),
          );
          return { outcome: "executed" };
        case "SHOW_ENV_CHECK":
          applyImplementationStageActionExecutionResult(
            buildImplementationStageActionShowStatusResult("env"),
          );
          return { outcome: "executed" };
        case "RUN_REVIEWER_CHECK":
          return runImplementationQualityGate("reviewer");
        case "RUN_SECURITY_CHECK":
          return runImplementationQualityGate("security");
        case "REQUEST_CODE_AGENT_WIP": {
          const pid = projectId.trim();
          const cursorApiReady = evaluateCursorExecutionAvailability({ setup: executionSetupRow }).ready;

          const prepared = prepareWipRequestRuntime({
            projectId: pid,
            baseState: parsedRequirementsState,
            pendingPatch: pendingImplementationPatch,
            envOk: effectiveImplementationState.envOk,
            designOk: effectiveImplementationState.designOk,
            cursorApiConfigured: cursorApiReady,
          });

          let runtimeState = prepared.state;
          let runtimeTaskPlan = prepared.taskPlan;
          let runtimeWorkItems = prepared.workItems;
          let runtimeSlots = runtimeState.implementationSlotsV1 ?? null;
          let runtimeDbStrategy = runtimeState.implementationDbStrategyV1 ?? null;
          let runtimeExecutionState = prepared.executionState;
          let runtimeTimeline = appendPromptTimelineEntries(
            runtimeState.promptTimeline,
            prepared.timelineEntries,
          );
          runtimeState = { ...runtimeState, promptTimeline: runtimeTimeline };

          const taskList = runtimeState.implementationTaskListV1;
          const seed = runtimeState.implementationSeedV1;
          const canUseTaskList = canUseTaskListForWipOrchestration({ taskList, seed });

          if (prepared.unconfirmedSlotsNote) {
            executionSingleChat.appendAiNotice(prepared.unconfirmedSlotsNote);
          }

          if (!runtimeWorkItems.length) {
            const message = "Code Agent WIP 작업 요청을 위해 구현 작업목록 또는 작업 계획이 필요합니다.";
            executionSingleChat.appendAiNotice(message);
            return { outcome: "blocked", message };
          }

          if (
            !shouldUseTaskListBoardWipGate({ taskList, executionState: runtimeExecutionState }) &&
            pid &&
            canUseTaskList &&
            hasTaskListForWipOrchestration(taskList)
          ) {
            const derived = buildTaskListDerivedWipOrchestration({
              projectId: pid,
              taskList: taskList!,
              projectArtifacts: executionArtifacts.projectArtifacts,
              artifactOrchestrationV1: executionArtifacts.artifactOrchestrationV1,
              envOk: effectiveImplementationState.envOk,
              designOk: effectiveImplementationState.designOk,
              envCursorBadge: effectiveImplementationState.envOk ? "ok" : "needs",
              priorTimeline: runtimeTimeline,
              priorExecutionState: runtimeExecutionState,
            });
            runtimeTaskPlan = derived.plan;
            runtimeWorkItems = [...derived.workItems];
            runtimeSlots = derived.slots;
            runtimeDbStrategy = derived.dbStrategy;
            runtimeExecutionState = derived.executionState;
            runtimeState = mergeTaskListWipRuntimeState(runtimeState, derived);
            runtimeTimeline = runtimeState.promptTimeline ?? runtimeTimeline;
          }

          const reGate = evaluateImplementationCursorGate(
            buildImplementationCursorGateContext(
              {
                ...runtimeState,
                cursorWorkItemsV1: runtimeWorkItems,
                implementationTaskPlanV1: runtimeTaskPlan,
                implementationTaskExecutionStateV1: runtimeExecutionState,
              },
              {
                envOk: effectiveImplementationState.envOk,
                designOk: effectiveImplementationState.designOk,
              },
              { projectId: pid },
            ),
          );
          if (!reGate.allowed) {
            const message = formatImplementationCursorBlockedNotice(
              buildImplementationCursorGateContext(
                {
                  ...runtimeState,
                  cursorWorkItemsV1: runtimeWorkItems,
                  implementationTaskPlanV1: runtimeTaskPlan,
                  implementationTaskExecutionStateV1: runtimeExecutionState,
                },
                {
                  envOk: effectiveImplementationState.envOk,
                  designOk: effectiveImplementationState.designOk,
                },
                { projectId: pid },
              ),
            );
            if (runtimeWorkItems.length && runtimeExecutionState && taskList) {
              const failedState = markDeveloperTasksFailedForWip({
                state: runtimeExecutionState,
                cursorWorkItems: runtimeWorkItems,
                errorMessage: message,
              });
              void persistChatToDb(resolvePrototypeExecutionSingleChatFromState(requirementsStateJson), {
                implementationTaskExecutionStateV1: failedState,
              });
            }
            executionSingleChat.appendAiNotice(message);
            showToast("Code Agent WIP 요청을 시작하지 못했습니다. 개발자 작업 상태를 실패로 기록했습니다.");
            return { outcome: "blocked", message };
          }

          let workItemsForWip = runtimeWorkItems;
          let scopedTaskId: string | null = null;
          let wipCandidateCount: number | undefined;
          if (taskList && runtimeExecutionState) {
            const board = buildImplementationExecutionBoardFromRequirementsState({
              projectId: pid,
              orchestration: runtimeState,
            })!;
            wipCandidateCount = countTaskListWipCandidateTasks(board);
            const scoped = selectCursorWorkItemsForWipExecution({
              board,
              workItems: runtimeWorkItems,
              boardState: runtimeState.implementationExecutionBoardStateV1,
              qualityGateResults: runtimeState.implementationQualityGateResultsV1,
            });
            scopedTaskId = scoped.selectedTaskId;
            if (scopedTaskId) {
              runtimeTimeline = appendPromptTimelineEntries(runtimeTimeline, [
                buildImplementationWipGenerationTimelineEntry({
                  action: "implementation_wip_selected_task_resolved",
                  projectId: pid,
                  hasImplementationTaskList: true,
                  hasCursorWorkItems: true,
                  selectedTaskId: scopedTaskId,
                  selectedWorkItemCount: scoped.selectedWorkItems.length,
                  cursorApiConfigured: cursorApiReady,
                  nowIso: new Date().toISOString(),
                }),
              ]);
              runtimeState = { ...runtimeState, promptTimeline: runtimeTimeline };
            }
            if (!scoped.selectedWorkItems.length) {
              const message = formatTaskScopedWipExecutionBlockedNotice({
                selectedTaskId: scoped.selectedTaskId,
                blockedReason:
                  scoped.blockedReason ??
                  "실행 가능한 개발자 작업이 없어 Code Agent WIP 요청을 시작하지 못했습니다.",
              });
              executionSingleChat.appendAiNotice(message);
              return { outcome: "blocked", message };
            }
            if (scopedTaskId) {
              const scopeValidation = validateTaskScopedWorkItems({
                selectedTaskId: scopedTaskId,
                selectedWorkItems: scoped.selectedWorkItems,
              });
              if (!scopeValidation.ok) {
                executionSingleChat.appendAiNotice(scopeValidation.message);
                return { outcome: "blocked", message: scopeValidation.message };
              }
            }
            workItemsForWip = scoped.selectedWorkItems;
          } else if (runtimeWorkItems.length) {
            scopedTaskId = runtimeWorkItems[0]?.taskId ?? null;
            workItemsForWip = scopedTaskId
              ? runtimeWorkItems.filter((w) => w.taskId === scopedTaskId)
              : runtimeWorkItems.slice(0, 1);
          }

          const wipResult = executeCodeAgentWipWorkRequest(
            {
              projectId: pid,
              requirementsStateJson,
              parsedState: runtimeState,
              applyMessages: executionSingleChat.applyPersistedMessages,
              appendNotice: (text) => executionSingleChat.appendAiNotice(text),
              persistOrchestration: () => {
                // Full persist + local merge handled by applyImplementationOrchestrationResult below.
              },
              focusComposer: () => queueMicrotask(() => chatInputRef.current?.focus()),
              showToast,
            },
            {
              plan: runtimeTaskPlan,
              workItems: workItemsForWip,
              taskList: taskList ?? undefined,
              executionState: runtimeExecutionState,
              selectedTaskId: scopedTaskId,
              selectedWorkItemIds: workItemsForWip.map((w) => w.id),
              totalCandidateCount: wipCandidateCount,
              cursorWorkItemsV1: runtimeWorkItems ?? undefined,
              implementationTaskPlanV1: runtimeTaskPlan ?? undefined,
              promptTimeline: runtimeTimeline,
            },
          );

          if (wipResult.kind === "blocked") {
            executionSingleChat.appendAiNotice(wipResult.message);
            return { outcome: "blocked", message: wipResult.message };
          }
          if (wipResult.kind === "already_active") {
            showToast("이미 Code Agent WIP 작업이 진행 중입니다.");
            return { outcome: "executed" };
          }

          const selectedTaskId = wipResult.selectedTaskId ?? scopedTaskId;
          const acceptedBoardState = selectedTaskId
            ? markReworkRequestsAcceptedForTask({
                state: runtimeState.implementationExecutionBoardStateV1,
                projectId: pid,
                taskId: selectedTaskId,
              })
            : runtimeState.implementationExecutionBoardStateV1;
          if (selectedTaskId && acceptedBoardState) {
            applyPendingFromOrchestrationPatch({
              implementationExecutionBoardStateV1: acceptedBoardState,
            });
          }
          const mergedOrchestrationAfterWip = {
            ...runtimeState,
            codeAgentWipExecutionV1: wipResult.orchestrationPatch.codeAgentWipExecutionV1,
            promptTimeline: wipResult.orchestrationPatch.promptTimeline,
            ...(wipResult.executionState
              ? { implementationTaskExecutionStateV1: wipResult.executionState }
              : {}),
            ...(acceptedBoardState ? { implementationExecutionBoardStateV1: acceptedBoardState } : {}),
          };

          const wip = wipResult.orchestrationPatch.codeAgentWipExecutionV1;
          const timelineTaskId = wip.selectedTaskId ?? selectedTaskId ?? "";
          const timelineBase = {
            projectId: pid,
            selectedTaskId: timelineTaskId,
            selectedWorkItemCount: wip.selectedWorkItemIds?.length ?? workItemsForWip.length,
            cursorApiReady,
            hasCodeAgentWipExecutionV1: true,
          };
          let timeline = [
            ...(wipResult.orchestrationPatch.promptTimeline ?? runtimeTimeline ?? []),
          ];
          timeline = appendPromptTimeline(
            timeline,
            buildImplementationWipDraftLifecycleTimelineEntry({
              action: "implementation_wip_draft_created",
              ...timelineBase,
            }),
          );
          timeline = appendPromptTimeline(
            timeline,
            buildImplementationWipDraftLifecycleTimelineEntry({
              action: "implementation_wip_draft_persisted",
              ...timelineBase,
            }),
          );
          timeline = appendPromptTimeline(
            timeline,
            buildImplementationWipDraftLifecycleTimelineEntry({
              action: "implementation_wip_draft_local_state_merged",
              ...timelineBase,
            }),
          );
          timeline = appendPromptTimeline(
            timeline,
            buildImplementationWipDraftLifecycleTimelineEntry({
              action: "legacy_cursor_bridge_diagnostic_removed",
              ...timelineBase,
            }),
          );

          const boardAfterWip = buildImplementationExecutionBoardFromRequirementsState({
            projectId: pid,
            orchestration: mergedOrchestrationAfterWip,
          });
          const boardMessage =
            boardAfterWip &&
            buildImplementationExecutionBoardMessage({
              board: boardAfterWip,
              nowIso: new Date().toISOString(),
              previewReady: prototypeRunSyncSnapshot.previewReady,
              hasExecutionState: true,
              codeAgentWipExecutionV1: wip,
              executionSetup: executionSetupRow,
            });
          if (boardMessage) {
            timeline = appendPromptTimeline(
              timeline,
              buildImplementationWipDraftLifecycleTimelineEntry({
                action: "implementation_wip_draft_board_refreshed",
                ...timelineBase,
              }),
            );
          }

          const staleSanitizeCtx = {
            implementationTaskListV1: runtimeState.implementationTaskListV1,
            cursorWorkItemsV1: runtimeWorkItems,
            implementationSeedV1: runtimeState.implementationSeedV1,
          };
          const baseMessages = wipResult.chatMessages;
          const rawNextMessages = boardMessage ? [...baseMessages, boardMessage] : baseMessages;
          const nextMessages = sanitizeImplementationConversationMessages(rawNextMessages, staleSanitizeCtx);
          applyImplementationOrchestrationResult({
            messages: nextMessages,
            orchestrationPatch: {
              codeAgentWipExecutionV1: wip,
              promptTimeline: timeline,
              ...(wipResult.executionState
                ? { implementationTaskExecutionStateV1: wipResult.executionState }
                : {}),
              ...(runtimeWorkItems?.length ? { cursorWorkItemsV1: [...runtimeWorkItems] } : {}),
              ...(runtimeTaskPlan ? { implementationTaskPlanV1: runtimeTaskPlan } : {}),
              ...(runtimeSlots ? { implementationSlotsV1: runtimeSlots } : {}),
              ...(runtimeDbStrategy ? { implementationDbStrategyV1: runtimeDbStrategy } : {}),
              ...(acceptedBoardState
                ? { implementationExecutionBoardStateV1: acceptedBoardState }
                : {}),
            },
          });

          const integratedWipSummary = Boolean(scopedTaskId && wipCandidateCount !== undefined);
          if (!integratedWipSummary) {
            const devCount = wipResult.developerTaskCount;
            const successNotice =
              devCount > 0
                ? `TaskList 기준 개발자 작업 ${devCount}건을 Code Agent WIP 요청으로 전환했습니다.`
                : "Code Agent WIP 작업 요청을 시작했습니다.";
            showToast(successNotice);
          } else {
            showToast("Code Agent WIP 초안이 생성되었습니다.");
          }
          return { outcome: "executed" };
        }
        case "REQUEST_CURSOR_BRIDGE_EXECUTION": {
          const pid = projectId.trim();
          const wip = orchestrationAwareRequirementsState.codeAgentWipExecutionV1;
          if (!wip) {
            const message =
              "WIP 초안 또는 Cursor 실행 결과가 저장되어 있지 않습니다. 먼저 [생성요청]을 실행해 WIP 초안을 생성해 주세요.";
            executionSingleChat.appendAiNotice(message);
            return { outcome: "blocked", message };
          }
          const bridgeStatus = wip.bridgeExecutionStatus;
          if (
            bridgeStatus !== "draft_created" &&
            bridgeStatus !== "draft_approved" &&
            bridgeStatus !== "failed"
          ) {
            const message = `현재 bridge 상태(${bridgeStatus ?? "unknown"})에서는 Cursor 실행 요청을 할 수 없습니다.`;
            executionSingleChat.appendAiNotice(message);
            return { outcome: "blocked", message };
          }
          const selectedTaskId = wip.selectedTaskId?.trim();
          const selectedWorkItemIds = wip.selectedWorkItemIds ?? [];
          if (!selectedTaskId || !selectedWorkItemIds.length) {
            const message = "WIP 실행 대상 taskId 또는 workItem이 없습니다. [생성요청]을 다시 실행해 주세요.";
            executionSingleChat.appendAiNotice(message);
            return { outcome: "blocked", message };
          }
          const bridgeWorkItems = orchestrationAwareRequirementsState.cursorWorkItemsV1 ?? [];
          const workItems = bridgeWorkItems.filter((w) => selectedWorkItemIds.includes(w.id));
          const bridgeTaskList = orchestrationAwareRequirementsState.implementationTaskListV1;
          if (!workItems.length) {
            const message = "선택된 Cursor WorkItem을 찾을 수 없습니다.";
            executionSingleChat.appendAiNotice(message);
            return { outcome: "blocked", message };
          }
          const stubCommit = wip.commits.find((c) => c.sha?.startsWith("wip-stub"));
          const commitMessage = stubCommit?.commitMessage ?? `wip(cursor): [${selectedTaskId}]`;

          void (async () => {
            const setupRes = await fetchExecutionSetup(pid);
            const executionSetup =
              setupRes.res.ok && setupRes.json.success ? (setupRes.json.data ?? null) : null;
            const readiness = evaluateExecutionSetupSourceGenerationReadiness({
              setup: executionSetup
                ? {
                    gitRepoUrl: executionSetup.gitRepoUrl,
                    gitRepoName: executionSetup.gitRepoName,
                    gitRepoProvider: executionSetup.gitRepoProvider,
                    baseBranch: executionSetup.baseBranch,
                    workspacePath: executionSetup.workspacePath,
                    allowedPathGlobs: executionSetup.allowedPathGlobs,
                    autoCommit: executionSetup.autoCommit,
                    autoPush: executionSetup.autoPush,
                    autoPr: executionSetup.autoPr,
                    cursorApiUrl: executionSetup.cursorApiUrl,
                    hasCursorToken: executionSetup.hasCursorToken,
                    hasGithubAccessToken: executionSetup.hasGithubAccessToken,
                  }
                : null,
            });
            const setupRow = executionSetup
              ? {
                  gitRepoUrl: executionSetup.gitRepoUrl,
                  gitRepoName: executionSetup.gitRepoName,
                  gitRepoProvider: executionSetup.gitRepoProvider,
                  baseBranch: executionSetup.baseBranch,
                  workspacePath: executionSetup.workspacePath,
                  allowedPathGlobs: executionSetup.allowedPathGlobs,
                  autoCommit: executionSetup.autoCommit,
                  autoPush: executionSetup.autoPush,
                  autoPr: executionSetup.autoPr,
                  cursorApiUrl: executionSetup.cursorApiUrl,
                  hasCursorToken: executionSetup.hasCursorToken,
                  hasGithubAccessToken: executionSetup.hasGithubAccessToken,
                }
              : null;

            if (!isCursorBridgeConfiguredForSourceGeneration({ setup: setupRow })) {
              const diagnostic = formatTargetRepoE2eDiagnosticLines({ setup: setupRow, wip }).join("\n");
              const blockedMessage = CURSOR_API_NOT_CONFIGURED_MESSAGE;
              executionSingleChat.appendAiNotice(`${blockedMessage}\n\n${diagnostic}`);
              showToast("Cursor 실행 설정이 준비되지 않았습니다.");
              setExecutionEnvironmentModalOpen(true);
              return;
            }

            const cursorAvailability = evaluateCursorExecutionAvailability({ setup: setupRow });
            const availabilityTimeline = buildCursorApiDirectTimelineEntry({
              action: "cursor_api_availability_checked",
              projectId: pid,
              selectedTaskId,
              repoFullName: setupRow?.gitRepoName ?? undefined,
              workspacePath: setupRow?.workspacePath ?? undefined,
              branchName: wip.branchName,
              status: cursorAvailability.status,
              nowIso: new Date().toISOString(),
            });
            void persistChatToDb(undefined, {
              promptTimeline: [
                ...(orchestrationAwareRequirementsState.promptTimeline ?? []),
                availabilityTimeline,
              ],
            });

            if (!readiness.ok) {
              const diagnostic = formatTargetRepoE2eDiagnosticLines({
                setup: setupRow,
                workspaceOriginStatus: "unchecked",
                wip,
              }).join("\n");
              executionSingleChat.appendAiNotice(`${readiness.message}\n\n${diagnostic}`);
              showToast("Cursor 실행 요청이 차단되었습니다.");
              if (readiness.missing.some((m) => m.includes("Git") || m.includes("실행환경"))) {
                setExecutionEnvironmentModalOpen(true);
              }
              return;
            }

            const targetRepository = readiness.context.targetRepository;
            const targetSnapshot = toCodeAgentTargetRepositorySnapshot(targetRepository);

            const e2eDiagnostic = formatTargetRepoE2eDiagnosticLines({
              context: readiness.context,
              workspaceOriginStatus:
                readiness.context.workspaceRootSource === "env_fallback" ? "not_applicable" : "unchecked",
              wip,
            }).join("\n");
            executionSingleChat.appendAiNotice(
              ["Target Repo 수동 E2E 진단:", "", e2eDiagnostic].join("\n"),
            );
            const readinessTimeline = buildTargetRepoE2eTimelineEntry({
              action: "target_repo_e2e_readiness_checked",
              projectId: pid,
              selectedTaskId,
              repoFullName: targetRepository.repoFullName,
              baseBranch: readiness.context.baseBranch,
              workspacePath: readiness.context.workspaceRoot,
              status: "ready",
              nowIso: new Date().toISOString(),
            });
            void persistChatToDb(undefined, {
              promptTimeline: [
                ...(orchestrationAwareRequirementsState.promptTimeline ?? []),
                readinessTimeline,
              ],
            });

            showToast("Cursor API 직접 실행을 시작합니다...");
            const requestedTimeline = buildCursorApiDirectTimelineEntry({
              action: "cursor_api_direct_execution_requested",
              projectId: pid,
              selectedTaskId,
              repoFullName: targetRepository.repoFullName,
              workspacePath: readiness.context.workspaceRoot,
              branchName: wip.branchName,
              status: cursorAvailability.mode,
              nowIso: new Date().toISOString(),
            });
            void persistChatToDb(undefined, {
              promptTimeline: [
                ...(orchestrationAwareRequirementsState.promptTimeline ?? []),
                availabilityTimeline,
                requestedTimeline,
              ],
            });
            const requestedWip: typeof wip = {
              ...wip,
              bridgeExecutionStatus: "bridge_requested",
              targetRepository: targetRepository.repoFullName,
              targetRepoFullName: targetRepository.repoFullName,
              targetRepositorySnapshot: targetSnapshot,
              workspacePath: readiness.context.workspaceRoot,
              baseBranch: readiness.context.baseBranch,
              bridgeAllowedPathGlobs: readiness.context.allowedPathGlobs,
              bridgeAutoPush: readiness.context.autoPush,
              bridgeAutoPr: readiness.context.autoPr,
            };
            void persistChatToDb(undefined, { codeAgentWipExecutionV1: requestedWip });

            try {
              const res = await fetch("/api/prototype/cursor-bridge/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  projectId: pid,
                  selectedTaskId,
                  selectedWorkItemIds,
                  workItems,
                  branchName: wip.branchName,
                  commitMessage,
                }),
              });
              const json = (await res.json()) as {
                success?: boolean;
                message?: string;
                result?: import("@/lib/prototype/cursorBridgeExecution").CursorBridgeExecuteResult;
              };
              if (!json.result) {
                const message = json.message ?? "Cursor API 응답이 올바르지 않습니다.";
                if (String(message).includes("일치하지 않습니다")) {
                  void persistChatToDb(undefined, {
                    promptTimeline: [
                      ...(orchestrationAwareRequirementsState.promptTimeline ?? []),
                      buildTargetRepoE2eTimelineEntry({
                        action: "target_repo_workspace_origin_mismatch",
                        projectId: pid,
                        selectedTaskId,
                        repoFullName: targetRepository.repoFullName,
                        workspacePath: readiness.context.workspaceRoot,
                        status: "blocked",
                        reason: message,
                      }),
                    ],
                  });
                }
                executionSingleChat.appendAiNotice(message);
                showToast(message);
                return;
              }
              const orchestration = buildCursorBridgeOrchestrationResult({
                requirementsStateJson,
                wip: requestedWip,
                bridgeResult: json.result,
                promptTimeline: orchestrationAwareRequirementsState.promptTimeline,
              });
              if (orchestration.kind === "blocked" || orchestration.kind === "failed") {
                const mismatchTimeline = String(json.message ?? orchestration.message ?? "").includes(
                  "일치하지 않습니다",
                )
                    ? buildTargetRepoE2eTimelineEntry({
                        action: "target_repo_workspace_origin_mismatch",
                        projectId: pid,
                        selectedTaskId,
                        repoFullName: targetRepository.repoFullName,
                        workspacePath: readiness.context.workspaceRoot,
                        status: "blocked",
                        reason: json.message,
                      })
                    : null;
                if (orchestration.orchestrationPatch) {
                  applyImplementationOrchestrationResult({
                    messages: orchestration.chatPatch?.messages ?? executionSingleChat.chatMessages,
                    orchestrationPatch: {
                      ...orchestration.orchestrationPatch,
                      ...(mismatchTimeline
                        ? {
                            promptTimeline: [
                              ...(orchestration.orchestrationPatch.promptTimeline ?? []),
                              mismatchTimeline,
                            ],
                          }
                        : {}),
                    },
                  });
                } else {
                  executionSingleChat.appendAiNotice(orchestration.message);
                }
                showToast(orchestration.message);
                return;
              }
              if (orchestration.chatPatch && orchestration.orchestrationPatch) {
                const approvedWip = orchestration.orchestrationPatch.codeAgentWipExecutionV1;
                const executionState = syncDeveloperTaskExecutionFromCodeAgentWip({
                  state: orchestrationAwareRequirementsState.implementationTaskExecutionStateV1,
                  taskList: bridgeTaskList ?? undefined,
                  cursorWorkItems: bridgeWorkItems,
                  codeAgentWipExecutionV1: approvedWip,
                  projectId: pid,
                });
                applyImplementationOrchestrationResult({
                  messages: orchestration.chatPatch.messages,
                  orchestrationPatch: {
                    ...orchestration.orchestrationPatch,
                    ...(executionState ? { implementationTaskExecutionStateV1: executionState } : {}),
                  },
                });
                if (selectedTaskId) {
                  const acceptedBoardState = markReworkRequestsAcceptedForTask({
                    state: orchestrationAwareRequirementsState.implementationExecutionBoardStateV1,
                    projectId: pid,
                    taskId: selectedTaskId,
                  });
                  void persistChatToDb(undefined, {
                    implementationExecutionBoardStateV1: acceptedBoardState,
                  });
                }
                const board = buildImplementationExecutionBoardFromRequirementsState({
                  projectId: pid,
                  orchestration: {
                    ...orchestrationAwareRequirementsState,
                    codeAgentWipExecutionV1: approvedWip,
                    implementationTaskExecutionStateV1: executionState ?? undefined,
                  },
                });
                if (board) {
                  appendImplementationTaskListAiMessage(
                    buildImplementationExecutionBoardMessage({
                      board,
                      nowIso: new Date().toISOString(),
                      previewReady: prototypeRunSyncSnapshot.previewReady,
                      codeAgentWipExecutionV1: approvedWip,
                      executionSetup: executionSetupRow,
                    }),
                  );
                }
                showToast(orchestration.message);
              }
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              executionSingleChat.appendAiNotice(`Cursor API 실행 오류: ${message}`);
              showToast(message);
            }
          })();

          return { outcome: "executed" };
        }
        case "RESOLVE_USER_CONFIRMATION": {
          const pid = projectId.trim();
          const nextBoardState = resolveAllPendingUserConfirmations({
            state: parsedRequirementsState.implementationExecutionBoardStateV1,
            projectId: pid,
          });
          void persistChatToDb(undefined, {
            implementationExecutionBoardStateV1: nextBoardState,
          });
          const notice = "사용자 확인 항목을 처리했습니다. 후속 작업을 이어갈 수 있습니다.";
          executionSingleChat.appendAiNotice(notice);
          showToast(notice);
          queueMicrotask(() => chatInputRef.current?.focus());
          return { outcome: "executed" };
        }
        case "SHOW_USER_CONFIRMATION_ITEMS": {
          const pid = projectId.trim();
          const result = tryAppendImplementationUserConfirmationBoardMessage({
            board: buildImplementationExecutionBoardFromRequirementsState({
              projectId: pid,
              orchestration: parsedRequirementsState,
            }),
            nowIso: new Date().toISOString(),
            appendAiMessage: appendImplementationTaskListAiMessage,
            showToast,
          });
          if (result.kind === "appended") return { outcome: "executed" };
          return { outcome: "blocked", message: result.message };
        }
        case "REQUEST_TASK_REWORK": {
          const pid = projectId.trim();
          const board = buildImplementationExecutionBoardFromRequirementsState({
            projectId: pid,
            orchestration: parsedRequirementsState,
          });
          if (!board) {
            const message = "구현 작업목록이 없어 재작업 요청을 등록할 수 없습니다.";
            showToast(message);
            return { outcome: "blocked", message };
          }
          const taskId = pickTaskIdForReworkRequest(board);
          if (!taskId) {
            const message = "재작업 요청을 등록할 대상 작업이 없습니다.";
            showToast(message);
            return { outcome: "blocked", message };
          }
          const nowIso = new Date().toISOString();
          const nextBoardState = appendReworkRequest({
            state: parsedRequirementsState.implementationExecutionBoardStateV1,
            projectId: pid,
            taskId,
            targetRole: "developer",
            reason: "사용자 재작업 요청: 구현 결과 보완 필요",
            nowIso,
          });
          void persistChatToDb(undefined, {
            implementationExecutionBoardStateV1: nextBoardState,
          });
          const nextBoard = buildImplementationExecutionBoardFromRequirementsState({
            projectId: pid,
            orchestration: {
              ...parsedRequirementsState,
              implementationExecutionBoardStateV1: nextBoardState,
            },
          });
          if (nextBoard) {
            appendImplementationTaskListAiMessage(
              buildImplementationExecutionBoardMessage({
                board: nextBoard,
                nowIso,
                previewReady: prototypeRunSyncSnapshot.previewReady,
                executionSetup: executionSetupRow,
              }),
            );
          }
          const notice = buildReworkRequestRegistrationNotice({
            board: nextBoard ?? board,
            taskId,
          });
          executionSingleChat.appendAiNotice(notice);
          showToast(notice.split("\n")[0] ?? notice);
          return { outcome: "executed" };
        }
        case "MOVE_TO_REVIEW_STAGE": {
          const pid = projectId.trim();
          const board = buildImplementationExecutionBoardFromRequirementsState({
            projectId: pid,
            orchestration: parsedRequirementsState,
          });
          const previewReady = prototypeRunSyncSnapshot.previewReady;
          if (!board || !isImplementationReadyForReviewStage({ board, previewReady })) {
            const message = !previewReady
              ? "프로토타입 preview가 준비되지 않아 검토단계로 이동할 수 없습니다."
              : "구현 실행 보드가 완료되지 않아 검토단계로 이동할 수 없습니다.";
            showToast(message);
            return { outcome: "blocked", message };
          }
          const reviewMarker = buildImplementationReviewStageReadyMarker({
            previewReady: true,
            nowIso: new Date().toISOString(),
          });
          const previewUrlForReview =
            previewUrl ?? prototypeRunSyncSnapshot.previewUrl ?? undefined;
          let session =
            parsedRequirementsState.reviewStageUserTestSessionV1 ??
            buildInitialReviewStageUserTestSession({
              projectId: pid,
              previewUrl: previewUrlForReview,
            });
          void persistChatToDb(undefined, {
            implementationReviewStageReadyV1: reviewMarker,
            reviewStageUserTestSessionV1: session,
          });
          appendImplementationTaskListAiMessage(
            buildReviewStageEntryMessage({
              entryReady: true,
              implementationReviewStageReadyV1: reviewMarker,
              previewReady: true,
              session,
              feedbackList: parsedRequirementsState.reviewStageUserFeedbackListV1,
              previewUrl: previewUrlForReview,
            }),
          );
          const message =
            "검토단계로 이동할 수 있습니다. 좌측 [검토] 메뉴에서 프로토타입 사용자 테스트를 진행하세요.";
          executionSingleChat.appendAiNotice(message);
          showToast(message);
          return { outcome: "executed" };
        }
        case "REVIEW_STAGE_OPEN_PREVIEW": {
          const url = previewUrl ?? prototypeRunSyncSnapshot.previewUrl;
          if (url) {
            window.open(url, "_blank", "noopener,noreferrer");
            return { outcome: "executed" };
          }
          showToast("Preview URL이 아직 없습니다.");
          return { outcome: "blocked", message: "Preview URL이 아직 없습니다." };
        }
        case "REVIEW_STAGE_START_USER_TEST": {
          const pid = projectId.trim();
          const previewUrlForReview =
            previewUrl ?? prototypeRunSyncSnapshot.previewUrl ?? undefined;
          const session = markReviewStageUserTestStarted({
            session: parsedRequirementsState.reviewStageUserTestSessionV1,
            projectId: pid,
            previewUrl: previewUrlForReview,
          });
          void persistChatToDb(undefined, { reviewStageUserTestSessionV1: session });
          appendImplementationTaskListAiMessage(
            buildReviewStageEntryMessage({
              entryReady: true,
              implementationReviewStageReadyV1: parsedRequirementsState.implementationReviewStageReadyV1,
              previewReady: prototypeRunSyncSnapshot.previewReady,
              session,
              feedbackList: parsedRequirementsState.reviewStageUserFeedbackListV1,
              previewUrl: previewUrlForReview,
            }),
          );
          const notice = "사용자 테스트를 시작했습니다. Preview에서 화면·흐름·문구를 확인해 주세요.";
          executionSingleChat.appendAiNotice(notice);
          showToast(notice);
          return { outcome: "executed" };
        }
        case "REVIEW_STAGE_ADD_FEEDBACK": {
          applyImplementationStageActionExecutionResult(
            buildImplementationStageActionFocusComposerResult(REVIEW_STAGE_ADD_FEEDBACK_GUIDE),
          );
          return { outcome: "executed" };
        }
        case "REVIEW_STAGE_VIEW_FEEDBACK": {
          appendImplementationTaskListAiMessage(
            buildReviewStageViewFeedbackMessage({
              feedbackList: parsedRequirementsState.reviewStageUserFeedbackListV1,
            }),
          );
          return { outcome: "executed" };
        }
        case "REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION": {
          const pid = projectId.trim();
          const board = buildImplementationExecutionBoardFromRequirementsState({
            projectId: pid,
            orchestration: parsedRequirementsState,
          });
          if (!board) {
            const message = "구현 작업 보드가 없어 보완 요청을 등록할 수 없습니다.";
            showToast(message);
            return { outcome: "blocked", message };
          }
          const active = getActiveReviewFeedbackItems(
            parsedRequirementsState.reviewStageUserFeedbackListV1,
          );
          const feedback = active[0];
          if (!feedback) {
            const message = "구현단계로 전환할 미처리 피드백이 없습니다.";
            showToast(message);
            return { outcome: "blocked", message };
          }
          const fallbackTaskId =
            pickFirstExecutableDeveloperTaskId(board) ??
            board.taskRows.find((row) => row.developerStatus !== "skipped")?.taskId ??
            "";
          if (!fallbackTaskId) {
            const message = "보완 요청을 연결할 developer 작업이 없습니다.";
            showToast(message);
            return { outcome: "blocked", message };
          }
          const feedbackList = parsedRequirementsState.reviewStageUserFeedbackListV1;
          if (!feedbackList) {
            const message = "피드백 목록이 없습니다.";
            showToast(message);
            return { outcome: "blocked", message };
          }
          const converted = convertReviewFeedbackToImplementationRework({
            feedbackList,
            boardState: parsedRequirementsState.implementationExecutionBoardStateV1,
            projectId: pid,
            feedbackId: feedback.feedbackId,
            fallbackTaskId,
          });
          const session = markReviewStageReturnedToImplementation({
            session:
              parsedRequirementsState.reviewStageUserTestSessionV1 ??
              buildInitialReviewStageUserTestSession({ projectId: pid }),
          });
          void persistChatToDb(undefined, {
            reviewStageUserFeedbackListV1: converted.feedbackList,
            implementationExecutionBoardStateV1: converted.boardState,
            reviewStageUserTestSessionV1: session,
          });
          const nextBoard = buildImplementationExecutionBoardFromRequirementsState({
            projectId: pid,
            orchestration: {
              ...parsedRequirementsState,
              implementationExecutionBoardStateV1: converted.boardState,
              reviewStageUserFeedbackListV1: converted.feedbackList,
              reviewStageUserTestSessionV1: session,
            },
          });
          if (nextBoard) {
            appendImplementationTaskListAiMessage(
              buildImplementationExecutionBoardMessage({
                board: nextBoard,
                nowIso: new Date().toISOString(),
                previewReady: prototypeRunSyncSnapshot.previewReady,
                executionSetup: executionSetupRow,
              }),
            );
          }
          const notice = buildReviewFeedbackConvertNotice({
            feedbackId: converted.feedbackId,
            targetTaskId: converted.targetTaskId,
            reworkRequestId: converted.reworkRequestId,
          });
          executionSingleChat.appendAiNotice(notice);
          showToast(notice);
          return { outcome: "executed" };
        }
        case "REVIEW_STAGE_COMPLETE_TEST": {
          const completeGate = canCompleteReviewStage({
            feedbackList: parsedRequirementsState.reviewStageUserFeedbackListV1,
          });
          if (!completeGate.ok) {
            showToast(completeGate.message);
            return { outcome: "blocked", message: completeGate.message };
          }
          const session = parsedRequirementsState.reviewStageUserTestSessionV1;
          if (!session) {
            const message = "사용자 테스트 세션이 없습니다. 먼저 사용자 테스트를 시작해 주세요.";
            showToast(message);
            return { outcome: "blocked", message };
          }
          const completed = markReviewStageUserTestCompleted({ session });
          void persistChatToDb(undefined, { reviewStageUserTestSessionV1: completed });
          appendImplementationTaskListAiMessage(
            buildReviewStageEntryMessage({
              entryReady: true,
              implementationReviewStageReadyV1: parsedRequirementsState.implementationReviewStageReadyV1,
              previewReady: prototypeRunSyncSnapshot.previewReady,
              session: completed,
              feedbackList: parsedRequirementsState.reviewStageUserFeedbackListV1,
              previewUrl: previewUrl ?? prototypeRunSyncSnapshot.previewUrl ?? undefined,
            }),
          );
          const notice = "프로토타입 사용자 테스트 검토를 완료했습니다.";
          executionSingleChat.appendAiNotice(notice);
          showToast(notice);
          return { outcome: "executed" };
        }
        case "RUN_REFACTOR_COMMON":
          return runIntegratedStageStep("refactor_common");
        case "RUN_INTEGRATED_REVIEW":
          return runIntegratedStageStep("integrated_review");
        case "RUN_INTEGRATED_SECURITY":
          return runIntegratedStageStep("integrated_security");
        case "RUN_FINAL_SCM":
          return runIntegratedStageStep("final_scm");
        default:
          return { outcome: "blocked", message: "지원하지 않는 구현단계 action입니다." };
      }
    },
    [
      applyImplementationStageActionExecutionResult,
      generateImplementationTaskList,
      confirmQuickDesignForImplementation,
      createImplementationSeedFromQuickDesignDraft,
      generateImplementationWorkPlanDraft,
      confirmImplementationTaskPlan,
      reviewDbIntegrationNeed,
      generateDataModelDraft,
      confirmMockImplementationMode,
      implementationCursorGate,
      executionSingleChat,
      wipChipHandlers,
      runImplementationQualityGate,
      runIntegratedStageStep,
      appendImplementationTaskListAiMessage,
      chatInputRef,
      parsedRequirementsState,
      pendingImplementationPatch,
      orchestrationAwareRequirementsState,
      projectId,
      requirementsStateJson,
      effectiveImplementationState,
      executionSetupRow,
      persistChatToDb,
      showToast,
      executionArtifacts,
      prototypeRunSyncSnapshot,
    ],
  );

  const executeImplementationStageAction = useCallback(
    (actionId: ImplementationStageActionId): boolean => {
      const pid = projectId.trim();
      if (!pid) {
        showToast("프로젝트를 선택해 주세요.");
        return true;
      }

      void orchestrateImplementationStageAction({
        projectId: pid,
        actionId,
        source: "cta",
        effectiveState: effectiveImplementationState,
        boardGateContext: implementationStageBoardGateContext,
        execute: () => runImplementationStageAction(actionId),
      }).then((run) => {
        persistImplementationStageActionRun(run);
        const gateBlocked = run.gateResult != null && !run.gateResult.ok;
        if (gateBlocked && run.message) {
          showToast(run.message);
        } else if (run.status === "failed" && run.message) {
          showToast(run.message);
        }
      });

      return true;
    },
    [
      projectId,
      effectiveImplementationState,
      implementationStageBoardGateContext,
      runImplementationStageAction,
      persistImplementationStageActionRun,
      showToast,
    ],
  );

  useEffect(() => {
    runImplementationStageActionRef.current = runImplementationStageAction;
    persistImplementationStageActionRunRef.current = persistImplementationStageActionRun;
  }, [runImplementationStageAction, persistImplementationStageActionRun]);

  const handleImplementationChip = useCallback(
    (label: string) => {
      const taskList = parsedRequirementsState.implementationTaskListV1 ?? null;
      const chipHandled = tryHandleImplementationTaskListChip({
          label,
          projectId,
          taskList,
          executionState: parsedRequirementsState.implementationTaskExecutionStateV1,
          integratedExecutionState: parsedRequirementsState.implementationIntegratedExecutionStateV1,
          boardState: parsedRequirementsState.implementationExecutionBoardStateV1,
          qualityGateResults: parsedRequirementsState.implementationQualityGateResultsV1,
          prototypeSnapshot: prototypeRunSyncSnapshot,
          envOk: canRequestGeneration.envOk,
          appendAiMessage: appendImplementationTaskListAiMessage,
          openEnvSettings: () => setExecutionEnvironmentModalOpen(true),
          openArtifactHub: () => setArtifactHubOpen(true),
          openPrototypePreview: () => {
            const url = previewUrl ?? prototypeRunSyncSnapshot.previewUrl;
            if (url) window.open(url, "_blank", "noopener,noreferrer");
            else showToast("Preview URL이 아직 없습니다.");
          },
          returnToPlanningStage: () => {
            const pid = projectId.trim();
            if (!pid) return;
            window.location.assign(`/requirements?projectId=${encodeURIComponent(pid)}`);
          },
          generateTaskListFromSeed: () => {
            void generateImplementationTaskList();
          },
          showToast,
        });

      if (chipHandled) {
        if (
          label.trim() === AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP &&
          taskList?.tasks?.length &&
          (!parsedRequirementsState.cursorWorkItemsV1 || parsedRequirementsState.cursorWorkItemsV1.length === 0)
        ) {
          const pid = projectId.trim();
          if (pid) {
            const workItems = buildCursorWorkItemsFromImplementationTaskList({ projectId: pid, taskList });
            if (workItems.length) {
              void persistChatToDb(resolvePrototypeExecutionSingleChatFromState(requirementsStateJson), {
                cursorWorkItemsV1: workItems,
              });
            }
          }
        }
        return true;
      }

      if (
        label.trim() === IMPLEMENTATION_GENERATION_REQUEST_CHIP &&
        taskList?.tasks?.length &&
        (!parsedRequirementsState.cursorWorkItemsV1 || parsedRequirementsState.cursorWorkItemsV1.length === 0)
      ) {
        const pid = projectId.trim();
        if (pid) {
          const workItems = buildCursorWorkItemsFromImplementationTaskList({ projectId: pid, taskList });
          if (workItems.length) {
            void persistChatToDb(resolvePrototypeExecutionSingleChatFromState(requirementsStateJson), {
              cursorWorkItemsV1: workItems,
            });
          }
        }
      }

      const actionId = mapImplementationChipToAction(label);
      if (actionId && executeImplementationStageAction(actionId)) return true;

      return tryHandlePrototypeExecutionChip(label, {
        openEnvSettings: () => setExecutionEnvironmentModalOpen(true),
        openArtifactHub: () => setArtifactHubOpen(true),
        showImplementationSeedReadinessCheck,
        returnToPlanningStage: () => {
          const pid = projectId.trim();
          if (!pid) return;
          window.location.assign(`/requirements?projectId=${encodeURIComponent(pid)}`);
        },
        focusComposerForScopeEdit: () => {
          showToast("아래 입력란에 수정·범위 조정 요청을 적고 전송해 주세요.");
          queueMicrotask(() => chatInputRef.current?.focus());
        },
        showRoleCheckDetails,
        showScmCheckDetails: () => appendStatusQueryFromChip("scm_check_details"),
        showEnvironmentCheckDetails: () => appendStatusQueryFromChip("environment_check_details"),
        generateImplementationWorkPlanDraft,
        confirmImplementationTaskPlan,
        reviewDbIntegrationNeed,
        generateDataModelDraft,
        confirmMockImplementationMode,
        ...wipChipHandlers,
        prepareImplementationExecution: () => {
          const toast = buildPrepareImplementationExecutionToast(
            effectiveImplementationState.implementationTaskPlanV1,
          );
          if (toast) showToast(toast);
        },
        confirmExecution: () => confirmExecution(),
        refreshStatus: () => void onRefreshPrototypeStatus(),
        showToast,
        canConfirmImplementationTaskPlan: () => {
          const gate = canConfirmImplementationWorkPlanFromEffectiveState(effectiveImplementationState);
          if (!gate.ok) {
            showToast(gate.message);
            return false;
          }
          return true;
        },
        canRequestCodeAgentWipWork: () => {
          const gate = evaluateImplementationCursorGate(implementationCursorGate);
          if (!gate.allowed) {
            executionSingleChat.appendAiNotice(formatImplementationCursorBlockedNotice(implementationCursorGate));
            return false;
          }
          return true;
        },
        canConfirmExecution: () => {
          if (!effectiveImplementationState.envOk || !effectiveImplementationState.designOk) {
            showToast("환경·설계 준비가 완료된 뒤 구현 실행을 진행할 수 있습니다.");
            return false;
          }
          return true;
        },
      });
    },
    [
      executeImplementationStageAction,
      parsedRequirementsState.implementationTaskListV1,
      parsedRequirementsState.implementationTaskExecutionStateV1,
      parsedRequirementsState.implementationQualityGateResultsV1,
      parsedRequirementsState.implementationSeedV1,
      prototypeRunSyncSnapshot,
      previewUrl,
      projectId,
      requirementsStateJson,
      persistChatToDb,
      canRequestGeneration.envOk,
      appendImplementationTaskListAiMessage,
      envSettingsHref,
      showImplementationSeedReadinessCheck,
      showRoleCheckDetails,
      appendStatusQueryFromChip,
      confirmImplementationTaskPlan,
      generateImplementationWorkPlanDraft,
      reviewDbIntegrationNeed,
      generateDataModelDraft,
      confirmMockImplementationMode,
      effectiveImplementationState,
      wipChipHandlers,
      implementationCursorGate,
      confirmExecution,
      onRefreshPrototypeStatus,
      executionSingleChat,
      showToast,
    ],
  );

  const handleArtifactBoardAction = useCallback(
    (action: ArtifactBoardAction) => {
      setArtifactHubOpen(false);
      switch (action) {
        case "go_to_implementation":
        case "generate_implementation_seed":
          showToast("아래 구현 대화에서 구현 준비정보·작업안을 이어서 진행해 주세요.");
          queueMicrotask(() => chatInputRef.current?.focus());
          return;
        case "generate_implementation_work_plan":
          generateImplementationWorkPlanDraft();
          return;
        case "generate_code_agent_instruction":
          handleImplementationChip(CODE_AGENT_WIP_WORK_REQUEST_CHIP);
          return;
        case "review_db_integration":
          handleImplementationChip(DB_INTEGRATION_REVIEW_CHIP);
          return;
        default:
          return;
      }
    },
    [generateImplementationWorkPlanDraft, handleImplementationChip, showToast],
  );

  useEffect(() => {
    const run = latestRun;
    if (!run?.id) return;
    const units = [...(run.workUnits ?? [])].sort((a, b) => a.order - b.order);
    const snap = JSON.stringify({
      id: run.id,
      st: run.status,
      u: units.map((u) => [u.order, u.status]),
      pv: String(run.previewUrl ?? "").trim(),
      planner: run.plannerStatus ?? "",
    });
    if (snap === lastTimelineSnapRef.current) return;
    lastTimelineSnapRef.current = snap;

    setTimelineCards((prev) => {
      const ids = new Set(prev.map((c) => c.id));
      const additions: PrototypeWorkspaceTimelineCardV1[] = [];
      const rid = run.id;
      const now = Date.now();

      if (units.length > 0) {
        const planHash = units.map((u) => `${u.order}:${u.title}`).join("|").slice(0, 400);
        const planId = `plan-${rid}-${planHash}`;
        if (!ids.has(planId)) {
          ids.add(planId);
          additions.push({
            id: planId,
            at: now,
            runId: rid,
            kind: "plan_ready",
            title: "작업계획이 생성되었습니다.",
            body: `총 ${units.length}개의 작업으로 구성했습니다.`,
            workUnitTitlesJson: JSON.stringify(units.map((u) => ({ order: u.order, title: u.title }))),
          });
        }
      }

      for (const u of units) {
        if (u.status !== "MERGED") continue;
        const wid = `wu-${u.order}-${rid}-merged`;
        if (ids.has(wid)) continue;
        ids.add(wid);
        additions.push({
          id: wid,
          at: now,
          runId: rid,
          kind: "workunit_merged",
          title: `작업 ${u.order} 완료`,
          body: u.title,
          workUnitOrder: u.order,
          prUrl: u.prUrl?.trim() ? u.prUrl.trim() : null,
        });
      }

      if (!additions.length) return prev;
      return [...prev, ...additions].slice(-300);
    });
  }, [latestRun]);

  const handleChatIntent = useCallback(
    (a: PrototypeChatAction) => {
      switch (a.intent) {
        case "OPEN_ENV_SETTINGS":
          setExecutionEnvironmentModalOpen(true);
          return;
        case "OPEN_TEMPLATE_PREVIEW":
          setTemplatePreviewOpen(true);
          return;
        case "SELECT_TEMPLATE_RECOMMENDED":
          applyChatTemplateIntent(null);
          return;
        case "SELECT_TEMPLATE":
          if (a.templateId) applyChatTemplateIntent(a.templateId as PrototypeTemplateType);
          return;
        case "CREATE_PLAN":
          startWorkPlanGenerationFromChat();
          return;
        case "OPEN_PLANNER_PROMPT_IN_CHAT": {
          if (!templatePlanningReady) return;
          if (plannerCreatePending || isPlannerRunning || protoBusy) return;
          setPlannerPromptModalOpen(true);
          return;
        }
        case "START_WORK_PLAN_GENERATION":
          startWorkPlanGenerationFromChat();
          return;
        case "RETRY_PLANNER_GENERATION":
          startWorkPlanGenerationFromChat();
          return;
        case "REFRESH_STATUS":
          void onRefreshPrototypeStatus();
          return;
        case "CONFIRM_EXECUTION":
          confirmExecution();
          return;
        case "REGENERATE_PLAN":
          void regeneratePlan();
          return;
        case "MODIFY_REQUEST":
          showToast("아래 입력란에 수정 요청을 적고 전송해 주세요.");
          queueMicrotask(() => chatInputRef.current?.focus());
          return;
        case "CANCEL_RUN":
          setCancelConfirmOpen(true);
          return;
        case "RESUME_RUN": {
          const rid = latestRun?.id;
          if (!rid) return;
          void (async () => {
            setProtoBusy(true);
            try {
              const r = await postPrototypeRunResume(rid, { projectId, mode: "resume" });
              if (r.success && r.data?.run) setLatestRun(r.data.run);
              if (r.message) showToast(r.message);
            } finally {
              setProtoBusy(false);
              void refreshLatestRun();
            }
          })();
          return;
        }
        case "RESTART_RUN": {
          const rid = latestRun?.id;
          if (!rid) return;
          void (async () => {
            setProtoBusy(true);
            try {
              const r = await postPrototypeRunResume(rid, { projectId, mode: "restart" });
              if (r.success && r.data?.run) setLatestRun(r.data.run);
              if (r.message) showToast(r.message);
            } finally {
              setProtoBusy(false);
              void refreshLatestRun();
            }
          })();
          return;
        }
        case "RETRY_FAILED_WU": {
          const rid = latestRun?.id;
          const ord = a.workUnitOrder;
          if (!rid || typeof ord !== "number") return;
          retryWorkUnit("same_prompt")(rid, ord);
          return;
        }
        case "OPEN_ACTIONS_URL": {
          const u = latestRun?.pagesDeployWorkflowRunUrl?.trim();
          if (u) {
            const win = window.open(u, "_blank", "noopener,noreferrer");
            registerPlatformPopupFromOpenedUrl(win, u);
          }
          return;
        }
        case "OPEN_PR_URL": {
          const ord = a.workUnitOrder;
          if (typeof ord !== "number") return;
          const wu = sortedWorkUnitsForSidebar.find((x) => x.order === ord);
          const u = wu?.prUrl?.trim();
          if (u) {
            const win = window.open(u, "_blank", "noopener,noreferrer");
            registerPlatformPopupFromOpenedUrl(win, u);
          }
          return;
        }
        case "OPEN_PREVIEW": {
          const u = previewUrl ?? latestRun?.previewUrl ?? latestRun?.suggestedPreviewUrl ?? "";
          if (u) {
            const win = window.open(u, "_blank", "noopener,noreferrer");
            registerPlatformPopupFromOpenedUrl(win, u);
          }
          return;
        }
        case "COPY_PREVIEW_URL": {
          const u = previewUrl ?? latestRun?.previewUrl ?? latestRun?.suggestedPreviewUrl ?? "";
          if (!u) return;
          void navigator.clipboard?.writeText(u).catch(() => {});
          showToast("URL을 복사했습니다.");
          return;
        }
        case "OPEN_PROTOTYPE_REVIEW": {
          const rid = latestRun?.id;
          if (!projectId.trim() || !rid) return;
          window.location.assign(
            `/prototype-review?${new URLSearchParams({ projectId: projectId.trim(), runId: rid }).toString()}`,
          );
          return;
        }
        default:
          return;
      }
    },
    [
      envSettingsHref,
      applyChatTemplateIntent,
      startWorkPlanGenerationFromChat,
      canRequestGeneration.designOk,
      templatePlanningReady,
      protoBusy,
      plannerCreatePending,
      isPlannerRunning,
      showToast,
      confirmExecution,
      regeneratePlan,
      latestRun?.id,
      latestRun?.pagesDeployWorkflowRunUrl,
      latestRun?.previewUrl,
      projectId,
      refreshLatestRun,
      retryWorkUnit,
      sortedWorkUnitsForSidebar,
      previewUrl,
    ],
  );

  const isWorkPlanPlanningUi = isPlannerRunning || plannerCreatePending;

  const chatPlaceholder = useMemo(() => {
    if (isWorkPlanPlanningUi) {
      return `${prototypeAiTitle}가 작업계획을 생성 중입니다.`;
    }
    if (isMessageInputBlocked) {
      return `${prototypeAiTitle}가 작업 중입니다. 잠시 기다려주세요.`;
    }
    if (isDraftGenerationComplete) {
      return "완료된 실행입니다. 새로 시작하려면 타임라인의 「처음부터 다시 생성」을 이용해 주세요.";
    }
    if (isRunningState) {
      return "실행 중에는 작업계획을 수정할 수 없습니다.";
    }
    if (latestRun?.id && latestRun.status === "WORK_UNITS_READY" && latestRun.workUnitsExecutionConfirmed !== true) {
      return "수정 요청을 입력한 뒤 전송하면 작업계획을 다시 만듭니다.";
    }
    if (
      templatePlanningReady &&
      (!latestRun?.id || (latestRun.workUnits?.length ?? 0) === 0) &&
      !isWorkPlanPlanningUi
    ) {
      return "작업계획 생성 전 추가 지시가 있으면 입력 후 전송하세요.";
    }
    return "메시지를 입력하세요.";
  }, [
    prototypeAiTitle,
    templatePlanningReady,
    isWorkPlanPlanningUi,
    isMessageInputBlocked,
    isRunningState,
    latestRun?.id,
    latestRun?.status,
    latestRun?.workUnits?.length,
    latestRun?.workUnitsExecutionConfirmed,
    isDraftGenerationComplete,
  ]);

  const prototypeModalParticipants = useMemo((): readonly ParticipantOption[] => {
    const aiStatus = isPlannerRunning
      ? "작업계획 생성 중"
      : isRunningState
        ? "자동화 진행 중"
        : isDraftGenerationComplete || (latestRun?.status === "PREVIEW_READY" && String(latestRun?.publicUrl ?? "").trim())
          ? "초안 완료"
          : latestRun?.status === "DEPLOY_FAILED" || latestRun?.status === "FAILED"
            ? "오류"
            : "대기";
    const memberIds = [...IMPLEMENTATION_MODE_PRIMARY_MEMBERS];
    const platformAi = buildWorkspaceAiParticipantOptions({
      currentMemberIds: memberIds,
      statusLabelForCurrent: aiStatus,
    });
    return [
      ...platformAi,
      {
        id: "prototype-user-self",
        name: "사용자",
        kind: "human",
        onlineHint: true,
        roleLabel: "OWNER",
      },
    ];
  }, [
    isPlannerRunning,
    isRunningState,
    isDraftGenerationComplete,
    latestRun?.status,
    latestRun?.publicUrl,
  ]);

  const implementationParticipantCount = useMemo(
    () => Math.max(prototypeModalParticipants.length, IMPLEMENTATION_MODE_PARTICIPANT_COUNT),
    [prototypeModalParticipants],
  );

  const planningOrchestrationView = useMemo(
    () =>
      buildPrototypeExecutionPlanningOrchestrationView({
        requirementsStateJson,
        projectId,
        projectName: projectName || "프로젝트",
        projectDescription,
        servicePlanningAgentCatalogKeys: prototypeScreenCatalogIds,
      }),
    [requirementsStateJson, projectId, projectName, projectDescription, prototypeScreenCatalogIds],
  );

  const deliverableViewerAssets = useMemo(() => {
    const pid = projectId.trim();
    const ids = planningOrchestrationView.deliverableViewerAssetIds;
    const fromDeliverables = planningOrchestrationView.deliverableAssets.filter((a) => ids.includes(a.id));
    const knownIds = new Set(fromDeliverables.map((a) => a.id));
    const extras = ids.flatMap((id) => {
      if (knownIds.has(id)) return [];
      const artifact = planningOrchestrationView.projectArtifacts.find((a) => a.id === id);
      if (!artifact || !pid) return [];
      return [projectArtifactToDeliverableAsset(artifact, pid)];
    });
    const byId = new Map<string, import("@/lib/requirements/ideationDeliverables").IdeationDeliverableAsset>();
    for (const a of [...fromDeliverables, ...extras, ...viewerDerivedAssets]) {
      byId.set(a.id, a);
    }
    return [...byId.values()];
  }, [planningOrchestrationView, projectId, viewerDerivedAssets]);

  const openDeliverableViewer = useCallback((ids: readonly string[], focusId?: string | null) => {
    setDeliverableViewerIds([...ids]);
    setDeliverableViewerFocusId(focusId ?? null);
    setDeliverableViewerOpen(true);
  }, []);

  const implementationArtifactHubView = useMemo(
    () =>
      buildArtifactHubBundle({
        mode: "implementation",
        state: parsedRequirementsState,
        projectId: projectId.trim(),
        deliverableAssets: planningOrchestrationView.deliverableAssets,
        projectArtifacts: planningOrchestrationView.projectArtifacts,
      }).view,
    [
      parsedRequirementsState,
      projectId,
      planningOrchestrationView.deliverableAssets,
      planningOrchestrationView.projectArtifacts,
    ],
  );

  const {
    open: recommendationPanelOpen,
    items: recommendationEvidenceItems,
    close: closeRecommendationPanel,
  } = useProjectRecommendationEvidence({
    projectId,
    requirementsStateJson: parsedRequirementsState,
    messages: executionSingleChat.chatMessages,
    projectArtifacts: planningOrchestrationView.projectArtifacts,
    projectDescription,
  });

  const artifactHubOpenedRef = useRef(false);
  useEffect(() => {
    if (!artifactHubOpen) {
      artifactHubOpenedRef.current = false;
      return;
    }
    if (artifactHubOpenedRef.current) return;
    artifactHubOpenedRef.current = true;
    const timeline = appendPromptTimeline(
      parsedRequirementsState.promptTimeline,
      buildImplementationArtifactsTimelineEntry({
        action: "implementation_artifact_hub_opened",
        implementationArtifactCount: implementationArtifactHubView.implementationPrimary.length,
        planningReferenceCount: implementationArtifactHubView.planningReference.length,
        types: implementationArtifactHubView.derivedTypes,
      }),
    );
    void persistChatToDb(undefined, { promptTimeline: timeline });
  }, [artifactHubOpen, implementationArtifactHubView, parsedRequirementsState.promptTimeline, persistChatToDb]);

  const handleArtifactHubSelect = useCallback(
    (entry: ProjectArtifactHubEntry) => {
      const pid = projectId.trim();
      const derived = derivedHubEntryToDeliverableAsset(entry, pid);
      if (derived) {
        setViewerDerivedAssets((prev) => (prev.some((a) => a.id === derived.id) ? prev : [...prev, derived]));
        openDeliverableViewer([derived.id], derived.id);
        const timeline = appendPromptTimeline(
          parsedRequirementsState.promptTimeline,
          buildImplementationArtifactsTimelineEntry({
            action: "implementation_artifact_viewed",
            implementationArtifactCount: implementationArtifactHubView.implementationPrimary.length,
            planningReferenceCount: implementationArtifactHubView.planningReference.length,
            types: implementationArtifactHubView.derivedTypes,
            viewedType: entry.implementationArtifactType ?? entry.title,
          }),
        );
        void persistChatToDb(undefined, { promptTimeline: timeline });
        return;
      }
      const ids = planningOrchestrationView.deliverableViewerAssetIds.length
        ? planningOrchestrationView.deliverableViewerAssetIds
        : [entry.assetId];
      openDeliverableViewer(ids, entry.assetId);
    },
    [
      projectId,
      openDeliverableViewer,
      planningOrchestrationView.deliverableViewerAssetIds,
      parsedRequirementsState.promptTimeline,
      implementationArtifactHubView,
      persistChatToDb,
    ],
  );

  const onImplementationQuickExecution = useCallback(() => {
    const pid = projectId.trim();
    if (!pid) return;

    const entryState = deriveImplementationEntryState({
      implementationSeedV1: parsedRequirementsState.implementationSeedV1,
      implementationTaskPlanV1: parsedRequirementsState.implementationTaskPlanV1,
      implementationTaskListV1: parsedRequirementsState.implementationTaskListV1,
      cursorWorkItemsV1: parsedRequirementsState.cursorWorkItemsV1,
      projectArtifacts: executionArtifacts.projectArtifacts,
      fastPlanDraftV1: parsedRequirementsState.fastPlanDraftV1,
      promptTimeline: parsedRequirementsState.promptTimeline,
      orchestration: parsedRequirementsState.singleChatOrchestrationV1,
      slotDefinitions: planningSlotDefinitions,
    });

    if (entryState.status === "board_ready") {
      if (entryState.needsCursorWorkItemsRegeneration && parsedRequirementsState.implementationTaskListV1) {
        const recovery = buildImplementationEntryCursorWorkItemsRecovery({
          projectId: pid,
          taskList: parsedRequirementsState.implementationTaskListV1,
          existingCursorWorkItems: parsedRequirementsState.cursorWorkItemsV1,
        });
        if (recovery.regenerated) {
          const nowIso = new Date().toISOString();
          void persistChatToDb(resolvePrototypeExecutionSingleChatFromState(requirementsStateJson), {
            cursorWorkItemsV1: [...recovery.cursorWorkItems],
            promptTimeline: [
              ...(parsedRequirementsState.promptTimeline ?? []),
              buildImplementationEntryCursorWorkItemsRegeneratedTimelineEntry({
                projectId: pid,
                taskCount: entryState.taskCount,
                developerTaskCount: entryState.developerTaskCount,
                nowIso,
              }),
            ],
          });
          showToast("구현 작업목록을 기준으로 AI 개발자 실행 항목을 복구했습니다.");
        }
      }
      const gate = evaluateImplementationCursorGate(implementationCursorGate);
      if (gate.allowed) {
        wipChipHandlers.requestCodeAgentWipWork();
        return;
      }
      executionSingleChat.appendAiNotice(formatImplementationCursorBlockedNotice(implementationCursorGate));
      return;
    }

    if (
      entryState.status === "seed_only" ||
      entryState.status === "task_plan_only" ||
      entryState.primaryAction === "GENERATE_IMPLEMENTATION_TASK_LIST"
    ) {
      void generateImplementationTaskList();
      return;
    }

    if (entryState.status === "quick_design_draft_unconfirmed") {
      void confirmQuickDesignForImplementation();
      return;
    }

    if (!effectiveImplementationState.implementationTaskPlanV1) {
      confirmImplementationTaskPlan();
      return;
    }
    const gate = evaluateImplementationCursorGate(implementationCursorGate);
    if (gate.allowed) {
      wipChipHandlers.requestCodeAgentWipWork();
      return;
    }
    const toast = buildPrepareImplementationExecutionToast(
      effectiveImplementationState.implementationTaskPlanV1,
    );
    if (toast) showToast(toast);
    else executionSingleChat.appendAiNotice(formatImplementationCursorBlockedNotice(implementationCursorGate));
  }, [
    projectId,
    parsedRequirementsState,
    executionArtifacts.projectArtifacts,
    planningSlotDefinitions,
    requirementsStateJson,
    persistChatToDb,
    showToast,
    implementationCursorGate,
    wipChipHandlers,
    executionSingleChat,
    generateImplementationTaskList,
    confirmQuickDesignForImplementation,
    effectiveImplementationState.implementationTaskPlanV1,
    confirmImplementationTaskPlan,
  ]);

  const implementationInterviewUi = useMemo(
    () =>
      buildImplementationSlotsInterviewUi({
        implementationSlotsV1: parsedRequirementsState.implementationSlotsV1,
        onQuickExecution: onImplementationQuickExecution,
      }),
    [parsedRequirementsState.implementationSlotsV1, onImplementationQuickExecution],
  );

  const onDownloadImplementationConversationMarkdown = useCallback(() => {
    const pid = projectId.trim();
    const md = buildConversationMarkdown({
      heading: "# 구현 단계 대화 내역",
      scopeLines: [`- projectId: ${pid || "(미연결)"}`, `- exportedAt: ${new Date().toISOString()}`],
      messages: executionSingleChat.chatMessages,
      meLabel: "나",
    });
    downloadConversationMarkdownFile({ markdown: md, filenameStem: (projectName || "구현").trim() || "구현" });
  }, [executionSingleChat.chatMessages, projectId, projectName]);

  const onResetImplementationConversation = useCallback(async () => {
    const pid = projectId.trim();
    if (!pid || protoBusy || implementationResetBusy) return;
    if (
      !confirmResetConversation({
        message:
          "구현 대화·작업안·Seed·WIP 진행 상태를 모두 삭제하고 구현 단계를 다시 시작할까요? 기획 산출물과 슬롯은 유지됩니다. 이 작업은 되돌릴 수 없습니다.",
      })
    ) {
      return;
    }
    setImplementationResetBusy(true);
    try {
      const nowIso = new Date().toISOString();
      const resetState = buildImplementationConversationResetStateJson(
        parseRequirementsStateJson(requirementsStateJson),
        nowIso,
      );
      lastPersistedChatFingerprintRef.current = "";
      setTimelineCards([]);
      lastTimelineSnapRef.current = "";
      setPrePlanGate("idle");
      setPlannerCreatePending(false);
      setPlannerProgressStep(1);
      setImplementationConversationResetNonce((n) => n + 1);
      onRequirementsStateJsonChange?.(resetState);

      const { res, json: raw } = await patchSpecWorkspaceRequest(pid, { requirementsStateJson: resetState });
      const json = raw as SpecWorkspaceProjectPatchResponseBody;
      if (!res.ok || !json.success || json.data?.patchApplied === false || !json.data?.project) {
        showToast(json.message ?? "구현 대화 초기화에 실패했습니다.");
        return;
      }
      onRequirementsStateJsonChange?.(json.data.project.requirementsStateJson ?? resetState);
      showToast("구현 세션을 초기화했습니다. AI개발자 진입 안내를 다시 표시합니다.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "구현 대화 초기화 중 오류가 발생했습니다.");
    } finally {
      setImplementationResetBusy(false);
    }
  }, [
    projectId,
    protoBusy,
    implementationResetBusy,
    requirementsStateJson,
    onRequirementsStateJsonChange,
    showToast,
  ]);

  const onSummarizeImplementationConversation = useCallback(async () => {
    const pid = projectId.trim();
    if (!pid || protoBusy || executionAiSummaryBusy) return;
    if (!executionSingleChat.chatMessages.length) {
      showToast("요약할 대화가 없습니다.");
      return;
    }
    setExecutionAiSummaryBusy(true);
    try {
      const contentHtml = buildConversationContentHtmlForWorkNoteSummary(executionSingleChat.chatMessages, "나", {
        maxMessages: 80,
      });
      const wire = await postWorkNoteSummarize({ projectId: pid, scope: "project", contentHtml });
      executionSingleChat.appendAiNotice(
        [
          "AI 요약",
          "",
          wire.summary,
          "",
          `요청 분류 ${wire.requestType}`,
          `우선순위 추천 ${wire.priority}`,
          ...(wire.priorityReason?.trim() ? [`근거 ${wire.priorityReason.trim()}`] : []),
        ].join("\n"),
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : "AI 요약에 실패했습니다.");
    } finally {
      setExecutionAiSummaryBusy(false);
    }
  }, [projectId, protoBusy, executionAiSummaryBusy, executionSingleChat, showToast]);

  const executionConversationIconToolbar = useMemo(
    () => (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <WorkspaceHubChromeIconButton
          title="템플릿 변경"
          ariaLabel="템플릿 변경"
          disabled={!canRequestGeneration.envOk || shouldLockInlineChatTemplateSelection(latestRun) || protoBusy}
          onClick={() => {
            if (!canRequestGeneration.envOk) {
              showToast("환경 검증과 연결 테스트가 완료된 뒤 템플릿을 변경할 수 있습니다.");
              return;
            }
            if (shouldLockInlineChatTemplateSelection(latestRun)) {
              showToast("작업계획이 생성된 뒤에는 템플릿을 변경할 수 없습니다.");
              return;
            }
            setTemplateChangeOpen(true);
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
        </WorkspaceHubChromeIconButton>

        <WorkspaceConversationHubIconRow
          busy={protoBusy || executionAiSummaryBusy || implementationResetBusy}
          interviewUi={implementationInterviewUi}
          slotsChromeLabels={{
            progressLabel: IMPLEMENTATION_PROGRESS_LABEL,
            detailAriaLabel: IMPLEMENTATION_SLOTS_DETAIL_ARIA_LABEL,
          }}
          quickExecutionTitle="빠른 실행: 구현 작업안·WIP"
          quickExecutionAriaLabel="빠른 실행: 구현 작업안 확정 또는 코드 에이전트 WIP 작업 요청"
          memberControls={{
            count: implementationParticipantCount,
            onOpen: () => setProtoMembersModalOpen(true),
          }}
          artifactHubControls={{
            count: implementationArtifactHubView.badgeCount,
            hasStale: false,
            title: IMPLEMENTATION_ARTIFACT_HUB_LABEL,
            onOpen: () => setArtifactHubOpen(true),
          }}
          onDownloadConversationMarkdown={onDownloadImplementationConversationMarkdown}
          onResetConversation={onResetImplementationConversation}
          onSummarizeConversation={onSummarizeImplementationConversation}
          resetConversationDisabled={
            protoBusy ||
            implementationResetBusy ||
            executionSingleChat.conversationStatus !== "loaded" ||
            !executionSingleChat.chatMessages.length
          }
        />
      </div>
    ),
    [
      protoBusy,
      executionAiSummaryBusy,
      implementationInterviewUi,
      implementationParticipantCount,
      implementationArtifactHubView.badgeCount,
      canRequestGeneration.envOk,
      latestRun,
      onDownloadImplementationConversationMarkdown,
      onResetImplementationConversation,
      onSummarizeImplementationConversation,
      showToast,
      executionSingleChat.conversationStatus,
      executionSingleChat.chatMessages.length,
    ],
  );

  return (
    <div
      className="jyo-prototype-generation-root"
      style={{
        position: "relative",
        flex: "1 1 auto",
        minHeight: 0,
        minWidth: 0,
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes jyo-proto-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .jyo-prototype-stage-shell { height: 100%; }
        .jyo-prototype-generation-root input,
        .jyo-prototype-generation-root select {
          box-sizing: border-box;
          max-width: 100%;
        }
      `}</style>
      {toast ? (
        <div style={toastStyle}>
          {toast}
        </div>
      ) : null}

      <div className="jyo-prototype-stage-shell" style={{ flex: 1, minHeight: 0, height: "100%", display: "flex", flexDirection: "column" }}>
        <PrototypeExecutionChatPanel
          conversationStatus={executionSingleChat.conversationStatus}
          chatMessages={prioritizedChatMessages}
          memberControls={{
            count: implementationParticipantCount,
            onOpen: () => setProtoMembersModalOpen(true),
          }}
          headerIconToolbar={executionConversationIconToolbar}
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
          onInterviewSuggestionPick={(label) => {
            if (handleImplementationChip(label)) return;
            const picked = executionSingleChat.handleInterviewSuggestionPick(label);
            if (picked.kind === "action") handleChatIntent(picked.action);
          }}
          aiInvokePending={executionSingleChat.aiInvokePending}
        />
        {isNextPublicDevWorkflowToolsEnabled() ? (
          <details style={{ fontSize: 11, color: "#475569", flexShrink: 0, margin: "0 18px 12px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 900, color: "#334155" }}>내부 오케스트레이션 (개발)</summary>
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
                  executionSlots,
                  plannerSource: latestRun?.plannerSource ?? null,
                  plannerError: latestRun?.plannerError ?? null,
                },
                null,
                2,
              )}
            </pre>
          </details>
        ) : null}
      </div>

      <RecommendationEvidenceDrawer
        open={recommendationPanelOpen}
        items={recommendationEvidenceItems}
        onClose={closeRecommendationPanel}
        closeOnEscape={!deliverableViewerOpen}
      />

      <RequirementsArtifactHubDrawer
        open={artifactHubOpen}
        artifactHubView={implementationArtifactHubView}
        items={implementationArtifactHubView.entries}
        projectName={projectName || "프로젝트"}
        projectId={projectId.trim() || undefined}
        projectArtifacts={planningOrchestrationView.projectArtifacts}
        deliverableAssets={planningOrchestrationView.deliverableAssets}
        generateDisabled
        lifecycleSummary={planningOrchestrationView.orchestrationUi.artifactLifecycleLabels.map((r) => ({
          label: r.label,
          hint: r.hint,
        }))}
        onClose={() => setArtifactHubOpen(false)}
        closeOnEscape={!deliverableViewerOpen}
        onSelectEntry={handleArtifactHubSelect}
        onGenerate={() => {
          showToast("문서 생성은 서비스 기획(/requirements) 화면에서 진행할 수 있습니다.");
        }}
        onArtifactBoardAction={(action) => handleArtifactBoardAction(action)}
        onExportFeedback={({ kind, count, blocked }) => {
          if (blocked) {
            showToast(blocked);
            return;
          }
          if (kind === "pdf") {
            showToast(
              count === 1
                ? "선택한 산출물 PDF 인쇄 창을 열었습니다."
                : `선택한 산출물 ${count}건 PDF 인쇄 창을 열었습니다.`,
            );
            return;
          }
          showToast(
            count === 1 ? "선택한 산출물을 Doc으로 내려받았습니다." : `선택한 산출물 ${count}건을 Doc으로 내려받았습니다.`,
          );
        }}
      />

      <RequirementsDeliverableViewerModal
        open={deliverableViewerOpen}
        onClose={() => setDeliverableViewerOpen(false)}
        assets={deliverableViewerAssets}
        initialAssetId={deliverableViewerFocusId}
      />

      <WorkspaceParticipantsModal
        open={protoMembersModalOpen}
        onClose={() => setProtoMembersModalOpen(false)}
        participants={prototypeModalParticipants}
        showInvite={false}
        inviteDisabled
        onInviteClick={() => {}}
      />

      <ProjectExecutionEnvironmentModal
        open={executionEnvironmentModalOpen}
        onClose={() => {
          setExecutionEnvironmentModalOpen(false);
          void handleExecutionSetupChanged();
        }}
        onSetupSaved={() => {
          void handleExecutionSetupChanged();
        }}
        projectId={projectId}
        project={executionEnvironmentModalProject}
        canEdit={true}
      />

      <PrototypeTemplateChangeModal
        open={templateChangeOpen}
        onClose={() => setTemplateChangeOpen(false)}
        canChange={canRequestGeneration.envOk && !shouldLockInlineChatTemplateSelection(latestRun)}
        draftPickerValue={draftPickerValue}
        recommendedTemplateId={analysis.recommendedTemplate}
        recommendedTemplateNameKo={effectiveTemplateDef?.nameKo ?? analysis.recommendedTemplate}
        disabled={protoBusy}
        onSelect={applyToolbarTemplateSelection}
        onPreview={() => {
          setTemplateChangeOpen(false);
          setTemplatePreviewOpen(true);
        }}
      />

      <PrototypePreviewDraggableShell
        open={templatePreviewOpen}
        onClose={() => setTemplatePreviewOpen(false)}
        title="템플릿 미리보기"
        modalWidth="min(980px, calc(100vw - 20px))"
        tone="showcase"
      >
        {effectiveTemplateDef ? (
          <div style={{ display: "grid", gap: 12 }}>
            <PrototypeTemplateMockPreview template={effectiveTemplateDef!} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setTemplatePreviewOpen(false)} style={btnMuted}>닫기</button>
              <button
                type="button"
                onClick={() => void onCursorAutoRequest()}
                disabled={!canStartPrototypeAutomation || protoBusy || isRunningState}
                style={btnPrimary}
              >
                이 템플릿으로 자동 실행 시작
              </button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, fontWeight: 800, color: "#64748b" }}>템플릿 정보를 찾을 수 없습니다.</div>
        )}
      </PrototypePreviewDraggableShell>

      {plannerPromptModalOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
          }}
          onClick={() => setPlannerPromptModalOpen(false)}
        >
          <div
            style={{
              width: "min(900px, 100%)",
              maxHeight: "min(85vh, 900px)",
              display: "flex",
              flexDirection: "column",
              background: "#fff",
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid #e2e8f0",
                fontSize: 15,
                fontWeight: 1000,
                color: "#0f172a",
              }}
            >
              플래너 입력 프롬프트
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 12 }}>
              <pre
                style={{
                  margin: 0,
                  fontSize: 11.5,
                  lineHeight: 1.45,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  color: "#334155",
                }}
              >
                {plannerCombinedInputPreview.trim() || "표시할 프롬프트가 아직 없습니다."}
              </pre>
            </div>
            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  const t = plannerCombinedInputPreview.trim();
                  if (!t) {
                    showToast("복사할 내용이 없습니다.");
                    return;
                  }
                  const p = navigator.clipboard?.writeText(t);
                  if (p) {
                    void p
                      .then(() => showToast("클립보드에 복사했습니다."))
                      .catch(() => showToast("복사에 실패했습니다."));
                  } else {
                    showToast("이 환경에서는 클립보드 복사를 사용할 수 없습니다.");
                  }
                }}
                style={btnPrimary}
              >
                복사하기
              </button>
              <button type="button" onClick={() => setPlannerPromptModalOpen(false)} style={btnMuted}>
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cancelConfirmOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
          }}
          onClick={() => setCancelConfirmOpen(false)}
        >
          <div
            style={{
              width: "min(520px, 100%)",
              background: "#fff",
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              padding: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 14, fontWeight: 1000, color: "#0f172a" }}>자동 생성을 중단할까요?</div>
            <div style={{ marginTop: 8, fontSize: 12.5, color: "#475569", lineHeight: 1.55 }}>
              현재 진행 중인 Cursor/Git 작업은 이미 일부 반영되었을 수 있습니다.
              <br />
              중단하면 플랫폼은 다음 단계 진행을 멈춥니다.
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" onClick={() => setCancelConfirmOpen(false)} style={btnMuted}>
                계속 진행
              </button>
              <button
                type="button"
                onClick={() => {
                  const rid = latestRun?.id;
                  if (!rid) return;
                  void (async () => {
                    setProtoBusy(true);
                    try {
                      const r = await postPrototypeRunCancel(rid, { projectId, reason: "user_requested" });
                      if (r.success && r.data?.run) setLatestRun(r.data.run);
                      showToast("중단 요청을 기록했습니다.");
                      setCancelConfirmOpen(false);
                      void refreshLatestRun();
                    } finally {
                      setProtoBusy(false);
                    }
                  })();
                }}
                disabled={protoBusy || !latestRun?.id}
                style={btnPrimary}
              >
                중단
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Re-export alias for new name usage (same behavior).
export const PrototypeGenerationWorkspace = PrototypePreviewPanel;

const summaryChip: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#0f172a",
};

const card: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 14,
  background: "#fff",
};

const btn: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  fontSize: 12.5,
  fontWeight: 900,
  cursor: "pointer",
};

const btnPrimary: CSSProperties = {
  ...btn,
  border: "1px solid #0f766e",
  background: "#0f766e",
  color: "#fff",
};

const btnMuted: CSSProperties = {
  ...btn,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#0f172a",
};

const templateModeToggleWrap: CSSProperties = {
  display: "inline-flex",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#e2e8f0",
  padding: 3,
  gap: 3,
};

const templateModeToggleSeg: CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "none",
  fontSize: 12.5,
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const templateModeToggleActive: CSSProperties = {
  background: "#fff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
};

const templateModeToggleIdle: CSSProperties = {
  background: "transparent",
  color: "#64748b",
};

const selectStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontSize: 12.5,
  fontWeight: 800,
  color: "#0f172a",
};

const toastStyle: CSSProperties = {
  position: "fixed",
  bottom: 24,
  right: 24,
  zIndex: 60,
  padding: "10px 14px",
  borderRadius: 12,
  background: "#0f172a",
  color: "#fff",
  fontSize: 12.5,
  fontWeight: 800,
  maxWidth: 360,
  boxShadow: "0 12px 30px rgba(15,23,42,0.25)",
};
