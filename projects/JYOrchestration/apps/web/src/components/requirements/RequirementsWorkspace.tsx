"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Project } from "@/components/project-spec/types";
import type { RequirementsComposerTargetPickerItem } from "@/components/requirements/RequirementsComposerGpt";
import { RequirementsIdeationChatPanel } from "@/components/requirements/RequirementsIdeationChatPanel";
import { RequirementsDeliverableViewerModal } from "@/components/requirements/RequirementsDeliverableViewerModal";
import { RequirementsIdeationDocumentDrawers } from "@/components/requirements/RequirementsIdeationDocumentDrawers";
import { RequirementsOrganizeProposalWorkspaceOverlay } from "@/components/requirements/RequirementsOrganizeProposalWorkspaceOverlay";
import { RequirementsWorkspaceErrorBand } from "@/components/requirements/RequirementsWorkspaceErrorBand";
import { RequirementsWorkspaceTopChrome } from "@/components/requirements/RequirementsWorkspaceTopChrome";
import {
  requirementsWorkspaceMainRowStyle,
  requirementsWorkspaceShellStyle,
} from "@/components/requirements/requirementsWorkspaceLayoutStyles";
import { RequirementsMemberInviteModal } from "@/components/requirements/RequirementsMemberInviteModal";
import { WorkspaceParticipantsModal } from "@/components/workspace/WorkspaceParticipantsModal";
import { resolveParticipantContextKey, useWorkspaceParticipants } from "@/components/workspace/useWorkspaceParticipants";
import { useRequirementsServiceFlowDraft } from "@/components/requirements/workspace/useRequirementsServiceFlowDraft";
import { useRequirementsProjectLoad } from "@/components/requirements/workspace/useRequirementsProjectLoad";
import { useRequirementsHandleGenerateDeliverables } from "@/components/requirements/workspace/useRequirementsHandleGenerateDeliverables";
import { persistRequirementsIdeationUserTurnBeforeAi } from "@/components/requirements/workspace/persistRequirementsIdeationUserTurnBeforeAi";
import {
  runRequirementsIdeationAiAfterUserPersist,
  type IdeationPlannerTail,
} from "@/components/requirements/workspace/runRequirementsIdeationAiAfterUserPersist";
import {
  composeIdeationSendUserTurn,
  newIdeationSendTraceId,
} from "@/components/requirements/workspace/requirementsIdeationSendHelpers";
import { useRequirementsSpecWorkspacePersist } from "@/components/requirements/workspace/useRequirementsSpecWorkspacePersist";
import { useRequirementsWorkspaceToasts } from "@/components/requirements/workspace/useRequirementsWorkspaceToasts";
import { useWorkNoteComposerInsertControls } from "@/components/worknote/WorkNoteComposerInsertContext";
import { WorkspaceSuccessErrorSaveToastHost } from "@/components/workspace/WorkspaceSuccessErrorSaveToastHost";
import {
  buildConversationMarkdown,
  confirmResetConversation,
  downloadConversationMarkdownFile,
} from "@/lib/chat/conversationMarkdown";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import {
  IDEATION_UNIFIED_PROPOSAL_OUTPUT,
  markDeliverableAssetsConfirmed,
  type IdeationDeliverableType,
} from "@/lib/requirements/ideationDeliverables";
import { ideationChecklistComplete } from "@/lib/requirements/ideationChecklist";
import { filterIdeationConversationMessages, isServiceFlowWorkshopMessage } from "@/lib/requirements/serviceFlowConversation";
import {
  IDEATION_INTERVIEW_BOOTSTRAP_INTERNAL_TYPE,
  normalizeIdeationBootstrapDisplayMessage,
} from "@/lib/requirements/ideationInterviewBootstrap";
import {
  hasPreProjectPlanningSummaryMessage,
  isProjectSeededFromPreProjectChat,
  PRE_PROJECT_PLANNING_SUMMARY_INTERNAL_TYPE,
  buildOnboardingPlanningSummaryFlightKey,
  shouldRegeneratePlanningSummaryAfterConversationReset,
  shouldSeedPreProjectPlanningSummaryOnWorkspaceEntry,
  shouldSuppressInitialServiceFlowOnProjectEntry,
} from "@/lib/requirements/preProjectPlanningSummary";
import {
  safeBuildPreProjectInitialProposalSeed,
  type PreProjectInterviewSuggestionActionMeta,
} from "@/lib/requirements/preProjectSingleChatInitialProposal";
import {
  buildProductDefinitionIntroAiMessage,
  hasProductDefinitionIntroMessage,
} from "@/lib/requirements/productDefinitionChatService";
import {
  buildProductDefinitionUserMessage,
  postProductDefinitionChat,
} from "@/components/requirements/workspace/runProductDefinitionSend";
import {
  emptyProblemInterviewState,
  problemInterviewStateFromBootstrapSeedWire,
  problemInterviewStrictFilledCount,
  slotStrictlyFilled,
  type ProblemInterviewState,
} from "@/lib/requirements/problemInterview";
import {
  mergeRequirementsStateJson,
  parseRequirementsStateJson,
  type RequirementsPromptTimelineEntry,
  type RequirementsStateJson,
  type RequirementsServiceFlowV1,
} from "@/lib/requirements/requirementsStateJson";
import type { RequirementsSingleChatOrchestrationStateV1 } from "@/lib/requirements/singleChatOrchestrationTypes";
import { parseRequirementsSingleChatOrchestrationV1 } from "@/lib/requirements/singleChatOrchestrationStateWire";
import { hydrateServiceFlowStepsFromAlternativePayload } from "@/lib/requirements/serviceFlowAlternativeProposalPayload";
import {
  applyOrchestrationInvalidationsAfterFlowChange,
  buildServiceFlowStructureFingerprint,
} from "@/lib/requirements/requirementsOrchestrationInvalidation";
import {
  resolveAuthoritativeOrchestrationStage,
  workspaceStageFromOrchestrationStage,
} from "@/lib/requirements/requirementsOrchestrationRegistry";
import {
  buildServiceFlowApplySyncUserMessage,
  buildServiceFlowSlotSyncTimelineEntry,
  syncServiceFlowToOrchestrationSlots,
  type ServiceFlowOrchestrationSyncResult,
} from "@/lib/requirements/serviceFlowOrchestrationSync";
import { initialOrchestrationStateFromDefinitions } from "@/lib/requirements/singleChatOrchestrationSlots";
import {
  appendIdeationBootstrapPromptTimeline,
  appendIdeationBootstrapPromptTimelineBatch,
  buildIdeationBootstrapContextualFallbackQuestion,
  buildIdeationBootstrapFallbackPromptTrace,
  coerceBootstrapPromptTrace,
  coerceRequirementsPromptTimelineEntry,
} from "@/lib/requirements/requirementsIdeationBootstrapPromptTimeline";
import { extractOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { normalizeLlmInterviewSuggestions } from "@/lib/requirements/interviewSuggestionChips";
import { joinSuccessCriteriaAndNfr } from "@/lib/project/requirementsSuccessCriteriaSplit";
import { publishProjectRailParticipantCount } from "@/lib/layout/projectRailParticipants";
import { REQUIREMENTS_IDEATION_HTTP, requirementsAiConnectionUrl } from "@/lib/requirements/requirementsIdeationHttp";
import { IDEATION_AI_DISPLAY_NAME } from "@/lib/requirements/ideationAiDisplayName";
import type { ServiceDesignHarnessPayload } from "@/lib/service-design/serviceDesignTurnPayload";
import { pickWorkspaceAiHandoffMember } from "@/components/requirements/workspace/pickWorkspaceAiHandoffMember";
import { useRequirementsStageRouteRedirect } from "@/components/requirements/workspace/useRequirementsStageRouteRedirect";
import { patchSpecWorkspaceRequest } from "@/lib/project/specWorkspaceClient";
import {
  CODE_TASK_PROMPT_DRAFT_NOT_READY_MESSAGE,
  resolveCodeTaskPromptDraftForCopy,
} from "@/lib/prototype/resolveCodeTaskPromptDraftForCopy";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { parseCodeTaskPromptContextMapV1 } from "@/lib/prototype/codeTaskPromptContext";
import { writeClipboardText } from "@/lib/clipboard/writeClipboardText";
import type { SpecWorkspaceProjectPatchResponseBody } from "@/lib/types/specWorkspaceProjectPatch";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import { formatDialogueExcerpt } from "@/lib/requirements/requirementsWorkspaceHelpers";
import { detectOwnerHintFromText, speakerNameForOwner } from "@/lib/requirements/orchestrationSpeakerUi";
import {
  newChatMessage,
  parseRequirementsRoomState,
  patchRequirementsRoomConversationMessages,
  VIRTUAL_AI_PLANNER_ID,
  type RequirementsRoomStateV3,
} from "@/lib/project/requirementsRoomState";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { APP_FLOW_LAST_PROJECT_KEY, notifyAppFlowProjectContextRefresh } from "@/lib/workflow/appFlowModel";
import { buildConversationContentHtmlForWorkNoteSummary } from "@/lib/worknote/buildConversationContentHtmlForWorkNoteSummary";
import { postWorkNoteSummarize } from "@/lib/worknote/workNotesSummarizeApi";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import { sessionUserFromAuthMe, type AuthMeDataWire } from "@/lib/user/platformProfile";
import { postPlanningResetCascade } from "@/lib/requirements/planningResetCascadeClient";
import { PLANNING_RESET_CONVERSATION_CONFIRM_MESSAGE } from "@/lib/requirements/resetDerivedImplementationState";
import {
  buildRequirementsConversationResetStateJson,
  ideationDraftGateStatus,
  ideationSendDevLog,
  planningWorkspaceHasResettableContent,
  resolveWorkspaceDeliverableAssets,
  resolveWorkspaceProjectArtifacts,
  shouldSkipIdeationDuplicateAppend,
  IDEATION_DRAFT_MIN_FILLED_SLOTS,
  IDEATION_DRAFT_REQUIRED_SLOTS,
  shouldShowWorkspaceHubNotificationBadges,
  type MemberRow,
  type RequirementsWorkspaceStage,
  type SessionUser,
} from "@/lib/requirements/requirementsWorkspaceHelpers";
import { evaluateGenerationReadinessFromSlots } from "@/lib/requirements/singleChatSlotNextAction";
import { projectServiceFlowResultToSingleChatSlots } from "@/lib/requirements/singleChatSlotResultProjection";
import { RequirementsWorkspaceStageRenderer } from "@/components/requirements/RequirementsWorkspaceStageRenderer";
import { buildPlatformMemberActivityFromRequirementsMessages } from "@/lib/ai-member/buildPlatformMemberActivityFromRequirementsMessages";
import { extractHandoffSnippetFromRequirementsMessages } from "@/lib/ai-member/extractHandoffSnippetFromRequirementsMessages";
import { publishWorkspaceAiScreenHandoff } from "@/lib/ai-member/workspaceAiHandoff";
import { requirementsWorkspaceStageToScreenKey } from "@/lib/requirements/requirementsWorkspaceScreenBridge";
import { useFeaturePlanningSingleChatBridge } from "@/components/feature-planning/useFeaturePlanningSingleChatBridge";
import { useServiceFlowSingleChatBridge } from "@/components/service-flow/useServiceFlowSingleChatBridge";
import { AlternativeProposalCanvasOverlay } from "@/components/service-flow/AlternativeProposalCanvasOverlay";
import { resolveEnabledCatalogKeysForScreen } from "@/lib/workspace-ai/workspaceScreenKeys";
import type { WorkspaceAiGraphMemberWire } from "@/lib/workspace-ai/workspaceAiGraphWire";

type ConversationAiInsight = Readonly<{
  summary: string;
  requestType: string;
  priority: string;
  priorityReason?: string;
}>;
import {
  buildFeaturePlanningMirroredUserTurn,
  buildFeaturePlanningMirroredAiTurn,
  shouldSkipFeaturePlanningMirror,
  shouldSkipFeaturePlanningAiMirror,
} from "@/lib/service-design/serviceDesignSingleChatFeaturePlanningMirror";
import type { ServiceFlowQuickActionDispatch } from "@/components/service-flow/useServiceFlowWorkshopChat";
import {
  dispatchServiceFlowSingleChatSend,
  interviewSuggestionPickToLabel,
  interviewSuggestionPickToQuickAction,
  interviewSuggestionPickToRouterOverrides,
  interviewSuggestionPickToSlotAction,
  storeInterviewSuggestionPick,
  type InterviewSuggestionPickWire,
  type ServiceFlowSingleChatSendOptions,
} from "@/lib/service-design/serviceDesignSingleChatServiceFlowSend";
import { fetchGenerateProjectArtifact } from "@/lib/requirements/projectArtifactClient";
import { projectArtifactToDeliverableAsset } from "@/lib/requirements/projectArtifactViewer";
import type { ProjectArtifactType } from "@/lib/requirements/projectArtifactTypes";
import { generateFastPlanFromCurrentContext } from "@/lib/requirements/fastPlanGeneration";
import { buildFastPlanDraftProposalMessage } from "@/lib/requirements/fastPlanDraftChatMessage";
import {
  createFastPlanDraftPlatformTrigger,
  platformNextActionLabelsForInterviewSuggestions,
  runFastPlanDraftFlow,
  extractFastPlanDraftV1FromRunResult,
} from "@/lib/platform-orchestration";
import {
  composerPromptForFastPlanDraftSuggestion,
  normalizeFastPlanDraftChipLabel,
  resolveFastPlanDraftSuggestionAction,
} from "@/lib/requirements/fastPlanDraftSuggestionPick";
import {
  patchRequirementsStageForImplementationStart,
  QUICK_DESIGN_IMPLEMENTATION_READY_INTERNAL_TYPE,
} from "@/lib/requirements/quickDesignConfirmArtifacts";
import {
  buildPseudoImplementationPrepProgress,
  type ImplementationPrepProgressPhase,
  buildImplementationPrepCompletedSnapshot,
} from "@/lib/requirements/implementationPrepProgress";
import {
  IMPLEMENTATION_PREP_LOG_VIEW_CHIP_LABEL,
  removeImplementationPrepProgressMessages,
  shouldRefreshImplementationPrepProgressMessage,
  upsertImplementationPrepProgressMessage,
} from "@/lib/requirements/implementationPrepProgressChatMessage";
import { postQuickDesignConfirm } from "@/components/project-spec/apis/quickDesignConfirmApi";
import {
  buildImplementationCandidateItems,
  implementationCandidateLabelForKey,
  REFINE_ALL_IMPLEMENTATION_CANDIDATES_PROMPT,
  resolveImplementationCandidateGapKeys,
} from "@/lib/requirements/implementationCandidateLabels";
import {
  buildApplyImplementationCandidateRefineComposerPrompt,
  isImplementationCandidateRefineApplyResultCtaLabel,
  isImplementationCandidateRefineCtaLabel,
  resolveImplementationCandidateRefineCtaAction,
} from "@/lib/requirements/implementationCandidateRefineCta";
import {
  IMPLEMENTATION_CANDIDATE_REFINE_APPLY_RESULT_INTERNAL_TYPE,
  IMPLEMENTATION_CANDIDATE_REFINE_RESULT_INTERNAL_TYPE,
  type ImplementationCandidateRefineRequestWire,
} from "@/lib/requirements/implementationCandidateRefineRequest";
import {
  IMPLEMENTATION_STAGE_NAVIGATE_LABEL,
  IMPLEMENTATION_WORK_PLAN_DRAFT_GENERATE_LABEL,
  PLANNING_ENV_SETTINGS_LABEL,
  PLANNING_INFO_REFINE_LABEL,
} from "@/lib/requirements/implementationUxLabels";
import { ProjectExecutionEnvironmentModal } from "@/components/project/ProjectExecutionEnvironmentModal";
import { buildApplyImplementationCandidateRefinePatches } from "@/lib/requirements/implementationCandidateRefineResult";
import type { ImplementationSeedGapKey } from "@/lib/requirements/implementationSeed";
import { ImplementationCandidateRefineDrawer } from "@/components/requirements/ImplementationCandidateRefineDrawer";
import { buildSlotCandidatePatchesFromFastPlanDrafts } from "@/lib/requirements/fastPlanDraftSlotPatch";
import { buildQuickDesignAreaShortfallWarnings } from "@/lib/requirements/quickDesignSlotArea";
import {
  buildFastPlanArtifactCreatedChatMessage,
  buildFastPlanArtifactCreatedTimelineEntry,
  buildFastPlanDraftGenerationHandoffTimeline,
  buildFastPlanDraftSuggestionPickedTimelineEntry,
  buildFastPlanGenerationBlockedTimelineEntry,
  buildFastPlanGenerationFailedTimelineEntry,
  buildGenerationReadinessCheckedTimelineEntry,
  evaluateFastPlanGenerationHandoffReadiness,
  FAST_PLAN_DRAFT_ACTION_GENERATE,
  resolveFastPlanArtifactFollowUpAction,
  isFastPlanArtifactFollowUpLabel,
  findLatestFastPlanArtifactIdFromMessages,
  quickDesignArtifactIdsFromMessageMeta,
  resolveLatestPlanningDeliverableAssetId,
} from "@/lib/requirements/fastPlanDraftGenerationHandoff";
import {
  PLANNING_IMPLEMENTATION_SEED_CHECK_CHIP,
  PLANNING_IMPLEMENTATION_SEED_GENERATE_CHIP,
  PLANNING_IMPLEMENTATION_SEED_SUPPLEMENT_CHIP,
} from "@/lib/requirements/implementationSeed";
import {
  buildPlanningImplementationSeedCheckResult,
  buildPlanningImplementationSeedGenerateCandidateResult,
  buildPlanningImplementationSeedSupplementResult,
} from "@/lib/requirements/planningImplementationSeedActions";
import { evaluateImplementationStartReadiness } from "@/lib/requirements/planningReadinessGate";
import {
  buildQuickDesignDraftCreatedTimelineEntry,
  buildQuickDesignRequestedTimelineEntry,
  buildQuickDesignResultMessage,
  buildQuickDesignSlotsPatchedTimelineEntry,
  buildPlanningArtifactViewRequestedTimelineEntry,
  QUICK_DESIGN_LABEL,
} from "@/lib/requirements/quickDesignLabels";
import { WorkspacePlusMenuItems } from "@/components/workspace/WorkspacePlusMenu";
import { RequirementsCanvasHubDrawer } from "@/components/requirements/RequirementsCanvasHubDrawer";
import { RequirementsArtifactHubDrawer } from "@/components/requirements/RequirementsArtifactHubDrawer";
import {
  buildProjectCanvasHubCatalog,
  type CanvasArtifactType,
  type ProjectCanvasArtifact,
} from "@/lib/requirements/projectCanvasHub";
import {
  buildProjectArtifactHubCatalog,
  countCompletedArtifactHubEntries,
  type ProjectArtifactHubEntry,
} from "@/lib/requirements/projectArtifactHub";
import { RecommendationEvidenceDrawer } from "@/components/recommendation/RecommendationEvidenceDrawer";
import { useProjectRecommendationEvidence } from "@/lib/recommendation/useProjectRecommendationEvidence";
import { buildWorkspacePlanningOrchestrationView } from "@/lib/requirements/buildWorkspacePlanningOrchestrationView";
import { buildPlanningDataSlotsStatePatch, resolvePlanningRepositoryName } from "@/lib/planning/planningDataSlotsStatePatch";
import {
  buildDynamicServicePlanningSlotDefinitions,
  hashSlotDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { resolveWorkspaceSingleChatOrchestration } from "@/lib/requirements/requirementsWorkspaceHelpers";
import { compactRequirementsIntentOrchestration } from "@/lib/requirements/requirementsOrchestrationCompaction";
import { buildOrchestrationRecoveryTimelineEntry } from "@/lib/requirements/requirementsOrchestrationTimelineView";
import { ServiceFlowStateCanvasOverlay } from "@/components/service-flow/ServiceFlowStateCanvasOverlay";
import { BaselineFlowCanvasOverlay } from "@/components/service-flow/BaselineFlowCanvasOverlay";
import { FeatureDefinitionCanvasOverlay } from "@/components/feature-planning/FeatureDefinitionCanvasOverlay";
import { applySampleDataSpecToPrototypeReadiness } from "@/lib/featurePlanning/featurePlanningSampleDataSync";
import type { SampleDataSpecV1 } from "@/lib/featurePlanning/sampleDataSpecV1";
import { FeatureDetailCanvasOverlay } from "@/components/feature-planning/FeatureDetailCanvasOverlay";
import { FeatureDetailEditDrawer } from "@/components/feature-planning/FeatureDetailEditDrawer";
import { mergeFeatureDetailReadinessPercent, projectFeatureDetailMetrics } from "@/lib/requirements/featureDetailSlots";
import { useFeatureDetailEditing } from "@/components/requirements/workspace/useFeatureDetailEditing";
import { ServiceFlowActorEditDrawer } from "@/components/service-flow/ServiceFlowActorEditDrawer";
import { ServiceFlowActorAssignmentDrawer } from "@/components/service-flow/ServiceFlowActorAssignmentDrawer";
import {
  appendCandidateActorToFlow,
  nextActorEditingPhase,
  type ActorEditingPhase,
  type ServiceFlowActorEditDraft,
} from "@/lib/requirements/serviceFlowActorEditing";
import {
  applyAssignmentEditToFlow,
  type ServiceFlowAssignmentEditDraft,
} from "@/lib/requirements/serviceFlowActorAssignment";
import { rebuildOrchestrationProjectionWithFallback } from "@/lib/requirements/serviceFlowOrchestrationProjection";


export function RequirementsWorkspace({
  initialProjectId,
  initialWorkflowNotice,
}: {
  readonly initialProjectId: string;
  readonly initialWorkflowNotice: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showScreenLabels = useShowScreenLabels();
  useRequirementsStageRouteRedirect(initialProjectId);

  const autoOpenPrototypePreview = useMemo(() => {
    const v = String(searchParams?.get("preview") ?? "").trim();
    return v === "1";
  }, [searchParams]);

  const [resolvedProjectId, setResolvedProjectId] = useState(() => initialProjectId.trim());
  const [project, setProject] = useState<Project | null>(null);
  const [executionEnvironmentModalOpen, setExecutionEnvironmentModalOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const membersRef = useRef(members);
  membersRef.current = members;
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [room, setRoom] = useState<RequirementsRoomStateV3>(() => parseRequirementsRoomState(null));
  const [conversationStatus, setConversationStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [loadedConversationProjectId, setLoadedConversationProjectId] = useState<string>("");
  const [goals, setGoals] = useState("");
  const [scopeIn, setScopeIn] = useState("");
  const [scopeOut, setScopeOut] = useState("");
  const [targetUsers, setTargetUsers] = useState("");
  const [success, setSuccess] = useState("");
  const [nfr, setNfr] = useState("");
  const [openIssues, setOpenIssues] = useState("");
  const [priorityFeatures, setPriorityFeatures] = useState("");
  const [input, setInput] = useState("");
  const composerTextAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [promptDrawerOpen, setPromptDrawerOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [resetConversationBusy, setResetConversationBusy] = useState(false);
  const [conversationResetNonce, setConversationResetNonce] = useState(0);
  const [fetchNonce, setFetchNonce] = useState(0);
  const [workspaceAiGraph, setWorkspaceAiGraph] = useState<WorkspaceAiGraphMemberWire[] | null>(null);
  const [aiConnPhase, setAiConnPhase] = useState<"checking" | "ready" | "no_key" | "error">("checking");
  const [aiConnDetail, setAiConnDetail] = useState<string | undefined>();
  const [aiInvokePending, setAiInvokePending] = useState(false);
  const [typingIndicatorSpeakerLine, setTypingIndicatorSpeakerLine] = useState<string | null>(null);
  const [typingIndicatorResolvedSpeakerSource, setTypingIndicatorResolvedSpeakerSource] = useState<string | null>(null);
  const [aiLastInvoke, setAiLastInvoke] = useState<{ ok: boolean; at: string; detail?: string } | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; preview: string } | null>(null);
  const [draftDrawerOpen, setDraftDrawerOpen] = useState(false);
  const [deliverableGenerateBusy, setDeliverableGenerateBusy] = useState(false);
  const [artifactGenerateBusy, setArtifactGenerateBusy] = useState(false);
  const [deliverableViewerOpen, setDeliverableViewerOpen] = useState(false);
  const [canvasHubOpen, setCanvasHubOpen] = useState(false);
  const [artifactHubOpen, setArtifactHubOpen] = useState(false);
  const [activeCanvasView, setActiveCanvasView] = useState<CanvasArtifactType | null>(null);
  const [actorEditOpen, setActorEditOpen] = useState(false);
  const [actorEditPhase, setActorEditPhase] = useState<ActorEditingPhase>("IDLE");
  const [actorEditBusy, setActorEditBusy] = useState(false);
  const [assignmentDrawerOpen, setAssignmentDrawerOpen] = useState(false);
  const [assignmentStepId, setAssignmentStepId] = useState<string | null>(null);
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const [implementationRefineDrawerOpen, setImplementationRefineDrawerOpen] = useState(false);
  const [deliverableViewerIds, setDeliverableViewerIds] = useState<string[]>([]);
  const [deliverableViewerFocusId, setDeliverableViewerFocusId] = useState<string | null>(null);
  const [, setLastSavedAt] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [plannerTypePickerOpen, setPlannerTypePickerOpen] = useState(false);
  const [organizeState, setOrganizeState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [organizeError, setOrganizeError] = useState<string | null>(null);
  const [organizedAt, setOrganizedAt] = useState<string | null>(null);
  const [serviceFlowDraftBusy, setServiceFlowDraftBusy] = useState(false);

  const stateJsonRef = useRef<RequirementsStateJson>({});
  const draftDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 인터뷰 자동 시작 이펙트 중복 실행(React StrictMode 등) 방지 */
  const ideationBootstrapFlightRef = useRef<string | null>(null);
  const productDefinitionIntroFlightRef = useRef<string | null>(null);
  const consumedResetSeedNonceRef = useRef<number | null>(null);
  /** 아이디어 구체화: spec 단계 기본 AI(planner) 보강 요청 중복 방지 */
  const ideationEnsurePlannerInFlightRef = useRef(false);
  /** 전송 핸들러 동시 실행(연타·Enter 이중) 방지 — React `busy`보다 먼저 잠금 */
  const requirementsSendFlightRef = useRef(false);
  const sendDraftRestoreRef = useRef<string | null>(null);
  /** 인터뷰 추천 칩 선택 후 전송 시 analyzer에 한 번 전달 */
  const interviewSuggestionPickRef = useRef<InterviewSuggestionPickWire | null>(null);
  const implementationCandidateRefineRequestRef = useRef<ImplementationCandidateRefineRequestWire | null>(
    null,
  );
  const [implementationRefineFilterNeedsConfirmationOnly, setImplementationRefineFilterNeedsConfirmationOnly] =
    useState(false);

  const [serviceFlow, setServiceFlow] = useState<RequirementsServiceFlowV1 | null>(null);
  const serviceFlowSendRef = useRef<
    | ((
        payload: ServiceDesignHarnessPayload,
        text: string,
        quickAction?: ServiceFlowQuickActionDispatch | null,
        opts?: ServiceFlowSingleChatSendOptions,
      ) => void | Promise<void>)
    | null
  >(null);
  const featurePlanningSendRef = useRef<((payload: ServiceDesignHarnessPayload, text: string) => void | Promise<void>) | null>(null);
  const serviceFlowStructureFingerprintRef = useRef<string | null>(null);

  const activeStage = useMemo((): RequirementsWorkspaceStage => {
    const persisted = parseRequirementsStateJson(project?.requirementsStateJson);
    const local = stateJsonRef.current;
    const st = (local && Object.keys(local).length ? local : persisted) as RequirementsStateJson;
    return workspaceStageFromOrchestrationStage(resolveAuthoritativeOrchestrationStage(st));
  }, [project?.requirementsStateJson, fetchNonce]);
  const inIdeationStage = activeStage === "ideation";
  const inProductDefinitionStage = activeStage === "product-definition";
  const participantAiMemberId = useMemo(() => resolveParticipantContextKey(activeStage), [activeStage]);
  const ideationScreenCatalogIds = useMemo(() => {
    if (!workspaceAiGraph) return undefined;
    return resolveEnabledCatalogKeysForScreen(workspaceAiGraph, "requirements_ideation");
  }, [workspaceAiGraph]);
  const serviceFlowScreenCatalogIds = useMemo(() => {
    if (!workspaceAiGraph) return undefined;
    return resolveEnabledCatalogKeysForScreen(workspaceAiGraph, "requirements_service_flow");
  }, [workspaceAiGraph]);
  const featurePlanningScreenCatalogIds = useMemo(() => {
    if (!workspaceAiGraph) return undefined;
    return resolveEnabledCatalogKeysForScreen(workspaceAiGraph, "feature_planning");
  }, [workspaceAiGraph]);
  const servicePlanningScreenCatalogIds = useMemo(() => {
    if (!workspaceAiGraph) return undefined;
    const out = new Set<WorkspaceAiMemberId>();
    for (const k of ["requirements_ideation", "requirements_service_flow", "feature_planning"] as const) {
      for (const id of resolveEnabledCatalogKeysForScreen(workspaceAiGraph, k)) out.add(id);
    }
    return [...out];
  }, [workspaceAiGraph]);
  const requirementsWorkspacePrevStageRef = useRef<RequirementsWorkspaceStage>(activeStage);

  const { successToast, errorToast, showSuccessToast, showErrorToast } = useRequirementsWorkspaceToasts();

  useEffect(() => {
    if (inIdeationStage) return;
    setSummaryModalOpen(false);
    setPromptDrawerOpen(false);
    setDraftDrawerOpen(false);
    setPlannerTypePickerOpen(false);
    setReplyTo(null);
    setOrganizeState("idle");
    setOrganizeError(null);
    setError(null);
  }, [inIdeationStage]);

  useEffect(() => {
    if (!autoOpenPrototypePreview) return;
    if (activeStage !== "service-flow") return;
    const pid = resolvedProjectId.trim();
    if (!pid) return;
    const sp = new URLSearchParams(searchParams?.toString() ?? "");
    sp.delete("preview");
    const next = `/requirements?${sp.toString()}`;
    // Remove preview=1 after first open to prevent re-opening on every render/back.
    router.replace(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run when autoOpenPrototypePreview hits
  }, [autoOpenPrototypePreview, activeStage, resolvedProjectId]);

  useEffect(() => {
    setResolvedProjectId(initialProjectId.trim());
  }, [initialProjectId]);

  useEffect(() => {
    if (resolvedProjectId) return;
    try {
      const s = sessionStorage.getItem(APP_FLOW_LAST_PROJECT_KEY);
      const sid = String(s ?? "").trim();
      if (sid) setResolvedProjectId(sid);
    } catch {
      /* ignore */
    }
  }, [resolvedProjectId]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await credentialsIncludeFetch("/api/auth/me");
        const json = (await res.json()) as { success?: boolean; data?: AuthMeDataWire | null };
        if (res.ok && json.success && json.data && String(json.data.id ?? "").trim()) {
          setSessionUser(sessionUserFromAuthMe(json.data));
        } else setSessionUser(null);
      } catch {
        setSessionUser(null);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setAiConnPhase("checking");
      setAiConnDetail(undefined);
      try {
        const res = await credentialsIncludeFetch(requirementsAiConnectionUrl(resolvedProjectId));
        const json = (await res.json()) as {
          success?: boolean;
          message?: string;
          data?: { connected?: boolean; code?: string; message?: string; checkedAt?: string };
        };
        if (cancelled) return;
        if (!res.ok || json.success === false) {
          setAiConnPhase("error");
          setAiConnDetail(json.message || `HTTP ${res.status}`);
          return;
        }
        const d = json.data;
        if (!d) {
          setAiConnPhase("error");
          setAiConnDetail("응답 형식 오류");
          return;
        }
        if (d.connected) {
          setAiConnPhase("ready");
          setAiConnDetail(undefined);
        } else if (d.code === "NO_KEY") {
          setAiConnPhase("no_key");
          setAiConnDetail(d.message);
        } else {
          setAiConnPhase("error");
          setAiConnDetail(d.message);
        }
      } catch {
        if (!cancelled) {
          setAiConnPhase("error");
          setAiConnDetail("네트워크 오류");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedProjectId]);

  const reloadMembers = useCallback(async () => {
    const pid = resolvedProjectId.trim();
    if (!pid) return;
    const res = await credentialsIncludeFetch(`/api/project/members?projectId=${encodeURIComponent(pid)}`);
    const json = (await res.json()) as { success?: boolean; data?: MemberRow[] };
    if (!res.ok || !json.success || !Array.isArray(json.data)) {
      setMembers([]);
      return;
    }
    setMembers(json.data);
  }, [resolvedProjectId]);

  useEffect(() => {
    const pid = resolvedProjectId.trim();
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
  }, [resolvedProjectId, fetchNonce]);

  useEffect(() => {
    ideationEnsurePlannerInFlightRef.current = false;
  }, [resolvedProjectId]);

  useEffect(() => {
    if (!inIdeationStage || conversationStatus !== "loaded") return;
    const pid = resolvedProjectId.trim();
    if (!pid || !project?.ownerUserId || !sessionUser?.id || sessionUser.id !== project.ownerUserId) return;

    const hasSpecPlanner = members.some(
      (m) => m.memberType === "AI" && m.aiOrchestrationRole === "planner" && m.orchestrationStage === "spec"
    );
    if (hasSpecPlanner) return;
    if (ideationEnsurePlannerInFlightRef.current) return;

    ideationEnsurePlannerInFlightRef.current = true;
    void (async () => {
      try {
        const res = await credentialsIncludeFetch("/api/project/members/ensure-default-planner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: pid }),
        });
        const json = (await res.json()) as { success?: boolean; message?: string };
        if (res.ok && json.success) {
          await reloadMembers();
        }
      } finally {
        ideationEnsurePlannerInFlightRef.current = false;
      }
    })();
  }, [
    inIdeationStage,
    conversationStatus,
    resolvedProjectId,
    project?.ownerUserId,
    sessionUser?.id,
    members,
    reloadMembers,
  ]);

  const aiPlannerStatusLabel = useMemo(() => {
    if (aiInvokePending) return "응답 대기 중(OpenAI 호출 중)";
    if (aiConnPhase === "checking") return "연결 확인 중…";
    if (aiConnPhase === "no_key") return "연결 확인 필요(API 키 없음)";
    if (aiConnPhase === "error") {
      const d = (aiConnDetail ?? "").trim();
      return d ? `연결 실패: ${d.slice(0, 72)}${d.length > 72 ? "…" : ""}` : "연결 실패";
    }
    if (aiConnPhase === "ready") {
      if (aiLastInvoke && !aiLastInvoke.ok) return "연결됨 · 마지막 호출 실패";
      if (aiLastInvoke?.ok) return "연결됨 · 마지막 응답 성공";
      return "연결됨 · 호출 전";
    }
    return "대기";
  }, [aiConnPhase, aiConnDetail, aiInvokePending, aiLastInvoke]);

  const conversation = room.requirementsConversation;
  const conversationMessages = conversation.messages;
  const roomRef = useRef(room);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);
  const ideationConversationOnly = useMemo(
    () => filterIdeationConversationMessages(conversationMessages),
    [conversationMessages],
  );
  const serviceFlowWorkshopPersisted = useMemo(
    () => conversationMessages.filter(isServiceFlowWorkshopMessage),
    [conversationMessages],
  );

  const ideationParticipantHumanMemberIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of ideationConversationOnly) {
      if (m.role !== "human") continue;
      const id = String(m.speakerId ?? "").trim();
      if (id) ids.add(id);
    }
    return [...ids];
  }, [ideationConversationOnly]);

  const platformMemberActivity = useMemo(
    () => buildPlatformMemberActivityFromRequirementsMessages(ideationConversationOnly, serviceFlowWorkshopPersisted),
    [ideationConversationOnly, serviceFlowWorkshopPersisted],
  );

  const { participants, participantBadgeCount } = useWorkspaceParticipants({
    members,
    sessionUser,
    activeStage,
    aiPlannerStatusLabel,
    participantContextKeys: inIdeationStage
      ? ideationScreenCatalogIds
      : activeStage === "feature-planning"
        ? featurePlanningScreenCatalogIds
        : serviceFlowScreenCatalogIds,
    participantContextKey: participantAiMemberId,
    platformMemberActivity,
  });

  const servicePlanningParticipantContextKeys = useMemo(() => {
    if (!workspaceAiGraph) return null;
    const out = new Set<WorkspaceAiMemberId>();
    const keys: readonly ("requirements_ideation" | "requirements_service_flow" | "feature_planning")[] = [
      "requirements_ideation",
      "requirements_service_flow",
      "feature_planning",
    ];
    for (const k of keys) {
      for (const id of resolveEnabledCatalogKeysForScreen(workspaceAiGraph, k)) out.add(id);
    }
    return [...out];
  }, [workspaceAiGraph]);

  const { participants: servicePlanningParticipants } = useWorkspaceParticipants({
    members,
    sessionUser,
    activeStage,
    aiPlannerStatusLabel,
    participantContextKeys: servicePlanningParticipantContextKeys ?? undefined,
    participantContextKey: participantAiMemberId,
    platformMemberActivity,
  });

  const servicePlanningRailParticipantCount = useMemo(() => {
    // 좌측 레일 "서비스 기획(requirements)" 배지: 서비스 기획 절차(3 화면)의 참여 AI를 합산(중복 제거) + HUMAN(세션 사용자 포함) 합계.
    const humanUserIdSet = new Set<string>();
    for (const m of members) {
      if (m.memberType !== "HUMAN") continue;
      const uid = String(m.userId ?? "").trim();
      if (uid) humanUserIdSet.add(uid);
    }
    const sid = String(sessionUser?.id ?? "").trim();
    if (sid) humanUserIdSet.add(sid);

    const aiSet = new Set<string>();
    if (workspaceAiGraph) {
      const keys: readonly ("requirements_ideation" | "requirements_service_flow" | "feature_planning")[] = [
        "requirements_ideation",
        "requirements_service_flow",
        "feature_planning",
      ];
      for (const k of keys) {
        const ids = resolveEnabledCatalogKeysForScreen(workspaceAiGraph, k);
        for (const id of ids) aiSet.add(id);
      }
    } else {
      // 그래프 로드 전: 현재 화면 참여자 수로만 표시(추후 업데이트됨).
      return participantBadgeCount;
    }
    return Math.max(0, humanUserIdSet.size + aiSet.size);
  }, [members, sessionUser?.id, workspaceAiGraph, participantBadgeCount]);

  // 현재 단계의 참여 멤버 수를 프로젝트 레일 배지로 올립니다.
  useEffect(() => {
    const pid = resolvedProjectId.trim();
    if (!pid) return;
    const key =
      inIdeationStage ? "requirements" : activeStage === "feature-planning" ? "features" : "service_flow";
    const count = key === "requirements" ? servicePlanningRailParticipantCount : participantBadgeCount;
    publishProjectRailParticipantCount(pid, key, count);
  }, [inIdeationStage, activeStage, participantBadgeCount, resolvedProjectId, servicePlanningRailParticipantCount]);

  useEffect(() => {
    const pid = resolvedProjectId.trim();
    const prev = requirementsWorkspacePrevStageRef.current;
    if (prev !== activeStage && pid) {
      const graphRows = workspaceAiGraph ?? [];
      const fromIds = resolveEnabledCatalogKeysForScreen(graphRows, requirementsWorkspaceStageToScreenKey(prev));
      const toIds = resolveEnabledCatalogKeysForScreen(graphRows, requirementsWorkspaceStageToScreenKey(activeStage));
      const fromKey = pickWorkspaceAiHandoffMember(prev, fromIds);
      const toKey = pickWorkspaceAiHandoffMember(activeStage, toIds);
      if (fromKey !== toKey) {
        const snippet = extractHandoffSnippetFromRequirementsMessages(
          prev,
          roomRef.current.requirementsConversation.messages
        );
        if (snippet.trim()) {
          publishWorkspaceAiScreenHandoff(pid, {
            targetMemberId: toKey,
            fromMemberId: fromKey,
            snippet: snippet.trim(),
          });
        }
      }
    }
    requirementsWorkspacePrevStageRef.current = activeStage;
  }, [activeStage, resolvedProjectId, workspaceAiGraph]);

  const draftDoc = room.requirementsDraft ?? null;

  useEffect(() => {
    if (!draftDoc) setDraftDrawerOpen(false);
  }, [draftDoc]);

  const onboardingKey = useMemo(() => (resolvedProjectId.trim() ? `pid:${resolvedProjectId.trim()}` : "no-pid"), [resolvedProjectId]);
  const [onboardingAppliedKey, setOnboardingAppliedKey] = useState<string | null>(null);

  const ideationSlice = useMemo(
    () => ({ goals, targetUsers, success, nfr }),
    [goals, targetUsers, success, nfr]
  );
  const ideationComplete = useMemo(() => ideationChecklistComplete(ideationSlice), [ideationSlice]);

  const persistedPromptState = useMemo(
    () => parseRequirementsStateJson(project?.requirementsStateJson),
    [project?.requirementsStateJson]
  );
  const [promptTimelineUi, setPromptTimelineUi] = useState<RequirementsPromptTimelineEntry[] | null>(null);

  useEffect(() => {
    // Drive the prompt timeline drawer from a React state so it updates immediately
    // when we append bootstrap/fallback traces (without waiting for project JSON refresh).
    setPromptTimelineUi((persistedPromptState.promptTimeline ?? null) as RequirementsPromptTimelineEntry[] | null);
  }, [persistedPromptState.promptTimeline]);

  const problemInterviewState = useMemo(
    () => persistedPromptState.problemInterview ?? null,
    [persistedPromptState.problemInterview]
  );

  const problemInterviewStrictFilled = useMemo(
    () => problemInterviewStrictFilledCount(problemInterviewState),
    [problemInterviewState]
  );
  const authoritativeOrchestrationStage = useMemo(() => {
    const st = (stateJsonRef.current && Object.keys(stateJsonRef.current).length ?
        stateJsonRef.current
      : parseRequirementsStateJson(project?.requirementsStateJson)) as RequirementsStateJson;
    return resolveAuthoritativeOrchestrationStage(st);
  }, [project?.requirementsStateJson, fetchNonce, persistedPromptState]);

  const featureDetailMetrics = useMemo(() => {
    const st = (stateJsonRef.current && Object.keys(stateJsonRef.current).length ?
        stateJsonRef.current
      : parseRequirementsStateJson(project?.requirementsStateJson)) as RequirementsStateJson;
    return projectFeatureDetailMetrics(st.featureDetailSlotsV1);
  }, [project?.requirementsStateJson, fetchNonce, persistedPromptState]);

  /**
   * 산출물 뷰어는 "채팅 카드가 가리키는 assetId"와 동일한 소스를 사용해야 합니다.
   * - 저장 직후(서버 응답 전)에는 `project.requirementsStateJson`이 아직 갱신되지 않을 수 있으므로
   *   `stateJsonRef.current.deliverableAssets`를 1차 소스로 사용합니다.
   * - 초기 로드/새로고침 등 `stateJsonRef`가 비어 있을 때만 project JSON을 폴백으로 사용합니다.
   */
  const deliverableAssetsFromProject = useMemo(() => {
    return resolveWorkspaceDeliverableAssets({
      localState: stateJsonRef.current,
      persisted: persistedPromptState.deliverableAssets,
    });
  }, [
    persistedPromptState.deliverableAssets,
    project?.requirementsStateJson,
    saveState,
    fetchNonce,
    room.requirementsConversation.messages.length,
    conversationResetNonce,
  ]);

  const projectArtifactsFromState = useMemo(() => {
    return resolveWorkspaceProjectArtifacts({
      localState: stateJsonRef.current,
      persisted: persistedPromptState.projectArtifacts,
    });
  }, [
    persistedPromptState.projectArtifacts,
    project?.requirementsStateJson,
    saveState,
    fetchNonce,
    conversationResetNonce,
  ]);

  const canvasHubCatalog = useMemo(() => {
    const st: RequirementsStateJson = {
      ...persistedPromptState,
      ...stateJsonRef.current,
      serviceFlowV1: serviceFlow ?? stateJsonRef.current.serviceFlowV1 ?? persistedPromptState.serviceFlowV1 ?? null,
      featurePlanningSlotsV1:
        stateJsonRef.current.featurePlanningSlotsV1 ?? persistedPromptState.featurePlanningSlotsV1 ?? null,
      featureDetailSlotsV1:
        stateJsonRef.current.featureDetailSlotsV1 ?? persistedPromptState.featureDetailSlotsV1 ?? null,
    };
    return buildProjectCanvasHubCatalog({
      state: st,
      serviceFlow: serviceFlow ?? st.serviceFlowV1 ?? null,
    });
  }, [persistedPromptState, serviceFlow, saveState, fetchNonce, project?.requirementsStateJson, conversationResetNonce]);

  const workspaceEvidenceState = useMemo((): RequirementsStateJson => {
    return {
      ...persistedPromptState,
      ...stateJsonRef.current,
      projectArtifacts: [...projectArtifactsFromState],
    };
  }, [
    persistedPromptState,
    projectArtifactsFromState,
    saveState,
    fetchNonce,
    project?.requirementsStateJson,
    conversationResetNonce,
  ]);

  const workspacePlanningView = useMemo(() => {
    const mergedState: RequirementsStateJson = {
      ...persistedPromptState,
      ...stateJsonRef.current,
      singleChatOrchestrationV1:
        stateJsonRef.current.singleChatOrchestrationV1 ?? persistedPromptState.singleChatOrchestrationV1,
      projectArtifacts: [...projectArtifactsFromState],
    };
    return buildWorkspacePlanningOrchestrationView({
      state: mergedState,
      projectId: resolvedProjectId,
      projectName: project?.name ?? "",
      projectDescription: project?.description ?? "",
      projectType: project?.projectType ?? null,
      servicePlanningAgentCatalogKeys: servicePlanningScreenCatalogIds ?? null,
      deliverableAssets: deliverableAssetsFromProject,
      projectArtifacts: projectArtifactsFromState,
      orchestrationProjectionState: {
        ...mergedState,
        requirementsIntentOrchestrationV1:
          stateJsonRef.current.requirementsIntentOrchestrationV1 ??
          persistedPromptState.requirementsIntentOrchestrationV1,
      },
    });
  }, [
    persistedPromptState,
    deliverableAssetsFromProject,
    projectArtifactsFromState,
    resolvedProjectId,
    project?.name,
    project?.description,
    project?.projectType,
    servicePlanningScreenCatalogIds,
    saveState,
    fetchNonce,
    conversationResetNonce,
  ]);

  const slotDefsForProgress = workspacePlanningView.slotDefs;
  const orchestrationSlotDefsHash = workspacePlanningView.slotDefsHash;
  const orchestrationAlignedState = workspacePlanningView.orchestrationAlignedState;
  const planningResetEligibilityState = useMemo((): RequirementsStateJson => {
    return {
      ...workspaceEvidenceState,
      deliverableAssets: [...deliverableAssetsFromProject],
      serviceFlowV1:
        serviceFlow ?? workspaceEvidenceState.serviceFlowV1 ?? null,
      singleChatOrchestrationV1:
        orchestrationAlignedState ?? workspaceEvidenceState.singleChatOrchestrationV1 ?? null,
    };
  }, [
    workspaceEvidenceState,
    deliverableAssetsFromProject,
    serviceFlow,
    orchestrationAlignedState,
  ]);
  const orchestrationUiState = workspacePlanningView.orchestrationUiState;
  const orchestrationConfirmedMetrics = workspacePlanningView.orchestrationConfirmedMetrics;
  const orchestrationWeightedMetrics = workspacePlanningView.orchestrationWeightedMetrics;
  const orchestrationStatusCounts = workspacePlanningView.orchestrationStatusCounts;
  const orchestrationSlotSectionsForUi = workspacePlanningView.orchestrationSlotSections;
  const planningArtifactHubView = workspacePlanningView.planningArtifactHub.view;
  const artifactHubOrchestration = workspacePlanningView.planningArtifactHub.orchestration;
  const orchestrationUi = workspacePlanningView.orchestrationUi;
  const deliverableViewerAssetIds = workspacePlanningView.deliverableViewerAssetIds;

  const proposalReadinessPercentVal = useMemo(() => {
    return mergeFeatureDetailReadinessPercent({
      orchestrationPercent: orchestrationWeightedMetrics.percent,
      stage: authoritativeOrchestrationStage,
      metrics: featureDetailMetrics,
    });
  }, [orchestrationWeightedMetrics.percent, authoritativeOrchestrationStage, featureDetailMetrics]);

  const showWorkspaceHubBadges = useMemo(
    () =>
      shouldShowWorkspaceHubNotificationBadges({
        readinessPercent: proposalReadinessPercentVal,
        statusCounts: orchestrationStatusCounts,
      }),
    [proposalReadinessPercentVal, orchestrationStatusCounts],
  );

  const problemInterviewCovered = orchestrationConfirmedMetrics.confirmed;
  const progressSlotTotal = orchestrationConfirmedMetrics.total;
  const nextNeededSlot = null;
  const remainingQuestionsEstimate = Math.max(
    0,
    Math.ceil(orchestrationWeightedMetrics.total - orchestrationWeightedMetrics.weightedScore),
  );

  const {
    open: recommendationPanelOpen,
    items: recommendationEvidenceItems,
    close: closeRecommendationPanel,
  } = useProjectRecommendationEvidence({
    projectId: resolvedProjectId,
    requirementsStateJson: workspaceEvidenceState,
    messages: conversationMessages,
    projectArtifacts: workspaceEvidenceState.projectArtifacts ?? [],
    projectDescription: project?.description ?? "",
  });

  const artifactHubCatalog = planningArtifactHubView.entries;
  const artifactHubCompletedCount = planningArtifactHubView.tabCounts.all.created;

  const deliverableViewerAssets = useMemo(() => {
    const pid = resolvedProjectId.trim();
    const fromDeliverables = deliverableAssetsFromProject.filter((a) => deliverableViewerIds.includes(a.id));
    const knownIds = new Set(fromDeliverables.map((a) => a.id));
    const projectArtifacts = projectArtifactsFromState;
    const extras = deliverableViewerIds.flatMap((id) => {
      if (knownIds.has(id)) return [];
      const artifact = projectArtifacts.find((a) => a.id === id);
      if (!artifact || !pid) return [];
      return [projectArtifactToDeliverableAsset(artifact, pid)];
    });
    return [...fromDeliverables, ...extras];
  }, [
    deliverableAssetsFromProject,
    deliverableViewerIds,
    projectArtifactsFromState,
    project?.requirementsStateJson,
    resolvedProjectId,
    saveState,
    fetchNonce,
    conversationResetNonce,
  ]);

  const openDeliverableViewer = useCallback((ids: readonly string[], focusId?: string | null) => {
    setDeliverableViewerIds([...ids]);
    setDeliverableViewerFocusId(focusId ?? null);
    setDeliverableViewerOpen(true);
  }, []);

  const openDeliverableList = useCallback(
    (focusId: string | null) => {
      const allIds = deliverableAssetsFromProject.map((a) => a.id);
      openDeliverableViewer(allIds, focusId ?? allIds[0] ?? null);
    },
    [deliverableAssetsFromProject, openDeliverableViewer]
  );

  const latestUnifiedProposal = useMemo(() => {
    const list = deliverableAssetsFromProject.filter((a) => a.type === "full_plan");
    if (!list.length) return null;
    return [...list].sort((a, b) => b.version - a.version)[0] ?? null;
  }, [deliverableAssetsFromProject]);

  const workflowBannerEligible = useMemo(() => {
    const pid = resolvedProjectId.trim();
    if (!pid) return false;
    if (conversationStatus !== "loaded") return false;
    if (!project) return false;
    if (loadedConversationProjectId !== pid) return false;
    return true;
  }, [resolvedProjectId, conversationStatus, project, loadedConversationProjectId]);

  const workflowGuidanceBanner = useMemo(() => {
    if (!workflowBannerEligible) return null;
    const fromUrl = initialWorkflowNotice.trim();
    if (fromUrl) return fromUrl;
    return null;
  }, [workflowBannerEligible, initialWorkflowNotice, project]);

  const enrichPlanningDataSlotsOnPersist = useCallback(
    (state: RequirementsStateJson): Partial<RequirementsStateJson> => {
      const pid = resolvedProjectId.trim();
      if (!pid) return {};
      const defs = buildDynamicServicePlanningSlotDefinitions({
        projectName: project?.name ?? "",
        projectDescription: project?.description ?? "",
        projectType: project?.projectType ?? null,
        servicePlanningAgentCatalogKeys: servicePlanningScreenCatalogIds ?? null,
      });
      const defsHash = hashSlotDefinitions(defs);
      const orchestration = resolveWorkspaceSingleChatOrchestration({
        localState: state,
        persistedOrchestration: state.singleChatOrchestrationV1,
        slotDefinitionsHash: defsHash,
      });
      if (!orchestration) return {};
      const repositoryName = resolvePlanningRepositoryName({ projectName: project?.name ?? "" });
      const patch = buildPlanningDataSlotsStatePatch({
        state,
        projectId: pid,
        repositoryName,
        orchestration,
        definitions: defs,
      });
      return {
        planningDataSlotsV1: patch.planningDataSlotsV1,
        planningHandoffForImplementationV1: patch.planningHandoffForImplementationV1,
      };
    },
    [resolvedProjectId, project?.name, project?.description, project?.projectType, servicePlanningScreenCatalogIds],
  );

  const { persistStateJsonOnly, persistServiceFlow, persistRemote } = useRequirementsSpecWorkspacePersist({
    resolvedProjectId,
    stateJsonRef,
    setSaveState,
    setLastSavedAt,
    setProject,
    setServiceFlow,
    setRoom,
    goals,
    scopeIn,
    scopeOut,
    targetUsers,
    success,
    nfr,
    openIssues,
    priorityFeatures,
    organizedAt,
    onboardingAppliedKey,
    onboardingKey,
    enrichRequirementsStateBeforePersist: enrichPlanningDataSlotsOnPersist,
  });

  const appendSingleChatPromptTimeline = useCallback(
    (entry: RequirementsPromptTimelineEntry) => {
      void persistStateJsonOnly({
        promptTimeline: appendIdeationBootstrapPromptTimeline(stateJsonRef.current.promptTimeline, entry),
      });
    },
    [persistStateJsonOnly]
  );

  const handleSaveSampleDataSpec = useCallback(
    async (next: SampleDataSpecV1) => {
      const fp = stateJsonRef.current.featurePlanningSlotsV1 ?? persistedPromptState.featurePlanningSlotsV1;
      const patch: Record<string, unknown> = { sampleDataSpecV1: next };
      if (fp?.prototypeReadiness) {
        patch.featurePlanningSlotsV1 = {
          ...fp,
          prototypeReadiness: applySampleDataSpecToPrototypeReadiness({
            prototypeReadiness: fp.prototypeReadiness,
            sampleDataSpec: next,
          }),
          updatedAt: new Date().toISOString(),
        };
      }
      await persistStateJsonOnly(patch);
      showSuccessToast("샘플데이터 기준을 저장했습니다.");
    },
    [persistStateJsonOnly, persistedPromptState.featurePlanningSlotsV1, showSuccessToast],
  );

  const recoveryTimelineKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const orch = persistedPromptState.requirementsIntentOrchestrationV1;
    if (!orch?.lastRecoveredAt) return;
    const sessionKey = String(orch.orchestrationSessionId ?? "").trim();
    if (!sessionKey) return;
    if (recoveryTimelineKeyRef.current === sessionKey) return;
    recoveryTimelineKeyRef.current = sessionKey;
    appendSingleChatPromptTimeline(
      buildOrchestrationRecoveryTimelineEntry({
        sessionId: orch.orchestrationSessionId,
        recoveredAt: orch.lastRecoveredAt,
      }),
    );
  }, [persistedPromptState.requirementsIntentOrchestrationV1, appendSingleChatPromptTimeline]);

  const featureDetailEditing = useFeatureDetailEditing({
    stateJsonRef,
    persistedFeatureDetail: persistedPromptState.featureDetailSlotsV1,
    serviceFlow,
    persistStateJsonOnly,
    appendSingleChatPromptTimeline,
    setActiveCanvasView,
    showSuccessToast,
    showErrorToast,
  });

  const persistServiceFlowWithOrchestration = useCallback(
    async (next: RequirementsServiceFlowV1 | null): Promise<ServiceFlowOrchestrationSyncResult | null> => {
      if (!next) {
        await persistServiceFlow(null);
        return null;
      }
      const hydrated = hydrateServiceFlowStepsFromAlternativePayload(next);
      const fp = buildServiceFlowStructureFingerprint(hydrated);
      const stage = resolveAuthoritativeOrchestrationStage(stateJsonRef.current);
      const projectionRebuild = rebuildOrchestrationProjectionWithFallback({
        orchestration: orchestrationAlignedState,
        definitions: slotDefsForProgress,
        mutationSource: "service_flow_persist",
        stage,
      });
      let orchBase = projectionRebuild.state;
      let invalidation: ReturnType<typeof applyOrchestrationInvalidationsAfterFlowChange> = null;
      try {
        invalidation =
          orchBase && serviceFlowStructureFingerprintRef.current
            ? applyOrchestrationInvalidationsAfterFlowChange({
                orchestration: orchBase,
                definitions: slotDefsForProgress,
                previousFingerprint: serviceFlowStructureFingerprintRef.current,
                currentFingerprint: fp,
                flowApproved: Boolean(hydrated.flowApproved),
              })
            : null;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        appendSingleChatPromptTimeline({
          stage: "service-flow",
          stageGroup: "service-planning",
          workspaceScreenKey: "requirements_service_flow",
          action: "orchestrationInvalidation",
          source: "internal",
          createdAt: new Date().toISOString(),
          routingDecision: "invalidation_error",
          responseText: `invalidation error (${projectionRebuild.log.projectionId}): ${msg}`,
        });
        orchBase = projectionRebuild.state;
      }
      serviceFlowStructureFingerprintRef.current = fp;

      if (invalidation) {
        orchBase = invalidation.state;
        appendSingleChatPromptTimeline({
          stage: "service-flow",
          stageGroup: "service-planning",
          workspaceScreenKey: "requirements_service_flow",
          action: "orchestrationInvalidation",
          source: "internal",
          createdAt: new Date().toISOString(),
          routingDecision: "flow_structure_invalidation",
          responseText: `invalidation applied: ${invalidation.invalidations.join("; ")}`,
          staleTriggered: invalidation.staleTriggered,
          invalidations: [...invalidation.invalidations],
          staleSlots: [...invalidation.staleSlotKeys],
          ...(projectionRebuild.log.retried ? { projectionRebuildRetried: true } : {}),
        });
      }

      const projectionSource = hydrated.flowApproved ? ("flow_approve" as const) : ("flow_draft" as const);
      const projected = projectServiceFlowResultToSingleChatSlots({
        orchestration: orchBase,
        definitions: slotDefsForProgress,
        flow: hydrated,
        source: projectionSource,
        nowIso: new Date().toISOString(),
      });
      if (projected) orchBase = projected;

      const sync = syncServiceFlowToOrchestrationSlots({
        flow: hydrated,
        definitions: slotDefsForProgress,
        orchestration: orchBase,
      });
      if (sync) {
        setServiceFlow(hydrated);
        stateJsonRef.current = mergeRequirementsStateJson(stateJsonRef.current, {
          serviceFlowV1: hydrated,
          singleChatOrchestrationV1: sync.state,
        });
        await persistStateJsonOnly({
          serviceFlowV1: hydrated,
          singleChatOrchestrationV1: sync.state,
        });
        const timelineMeta = buildServiceFlowSlotSyncTimelineEntry(sync);
        appendSingleChatPromptTimeline({
          stage: "service-flow",
          stageGroup: "service-planning",
          workspaceScreenKey: "requirements_service_flow",
          action: timelineMeta.action,
          source: timelineMeta.source,
          createdAt: new Date().toISOString(),
          routingDecision: timelineMeta.routingDecision,
          slotSyncTriggered: timelineMeta.slotSyncTriggered,
          slotSyncMode: timelineMeta.slotSyncMode,
          slotSyncResult: timelineMeta.slotSyncResult,
          slotSyncCount: timelineMeta.slotSyncCount,
          progressBefore: timelineMeta.progressBefore,
          progressAfter: timelineMeta.progressAfter,
          slotStateTransitions: [...timelineMeta.slotStateTransitions],
          updatedSlotCount: timelineMeta.updatedSlotCount,
          staleSlots: [...timelineMeta.staleSlots],
          ...(invalidation?.staleTriggered ? { staleTriggered: true } : {}),
        });
        return sync;
      }
      await persistServiceFlow(hydrated);
      return null;
    },
    [
      appendSingleChatPromptTimeline,
      persistServiceFlow,
      persistStateJsonOnly,
      slotDefsForProgress,
      orchestrationAlignedState,
    ],
  );

  useRequirementsProjectLoad({
    resolvedProjectId,
    fetchNonce,
    stateJsonRef,
    persistStateJsonOnly,
    setConversationStatus,
    setLoadedConversationProjectId,
    setLoadError,
    setProject,
    setRoom,
    setGoals,
    setScopeIn,
    setScopeOut,
    setTargetUsers,
    setSuccess,
    setNfr,
    setOpenIssues,
    setPriorityFeatures,
    setLastSavedAt,
    setOrganizedAt,
    setServiceFlow,
    setInput,
    setMembers,
  });

  const composerPlaceholder = "메시지를 입력하세요";

  const targetPickerItems = useMemo<readonly RequirementsComposerTargetPickerItem[]>(() => {
    // `@@` 멘션은 "현재 화면 참여자"가 아니라 서비스 기획 전 단계(아이디어/흐름/기능정리) 전체 참여자를 대상으로 한다.
    return servicePlanningParticipants.map((p) => ({
      id: `picker:participant:${p.id}`,
      label: p.invited ? `${p.name} (초대됨)` : p.name,
      targets: [{ id: p.id, name: p.name }],
    }));
  }, [servicePlanningParticipants]);

  const ideationAssets = useMemo(() => stateJsonRef.current.deliverableAssets ?? [], [fetchNonce, project?.requirementsStateJson]);
  const ideationReadyForServiceFlow = useMemo(() => {
    const assets = ideationAssets ?? [];
    if (assets.length > 0) return true;
    // MVP gate: allow entry if any meaningful ideation text exists (even before deliverables)
    if (goals.trim() || targetUsers.trim() || success.trim()) return true;
    const lastPrompt = String(stateJsonRef.current.lastPromptText ?? "").trim();
    if (lastPrompt) return true;
    const draftText = String(stateJsonRef.current.lastUserDraftText ?? "").trim();
    if (draftText) return true;
    const ok = new Set(["meeting_summary", "problem_statement", "kpi", "full_plan", "mvp_scope", "feature_list"]);
    return assets.some((a) => ok.has(String(a.type)));
  }, [ideationAssets, goals, targetUsers, success, fetchNonce]);
  const ideationReadyNotice = "현재 단계로 이동하려면\n아이디어 구체화 단계에서\n기획 산출물 정리가 필요합니다.";

  const appendServiceFlowWorkshopMessages = useCallback(
    async (incoming: readonly RequirementsMessage[]): Promise<RequirementsMessage[]> => {
      const pid = resolvedProjectId.trim();
      if (!pid || incoming.length === 0) return [];
      const r = roomRef.current;
      const base = r.requirementsConversation.messages;
      const appended = [...base, ...incoming];
      const nextRoom: RequirementsRoomStateV3 = {
        ...r,
        requirementsConversation: {
          ...r.requirementsConversation,
          projectId: pid,
          messages: appended,
        },
      };
      await persistRemote(nextRoom, {}, {});
      return appended.filter(isServiceFlowWorkshopMessage);
    },
    [resolvedProjectId, persistRemote],
  );

  useEffect(() => {
    const pid = resolvedProjectId.trim();
    if (!pid || conversationStatus !== "loaded") {
      if (draftDebounceTimerRef.current) {
        clearTimeout(draftDebounceTimerRef.current);
        draftDebounceTimerRef.current = null;
      }
      return;
    }
    if (draftDebounceTimerRef.current) clearTimeout(draftDebounceTimerRef.current);
    draftDebounceTimerRef.current = setTimeout(() => {
      draftDebounceTimerRef.current = null;
      void persistStateJsonOnly({ lastUserDraftText: input });
    }, 800);
    return () => {
      if (draftDebounceTimerRef.current) {
        clearTimeout(draftDebounceTimerRef.current);
        draftDebounceTimerRef.current = null;
      }
    };
  }, [input, resolvedProjectId, conversationStatus, persistStateJsonOnly]);

  const serviceFlowDraft = useRequirementsServiceFlowDraft({
    resolvedProjectId,
    persistServiceFlow: persistServiceFlowWithOrchestration,
    serviceFlow,
    project,
    ideationReadyForServiceFlow,
    ideationReadyNotice,
    setError,
    showSuccessToast,
    showErrorToast,
    roomRef,
    stateJsonRef,
    aiBackgroundBusy: serviceFlowDraftBusy,
    setAiBackgroundBusy: setServiceFlowDraftBusy,
    activeStage,
    fetchNonce,
    ideationConversationOnly,
  });

  useEffect(() => {
    if (conversationStatus !== "loaded") return;
    const pid = resolvedProjectId.trim();
    if (!pid) return;
    if (!project) return;
    if (loadedConversationProjectId !== pid) return;
    const workspaceState = parseRequirementsStateJson(project.requirementsStateJson);
    const seededFromPreProject = isProjectSeededFromPreProjectChat(workspaceState);
    const forceRegeneratePlanningSummary = shouldRegeneratePlanningSummaryAfterConversationReset({
      resetNonce: conversationResetNonce,
      consumedResetNonce: consumedResetSeedNonceRef.current,
      seededFromPreProject,
    });

    if (!forceRegeneratePlanningSummary && onboardingAppliedKey === onboardingKey) return;
    const existing = room.requirementsConversation.messages;

    if (!forceRegeneratePlanningSummary) {
      if (hasPreProjectPlanningSummaryMessage(existing)) {
        setOnboardingAppliedKey(onboardingKey);
        return;
      }
      if (existing.length > 0) {
        setOnboardingAppliedKey(onboardingKey);
        return;
      }
    }
    const flightKey = buildOnboardingPlanningSummaryFlightKey({
      onboardingKey,
      forceRegenerate: forceRegeneratePlanningSummary,
      resetNonce: conversationResetNonce,
    });
    if (ideationBootstrapFlightRef.current === flightKey) return;
    ideationBootstrapFlightRef.current = flightKey;

    let cancelled = false;

    void (async () => {
      const persistFirstQuestion = async (params: {
        readonly bodyText: string;
        readonly seedWire?: unknown | null;
        readonly source: "llm" | "fallback";
        readonly fallbackReason?: string;
        readonly promptText?: string;
        readonly promptAtIso?: string;
        readonly promptTrace?: RequirementsPromptTimelineEntry | null;
        readonly singleChatOrchestrationV1?: RequirementsSingleChatOrchestrationStateV1 | null;
        readonly interviewSuggestions?: readonly string[];
        readonly interviewSuggestionActions?: readonly PreProjectInterviewSuggestionActionMeta[];
        readonly interviewAllowCustomInput?: boolean;
        readonly bootstrapInternalType?: string;
      }): Promise<boolean> => {
        const nowIso = new Date().toISOString();
        const nextRoom = patchRequirementsRoomConversationMessages(room, pid, [
          newChatMessage({
            role: "ai",
            body: params.bodyText,
            speakerType: "AI",
            speakerId: VIRTUAL_AI_PLANNER_ID,
            speakerName: IDEATION_AI_DISPLAY_NAME,
            messageType: "ANSWER",
            meta: {
              internalType: params.bootstrapInternalType ?? IDEATION_INTERVIEW_BOOTSTRAP_INTERNAL_TYPE,
              source: params.source,
              ...(params.source === "fallback" && params.fallbackReason
                ? { fallbackReason: params.fallbackReason }
                : {}),
              ...(params.interviewSuggestions?.length
                ? { interviewSuggestions: [...params.interviewSuggestions] }
                : {}),
              ...(params.interviewSuggestionActions?.length
                ? { interviewSuggestionActions: [...params.interviewSuggestionActions] }
                : {}),
              ...(params.interviewAllowCustomInput === false ? { interviewAllowCustomInput: false } : {}),
              ...(params.promptTrace
                ? (() => {
                    const ex = extractOverlayPromptTraceMetadata(params.promptTrace);
                    return Object.keys(ex).length > 0 ? { messageOverlayExplainability: ex } : {};
                  })()
                : {}),
            },
          }),
        ]);
        const seeded = params.seedWire
          ? problemInterviewStateFromBootstrapSeedWire(params.seedWire, nowIso)
          : emptyProblemInterviewState(nowIso);
        const existingTimeline = stateJsonRef.current.promptTimeline;
        const nextTimeline = appendIdeationBootstrapPromptTimeline(existingTimeline, params.promptTrace ?? null);
        console.debug("[PROMPT TIMELINE]", nextTimeline);
        // Keep in-memory state in sync immediately so the prompt timeline drawer updates
        // even if the project JSON refresh lags behind the persist call.
        stateJsonRef.current = mergeRequirementsStateJson(stateJsonRef.current, {
          ...(params.promptTrace ? { promptTimeline: nextTimeline } : {}),
          ...(params.singleChatOrchestrationV1 !== undefined && params.singleChatOrchestrationV1 !== null
            ? { singleChatOrchestrationV1: params.singleChatOrchestrationV1 }
            : {}),
        });
        if (params.promptTrace) setPromptTimelineUi(nextTimeline);
        try {
          await persistRemote(nextRoom, {}, {
            onboardingShown: true,
            problemInterview: seeded,
            ...(params.promptText ? { lastPromptText: params.promptText } : {}),
            ...(params.promptAtIso ? { lastPromptGeneratedAt: params.promptAtIso } : {}),
            ...(params.promptTrace ? { promptTimeline: nextTimeline } : {}),
            ...(params.singleChatOrchestrationV1 !== undefined && params.singleChatOrchestrationV1 !== null
              ? { singleChatOrchestrationV1: params.singleChatOrchestrationV1 }
              : {}),
          });
          if (!cancelled) setOnboardingAppliedKey(onboardingKey);
          return true;
        } catch (pe) {
          console.error("[PROMPT TIMELINE PERSIST FAIL]", pe);
          if (!cancelled) {
            setError(pe instanceof Error ? pe.message : "저장에 실패했습니다.");
            ideationBootstrapFlightRef.current = null;
          }
          return false;
        }
      };

      if (
        shouldSeedPreProjectPlanningSummaryOnWorkspaceEntry({
          conversationStatus,
          hasProject: true,
          loadedConversationProjectMatches: loadedConversationProjectId === pid,
          alreadyApplied: onboardingAppliedKey === onboardingKey,
          hasExistingPlanningSummary: hasPreProjectPlanningSummaryMessage(existing),
          existingMessageCount: existing.length,
          seededFromPreProject,
          forceRegenerate: forceRegeneratePlanningSummary,
        }) &&
        resolveAuthoritativeOrchestrationStage(workspaceState) !== "PRODUCT_DEFINITION"
      ) {
        if (forceRegeneratePlanningSummary) {
          consumedResetSeedNonceRef.current = conversationResetNonce;
        }
        const initialSeed = safeBuildPreProjectInitialProposalSeed({
          projectName: project.name ?? "",
          projectDescription: project.description ?? "",
          state:
            forceRegeneratePlanningSummary ?
              mergeRequirementsStateJson(workspaceState, {
                promptTimeline: stateJsonRef.current.promptTimeline ?? [],
                singleChatOrchestrationV1: stateJsonRef.current.singleChatOrchestrationV1 ?? null,
              })
            : workspaceState,
          definitions: slotDefsForProgress,
          existingOrchestration: forceRegeneratePlanningSummary ? null : orchestrationAlignedState,
          projectId: pid,
          regenerated: forceRegeneratePlanningSummary,
        });
        if (cancelled) return;
        const planningOk = await persistFirstQuestion({
          bodyText: initialSeed.bodyText,
          seedWire: null,
          source: "fallback",
          bootstrapInternalType: PRE_PROJECT_PLANNING_SUMMARY_INTERNAL_TYPE,
          promptTrace: initialSeed.promptTrace,
          ...(initialSeed.mode === "slot_based"
            ? {
                singleChatOrchestrationV1: initialSeed.orchestration,
                interviewSuggestions: initialSeed.interviewSuggestions,
                interviewSuggestionActions: initialSeed.interviewSuggestionActions,
                interviewAllowCustomInput: true,
              }
            : {}),
        });
        if (planningOk && forceRegeneratePlanningSummary) {
          consumedResetSeedNonceRef.current = conversationResetNonce;
        }
        if (!planningOk && !cancelled) {
          ideationBootstrapFlightRef.current = null;
        }
        return;
      }

      try {
        const res = await credentialsIncludeFetch(REQUIREMENTS_IDEATION_HTTP.AI_FACILITATOR, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: pid,
            projectName: project.name ?? "",
            projectDescription: project.description ?? "",
            projectType: project.projectType ?? "",
            stage: "requirements",
            bootstrapInterview: true,
            workspaceScreenKey: "requirements_ideation",
          }),
        });
        const json = (await res.json()) as {
          success?: boolean;
          code?: string;
          data?: {
            reply?: string;
            seedInterviewState?: unknown | null;
            promptText?: string;
            model?: string;
            provider?: string;
            calledAt?: string;
            promptTrace?: unknown;
            singleChatOrchestrationV1?: unknown;
            interviewSuggestions?: unknown;
            interviewAllowCustomInput?: boolean;
          };
          message?: string;
        };
        const bootCtx = {
          projectName: project.name ?? "",
          projectDescription: project.description ?? "",
          projectType: project.projectType ?? "",
        };
        const contextualFb = buildIdeationBootstrapContextualFallbackQuestion(bootCtx);
        const rawTraceEarly =
          (json.data as { promptTrace?: unknown } | undefined)?.promptTrace ??
          (json as { data?: { promptTrace?: unknown } }).data?.promptTrace;
        const traceEarly = coerceBootstrapPromptTrace(rawTraceEarly);
        const replyFromApi = String(json.data?.reply ?? "").trim();
        const replyFromTrace = String(
          traceEarly?.responseText ?? traceEarly?.interviewQuestion ?? traceEarly?.fallbackText ?? "",
        ).trim();
        const resolvedReply = replyFromApi || replyFromTrace;
        const okReply = res.ok && json.success && Boolean(resolvedReply);
        const fallbackReason =
          okReply
            ? undefined
            : [String(json.code ?? "").trim(), String(json.message ?? "").trim(), `HTTP ${res.status}`].filter(Boolean).join(" · ");
        const bodyText = normalizeIdeationBootstrapDisplayMessage(resolvedReply || contextualFb);
        if (cancelled) return;
        const seedWire = res.ok && json.success ? (json.data?.seedInterviewState ?? null) : null;
        const apiRawSug = json.data?.interviewSuggestions;
        const orchBootstrap = parseRequirementsSingleChatOrchestrationV1(json.data?.singleChatOrchestrationV1);
        if (orchBootstrap) {
          stateJsonRef.current = mergeRequirementsStateJson(stateJsonRef.current, {
            singleChatOrchestrationV1: orchBootstrap,
          });
        }

        // Single-call bootstrap: on failure, do NOT do extra LLM calls for suggestions.
        const bootInterviewChips = normalizeLlmInterviewSuggestions(
          Array.isArray(apiRawSug) ? (apiRawSug as unknown[]).map((x) => String(x ?? "")) : []
        );
        const bootSugSource: "llm" | "empty" = bootInterviewChips.length ? "llm" : "empty";
        const bootAllowCustom = json.data?.interviewAllowCustomInput !== false;
        const rawTrace = okReply ? (json.data as { promptTrace?: unknown }).promptTrace : (json as { data?: { promptTrace?: unknown } }).data?.promptTrace;
        let promptTrace = coerceBootstrapPromptTrace(rawTrace);
        if (rawTrace != null && !promptTrace) {
          console.warn("[PROMPT TRACE DROPPED]", rawTrace);
        }
        if (!promptTrace) {
          promptTrace = buildIdeationBootstrapFallbackPromptTrace({
            error: fallbackReason ?? "bootstrap_http_failed",
            fallbackReason: fallbackReason ?? "UNKNOWN_BOOTSTRAP_ERROR",
            provider: "fallback",
            fallbackText: bodyText,
            routingDecision: "bootstrap_proposal_skeleton_fallback_http",
            interviewQuestion: bodyText,
            interviewSuggestions: bootInterviewChips,
            interviewSuggestionsSource: bootSugSource,
          });
        } else {
          promptTrace = {
            ...promptTrace,
            interviewQuestion: bodyText,
            ...(bootInterviewChips.length ? { interviewSuggestions: [...bootInterviewChips] } : {}),
            interviewSuggestionsSource: bootSugSource,
          };
        }

        const ok = await persistFirstQuestion({
          bodyText,
          seedWire,
          source: okReply ? "llm" : "fallback",
          ...(okReply
            ? {
                promptText: String(json.data?.promptText ?? "").trim() || undefined,
                promptAtIso: String(json.data?.calledAt ?? "").trim() || undefined,
              }
            : { fallbackReason }),
          promptTrace,
          ...(orchBootstrap ? { singleChatOrchestrationV1: orchBootstrap } : {}),
          interviewSuggestions: bootInterviewChips,
          ...(okReply && bootAllowCustom === false ? { interviewAllowCustomInput: false } : {}),
        });
        if (!ok && !cancelled) {
          ideationBootstrapFlightRef.current = null;
          const persistFailCtx = buildIdeationBootstrapContextualFallbackQuestion(bootCtx);
          const persistFailBody = normalizeIdeationBootstrapDisplayMessage(persistFailCtx);
          const persistFailSug: string[] = [];
          const persistFailSugSrc: "llm" | "empty" = persistFailSug.length ? "llm" : "empty";
          await persistFirstQuestion({
            bodyText: persistFailBody,
            seedWire: null,
            source: "fallback",
            fallbackReason: "persist_failed",
            promptTrace: buildIdeationBootstrapFallbackPromptTrace({
              error: "persist_failed",
              fallbackReason: "UNKNOWN_BOOTSTRAP_ERROR",
              provider: "fallback",
              fallbackText: persistFailBody,
              routingDecision: "bootstrap_contextual_fallback_persist_failed",
              interviewQuestion: persistFailBody,
              interviewSuggestions: persistFailSug,
              interviewSuggestionsSource: persistFailSugSrc,
            }),
            interviewSuggestions: persistFailSug,
          });
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "인터뷰 시작에 실패했습니다.");
        ideationBootstrapFlightRef.current = null;
        const excBootCtx = {
          projectName: project.name ?? "",
          projectDescription: project.description ?? "",
          projectType: project.projectType ?? "",
        };
        const excCtx = buildIdeationBootstrapContextualFallbackQuestion(excBootCtx);
        const bodyText = normalizeIdeationBootstrapDisplayMessage(excCtx);
        const excSug: string[] = [];
        const excSugSrc: "llm" | "empty" = excSug.length ? "llm" : "empty";
        await persistFirstQuestion({
          bodyText,
          seedWire: null,
          source: "fallback",
          fallbackReason: e instanceof Error ? e.message : "bootstrap_failed",
          promptTrace: buildIdeationBootstrapFallbackPromptTrace({
            error: e instanceof Error ? e.message : "bootstrap_failed",
            fallbackText: bodyText,
            routingDecision: "bootstrap_contextual_fallback_exception",
            interviewQuestion: bodyText,
            interviewSuggestions: excSug,
            interviewSuggestionsSource: excSugSrc,
          }),
          interviewSuggestions: excSug,
        });
      }
    })();

    return () => {
      cancelled = true;
      // Reset 재seed 진행 중에는 room 갱신으로 effect가 재실행돼도 flight를 유지한다.
      if (!flightKey.includes(":reset:") && ideationBootstrapFlightRef.current === flightKey) {
        ideationBootstrapFlightRef.current = null;
      }
    };
  }, [
    conversationStatus,
    resolvedProjectId,
    loadedConversationProjectId,
    project,
    onboardingAppliedKey,
    onboardingKey,
    room,
    persistRemote,
    conversationResetNonce,
    slotDefsForProgress,
    orchestrationAlignedState,
  ]);

  const onOrganizeRequirements = useCallback(async () => {
    // 플래너 검토형 정리 요청: 먼저 산출물 유형을 단일 선택
    setPlannerTypePickerOpen(true);
    return;
  }, []);

  const onResetConversation = useCallback(async () => {
    const pid = resolvedProjectId.trim();
    if (!pid) return;
    const remoteLockedLocal = !pid;
    if (remoteLockedLocal) return;
    if (busy || resetConversationBusy) return;
    if (!confirmResetConversation({ message: PLANNING_RESET_CONVERSATION_CONFIRM_MESSAGE })) {
      return;
    }
    setResetConversationBusy(true);
    try {
      const nowIso = new Date().toISOString();
      const base = roomRef.current;
      const cleared = patchRequirementsRoomConversationMessages(base, pid, []);
      const nextRoom: RequirementsRoomStateV3 = {
        ...cleared,
        requirementsDraft: null,
      };
      setRoom(nextRoom);
      setReplyTo(null);
      setInput("");
      setOnboardingAppliedKey(null);
      ideationBootstrapFlightRef.current = null;
      consumedResetSeedNonceRef.current = null;
      setConversationResetNonce((n) => n + 1);
      const cascade = await postPlanningResetCascade({
        projectId: pid,
        reason: "planning_reset",
      });
      if (!cascade.success) {
        throw new Error(cascade.message ?? "기획 초기화 시 구현 Runtime 정리에 실패했습니다.");
      }
      const resetState = buildRequirementsConversationResetStateJson(stateJsonRef.current, nowIso);
      stateJsonRef.current = resetState;
      setServiceFlow(null);
      setPromptTimelineUi([]);
      setCanvasHubOpen(false);
      setArtifactHubOpen(false);
      setDeliverableViewerOpen(false);
      setDeliverableViewerIds([]);
      setDeliverableViewerFocusId(null);
      setActiveCanvasView(null);
      lastFastPlanArtifactIdRef.current = null;
      await persistRemote(nextRoom, {}, resetState);
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : "기획 초기화에 실패했습니다.");
    } finally {
      setResetConversationBusy(false);
    }
  }, [resolvedProjectId, busy, resetConversationBusy, persistRemote, setServiceFlow, showErrorToast]);


  const handleGenerateProjectArtifact = useCallback(
    async (artifactType: ProjectArtifactType) => {
      const pid = resolvedProjectId.trim();
      if (!pid || busy || artifactGenerateBusy) return;
      setArtifactGenerateBusy(true);
      setError(null);
      try {
        const st = stateJsonRef.current;
        const sourceStage = resolveAuthoritativeOrchestrationStage(st);
        const result = await fetchGenerateProjectArtifact({
          projectId: pid,
          artifactType,
          projectName: project?.name ?? "",
          projectDescription: project?.description ?? "",
          sourceStage,
          serviceFlow: serviceFlow ?? st.serviceFlowV1 ?? null,
          featurePlanning: st.featurePlanningSlotsV1 ?? null,
        });
        if (!result.success || !result.artifact) {
          const msg = result.message ?? "문서 생성에 실패했습니다.";
          setError(msg);
          showErrorToast(msg);
          return;
        }
        const deliverable = projectArtifactToDeliverableAsset(result.artifact, pid);
        await persistStateJsonOnly({
          projectArtifacts: [...(st.projectArtifacts ?? []), result.artifact],
          deliverableAssets: [...(st.deliverableAssets ?? []), deliverable],
        });
        openDeliverableViewer([deliverable.id], deliverable.id);
        showSuccessToast(`${result.artifact.title}을(를) 생성했습니다.`);
      } finally {
        setArtifactGenerateBusy(false);
      }
    },
    [
      resolvedProjectId,
      busy,
      artifactGenerateBusy,
      project?.name,
      project?.description,
      serviceFlow,
      persistStateJsonOnly,
      openDeliverableViewer,
      showErrorToast,
      showSuccessToast,
    ],
  );

  const handleGenerateDeliverables = useRequirementsHandleGenerateDeliverables({
    resolvedProjectId,
    conversationStatus,
    goals,
    targetUsers,
    scopeIn,
    scopeOut,
    success,
    nfr,
    openIssues,
    priorityFeatures,
    conversationMessages,
    ideationConversationOnly,
    project,
    room,
    persistRemote,
    showSuccessToast,
    showErrorToast,
    openDeliverableViewer,
    setDeliverableGenerateBusy,
    setError,
    stateJsonRef,
  });

  const isAiTarget = useCallback((targetId: string) => {
    if (targetId === VIRTUAL_AI_PLANNER_ID) return true;
    const row = membersRef.current.find((m) => m.memberId === targetId);
    return Boolean(row?.memberType === "AI");
  }, []);

  const runIdeationSend = useCallback(async (harnessPayload: ServiceDesignHarnessPayload) => {
    if (requirementsSendFlightRef.current) {
      ideationSendDevLog("start", "ignored-in-flight");
      return;
    }
    requirementsSendFlightRef.current = true;
    try {
      if (draftDebounceTimerRef.current) {
        clearTimeout(draftDebounceTimerRef.current);
        draftDebounceTimerRef.current = null;
      }
      const text = input.trim();
      if (!text || busy || aiInvokePending) return;
      if (
        shouldSkipIdeationDuplicateAppend({
          messages: ideationConversationOnly,
          role: "user",
          body: text,
          speakerId: sessionUser?.id ?? "me",
        })
      ) {
        ideationSendDevLog("dedupe-user-skip", text.slice(0, 80));
        return;
      }
      sendDraftRestoreRef.current = text;
      flushSync(() => {
        setInput("");
      });
      const sendTraceId = newIdeationSendTraceId();
      const hasAtAtMention = text.includes("@@");
      const replyToIdSnapshot = hasAtAtMention ? null : (replyTo?.id ?? null);
      const replyMode = Boolean(replyToIdSnapshot?.trim());
      // reply는 "일회성 컨텍스트" — 이번 전송 이후 자동 해제되어야 한다.
      // UI에서는 전송 시작 즉시 해제해 다음 입력이 자동으로 reply로 묶이지 않게 한다.
      if (replyMode || hasAtAtMention) setReplyTo(null);

      // suggestion chip 선택도 one-shot: 이번 전송에만 포함하고 즉시 비움
      const selectedSuggestionSnapshot = interviewSuggestionPickRef.current;
      interviewSuggestionPickRef.current = null;
      ideationSendDevLog("start", `mode=${replyMode ? "reply" : "normal"}${hasAtAtMention ? " mention=@@(detach-reply)" : ""}`);
      setServiceFlowDraftBusy(true);
      setError(null);
      const { targets, anyAi, effectiveReplyTo, msgs, turn } = composeIdeationSendUserTurn({
        text,
        replyToId: replyToIdSnapshot,
        conversationMessages,
        ideationConversationOnly,
        participants,
        sessionUserId: sessionUser?.id ?? "me",
        sessionUserName: sessionUser?.name ?? "나",
        aiQuestionIndex: room.aiQuestionIndex,
        isAiTarget,
      });

      if (anyAi) {
        const { withCalling, primaryId, aiName } = await persistRequirementsIdeationUserTurnBeforeAi({
          sendTraceId,
          text,
          room,
          resolvedProjectId,
          msgs,
          targets,
          ideationConversationOnly,
          projectName: project?.name ?? "",
          projectDescription: project?.description ?? "",
          isAiTarget,
          stateJsonRef,
          persistRemote,
        });
        ideationSendDevLog("user-appended", `id=${sendTraceId}`);
        const ownerHint = detectOwnerHintFromText(text);
        if (ownerHint) {
          setTypingIndicatorSpeakerLine(speakerNameForOwner(ownerHint));
          setTypingIndicatorResolvedSpeakerSource("explicit_role_mention(client)");
        } else {
          setTypingIndicatorSpeakerLine(null);
          setTypingIndicatorResolvedSpeakerSource("screenAiMemberId_fallback");
        }
        setAiInvokePending(true);
        let plannerTail: IdeationPlannerTail;
        try {
          plannerTail = await runRequirementsIdeationAiAfterUserPersist({
            sendTraceId,
            text,
            withCalling,
            msgs,
            turn,
            pid: resolvedProjectId.trim(),
            primaryId,
            aiName,
            targets,
            effectiveReplyTo,
            stateJsonRef,
            projectName: project?.name ?? "",
            projectDescription: project?.description ?? "",
            draftDoc,
            sessionUserId: sessionUser?.id ?? "",
            sessionUserName: sessionUser?.name ?? "나",
            persistRemote,
            setAiLastInvoke,
            setInput,
            setReplyTo,
            showErrorToast,
            serviceDesignHarness: harnessPayload,
            workspaceScreenKey: requirementsWorkspaceStageToScreenKey(activeStage),
            projectType: project?.projectType ?? "",
            consumeInterviewSelectedSuggestion: () =>
              interviewSuggestionPickToLabel(selectedSuggestionSnapshot),
            consumeImplementationCandidateRefineRequest: () => {
              const wire = implementationCandidateRefineRequestRef.current;
              implementationCandidateRefineRequestRef.current = null;
              return wire;
            },
          });
        } finally {
          setAiInvokePending(false);
          setTypingIndicatorSpeakerLine(null);
          setTypingIndicatorResolvedSpeakerSource(null);
        }
        if (plannerTail.needsTailPersist) {
          await persistRemote(plannerTail.finalRoom, {}, {
            lastUserDraftText: "",
            ...(plannerTail.persistMeta ?? {}),
          });
        }
        sendDraftRestoreRef.current = null;
        setReplyTo(null);
        ideationSendDevLog("end", `id=${sendTraceId}`);
      } else {
        const nextRoom = patchRequirementsRoomConversationMessages(room, resolvedProjectId, msgs);
        sendDraftRestoreRef.current = null;
        setReplyTo(null);
        await persistRemote(nextRoom, {}, { lastUserDraftText: "" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
      if (sendDraftRestoreRef.current) {
        setInput(sendDraftRestoreRef.current);
        sendDraftRestoreRef.current = null;
      }
    } finally {
      requirementsSendFlightRef.current = false;
      setBusy(false);
      setServiceFlowDraftBusy(false);
    }
  }, [
    input,
    busy,
    aiInvokePending,
    room,
    conversationMessages,
    ideationConversationOnly,
    participants,
    persistRemote,
    resolvedProjectId,
    sessionUser?.id,
    sessionUser?.name,
    project?.name,
    project?.description,
    draftDoc,
    replyTo,
    showErrorToast,
    activeStage,
    project?.projectType,
  ]);

  const runServiceFlowSend = useCallback(
    async (payload: ServiceDesignHarnessPayload) => {
      const text = input.trim();
      const pick = interviewSuggestionPickRef.current;
      interviewSuggestionPickRef.current = null;
      const routerOverrides = interviewSuggestionPickToRouterOverrides(pick);
      await dispatchServiceFlowSingleChatSend({
        payload,
        text,
        quickAction: interviewSuggestionPickToQuickAction(pick),
        quickActionLabel: interviewSuggestionPickToLabel(pick),
        slotAction: interviewSuggestionPickToSlotAction(pick),
        ...(routerOverrides ?? {}),
        sendRefCurrent: serviceFlowSendRef.current,
        onAfterDispatch: () => setInput(""),
      });
    },
    [input]
  );

  const runFeaturePlanningSend = useCallback(
    async (payload: ServiceDesignHarnessPayload) => {
      // Safety guard
      if (payload.serviceDesignStage !== "feature-planning") return;
      const pid = resolvedProjectId.trim();
      const text = input.trim();
      if (!pid || !text) return;

      const pick = interviewSuggestionPickRef.current;
      interviewSuggestionPickRef.current = null;
      const quickAction = interviewSuggestionPickToQuickAction(pick);
      const quickLabel = interviewSuggestionPickToLabel(pick);

      setInput("");

      const nowIso = new Date().toISOString();
      const baseMessages = roomRef.current.requirementsConversation.messages;

      let mirroredUserTurn = false;
      // Mirror user turn into requirementsConversation (single timeline).
      if (
        !shouldSkipFeaturePlanningMirror({
          messages: baseMessages,
          text,
          mentionedAI: payload.mentionedAI,
          nowIso,
        })
      ) {
        const userMsg = buildFeaturePlanningMirroredUserTurn({
          text,
          payload,
          speakerId: sessionUser?.id ?? "me",
          speakerName: sessionUser?.name ?? "나",
          createdAtIso: nowIso,
        });
        const nextRoom = patchRequirementsRoomConversationMessages(roomRef.current, pid, [...baseMessages, userMsg]);
        setRoom(nextRoom);
        await persistRemote(nextRoom, {}, { lastUserDraftText: "" });
        mirroredUserTurn = true;
      }

      // Orchestration quick actions (화면 정의 등) — service-flow-analyze fast-path + 단일 타임라인 반영
      const orchestrationDispatched = await dispatchServiceFlowSingleChatSend({
        payload,
        text,
        quickAction,
        quickActionLabel: quickLabel,
        silentUserAppend: mirroredUserTurn,
        sendRefCurrent: serviceFlowSendRef.current,
        onAfterDispatch: () => {},
      });
      if (orchestrationDispatched.dispatched) return;

      // Execute existing feature-planning logic (no rewrite).
      const fn = featurePlanningSendRef.current;
      if (!fn) {
        showErrorToast("기능 정리 전송을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      try {
        await fn(payload, text);
      } catch (e) {
        // restore input if stage-local send failed
        setInput(text);
        throw e;
      }
    },
    [resolvedProjectId, input, sessionUser?.id, sessionUser?.name, persistRemote, showErrorToast]
  );

  const appendFeaturePlanningAiTurnsToRequirementsConversation = useCallback(
    async (incoming: readonly { content: string; speakerName?: string }[]) => {
      const pid = resolvedProjectId.trim();
      if (!pid) return;
      const base = roomRef.current.requirementsConversation.messages;
      const nowIso = new Date().toISOString();

      const out: RequirementsMessage[] = [];
      for (const row of incoming) {
        const text = String(row?.content ?? "").trim();
        if (!text) continue;
        if (
          shouldSkipFeaturePlanningAiMirror({
            messages: [...base, ...out],
            text,
            nowIso,
          })
        ) {
          continue;
        }
        out.push(
          buildFeaturePlanningMirroredAiTurn({
            text,
            speakerName: row.speakerName,
            createdAtIso: nowIso,
          })
        );
      }
      if (!out.length) return;
      const nextRoom = patchRequirementsRoomConversationMessages(roomRef.current, pid, [...base, ...out]);
      setRoom(nextRoom);
      try {
        await persistRemote(nextRoom, {}, {});
      } catch {
        // best-effort: do not break feature-planning if AI mirror fails
      }
    },
    [resolvedProjectId, persistRemote]
  );

  useFeaturePlanningSingleChatBridge({
    projectId: resolvedProjectId.trim(),
    singleChatSendRef: featurePlanningSendRef,
    onSingleChatAiMessages: appendFeaturePlanningAiTurnsToRequirementsConversation,
  });

  const runProductDefinitionSend = useCallback(
    async (_harnessPayload: ServiceDesignHarnessPayload) => {
      const text = input.trim();
      const pid = resolvedProjectId.trim();
      if (!text || busy || !pid) return;
      flushSync(() => setInput(""));
      setBusy(true);
      setError(null);
      try {
        const userMsg = buildProductDefinitionUserMessage({
          text,
          sessionUserId: sessionUser?.id ?? "me",
          sessionUserName: sessionUser?.name ?? "나",
        });
        const r0 = roomRef.current;
        const withUser = [...r0.requirementsConversation.messages, userMsg];
        await persistRemote(
          {
            ...r0,
            requirementsConversation: { ...r0.requirementsConversation, projectId: pid, messages: withUser },
          },
          {},
          {},
        );
        const transcript = filterIdeationConversationMessages(withUser)
          .slice(-10)
          .map((m) => `${m.role}: ${String(m.content ?? "").slice(0, 400)}`)
          .join("\n");
        const result = await postProductDefinitionChat({
          projectId: pid,
          userMessage: text,
          recentTranscript: transcript,
        });
        if (!result.ok) {
          showErrorToast(result.message);
          return;
        }
        await persistStateJsonOnly(result.requirementsStateJson);
        const r1 = roomRef.current;
        const withAi = [...r1.requirementsConversation.messages, result.assistantMessage];
        await persistRemote(
          {
            ...r1,
            requirementsConversation: { ...r1.requirementsConversation, projectId: pid, messages: withAi },
          },
          {},
          {},
        );
        setFetchNonce((n) => n + 1);
        if (result.completedPlanning) {
          showSuccessToast("Product Definition을 확정했습니다. 기획 단계를 이어갈 수 있습니다.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Product Definition 전송 오류");
      } finally {
        setBusy(false);
      }
    },
    [
      input,
      busy,
      resolvedProjectId,
      sessionUser?.id,
      sessionUser?.name,
      persistRemote,
      persistStateJsonOnly,
      showErrorToast,
      showSuccessToast,
    ],
  );

  const handleServiceDesignComposerSend = useCallback(
    async (payload: ServiceDesignHarnessPayload) => {
      if (activeStage === "product-definition") {
        await runProductDefinitionSend(payload);
        return;
      }
      if (activeStage === "ideation") {
        await runIdeationSend(payload);
        return;
      }
      if (activeStage === "service-flow") {
        await runServiceFlowSend(payload);
        return;
      }
      if (activeStage === "feature-planning") {
        await runFeaturePlanningSend(payload);
        return;
      }
    },
    [activeStage, runProductDefinitionSend, runIdeationSend, runServiceFlowSend, runFeaturePlanningSend]
  );

  useEffect(() => {
    if (!inProductDefinitionStage || conversationStatus !== "loaded") return;
    const pid = resolvedProjectId.trim();
    if (!pid || !project) return;
    const st = parseRequirementsStateJson(project.requirementsStateJson);
    const def = st.productDefinitionV1;
    if (!def) return;
    if (hasProductDefinitionIntroMessage(conversationMessages)) return;
    if (productDefinitionIntroFlightRef.current === pid) return;
    productDefinitionIntroFlightRef.current = pid;
    void (async () => {
      const intro = buildProductDefinitionIntroAiMessage({ definition: def });
      const r = roomRef.current;
      const appended = [...r.requirementsConversation.messages, intro];
      await persistRemote(
        {
          ...r,
          requirementsConversation: { ...r.requirementsConversation, projectId: pid, messages: appended },
        },
        {},
        {},
      );
    })();
  }, [
    inProductDefinitionStage,
    conversationStatus,
    resolvedProjectId,
    project,
    conversationMessages,
    persistRemote,
  ]);

  const onPanelBlurSave = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const nextRoom: RequirementsRoomStateV3 = {
        ...room,
        openIssues: openIssues.trim() || undefined,
        priorityFeatures: priorityFeatures.trim() || undefined,
      };
      await persistRemote(nextRoom, {
        specCoreGoals: goals.trim() || null,
        specScopeIn: scopeIn.trim() || null,
        specScopeOut: scopeOut.trim() || null,
        specTargetUsers: targetUsers.trim() || null,
        specSuccessCriteria: joinSuccessCriteriaAndNfr(success, nfr).trim() || null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }, [busy, room, openIssues, priorityFeatures, goals, scopeIn, scopeOut, targetUsers, success, nfr, persistRemote]);

  const insertComposerPrompt = useCallback((text: string) => {
    setInput(text);
    window.requestAnimationFrame(() => {
      const el = composerTextAreaRef.current;
      if (!el) return;
      el.focus();
      const len = text.length;
      try {
        el.setSelectionRange(len, len);
      } catch {
        /* ignore */
      }
    });
  }, []);

  const { register: registerWorkNoteComposerInsert } = useWorkNoteComposerInsertControls();
  useEffect(() => {
    if (!inIdeationStage) return;
    registerWorkNoteComposerInsert((text) => insertComposerPrompt(text));
    return () => registerWorkNoteComposerInsert(null);
  }, [inIdeationStage, registerWorkNoteComposerInsert, insertComposerPrompt]);

  const handleConfirmDeliverableAssets = useCallback(
    async (ids: readonly string[]) => {
      const pid = resolvedProjectId.trim();
      if (!pid) return;
      const cur =
        parseRequirementsStateJson(project?.requirementsStateJson).deliverableAssets ??
        stateJsonRef.current.deliverableAssets ??
        [];
      const next = markDeliverableAssetsConfirmed(cur, ids);
      const idSet = new Set(ids.map((x) => String(x).trim()).filter(Boolean));
      const confirmedFullPlan = next.find((a) => idSet.has(a.id) && a.type === "full_plan") ?? null;
      if (!confirmedFullPlan) {
        await persistStateJsonOnly({ deliverableAssets: next });
        return;
      }

      const now = new Date().toISOString();
      const completedInterview = stateJsonRef.current.problemInterview
        ? { ...stateJsonRef.current.problemInterview, active: false, updatedAt: now }
        : undefined;
      const completedState = mergeRequirementsStateJson(stateJsonRef.current, {
        deliverableAssets: next,
        ideationStageCompletedAt: now,
        ideationConfirmedAssetId: confirmedFullPlan.id,
        organizePlannerState: null,
        ...(completedInterview ? { problemInterview: completedInterview } : {}),
        lastSavedAt: now,
      });
      stateJsonRef.current = completedState;
      const { res, json: raw } = await patchSpecWorkspaceRequest(pid, {
        requirementsStateJson: completedState,
        confirmedSpecMarkdown: confirmedFullPlan.content,
        workflowStatus: null,
      });
      const json = raw as SpecWorkspaceProjectPatchResponseBody;
      if (!res.ok || !json.success || !json.data?.project || json.data.patchApplied === false) {
        const msg = json.data?.message || json.message || "아이디어 초안 확정 저장에 실패했습니다.";
        setError(msg);
        showErrorToast(msg);
        return;
      }
      setProject(json.data.project);
      stateJsonRef.current = parseRequirementsStateJson(json.data.project.requirementsStateJson);
      setDeliverableViewerOpen(false);
      setAiInvokePending(false);
      notifyAppFlowProjectContextRefresh();
      showSuccessToast("아이디어 초안이 확정되었습니다. 다음 단계로 이동합니다.");
      router.push(`/requirements?projectId=${encodeURIComponent(pid)}`);
    },
    [resolvedProjectId, project?.requirementsStateJson, persistStateJsonOnly, router, showErrorToast, showSuccessToast]
  );

  const existingHumanUserIds = useMemo(
    () => new Set(members.filter((m) => m.memberType === "HUMAN" && m.userId).map((m) => m.userId as string)),
    [members]
  );
  const remoteLocked = !resolvedProjectId.trim();

  const latestProblemInterviewStateForGate = useCallback((): ProblemInterviewState | null => {
    const candidates = [
      problemInterviewState,
      parseRequirementsStateJson(project?.requirementsStateJson).problemInterview ?? null,
      (stateJsonRef.current.problemInterview as ProblemInterviewState | null | undefined) ?? null,
    ].filter((x): x is ProblemInterviewState => Boolean(x));
    if (!candidates.length) return null;
    return candidates.reduce((best, cur) => {
      const bestCount = problemInterviewStrictFilledCount(best);
      const curCount = problemInterviewStrictFilledCount(cur);
      if (curCount !== bestCount) return curCount > bestCount ? cur : best;
      const bestTime = Date.parse(String(best.updatedAt ?? ""));
      const curTime = Date.parse(String(cur.updatedAt ?? ""));
      return Number.isFinite(curTime) && (!Number.isFinite(bestTime) || curTime > bestTime) ? cur : best;
    });
  }, [problemInterviewState, project?.requirementsStateJson]);

  const organizeStartGenerateFinalProposal = useCallback(async () => {
    if (busy || deliverableGenerateBusy || remoteLocked) return;
    const latestInterviewState = latestProblemInterviewStateForGate();
    const gate = ideationDraftGateStatus(latestInterviewState);
    const slotReadiness = evaluateGenerationReadinessFromSlots({
      orchestration: orchestrationAlignedState,
      definitions: slotDefsForProgress,
    });
    if (!gate.ready) {
      const missingRequired = IDEATION_DRAFT_REQUIRED_SLOTS.filter((slot) => !slotStrictlyFilled(latestInterviewState ?? emptyProblemInterviewState(""), slot));
      const msg =
        slotReadiness.missing.length > 0
          ? `구현 단계로 가기 전 다음 서비스 정의 항목이 아직 확정되지 않았습니다.\n- ${slotReadiness.missing.join("\n- ")}`
          : missingRequired.length
            ? "아이디어 초안 생성 전 필수 정보(서비스 아이디어, 주 사용자, 핵심 문제, 기대 효과)를 먼저 확인해 주세요."
            : `아이디어 초안은 최소 ${IDEATION_DRAFT_MIN_FILLED_SLOTS}개 슬롯 확정 후 생성할 수 있습니다.`;
      setError(msg);
      showErrorToast(msg);
      return;
    }
    setPlannerTypePickerOpen(false);
    await handleGenerateDeliverables([...IDEATION_UNIFIED_PROPOSAL_OUTPUT]);
  }, [
    busy,
    deliverableGenerateBusy,
    remoteLocked,
    latestProblemInterviewStateForGate,
    orchestrationAlignedState,
    slotDefsForProgress,
    handleGenerateDeliverables,
    showErrorToast,
  ]);

  const handleRequestFastPlanDraft = useCallback(async () => {
    const pid = resolvedProjectId.trim();
    if (!pid || busy || deliverableGenerateBusy || remoteLocked) return;
    setDeliverableGenerateBusy(true);
    setError(null);
    try {
      const st = stateJsonRef.current;
      const nowIso = new Date().toISOString();
      appendSingleChatPromptTimeline(buildQuickDesignRequestedTimelineEntry({ projectId: pid, nowIso }));
      const latestInterviewState = latestProblemInterviewStateForGate();
      const trigger = createFastPlanDraftPlatformTrigger({
        projectId: pid,
        userId: sessionUser?.id ?? null,
        createdAt: nowIso,
      });
      const result = runFastPlanDraftFlow({
        trigger,
        projectName: project?.name ?? "",
        projectDescription: project?.description ?? "",
        conversationMessages: ideationConversationOnly.length ? ideationConversationOnly : conversationMessages,
        serviceFlow: serviceFlow ?? st.serviceFlowV1 ?? null,
        orchestration: orchestrationAlignedState,
        slotDefinitions: slotDefsForProgress,
        featurePlanning: st.featurePlanningSlotsV1 ?? null,
        problemInterview: latestInterviewState,
        nowIso,
      });
      let fastPlanDraftV1 = extractFastPlanDraftV1FromRunResult(result);
      let orchestrationAfterDraft = orchestrationAlignedState ?? orchestrationUiState;
      if (!orchestrationAfterDraft && slotDefsForProgress.length) {
        orchestrationAfterDraft = initialOrchestrationStateFromDefinitions(slotDefsForProgress, nowIso);
      }
      if (fastPlanDraftV1 && orchestrationAfterDraft) {
        const quickDesignRunId =
          fastPlanDraftV1.memberRuns.find((r) => r.status === "completed")?.runId ??
          fastPlanDraftV1.memberDrafts[0]?.runId ??
          undefined;
        const slotPatch = buildSlotCandidatePatchesFromFastPlanDrafts({
          memberDrafts: fastPlanDraftV1.memberDrafts,
          orchestration: orchestrationAfterDraft,
          definitions: slotDefsForProgress,
          nowIso,
          runId: quickDesignRunId,
        });
        if (slotPatch.orchestration) orchestrationAfterDraft = slotPatch.orchestration;
        if (slotPatch.slotCandidatePatch) {
          fastPlanDraftV1 = { ...fastPlanDraftV1, slotCandidatePatch: slotPatch.slotCandidatePatch };
        }
        if (slotPatch.patchedSlotKeys.length && slotPatch.slotCandidatePatch) {
          appendSingleChatPromptTimeline(
            buildQuickDesignSlotsPatchedTimelineEntry({
              projectId: pid,
              nowIso,
              patchedSlotKeys: slotPatch.patchedSlotKeys,
              areaCounts: slotPatch.areaCounts,
              runId: slotPatch.slotCandidatePatch.runId,
              shortfallWarnings: buildQuickDesignAreaShortfallWarnings(slotPatch.areaCounts),
              skippedConfirmedSlotKeys: slotPatch.skippedConfirmedSlotKeys,
            }),
          );
        }
      }
      appendSingleChatPromptTimeline(
        buildQuickDesignDraftCreatedTimelineEntry({
          projectId: pid,
          nowIso,
          draftCount: fastPlanDraftV1?.memberDrafts.length ?? result.memberDrafts.length,
        }),
      );
      const proposalContent = buildQuickDesignResultMessage({
        memberDrafts: fastPlanDraftV1?.memberDrafts ?? result.memberDrafts,
        assumptions: fastPlanDraftV1?.assumptions ?? [],
        slotCandidatePatch: fastPlanDraftV1?.slotCandidatePatch ?? null,
      });
      const proposalMessage = buildFastPlanDraftProposalMessage({
        content: proposalContent,
        interviewSuggestions: platformNextActionLabelsForInterviewSuggestions(result.nextActions),
        nowIso,
      });
      await appendServiceFlowWorkshopMessages([proposalMessage]);
      if (fastPlanDraftV1) {
        await persistStateJsonOnly({
          fastPlanDraftV1,
          ...(orchestrationAfterDraft ? { singleChatOrchestrationV1: orchestrationAfterDraft } : {}),
        });
      }
      showSuccessToast(
        `${QUICK_DESIGN_LABEL} 초안을 서비스 정의·분석·설계·디자인 후보로 반영했습니다. SingleChat에서 확인해 주세요.`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : `${QUICK_DESIGN_LABEL} 실행 중 오류가 발생했습니다.`;
      setError(msg);
      showErrorToast(msg);
    } finally {
      setDeliverableGenerateBusy(false);
    }
  }, [
    resolvedProjectId,
    busy,
    deliverableGenerateBusy,
    remoteLocked,
    latestProblemInterviewStateForGate,
    orchestrationAlignedState,
    slotDefsForProgress,
    project?.name,
    project?.description,
    ideationConversationOnly,
    conversationMessages,
    serviceFlow,
    sessionUser?.id,
    appendServiceFlowWorkshopMessages,
    appendSingleChatPromptTimeline,
    persistStateJsonOnly,
    showErrorToast,
    showSuccessToast,
    orchestrationUiState,
  ]);

  const lastFastPlanArtifactIdRef = useRef<string | null>(null);
  const implementationPrepProgressTrackRef = useRef<{
    percent: number;
    phase: ImplementationPrepProgressPhase;
  } | null>(null);
  const implementationPrepProgressStartedAtRef = useRef<number | null>(null);
  /** true면 pseudo-progress interval이 running 메시지로 덮어쓰지 않음 */
  const implementationPrepProgressFrozenRef = useRef(false);

  const applyLocalConversationMessages = useCallback(
    (messages: readonly RequirementsMessage[]) => {
      const pid = resolvedProjectId.trim();
      if (!pid) return;
      const nextRoom = patchRequirementsRoomConversationMessages(roomRef.current, pid, [...messages]);
      roomRef.current = nextRoom;
      setRoom(nextRoom);
    },
    [resolvedProjectId],
  );

  const handleConfirmFastPlanDraftSlots = useCallback(async () => {
    const pid = resolvedProjectId.trim();
    if (!pid) {
      showErrorToast("프로젝트를 먼저 저장해 주세요.");
      return;
    }
    if (busy || deliverableGenerateBusy) {
      showErrorToast("다른 작업이 진행 중입니다. 완료 후 다시 시도해 주세요.");
      return;
    }
    if (remoteLocked) {
      showErrorToast("원격 저장소 잠금 상태입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    const draft = stateJsonRef.current.fastPlanDraftV1;
    if (!draft?.memberDrafts?.length) {
      showErrorToast(`확인할 Quick Design 초안이 없습니다. 먼저 「${QUICK_DESIGN_LABEL}」을 실행해 주세요.`);
      return;
    }
    const orchestrationForConfirm = orchestrationAlignedState ?? orchestrationUiState;
    if (!orchestrationForConfirm) {
      showErrorToast("슬롯 상태를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setDeliverableGenerateBusy(true);
    const prepStartIso = new Date().toISOString();
    const initialPrepSnapshot = buildPseudoImplementationPrepProgress(0);
    implementationPrepProgressFrozenRef.current = false;
    implementationPrepProgressStartedAtRef.current = Date.now();
    implementationPrepProgressTrackRef.current = {
      percent: initialPrepSnapshot.percent,
      phase: initialPrepSnapshot.phase,
    };
    applyLocalConversationMessages(
      upsertImplementationPrepProgressMessage({
        messages: roomRef.current.requirementsConversation.messages,
        progressStatus: "running",
        snapshot: initialPrepSnapshot,
        nowIso: prepStartIso,
      }),
    );
    showSuccessToast("Quick Design 확정 중입니다. LLM 설정이 켜져 있으면 1분 이상 걸릴 수 있습니다.");
    try {
      const st = stateJsonRef.current;
      const { res, json } = await postQuickDesignConfirm(pid, {
        mode: "planning",
        projectName: project?.name ?? "",
        projectDescription: project?.description ?? "",
        requirementsStateJson: st,
        conversationMessages: ideationConversationOnly.length ? ideationConversationOnly : conversationMessages,
        slotDefinitions: slotDefsForProgress,
        serviceFlow: serviceFlow ?? st.serviceFlowV1 ?? null,
        problemInterview: latestProblemInterviewStateForGate(),
        sourceStage: resolveAuthoritativeOrchestrationStage(st),
      });
      if (!res.ok || !json.success || !json.data || json.data.mode !== "planning") {
        const failureMessage = json.message || "Quick Design 확정에 실패했습니다.";
        implementationPrepProgressFrozenRef.current = true;
        implementationPrepProgressStartedAtRef.current = null;
        applyLocalConversationMessages(
          upsertImplementationPrepProgressMessage({
            messages: removeImplementationPrepProgressMessages(
              roomRef.current.requirementsConversation.messages,
            ),
            progressStatus: "failed",
            nowIso: new Date().toISOString(),
            errorMessage: failureMessage,
          }),
        );
        showErrorToast(failureMessage);
        return;
      }
      const flowResult = json.data;
      if (!flowResult.statePatch) {
        const failureMessage = "Quick Design 확정 결과를 적용할 수 없습니다.";
        implementationPrepProgressFrozenRef.current = true;
        implementationPrepProgressStartedAtRef.current = null;
        applyLocalConversationMessages(
          upsertImplementationPrepProgressMessage({
            messages: removeImplementationPrepProgressMessages(
              roomRef.current.requirementsConversation.messages,
            ),
            progressStatus: "failed",
            nowIso: new Date().toISOString(),
            errorMessage: failureMessage,
          }),
        );
        showErrorToast(failureMessage);
        return;
      }

      const statePatchWithTimeline = flowResult.timelineEntries?.length
        ? {
            ...flowResult.statePatch,
            promptTimeline: appendIdeationBootstrapPromptTimelineBatch(stateJsonRef.current.promptTimeline, [
              ...(flowResult.timelineEntries as import("@/lib/requirements/requirementsStateJson").RequirementsPromptTimelineEntry[]),
            ]),
          }
        : flowResult.statePatch;
      const persisted = await persistStateJsonOnly(statePatchWithTimeline);
      if (!persisted) {
        const failureMessage = "Quick Design 확정 결과 저장에 실패했습니다. 다시 시도해 주세요.";
        implementationPrepProgressFrozenRef.current = true;
        implementationPrepProgressStartedAtRef.current = null;
        applyLocalConversationMessages(
          upsertImplementationPrepProgressMessage({
            messages: removeImplementationPrepProgressMessages(
              roomRef.current.requirementsConversation.messages,
            ),
            progressStatus: "failed",
            nowIso: new Date().toISOString(),
            errorMessage: failureMessage,
          }),
        );
        showErrorToast(failureMessage);
        return;
      }
      lastFastPlanArtifactIdRef.current = flowResult.primaryArtifactId ?? null;
      implementationPrepProgressFrozenRef.current = true;
      implementationPrepProgressStartedAtRef.current = null;
      implementationPrepProgressTrackRef.current = null;
      const completedAtIso = new Date().toISOString();
      applyLocalConversationMessages(
        upsertImplementationPrepProgressMessage({
          messages: roomRef.current.requirementsConversation.messages,
          progressStatus: "completed",
          snapshot: buildImplementationPrepCompletedSnapshot(),
          nowIso: completedAtIso,
        }),
      );
      if (flowResult.messages?.[0]) {
        const seedMessage = flowResult.messages[0];
        const seedCreatedAt = new Date(
          Math.max(
            Date.parse(completedAtIso) + 1,
            Date.parse(String(seedMessage.createdAt ?? completedAtIso)) || 0,
          ),
        ).toISOString();
        await appendServiceFlowWorkshopMessages([
          { ...seedMessage, createdAt: seedCreatedAt },
        ]);
      }
      showSuccessToast(flowResult.userFacingSummary ?? json.message ?? "Quick Design을 확정했습니다.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Quick Design 확정 처리 중 오류가 발생했습니다.";
      implementationPrepProgressFrozenRef.current = true;
      implementationPrepProgressStartedAtRef.current = null;
      applyLocalConversationMessages(
        upsertImplementationPrepProgressMessage({
          messages: removeImplementationPrepProgressMessages(
            roomRef.current.requirementsConversation.messages,
          ),
          progressStatus: "failed",
          nowIso: new Date().toISOString(),
          errorMessage: msg,
        }),
      );
      showErrorToast(msg);
    } finally {
      implementationPrepProgressFrozenRef.current = false;
      implementationPrepProgressTrackRef.current = null;
      implementationPrepProgressStartedAtRef.current = null;
      setDeliverableGenerateBusy(false);
    }
  }, [
    resolvedProjectId,
    busy,
    deliverableGenerateBusy,
    remoteLocked,
    orchestrationAlignedState,
    orchestrationUiState,
    slotDefsForProgress,
    project?.name,
    project?.description,
    ideationConversationOnly,
    conversationMessages,
    serviceFlow,
    latestProblemInterviewStateForGate,
    persistStateJsonOnly,
    appendServiceFlowWorkshopMessages,
    applyLocalConversationMessages,
    appendSingleChatPromptTimeline,
    showErrorToast,
    showSuccessToast,
  ]);

  useEffect(() => {
    if (!deliverableGenerateBusy) return;
    const timer = window.setInterval(() => {
      if (implementationPrepProgressFrozenRef.current) return;
      const startedAt = implementationPrepProgressStartedAtRef.current;
      if (startedAt == null) return;
      const snapshot = buildPseudoImplementationPrepProgress(Date.now() - startedAt);
      const track = implementationPrepProgressTrackRef.current;
      if (
        !shouldRefreshImplementationPrepProgressMessage({
          previousPercent: track?.percent ?? null,
          previousPhase: track?.phase ?? null,
          next: snapshot,
        })
      ) {
        return;
      }
      implementationPrepProgressTrackRef.current = {
        percent: snapshot.percent,
        phase: snapshot.phase,
      };
      applyLocalConversationMessages(
        upsertImplementationPrepProgressMessage({
          messages: roomRef.current.requirementsConversation.messages,
          progressStatus: "running",
          snapshot,
          nowIso: new Date().toISOString(),
        }),
      );
    }, 450);
    return () => window.clearInterval(timer);
  }, [deliverableGenerateBusy, applyLocalConversationMessages]);

  const handleGenerateFastPlanFromCurrentContext = useCallback(async () => {
    const pid = resolvedProjectId.trim();
    const nowIso = new Date().toISOString();
    const readiness = evaluateFastPlanGenerationHandoffReadiness({
      projectId: pid,
      busy,
      deliverableGenerateBusy,
      remoteLocked,
      conversationStatus,
      projectLoaded: Boolean(project),
    });
    if (!readiness.ready) {
      const reason = readiness.reason ?? "현재 기획안을 생성할 수 없습니다.";
      showErrorToast(reason);
      appendSingleChatPromptTimeline(
        buildFastPlanGenerationBlockedTimelineEntry({
          projectId: pid || "unknown",
          nowIso,
          reason,
          blockedBy: readiness.blockedBy ?? "blocked",
        }),
      );
      return;
    }

    setDeliverableGenerateBusy(true);
    setError(null);
    try {
      const st = stateJsonRef.current;
      appendSingleChatPromptTimeline(
        buildFastPlanDraftGenerationHandoffTimeline({
          actionLabel: FAST_PLAN_DRAFT_ACTION_GENERATE,
          projectId: pid,
          nowIso,
        })[1]!,
      );

      const latestInterviewState = latestProblemInterviewStateForGate();
      const slotReadiness = evaluateGenerationReadinessFromSlots({
        orchestration: orchestrationAlignedState,
        definitions: slotDefsForProgress,
      });
      if (slotReadiness.missing.length > 0) {
        showSuccessToast("부족한 항목은 AI가 후보로 보완해 기획안을 생성합니다.");
      }
      const result = generateFastPlanFromCurrentContext({
        projectId: pid,
        projectName: project?.name ?? "",
        projectDescription: project?.description ?? "",
        conversationMessages: ideationConversationOnly.length ? ideationConversationOnly : conversationMessages,
        serviceFlow: serviceFlow ?? st.serviceFlowV1 ?? null,
        orchestration: orchestrationAlignedState,
        slotDefinitions: slotDefsForProgress,
        featurePlanning: st.featurePlanningSlotsV1 ?? null,
        problemInterview: latestInterviewState,
        sourceStage: resolveAuthoritativeOrchestrationStage(st),
        nowIso,
      });
      const deliverable = projectArtifactToDeliverableAsset(result.artifact, pid);
      const priorArtifacts = (st.projectArtifacts ?? []).filter((a) => a.type !== "fast_prototype_plan");
      const priorDeliverables = (st.deliverableAssets ?? []).filter((d) => {
        const t = String(d.title ?? "").trim();
        return t !== "기획안" && t !== "프로토타입 기획안";
      });
      await persistStateJsonOnly({
        projectArtifacts: [...priorArtifacts, result.artifact],
        deliverableAssets: [...priorDeliverables, deliverable],
        fastPlanGenerationV1: result.fastPlanGenerationV1,
        ...(result.orchestration ? { singleChatOrchestrationV1: result.orchestration } : {}),
      });
      lastFastPlanArtifactIdRef.current = deliverable.id;
      const completionMessage = buildFastPlanArtifactCreatedChatMessage({
        artifactTitle: result.artifact.title,
        artifactId: deliverable.id,
        nowIso,
      });
      await appendServiceFlowWorkshopMessages([completionMessage]);
      appendSingleChatPromptTimeline(
        buildFastPlanArtifactCreatedTimelineEntry({
          artifactId: deliverable.id,
          projectId: pid,
          nowIso,
        }),
      );
      openDeliverableViewer([deliverable.id], deliverable.id);
      showSuccessToast(result.userFacingSummary);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "기획안 생성 중 오류가 발생했습니다.";
      setError(msg);
      showErrorToast(msg);
      appendSingleChatPromptTimeline(
        buildFastPlanGenerationFailedTimelineEntry({
          projectId: pid,
          nowIso,
          error: msg,
        }),
      );
    } finally {
      setDeliverableGenerateBusy(false);
    }
  }, [
    resolvedProjectId,
    busy,
    deliverableGenerateBusy,
    remoteLocked,
    conversationStatus,
    project,
    latestProblemInterviewStateForGate,
    orchestrationAlignedState,
    slotDefsForProgress,
    project?.name,
    project?.description,
    ideationConversationOnly,
    conversationMessages,
    serviceFlow,
    persistStateJsonOnly,
    appendServiceFlowWorkshopMessages,
    appendSingleChatPromptTimeline,
    openDeliverableViewer,
    showErrorToast,
    showSuccessToast,
  ]);

  const onForceGeneratePlanNow = useCallback(() => {
    void handleRequestFastPlanDraft();
  }, [handleRequestFastPlanDraft]);

  const resolveQuickDesignArtifactIdsForView = useCallback((): readonly string[] => {
    for (let i = conversationMessages.length - 1; i >= 0; i--) {
      const meta = conversationMessages[i]?.meta;
      const ids = quickDesignArtifactIdsFromMessageMeta(meta);
      if (ids.length) return ids;
    }
    const st = stateJsonRef.current;
    const fromDeliverables = (st.deliverableAssets ?? [])
      .map((d) => String(d.id ?? "").trim())
      .filter(Boolean);
    if (fromDeliverables.length) return fromDeliverables;
    const fallback = lastFastPlanArtifactIdRef.current;
    return fallback ? [fallback] : [];
  }, [conversationMessages]);

  const handleStartImplementation = useCallback(async () => {
    const pid = resolvedProjectId.trim();
    if (!pid) {
      showErrorToast("프로젝트가 연결된 뒤 구현 단계로 이동할 수 있습니다.");
      return;
    }
    if (busy || remoteLocked) {
      showErrorToast("처리 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    const readiness = evaluateImplementationStartReadiness({
      orchestration: orchestrationAlignedState,
      definitions: slotDefsForProgress,
      projectArtifacts: stateJsonRef.current.projectArtifacts,
      artifactOrchestrationV1: stateJsonRef.current.artifactOrchestrationV1,
    });
    const nowIso = new Date().toISOString();
    appendSingleChatPromptTimeline(
      buildGenerationReadinessCheckedTimelineEntry({
        projectId: pid,
        nowIso,
        ready: readiness.ready,
        detail: readiness.reason ?? "implementation_start",
      }),
    );
    if (!readiness.ready) {
      showErrorToast(
        readiness.reason ?? "구현을 시작하려면 Quick Design 확정으로 필수 슬롯을 먼저 확정해 주세요.",
      );
      return;
    }
    await persistStateJsonOnly({
      requirementsOrchestrationStageV1: patchRequirementsStageForImplementationStart({
        existing: stateJsonRef.current.requirementsOrchestrationStageV1,
        nowIso,
      }),
    });
    router.replace(`/execution?projectId=${encodeURIComponent(pid)}`);
    showSuccessToast("구현 단계로 이동합니다.");
  }, [
    resolvedProjectId,
    busy,
    remoteLocked,
    orchestrationAlignedState,
    slotDefsForProgress,
    persistStateJsonOnly,
    appendSingleChatPromptTimeline,
    router,
    showErrorToast,
    showSuccessToast,
  ]);

  const handlePlanningImplementationSeedChip = useCallback(
    async (label: string) => {
      const trimmed = String(label ?? "").trim();
      const pid = resolvedProjectId.trim();
      if (!pid || busy || remoteLocked) return;
      const orch = orchestrationAlignedState;
      const defs = slotDefsForProgress;
      const timeline = stateJsonRef.current.promptTimeline;
      const nowIso = new Date().toISOString();
      const sampleDataSpecV1 = stateJsonRef.current.sampleDataSpecV1 ?? null;

      if (trimmed === PLANNING_IMPLEMENTATION_SEED_CHECK_CHIP) {
        const result = buildPlanningImplementationSeedCheckResult({
          projectId: pid,
          orchestration: orch,
          definitions: defs,
          promptTimeline: timeline,
          nowIso,
          sampleDataSpecV1,
        });
        await appendServiceFlowWorkshopMessages([result.message]);
        await persistStateJsonOnly({
          ...result.orchestrationPatch,
          promptTimeline: [...result.orchestrationPatch.promptTimeline],
        });
        showSuccessToast(
          result.seed.readiness.ready
            ? "구현 작업안 초안 생성이 가능한 준비도입니다."
            : "구현 준비도 점검 결과를 확인해 주세요.",
        );
        return;
      }
      if (trimmed === PLANNING_IMPLEMENTATION_SEED_SUPPLEMENT_CHIP) {
        const result = buildPlanningImplementationSeedSupplementResult({
          projectId: pid,
          orchestration: orch,
          definitions: defs,
          promptTimeline: timeline,
          nowIso,
          sampleDataSpecV1,
        });
        await appendServiceFlowWorkshopMessages([result.message]);
        await persistStateJsonOnly({
          ...result.orchestrationPatch,
          promptTimeline: [...result.orchestrationPatch.promptTimeline],
        });
        showSuccessToast("부족 슬롯에 AI 후보를 반영했습니다. 확인 후 확정해 주세요.");
        return;
      }
      if (trimmed === PLANNING_IMPLEMENTATION_SEED_GENERATE_CHIP) {
        const result = buildPlanningImplementationSeedGenerateCandidateResult({
          projectId: pid,
          projectName: project?.name,
          orchestration: orch,
          definitions: defs,
          promptTimeline: timeline,
          nowIso,
          sampleDataSpecV1,
        });
        await appendServiceFlowWorkshopMessages([result.message]);
        await persistStateJsonOnly({
          ...result.orchestrationPatch,
          promptTimeline: [...result.orchestrationPatch.promptTimeline],
        });
        showSuccessToast("Implementation Seed 후보를 생성했습니다 (candidate, 자동 확정 없음).");
      }
    },
    [
      resolvedProjectId,
      busy,
      remoteLocked,
      orchestrationAlignedState,
      slotDefsForProgress,
      appendServiceFlowWorkshopMessages,
      persistStateJsonOnly,
      showSuccessToast,
      project?.name,
    ],
  );

  const latestImplementationCandidateRefineMeta = useMemo(() => {
    for (let i = conversationMessages.length - 1; i >= 0; i -= 1) {
      const m = conversationMessages[i];
      if (m?.meta?.internalType !== IMPLEMENTATION_CANDIDATE_REFINE_RESULT_INTERNAL_TYPE) continue;
      return m.meta?.implementationCandidateRefineResult ?? null;
    }
    return null;
  }, [conversationMessages]);

  const latestImplementationCandidateRefineApplyMeta = useMemo(() => {
    for (let i = conversationMessages.length - 1; i >= 0; i -= 1) {
      const m = conversationMessages[i];
      if (m?.meta?.internalType !== IMPLEMENTATION_CANDIDATE_REFINE_APPLY_RESULT_INTERNAL_TYPE) continue;
      return m.meta?.implementationCandidateRefineApplyResult ?? null;
    }
    return null;
  }, [conversationMessages]);

  const planningRefineCandidateItems = useMemo(() => {
    let touchedFromMessage: readonly ImplementationSeedGapKey[] | undefined;
    let sawQuickDesignReadyMessage = false;
    for (let i = conversationMessages.length - 1; i >= 0; i -= 1) {
      const m = conversationMessages[i];
      if (m?.meta?.internalType !== QUICK_DESIGN_IMPLEMENTATION_READY_INTERNAL_TYPE) continue;
      sawQuickDesignReadyMessage = true;
      const keys = m.meta?.implementationCandidateGapKeys;
      if (Array.isArray(keys) && keys.length) {
        touchedFromMessage = keys
          .map((k) => String(k ?? "").trim())
          .filter(Boolean) as ImplementationSeedGapKey[];
        break;
      }
    }
    const keys = resolveImplementationCandidateGapKeys({
      touchedGapKeys: touchedFromMessage,
      autoCandidateGenerated: Boolean(touchedFromMessage?.length) || sawQuickDesignReadyMessage,
      orchestration: orchestrationAlignedState ?? orchestrationUiState,
      definitions: slotDefsForProgress,
    });
    let items = buildImplementationCandidateItems(keys);
    if (implementationRefineFilterNeedsConfirmationOnly) {
      const pendingKeys =
        latestImplementationCandidateRefineApplyMeta?.remainingKeys ??
        latestImplementationCandidateRefineMeta?.needsConfirmationKeys ??
        [];
      const pending = new Set(pendingKeys);
      if (pending.size) {
        items = items.filter((item) => pending.has(item.key));
      }
    }
    return items;
  }, [
    conversationMessages,
    orchestrationAlignedState,
    orchestrationUiState,
    slotDefsForProgress,
    implementationRefineFilterNeedsConfirmationOnly,
    latestImplementationCandidateRefineMeta,
    latestImplementationCandidateRefineApplyMeta,
  ]);

  const handleImplementationCandidateRefineCta = useCallback(
    async (action: ReturnType<typeof resolveImplementationCandidateRefineCtaAction>) => {
      if (!action) return;
      const reviewMeta = latestImplementationCandidateRefineMeta;
      const applyMeta = latestImplementationCandidateRefineApplyMeta;
      const orch = orchestrationAlignedState ?? orchestrationUiState;
      if (action === "review_later") {
        setImplementationRefineDrawerOpen(false);
        setImplementationRefineFilterNeedsConfirmationOnly(false);
        showSuccessToast("나중에 검토하도록 현재 상태를 유지했습니다.");
        return;
      }
      if (action === "edit_by_item") {
        setImplementationRefineFilterNeedsConfirmationOnly(false);
        setImplementationRefineDrawerOpen(true);
        return;
      }
      if (action === "view_needs_confirmation") {
        setImplementationRefineFilterNeedsConfirmationOnly(true);
        setImplementationRefineDrawerOpen(true);
        return;
      }
      if (action === "review_again") {
        const mode = reviewMeta?.mode ?? applyMeta?.mode ?? "all";
        const keys = ((reviewMeta?.keys?.length ? reviewMeta.keys : applyMeta?.keys) ??
          []) as ImplementationSeedGapKey[];
        implementationCandidateRefineRequestRef.current = {
          mode,
          kind: "review",
          keys,
          labels: keys.map((k) => implementationCandidateLabelForKey(String(k))),
          requestedAt: new Date().toISOString(),
        };
        insertComposerPrompt(
          mode === "all"
            ? REFINE_ALL_IMPLEMENTATION_CANDIDATES_PROMPT
            : `다음 기획정보 후보 항목을 보완해 주세요: ${keys
                .map((k) => implementationCandidateLabelForKey(String(k)))
                .join(", ")}`,
        );
        return;
      }
      if ((action === "apply_all" || action === "apply_selected") && orch) {
        const keys = (reviewMeta?.keys ?? []) as ImplementationSeedGapKey[];
        if (!keys.length) {
          showErrorToast("적용할 보완 항목을 찾을 수 없습니다. 먼저 후보 항목 검토를 실행해 주세요.");
          return;
        }
        const nowIso = new Date().toISOString();
        const nextOrch = buildApplyImplementationCandidateRefinePatches({
          keys,
          orchestration: orch,
          definitions: slotDefsForProgress,
          nowIso,
        });
        await persistStateJsonOnly({ singleChatOrchestrationV1: nextOrch });
        const labels = keys.map((k) => implementationCandidateLabelForKey(k));
        const applyMode = reviewMeta?.mode === "selected" ? "selected" : "all";
        implementationCandidateRefineRequestRef.current = {
          mode: applyMode,
          kind: "apply",
          keys,
          labels,
          requestedAt: nowIso,
        };
        insertComposerPrompt(
          buildApplyImplementationCandidateRefineComposerPrompt({
            mode: applyMode,
            labels,
          }),
        );
        showSuccessToast(
          `${labels.length}개 항목을 보완안 적용 대상(partial)으로 반영했습니다. 전송 후 AI가 적용 결과를 정리합니다.`,
        );
        return;
      }
    },
    [
      latestImplementationCandidateRefineMeta,
      latestImplementationCandidateRefineApplyMeta,
      orchestrationAlignedState,
      orchestrationUiState,
      slotDefsForProgress,
      persistStateJsonOnly,
      insertComposerPrompt,
      showErrorToast,
      showSuccessToast,
    ],
  );

  const handleFastPlanDraftSuggestionPick = useCallback(
    (label: string) => {
      const trimmed = normalizeFastPlanDraftChipLabel(label);
      if (
        trimmed === IMPLEMENTATION_STAGE_NAVIGATE_LABEL ||
        trimmed === IMPLEMENTATION_WORK_PLAN_DRAFT_GENERATE_LABEL
      ) {
        void handleStartImplementation();
        return;
      }
      if (trimmed === PLANNING_ENV_SETTINGS_LABEL) {
        const pid = resolvedProjectId.trim();
        if (!pid) {
          showErrorToast("프로젝트를 먼저 저장해 주세요.");
          return;
        }
        setExecutionEnvironmentModalOpen(true);
        return;
      }
      if (trimmed === IMPLEMENTATION_PREP_LOG_VIEW_CHIP_LABEL) {
        setPromptDrawerOpen(true);
        return;
      }
      if (
        isImplementationCandidateRefineCtaLabel(trimmed) ||
        isImplementationCandidateRefineApplyResultCtaLabel(trimmed)
      ) {
        void handleImplementationCandidateRefineCta(resolveImplementationCandidateRefineCtaAction(trimmed));
        return;
      }
      if (
        trimmed === PLANNING_IMPLEMENTATION_SEED_CHECK_CHIP ||
        trimmed === PLANNING_IMPLEMENTATION_SEED_SUPPLEMENT_CHIP ||
        trimmed === PLANNING_IMPLEMENTATION_SEED_GENERATE_CHIP
      ) {
        void handlePlanningImplementationSeedChip(trimmed);
        return;
      }
      const artifactFollowUp = resolveFastPlanArtifactFollowUpAction(trimmed);
      if (artifactFollowUp === "view_artifacts") {
        const artifactIds = resolveQuickDesignArtifactIdsForView();
        const pid = resolvedProjectId.trim();
        if (pid) {
          appendSingleChatPromptTimeline(
            buildPlanningArtifactViewRequestedTimelineEntry({
              projectId: pid,
              nowIso: new Date().toISOString(),
              artifactId: artifactIds[0] ?? null,
            }),
          );
        }
        if (artifactIds.length) {
          openDeliverableViewer(artifactIds, artifactIds[0] ?? null);
        } else {
          setArtifactHubOpen(true);
        }
        return;
      }
      if (artifactFollowUp === "start_implementation") {
        void handleStartImplementation();
        return;
      }
      if (artifactFollowUp === "refine") {
        if (trimmed === PLANNING_INFO_REFINE_LABEL) {
          setImplementationRefineDrawerOpen(true);
          return;
        }
        insertComposerPrompt("추가 보완을 이어가겠습니다. 우선 수정할 항목을 알려 주세요.");
        return;
      }
      if (isFastPlanArtifactFollowUpLabel(trimmed)) return;

      const action = resolveFastPlanDraftSuggestionAction(trimmed);
      const nowIso = new Date().toISOString();
      const pid = resolvedProjectId.trim() || "unknown";

      if (action) {
        appendSingleChatPromptTimeline(
          buildFastPlanDraftSuggestionPickedTimelineEntry({
            actionLabel: trimmed,
            routingDecision: action,
            projectId: pid,
            nowIso,
          }),
        );
      }

      if (action === "confirm_draft_slots") {
        void handleConfirmFastPlanDraftSlots();
        return;
      }
      if (action === "view_artifacts") {
        const artifactIds = resolveQuickDesignArtifactIdsForView();
        if (artifactIds.length) {
          openDeliverableViewer(artifactIds, artifactIds[0] ?? null);
        } else {
          setArtifactHubOpen(true);
        }
        return;
      }
      if (action === "start_implementation") {
        void handleStartImplementation();
        return;
      }
      if (action === "request_draft") {
        void handleRequestFastPlanDraft();
        return;
      }
      const composerPrompt = action ? composerPromptForFastPlanDraftSuggestion(action) : null;
      if (composerPrompt) {
        insertComposerPrompt(composerPrompt);
        return;
      }
      if (action) return;
      interviewSuggestionPickRef.current = storeInterviewSuggestionPick(label);
      insertComposerPrompt(label);
    },
    [
      resolveQuickDesignArtifactIdsForView,
      orchestrationAlignedState,
      slotDefsForProgress,
      handleConfirmFastPlanDraftSlots,
      handleStartImplementation,
      handleRequestFastPlanDraft,
      appendSingleChatPromptTimeline,
      insertComposerPrompt,
      openDeliverableViewer,
      setArtifactHubOpen,
      resolvedProjectId,
      showErrorToast,
      showSuccessToast,
      handlePlanningImplementationSeedChip,
      handleImplementationCandidateRefineCta,
      latestImplementationCandidateRefineApplyMeta,
    ],
  );

  const trimmedProjectName = project?.name?.trim();
  const headerProjectName = trimmedProjectName
    ? trimmedProjectName
    : !resolvedProjectId.trim()
      ? "새 아이디어 (프로젝트 미연결)"
      : loadError
        ? "프로젝트"
        : !project
          ? "불러오는 중…"
          : "이름 미설정";

  const suppressInitialServiceFlowVisibleMessage = useMemo(() => {
    if (conversationStatus !== "loaded") return false;
    const st = parseRequirementsStateJson(project?.requirementsStateJson);
    return shouldSuppressInitialServiceFlowOnProjectEntry(st, serviceFlowWorkshopPersisted.length);
  }, [conversationStatus, project?.requirementsStateJson, serviceFlowWorkshopPersisted.length, fetchNonce]);

  const serviceFlowAlternativeCanvas = useServiceFlowSingleChatBridge({
    projectId: resolvedProjectId.trim(),
    projectName: headerProjectName,
    projectDescription: String(project?.description ?? ""),
    suppressInitialAutoServiceFlowVisibleMessage: suppressInitialServiceFlowVisibleMessage,
    ideationParticipantHumanMemberIds,
    ideationAssets: (stateJsonRef.current.deliverableAssets ?? []).map((a) => ({
      type: a.type,
      title: a.title,
      content: a.content,
    })),
    flow: serviceFlow,
    onChangeFlow: (next) => void persistServiceFlowWithOrchestration(next),
    members,
    currentUserId: sessionUser?.id ?? null,
    ideationReady: ideationReadyForServiceFlow,
    generatingDraft: serviceFlowDraftBusy,
    draftGenerationCount: serviceFlowDraft.serviceFlowDraftGenerationCount,
    persistedServiceFlowMessages: serviceFlowWorkshopPersisted,
    onAppendPersistedServiceFlowMessages: appendServiceFlowWorkshopMessages,
    platformScreenAiMemberIds: serviceFlowScreenCatalogIds,
    onSingleChatPromptTrace: appendSingleChatPromptTimeline,
    orchestrationContext: {
      singleChatOrchestrationV1: orchestrationAlignedState,
      requirementsOrchestrationStageV1: stateJsonRef.current.requirementsOrchestrationStageV1,
      featurePlanningSlotsV1: stateJsonRef.current.featurePlanningSlotsV1,
      featureDetailSlotsV1: stateJsonRef.current.featureDetailSlotsV1,
      requirementsIntentOrchestrationV1: stateJsonRef.current.requirementsIntentOrchestrationV1,
    },
    onAnalyzeStatePatch: async (patch) => {
      const nextPatch =
        patch.requirementsIntentOrchestrationV1 ?
          {
            ...patch,
            requirementsIntentOrchestrationV1: compactRequirementsIntentOrchestration(
              patch.requirementsIntentOrchestrationV1,
            ),
          }
        : patch;
      stateJsonRef.current = mergeRequirementsStateJson(stateJsonRef.current, nextPatch);
      await persistStateJsonOnly(nextPatch);
    },
    serviceFlowSendRef,
    onEnterActorEdit: () => {
      setActorEditPhase((p) => nextActorEditingPhase(p, "open"));
      setActorEditOpen(true);
    },
    onEnterFeatureDetailEdit: () => void featureDetailEditing.openEdit(),
    onOpenArtifactHub: () => setArtifactHubOpen(true),
    orchestrationSlotDefinitions: slotDefsForProgress,
  });

  const handleActorEditSave = useCallback(
    async (draft: ServiceFlowActorEditDraft) => {
      if (!serviceFlow) return;
      setActorEditBusy(true);
      setActorEditPhase((p) => nextActorEditingPhase(p, "save"));
      try {
        const nextFlow = appendCandidateActorToFlow({
          flow: serviceFlow,
          draft,
          projectionId: orchestrationAlignedState?.slotDefinitionsHash ?? undefined,
        });
        setActorEditPhase((p) => nextActorEditingPhase(p, "recompute_ok"));
        await persistServiceFlowWithOrchestration(nextFlow);
        setServiceFlow(nextFlow);
        setActorEditOpen(false);
        setActorEditPhase("CONFIRMED");
        showSuccessToast(`후보 액터 "${draft.name.trim()}"을(를) 저장했습니다.`);
      } catch {
        setActorEditPhase((p) => nextActorEditingPhase(p, "recompute_fail"));
        showErrorToast("액터 저장 후 오케스트레이션 갱신에 실패했습니다.");
      } finally {
        setActorEditBusy(false);
      }
    },
    [serviceFlow, persistServiceFlowWithOrchestration, showSuccessToast, showErrorToast, orchestrationAlignedState],
  );

  const openAssignmentDrawerForStep = useCallback((stepId: string) => {
    setAssignmentStepId(stepId);
    setAssignmentDrawerOpen(true);
  }, []);

  const handleAssignmentSave = useCallback(
    async (draft: ServiceFlowAssignmentEditDraft) => {
      if (!serviceFlow) return;
      setAssignmentBusy(true);
      try {
        const nextFlow = applyAssignmentEditToFlow({
          flow: serviceFlow,
          draft,
          projectionId: orchestrationAlignedState?.slotDefinitionsHash ?? undefined,
        });
        await persistServiceFlowWithOrchestration(nextFlow);
        setServiceFlow(nextFlow);
        const meta = nextFlow.lastAssignmentMutation;
        if (meta) {
          appendSingleChatPromptTimeline({
            stage: "service-flow",
            stageGroup: "service-planning",
            workspaceScreenKey: "requirements_service_flow",
            action: "assignment_mutation",
            source: "internal",
            createdAt: meta.createdAt,
            routingDecision: meta.assignmentAction,
            responseText: [
              `assignment:${meta.assignmentAction}`,
              `step:${meta.stepId}`,
              meta.previousActorId ? `from:${meta.previousActorId}` : "",
              meta.nextActorId ? `to:${meta.nextActorId}` : "",
              `type:${meta.assignmentType}`,
            ]
              .filter(Boolean)
              .join(" "),
          });
        }
        setAssignmentDrawerOpen(false);
        setAssignmentStepId(null);
        showSuccessToast("단계 담당 배정을 저장했습니다.");
      } catch {
        showErrorToast("담당 저장 후 오케스트레이션 갱신에 실패했습니다.");
      } finally {
        setAssignmentBusy(false);
      }
    },
    [
      serviceFlow,
      persistServiceFlowWithOrchestration,
      orchestrationAlignedState,
      appendSingleChatPromptTimeline,
      showSuccessToast,
      showErrorToast,
    ],
  );

  const handleCanvasHubSelect = useCallback(
    (item: ProjectCanvasArtifact) => {
      setCanvasHubOpen(false);
      switch (item.type) {
        case "service-flow":
          setActiveCanvasView("service-flow");
          return;
        case "alternative-flow":
          serviceFlowAlternativeCanvas.openAlternativeCanvas();
          return;
        case "baseline-flow":
          setActiveCanvasView("baseline-flow");
          return;
        case "feature-definition":
          setActiveCanvasView("feature-definition");
          return;
        case "feature-detail":
          setActiveCanvasView("feature-detail");
          return;
        default:
          return;
      }
    },
    [serviceFlowAlternativeCanvas],
  );

  const handleArtifactHubSelect = useCallback(
    (entry: ProjectArtifactHubEntry) => {
      const ids = deliverableViewerAssetIds.length ? deliverableViewerAssetIds : [entry.assetId];
      openDeliverableViewer(ids, entry.assetId);
    },
    [deliverableViewerAssetIds, openDeliverableViewer],
  );

  const handleArtifactHubGenerate = useCallback(
    (type: ProjectArtifactType) => {
      setArtifactHubOpen(false);
      void handleGenerateProjectArtifact(type);
    },
    [handleGenerateProjectArtifact],
  );

  const onDownloadConversationMarkdown = useCallback(() => {
    const pid = resolvedProjectId.trim();
    const projectLabel = (project?.name ?? "").trim() || "서비스기획";
    const list = ideationConversationOnly.length ? ideationConversationOnly : conversationMessages;
    const md = buildConversationMarkdown({
      heading: "# 서비스 기획 대화 내역",
      scopeLines: [`- projectId: ${pid || "(미연결)"}`, `- exportedAt: ${new Date().toISOString()}`],
      messages: list,
      meLabel: String(sessionUser?.name ?? "").trim() || "나",
    });
    downloadConversationMarkdownFile({ markdown: md, filenameStem: projectLabel });
  }, [conversationMessages, ideationConversationOnly, project?.name, resolvedProjectId, sessionUser?.name]);

  const [aiSummaryBusy, setAiSummaryBusy] = useState(false);
  const [conversationAiInsight, setConversationAiInsight] = useState<ConversationAiInsight | null>(null);
  const [conversationAiSummaryError, setConversationAiSummaryError] = useState<string | null>(null);

  const buildConversationHtmlForSummary = useCallback((): string => {
    const list = ideationConversationOnly.length ? ideationConversationOnly : conversationMessages;
    const meLabel = String(sessionUser?.name ?? "").trim() || "나";
    return buildConversationContentHtmlForWorkNoteSummary(list, meLabel, { maxMessages: 80 });
  }, [conversationMessages, ideationConversationOnly, sessionUser?.name]);

  const onSummarizeConversation = useCallback(async () => {
    const pid = resolvedProjectId.trim();
    if (!pid || busy || remoteLocked || aiSummaryBusy) return;
    setAiSummaryBusy(true);
    setConversationAiSummaryError(null);
    try {
      const contentHtml = buildConversationHtmlForSummary();
      const wire = await postWorkNoteSummarize({ projectId: pid, scope: "project", contentHtml });
      setConversationAiInsight({
        summary: wire.summary,
        requestType: wire.requestType,
        priority: wire.priority,
        ...(wire.priorityReason.trim() ? { priorityReason: wire.priorityReason.trim() } : {}),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "요약 실패";
      setConversationAiSummaryError(msg);
      showErrorToast(`AI 요약에 실패했습니다. (${msg})`);
    } finally {
      setAiSummaryBusy(false);
    }
  }, [
    aiSummaryBusy,
    busy,
    buildConversationHtmlForSummary,
    remoteLocked,
    resolvedProjectId,
    showErrorToast,
  ]);

  const applyConversationSummary = useCallback(() => {
    const insight = conversationAiInsight;
    if (!insight) return;
    const meta = [
      `요청 분류 ${insight.requestType}`,
      `우선순위 추천 ${insight.priority}`,
      ...(insight.priorityReason ? [`근거 ${insight.priorityReason}`] : []),
    ]
      .filter(Boolean)
      .join(" · ");
    insertComposerPrompt(`AI 요약\n\n${insight.summary}\n\n${meta}`.trim());
    setConversationAiInsight(null);
    setConversationAiSummaryError(null);
  }, [conversationAiInsight, insertComposerPrompt]);

  const serviceFlowChatPending =
    activeStage === "service-flow" && serviceFlowAlternativeCanvas.replying;

  const handleCopyAllCodeTaskPrompts = useCallback(async () => {
    const pid = resolvedProjectId.trim();
    if (!pid) {
      showErrorToast("프로젝트가 연결되지 않았습니다.");
      return false;
    }
    const state = stateJsonRef.current;
    const built = resolveCodeTaskPromptDraftForCopy({
      projectId: pid,
      codeTaskPlan: parseImplementationCodeTaskPlanV1(state.implementationCodeTaskPlanV1),
      taskList: state.implementationTaskListV1 ?? null,
      codeTaskPromptContextMapV1: parseCodeTaskPromptContextMapV1(state.codeTaskPromptContextMapV1),
      mode: "all",
    });
    if (!built.ok || !built.prompt) {
      showErrorToast(built.reason ?? CODE_TASK_PROMPT_DRAFT_NOT_READY_MESSAGE);
      return false;
    }
    const ok = await writeClipboardText(built.prompt);
    if (ok) {
      showSuccessToast("CodeTask 1단계 프롬프트 초안을 복사했습니다.");
    } else {
      showErrorToast("클립보드 복사에 실패했습니다.");
    }
    return ok;
  }, [resolvedProjectId, showErrorToast, showSuccessToast]);

  const ideationStage = (
    <div key="ideation" style={{ display: "contents" }}>
      <RequirementsIdeationChatPanel
        showScreenLabels={showScreenLabels}
        conversationStatus={conversationStatus}
        chatMessages={conversationMessages}
        participantAiMemberId={participantAiMemberId}
        aiInvokePending={aiInvokePending}
        serviceFlowAnalyzePending={serviceFlowChatPending}
        serviceFlowPendingStatusLabel={serviceFlowAlternativeCanvas.pendingStatusLabel}
        quickDesignConfirmPending={deliverableGenerateBusy}
        serviceDesignStage={activeStage}
        onInsertComposerPrompt={insertComposerPrompt}
        onInterviewSuggestionPick={handleFastPlanDraftSuggestionPick}
        onSetReplyTo={(messageId, preview) => setReplyTo({ id: messageId, preview })}
        openDeliverableDocument={(id) => openDeliverableViewer([id], id)}
        openDeliverableList={(focusId) => openDeliverableList(focusId)}
        openDeliverableDocuments={(ids) => openDeliverableViewer(ids, ids[0] ?? null)}
        onRegenerateDeliverables={(types) => void handleGenerateDeliverables(types)}
        onConfirmDeliverables={(ids) => void handleConfirmDeliverableAssets(ids)}
        replyTo={replyTo}
        onClearReplyTo={() => setReplyTo(null)}
        composerTextAreaRef={composerTextAreaRef}
        typingIndicatorSpeakerLine={typingIndicatorSpeakerLine}
        typingIndicatorResolvedSpeakerSource={typingIndicatorResolvedSpeakerSource}
        sessionUserDisplayName={sessionUser?.name?.trim() || "나"}
        input={input}
        onInputChange={setInput}
        onSendIdeation={handleServiceDesignComposerSend}
        busy={busy || serviceFlowChatPending}
        composerPlaceholder={composerPlaceholder}
        targetPickerItems={targetPickerItems}
        onOrganizeRequirements={() => void onOrganizeRequirements()}
        onCopyAllCodeTaskPrompts={handleCopyAllCodeTaskPrompts}
        organizeDisabled={busy || remoteLocked}
        draftDocTruthy={Boolean(draftDoc)}
        onOpenDraftView={() => setDraftDrawerOpen(true)}
        plusMenuRender={({ close }) => (
          <>
            {activeStage === "ideation" ? (
              <WorkspacePlusMenuItems
                tools={{
                  onOrganizeRequirements: () => void onOrganizeRequirements(),
                  organizeDisabled: busy || remoteLocked,
                  draftViewAvailable: Boolean(draftDoc),
                  onOpenDraftView: () => setDraftDrawerOpen(true),
                }}
                onPick={close}
              />
            ) : null}
          </>
        )}
        promptTimeline={promptTimelineUi ?? null}
        onOpenPromptTimeline={() => setPromptDrawerOpen(true)}
      />
    </div>
  );

  return (
    <div style={requirementsWorkspaceShellStyle}>
      <ScreenLabel label="요구사항-목록-페이지-섹션" visible={showScreenLabels} />

      <RequirementsCanvasHubDrawer
        open={canvasHubOpen}
        items={canvasHubCatalog}
        onClose={() => setCanvasHubOpen(false)}
        onSelect={handleCanvasHubSelect}
      />

      <RecommendationEvidenceDrawer
        open={recommendationPanelOpen}
        items={recommendationEvidenceItems}
        onClose={closeRecommendationPanel}
      />

      <ImplementationCandidateRefineDrawer
        open={implementationRefineDrawerOpen}
        items={planningRefineCandidateItems}
        onClose={() => {
          setImplementationRefineDrawerOpen(false);
          setImplementationRefineFilterNeedsConfirmationOnly(false);
        }}
        onInsertComposerPrompt={insertComposerPrompt}
        onRefineRequest={(wire) => {
          implementationCandidateRefineRequestRef.current = wire;
        }}
      />

      <RequirementsArtifactHubDrawer
        open={artifactHubOpen}
        artifactHubView={planningArtifactHubView}
        items={artifactHubCatalog}
        projectName={headerProjectName}
        projectId={resolvedProjectId.trim() || undefined}
        projectArtifacts={
          stateJsonRef.current.projectArtifacts ?? persistedPromptState.projectArtifacts ?? undefined
        }
        deliverableAssets={deliverableAssetsFromProject}
        generateDisabled={busy || artifactGenerateBusy || remoteLocked || deliverableGenerateBusy}
        lifecycleSummary={orchestrationUi.artifactLifecycleLabels.map((r) => ({
          label: r.label,
          hint: r.hint,
        }))}
        onClose={() => setArtifactHubOpen(false)}
        closeOnEscape={!deliverableViewerOpen}
        onSelectEntry={handleArtifactHubSelect}
        onGenerate={handleArtifactHubGenerate}
        onExportFeedback={({ kind, count, blocked }) => {
          if (blocked) {
            showErrorToast(blocked);
            return;
          }
          if (kind === "pdf") {
            showSuccessToast(
              count === 1
                ? "선택한 산출물을 PDF로 저장할 수 있도록 인쇄 창을 열었습니다. 대상에서 「PDF로 저장」을 선택해 주세요."
                : `선택한 산출물 ${count}건을 PDF로 저장할 수 있도록 인쇄 창을 열었습니다.`,
            );
            return;
          }
          showSuccessToast(
            count === 1 ? "선택한 산출물을 Doc 파일로 내려받았습니다." : `선택한 산출물 ${count}건을 Doc 파일로 내려받았습니다.`,
          );
        }}
      />

      <ServiceFlowStateCanvasOverlay
        open={activeCanvasView === "service-flow"}
        flow={serviceFlow}
        onClose={() => setActiveCanvasView(null)}
        onManageStepAssignment={openAssignmentDrawerForStep}
      />

      <ServiceFlowActorAssignmentDrawer
        open={assignmentDrawerOpen}
        flow={serviceFlow}
        stepId={assignmentStepId}
        busy={assignmentBusy}
        onClose={() => {
          setAssignmentDrawerOpen(false);
          setAssignmentStepId(null);
        }}
        onSave={handleAssignmentSave}
      />

      <BaselineFlowCanvasOverlay
        open={activeCanvasView === "baseline-flow"}
        payload={serviceFlowAlternativeCanvas.alternativeCanvasPayload ?? serviceFlow?.alternativeProposalPayload ?? null}
        onClose={() => setActiveCanvasView(null)}
      />

      <FeatureDefinitionCanvasOverlay
        open={activeCanvasView === "feature-definition"}
        artifact={stateJsonRef.current.featurePlanningSlotsV1 ?? persistedPromptState.featurePlanningSlotsV1 ?? null}
        sampleDataSpecV1={stateJsonRef.current.sampleDataSpecV1 ?? persistedPromptState.sampleDataSpecV1 ?? null}
        onSaveSampleDataSpec={(next) => void handleSaveSampleDataSpec(next)}
        onClose={() => setActiveCanvasView(null)}
      />
      <FeatureDetailCanvasOverlay
        open={activeCanvasView === "feature-detail"}
        artifact={featureDetailEditing.artifactLive}
        selectedSlotId={featureDetailEditing.editSlotId}
        onClose={() => {
          setActiveCanvasView(null);
          featureDetailEditing.closeEdit();
        }}
        onEditSlot={(slotId) => void featureDetailEditing.openEdit(slotId)}
        onPartialSaveSlot={(slotId) => void featureDetailEditing.mutateFromCanvas(slotId, "partial")}
        onConfirmSlot={(slotId) => void featureDetailEditing.mutateFromCanvas(slotId, "confirm")}
        onObsoleteSlot={(slotId) => void featureDetailEditing.mutateFromCanvas(slotId, "obsolete")}
      />
      <FeatureDetailEditDrawer
        open={featureDetailEditing.editOpen}
        slot={featureDetailEditing.editSlot}
        slotIds={featureDetailEditing.navSlotIds}
        steps={featureDetailEditing.flowSteps}
        busy={featureDetailEditing.editBusy}
        confirmError={featureDetailEditing.confirmError}
        focusDriftBanner={orchestrationUi.focusDrift}
        onNavigateSlot={(slotId) => void featureDetailEditing.openEdit(slotId)}
        onClose={featureDetailEditing.closeEdit}
        onPartialSave={featureDetailEditing.handlePartialSave}
        onConfirm={featureDetailEditing.handleConfirm}
        onObsolete={featureDetailEditing.handleObsolete}
      />

      <ServiceFlowActorEditDrawer
        open={actorEditOpen}
        phase={actorEditPhase}
        steps={serviceFlow?.steps ?? []}
        busy={actorEditBusy}
        onClose={() => {
          setActorEditOpen(false);
          setActorEditPhase((p) => nextActorEditingPhase(p, "close"));
        }}
        onSave={handleActorEditSave}
      />

      {activeStage === "service-flow" ? (
        <AlternativeProposalCanvasOverlay
          open={serviceFlowAlternativeCanvas.alternativeCanvasOpen}
          payload={serviceFlowAlternativeCanvas.alternativeCanvasPayload}
          onClose={serviceFlowAlternativeCanvas.closeAlternativeCanvas}
          onApplyAlternative={serviceFlowAlternativeCanvas.applyAlternativeFromCanvas}
          onKeepPrimary={serviceFlowAlternativeCanvas.keepPrimaryFromCanvas}
          onRegenerateAlternative={serviceFlowAlternativeCanvas.regenerateAlternativeFromCanvas}
          busy={serviceFlowAlternativeCanvas.replying}
        />
      ) : null}

      {inIdeationStage ? (
        <RequirementsOrganizeProposalWorkspaceOverlay
          open={plannerTypePickerOpen}
          onClose={() => setPlannerTypePickerOpen(false)}
          busy={busy}
          deliverableGenerateBusy={deliverableGenerateBusy}
          organizeRunning={organizeState === "running"}
          showRegenerate={Boolean(latestUnifiedProposal)}
          regenerateDisabled={busy || deliverableGenerateBusy || remoteLocked}
          onRegenerate={() => {
            setPlannerTypePickerOpen(false);
            void handleGenerateDeliverables([...IDEATION_UNIFIED_PROPOSAL_OUTPUT]);
          }}
          onStartOrganize={() => void organizeStartGenerateFinalProposal()}
          planSubjectName={(project?.name ?? "").trim() || "프로젝트"}
        />
      ) : null}

      <WorkspaceSuccessErrorSaveToastHost
        success={successToast}
        error={errorToast}
      />

      <RequirementsWorkspaceTopChrome
        showScreenLabels={showScreenLabels}
        showProjectWorkflowNav={Boolean(resolvedProjectId.trim())}
        resolvedProjectIdTrimmed={resolvedProjectId.trim()}
        inIdeationStage={inIdeationStage}
        conversationStatus={conversationStatus}
        ideationComplete={ideationComplete}
        problemInterviewState={problemInterviewState}
        problemInterviewStrictFilled={problemInterviewStrictFilled}
        busy={busy}
        remoteLocked={remoteLocked}
        onOrganizeRequirements={() => void onOrganizeRequirements()}
        onResetConversation={() => void onResetConversation()}
        ideationInterviewUi={
          conversationStatus === "loaded"
            ? {
                readinessPercent: proposalReadinessPercentVal,
                covered: problemInterviewCovered,
                total: progressSlotTotal,
                statusCounts: orchestrationStatusCounts ?? null,
                remainingQuestionsEstimate,
                orchestrationSlotSections: orchestrationSlotSectionsForUi ?? null,
                onForceGeneratePlanNow,
              }
            : null
        }
        memberControls={{ count: servicePlanningParticipants.length, onOpen: () => setMembersModalOpen(true) }}
        canvasHubControls={
          resolvedProjectId.trim()
            ? {
                count: showWorkspaceHubBadges ? canvasHubCatalog.length : 0,
                onOpen: () => setCanvasHubOpen(true),
              }
            : null
        }
        artifactHubControls={
          resolvedProjectId.trim()
            ? {
                count: artifactHubCompletedCount,
                hasStale: orchestrationUi.artifactBadgeHasStale,
                onOpen: () => setArtifactHubOpen(true),
              }
            : null
        }
        onDownloadConversationMarkdown={() => void onDownloadConversationMarkdown()}
        onSummarizeConversation={() => void onSummarizeConversation()}
        resetConversationDisabled={
          remoteLocked ||
          busy ||
          resetConversationBusy ||
          conversationStatus !== "loaded" ||
          !planningWorkspaceHasResettableContent({
            messageCount: room.requirementsConversation.messages.length,
            state: planningResetEligibilityState,
          })
        }
        workflowGuidanceBanner={workflowGuidanceBanner}
        loadError={loadError}
        onClearLoadErrorAndRetry={() => {
          setLoadError(null);
          setFetchNonce((n) => n + 1);
        }}
        onGoHome={() => router.push("/")}
        onOpenEnvironmentSettings={() => setExecutionEnvironmentModalOpen(true)}
      />

      {conversationAiInsight || conversationAiSummaryError ? (
        <div
          role="status"
          aria-label="대화 AI 요약 결과"
          style={{
            position: "fixed",
            zIndex: 70,
            left: "max(12px, env(safe-area-inset-left, 0px))",
            right: "max(12px, env(safe-area-inset-right, 0px))",
            bottom: "max(12px, env(safe-area-inset-bottom, 0px))",
            margin: "0 auto",
            maxWidth: 860,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            boxShadow: "0 22px 70px -32px rgba(15, 23, 42, 0.45)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>AI 요약</div>
          </div>
          <div style={{ padding: "12px 14px", fontSize: 14, lineHeight: 1.6, color: "#0f172a", whiteSpace: "pre-wrap" }}>
            {conversationAiInsight ? (
              <>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>요약 결과</div>
                <div>{conversationAiInsight.summary}</div>
                <div style={{ marginTop: 10, fontSize: 13, color: "#334155" }}>
                  요청 분류 {conversationAiInsight.requestType}{"\n"}우선순위 추천 {conversationAiInsight.priority}
                  {conversationAiInsight.priorityReason ? `\n근거 ${conversationAiInsight.priorityReason}` : ""}
                </div>
              </>
            ) : (
              <div style={{ color: "#991b1b", fontWeight: 800 }}>AI 요약에 실패했습니다.\n{conversationAiSummaryError}</div>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "12px 14px 14px" }}>
            <button
              type="button"
              disabled={aiSummaryBusy}
              onClick={() => void onSummarizeConversation()}
              style={{
                border: "1px solid #cbd5e1",
                background: "#fff",
                borderRadius: 10,
                padding: "9px 12px",
                fontSize: 13,
                fontWeight: 900,
                cursor: aiSummaryBusy ? "not-allowed" : "pointer",
                opacity: aiSummaryBusy ? 0.6 : 1,
                color: "#334155",
              }}
            >
              {aiSummaryBusy ? "요약 중…" : "AI 요약"}
            </button>
            <button
              type="button"
              disabled={!conversationAiInsight}
              onClick={applyConversationSummary}
              style={{
                border: "2px solid #2563eb",
                background: "#2563eb",
                borderRadius: 10,
                padding: "9px 12px",
                fontSize: 13,
                fontWeight: 900,
                cursor: conversationAiInsight ? "pointer" : "not-allowed",
                opacity: conversationAiInsight ? 1 : 0.55,
                color: "#fff",
              }}
            >
              요약본 반영
            </button>
            <button
              type="button"
              onClick={() => {
                setConversationAiInsight(null);
                setConversationAiSummaryError(null);
              }}
              style={{
                border: "1px solid #e2e8f0",
                background: "#fff",
                borderRadius: 10,
                padding: "9px 12px",
                fontSize: 13,
                fontWeight: 900,
                cursor: "pointer",
                color: "#334155",
              }}
            >
              요약 닫기
            </button>
          </div>
        </div>
      ) : null}

      <div className="jyo-requirements-workspace-body">
        <div style={requirementsWorkspaceMainRowStyle} className="jyo-requirements-workspace-main">
          <RequirementsWorkspaceStageRenderer singleChatSurface={ideationStage} />
        </div>
      </div>

      <RequirementsWorkspaceErrorBand
        error={error}
        organizeState={organizeState}
        organizeError={organizeError}
        onRetryOrganizeProposal={() => {
          setOrganizeState("idle");
          setOrganizeError(null);
          setError(null);
          void organizeStartGenerateFinalProposal();
        }}
      />

      <RequirementsMemberInviteModal
        open={inviteOpen && Boolean(resolvedProjectId.trim())}
        projectId={resolvedProjectId.trim()}
        onClose={() => setInviteOpen(false)}
        onInvited={() => void reloadMembers()}
        existingHumanUserIds={existingHumanUserIds}
      />

      <WorkspaceParticipantsModal
        open={membersModalOpen}
        onClose={() => setMembersModalOpen(false)}
        participants={servicePlanningParticipants}
        showInvite={Boolean(resolvedProjectId.trim())}
        inviteDisabled={remoteLocked}
        onInviteClick={() => setInviteOpen(true)}
      />

      {inIdeationStage ? (
        <RequirementsIdeationDocumentDrawers
          promptDrawerOpen={promptDrawerOpen}
          onClosePromptDrawer={() => setPromptDrawerOpen(false)}
          lastPromptView={persistedPromptState.lastPromptView ?? null}
          lastPromptText={persistedPromptState.lastPromptText}
          lastPromptGeneratedAt={persistedPromptState.lastPromptGeneratedAt}
          promptTimeline={promptTimelineUi ?? null}
          ideationConversationForPromptExport={conversationStatus === "loaded" ? ideationConversationOnly : null}
          exportBaseName={project?.name?.trim() ?? ""}
          summaryModalOpen={summaryModalOpen}
          onCloseSummaryModal={() => setSummaryModalOpen(false)}
          goals={goals}
          targetUsers={targetUsers}
          scopeIn={scopeIn}
          scopeOut={scopeOut}
          openIssues={openIssues}
          success={success}
          onGoalsChange={setGoals}
          onTargetUsersChange={setTargetUsers}
          onScopeInChange={setScopeIn}
          onScopeOutChange={setScopeOut}
          onOpenIssuesChange={setOpenIssues}
          onSuccessChange={setSuccess}
          onSummaryBlurSave={() => void onPanelBlurSave()}
          draftDrawerOpen={draftDrawerOpen}
          onCloseDraftDrawer={() => setDraftDrawerOpen(false)}
          draftDoc={draftDoc}
          orchestrationDebugSummary={orchestrationUi.humanReadableDebugSummary}
        />
      ) : null}

      <RequirementsDeliverableViewerModal
        open={deliverableViewerOpen}
        onClose={() => setDeliverableViewerOpen(false)}
        assets={deliverableViewerAssets}
        initialAssetId={deliverableViewerFocusId}
      />

      <ProjectExecutionEnvironmentModal
        open={executionEnvironmentModalOpen}
        onClose={() => setExecutionEnvironmentModalOpen(false)}
        projectId={resolvedProjectId.trim()}
        project={project}
        canEdit={true}
      />
    </div>
  );
}
