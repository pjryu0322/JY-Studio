"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Project } from "@/components/project-spec/types";
import type { RequirementsComposerTargetPickerItem } from "@/components/requirements/RequirementsComposerGpt";
import { RequirementsIdeationChatPanel } from "@/components/requirements/RequirementsIdeationChatPanel";
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
import {
  buildDynamicServicePlanningSlotDefinitions,
  buildOrchestrationSlotSummarySections,
  hashSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
  singleChatOrchestrationConfirmedProgress,
  singleChatOrchestrationStatusCounts,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import {
  appendIdeationBootstrapPromptTimeline,
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
import {
  ideationDraftGateStatus,
  ideationSendDevLog,
  shouldSkipIdeationDuplicateAppend,
  IDEATION_DRAFT_MIN_FILLED_SLOTS,
  IDEATION_DRAFT_REQUIRED_SLOTS,
  type MemberRow,
  type RequirementsWorkspaceStage,
  type SessionUser,
} from "@/lib/requirements/requirementsWorkspaceHelpers";
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
import { dispatchServiceFlowSingleChatSend } from "@/lib/service-design/serviceDesignSingleChatServiceFlowSend";


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
  const [deliverableViewerOpen, setDeliverableViewerOpen] = useState(false);
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
  /** 아이디어 구체화: spec 단계 기본 AI(planner) 보강 요청 중복 방지 */
  const ideationEnsurePlannerInFlightRef = useRef(false);
  /** 전송 핸들러 동시 실행(연타·Enter 이중) 방지 — React `busy`보다 먼저 잠금 */
  const requirementsSendFlightRef = useRef(false);
  const sendDraftRestoreRef = useRef<string | null>(null);
  /** 인터뷰 추천 칩 선택 후 전송 시 analyzer에 한 번 전달 */
  const interviewSuggestionPickRef = useRef<string | null>(null);

  const [serviceFlow, setServiceFlow] = useState<RequirementsServiceFlowV1 | null>(null);
  const serviceFlowSendRef = useRef<((payload: ServiceDesignHarnessPayload, text: string) => void | Promise<void>) | null>(null);
  const featurePlanningSendRef = useRef<((payload: ServiceDesignHarnessPayload, text: string) => void | Promise<void>) | null>(null);

  const activeStage = useMemo((): RequirementsWorkspaceStage => {
    // SingleChat 정책: URL stage 쿼리는 더 이상 UI/내부 단계의 단일 소스가 아니다.
    // 내부 단계는 저장된 state JSON(요구사항 상태)을 기반으로 자동 산정한다.
    const persisted = parseRequirementsStateJson(project?.requirementsStateJson);
    const local = stateJsonRef.current;
    const st = (local && Object.keys(local).length ? local : persisted) as RequirementsStateJson;

    // 1) 기능 정리 산출물이 있으면 feature-planning
    if (st.featurePlanningSlotsV1?.slots?.length) return "feature-planning";
    // 2) 서비스 흐름이 있으면 service-flow
    if (st.serviceFlowV1?.steps?.length || st.serviceFlowV1?.actors?.length) return "service-flow";
    // 3) 그 외는 ideation
    return "ideation";
  }, [project?.requirementsStateJson, fetchNonce]);
  const inIdeationStage = activeStage === "ideation";
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
    setDeliverableViewerOpen(false);
    setDeliverableViewerIds([]);
    setDeliverableViewerFocusId(null);
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

  const slotDefsForProgress = useMemo(
    () =>
      buildDynamicServicePlanningSlotDefinitions({
        projectName: project?.name ?? "",
        projectDescription: project?.description ?? "",
        projectType: project?.projectType ?? null,
        servicePlanningAgentCatalogKeys: servicePlanningScreenCatalogIds ?? null,
      }),
    [project?.name, project?.description, project?.projectType, servicePlanningScreenCatalogIds]
  );

  const orchestrationSlotDefsHash = useMemo(() => hashSlotDefinitions(slotDefsForProgress), [slotDefsForProgress]);

  const orchestrationAlignedState = useMemo(() => {
    const orch = persistedPromptState.singleChatOrchestrationV1 ?? null;
    if (!orch || orch.slotDefinitionsHash !== orchestrationSlotDefsHash) return null;
    return orch;
  }, [persistedPromptState.singleChatOrchestrationV1, orchestrationSlotDefsHash]);

  const orchestrationUiState = useMemo(() => {
    // Source-of-truth: singleChatOrchestrationV1.
    // If persisted state is missing/misaligned, render an empty orchestration grid (0% progress) instead of legacy 8-slot UI.
    return (
      orchestrationAlignedState ??
      initialOrchestrationStateFromDefinitions(slotDefsForProgress, new Date().toISOString())
    );
  }, [orchestrationAlignedState, slotDefsForProgress]);

  const orchestrationConfirmedMetrics = useMemo(
    () => singleChatOrchestrationConfirmedProgress(orchestrationUiState),
    [orchestrationUiState]
  );
  const orchestrationStatusCounts = useMemo(
    () => singleChatOrchestrationStatusCounts(orchestrationUiState),
    [orchestrationUiState]
  );

  const orchestrationSlotSectionsForUi = useMemo(() => {
    return buildOrchestrationSlotSummarySections(slotDefsForProgress, orchestrationUiState);
  }, [orchestrationUiState, slotDefsForProgress]);

  const problemInterviewStrictFilled = useMemo(
    () => problemInterviewStrictFilledCount(problemInterviewState),
    [problemInterviewState]
  );
  const proposalReadinessPercentVal = useMemo(() => {
    return orchestrationConfirmedMetrics.percent;
  }, [orchestrationConfirmedMetrics.percent]);
  const problemInterviewCovered = useMemo(() => {
    return orchestrationConfirmedMetrics.confirmed;
  }, [orchestrationConfirmedMetrics.confirmed]);
  const progressSlotTotal = useMemo(() => {
    return orchestrationConfirmedMetrics.total;
  }, [orchestrationConfirmedMetrics.total]);
  const nextNeededSlot = useMemo(() => {
    // LLM-first orchestration: next slot is not a fixed 8-slot interview concept.
    return null;
  }, []);
  const remainingQuestionsEstimate = useMemo(() => {
    return Math.max(0, orchestrationConfirmedMetrics.total - orchestrationConfirmedMetrics.confirmed);
  }, [orchestrationConfirmedMetrics.total, orchestrationConfirmedMetrics.confirmed]);

  /**
   * 산출물 뷰어는 "채팅 카드가 가리키는 assetId"와 동일한 소스를 사용해야 합니다.
   * - 저장 직후(서버 응답 전)에는 `project.requirementsStateJson`이 아직 갱신되지 않을 수 있으므로
   *   `stateJsonRef.current.deliverableAssets`를 1차 소스로 사용합니다.
   * - 초기 로드/새로고침 등 `stateJsonRef`가 비어 있을 때만 project JSON을 폴백으로 사용합니다.
   */
  const deliverableAssetsFromProject = useMemo(() => {
    const local = stateJsonRef.current.deliverableAssets;
    if (Array.isArray(local) && local.length) return local;
    return persistedPromptState.deliverableAssets ?? [];
  }, [
    persistedPromptState.deliverableAssets,
    project?.requirementsStateJson,
    saveState,
    fetchNonce,
    room.requirementsConversation.messages.length,
  ]);

  const deliverableViewerAssets = useMemo(
    () => deliverableAssetsFromProject.filter((a) => deliverableViewerIds.includes(a.id)),
    [deliverableAssetsFromProject, deliverableViewerIds]
  );

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
  });

  const appendSingleChatPromptTimeline = useCallback(
    (entry: RequirementsPromptTimelineEntry) => {
      void persistStateJsonOnly({
        promptTimeline: appendIdeationBootstrapPromptTimeline(stateJsonRef.current.promptTimeline, entry),
      });
    },
    [persistStateJsonOnly]
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
    persistServiceFlow,
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
    if (onboardingAppliedKey === onboardingKey) return;
    const existing = room.requirementsConversation.messages;
    if (existing.length > 0) {
      setOnboardingAppliedKey(onboardingKey);
      return;
    }
    if (ideationBootstrapFlightRef.current === onboardingKey) return;
    ideationBootstrapFlightRef.current = onboardingKey;

    let cancelled = false;
    const flightKey = onboardingKey;

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
        readonly interviewAllowCustomInput?: boolean;
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
              internalType: IDEATION_INTERVIEW_BOOTSTRAP_INTERNAL_TYPE,
              source: params.source,
              ...(params.source === "fallback" && params.fallbackReason
                ? { fallbackReason: params.fallbackReason }
                : {}),
              ...(params.interviewSuggestions?.length
                ? { interviewSuggestions: [...params.interviewSuggestions] }
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
      if (ideationBootstrapFlightRef.current === flightKey) {
        ideationBootstrapFlightRef.current = null;
      }
    };
  }, [conversationStatus, resolvedProjectId, loadedConversationProjectId, project, onboardingAppliedKey, onboardingKey, room, persistRemote]);

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
    if (typeof window !== "undefined") {
      const ok = window.confirm("대화 내역을 모두 삭제하고 서비스 기획을 다시 시작할까요? 이 작업은 되돌릴 수 없습니다.");
      if (!ok) return;
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
      // Clear prompt timeline + orchestration state so the next bootstrap turn starts clean.
      stateJsonRef.current = mergeRequirementsStateJson(stateJsonRef.current, {
        promptTimeline: [],
        singleChatOrchestrationV1: null,
      });
      setPromptTimelineUi([]);
      await persistRemote(nextRoom, {}, {
        onboardingShown: false,
        problemInterview: emptyProblemInterviewState(nowIso),
        lastUserDraftText: "",
        promptTimeline: [],
        singleChatOrchestrationV1: null,
      });
    } finally {
      setResetConversationBusy(false);
    }
  }, [resolvedProjectId, busy, resetConversationBusy, persistRemote]);


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
            consumeInterviewSelectedSuggestion: () => {
              // chip 클릭은 입력 보조만: 자동 전송/강제 reply가 되지 않도록 이번 전송 1회만 포함
              return selectedSuggestionSnapshot;
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
      const quickActionLabel = interviewSuggestionPickRef.current;
      interviewSuggestionPickRef.current = null;
      await dispatchServiceFlowSingleChatSend({
        payload,
        text,
        quickActionLabel,
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

      setInput("");

      const nowIso = new Date().toISOString();
      const baseMessages = roomRef.current.requirementsConversation.messages;

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
      }

      // Execute existing feature-planning logic (no rewrite).
      const fn = featurePlanningSendRef.current;
      if (!fn) return;
      try {
        await fn(payload, text);
      } catch (e) {
        // restore input if stage-local send failed
        setInput(text);
        throw e;
      }
    },
    [resolvedProjectId, input, sessionUser?.id, sessionUser?.name, persistRemote]
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

  const handleServiceDesignComposerSend = useCallback(
    async (payload: ServiceDesignHarnessPayload) => {
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
    [activeStage, runIdeationSend, runServiceFlowSend, runFeaturePlanningSend]
  );

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
    if (!gate.ready) {
      const missingRequired = IDEATION_DRAFT_REQUIRED_SLOTS.filter((slot) => !slotStrictlyFilled(latestInterviewState ?? emptyProblemInterviewState(""), slot));
      const msg = missingRequired.length
        ? "아이디어 초안 생성 전 필수 정보(서비스 아이디어, 주 사용자, 핵심 문제, 기대 효과)를 먼저 확인해 주세요."
        : `아이디어 초안은 최소 ${IDEATION_DRAFT_MIN_FILLED_SLOTS}개 슬롯 확정 후 생성할 수 있습니다.`;
      setError(msg);
      showErrorToast(msg);
      return;
    }
    setPlannerTypePickerOpen(false);
    await handleGenerateDeliverables([...IDEATION_UNIFIED_PROPOSAL_OUTPUT]);
  }, [busy, deliverableGenerateBusy, remoteLocked, latestProblemInterviewStateForGate, handleGenerateDeliverables, showErrorToast]);

  const onForceGeneratePlanNow = useCallback(() => {
    if (busy || deliverableGenerateBusy || remoteLocked) return;
    const latestInterviewState = latestProblemInterviewStateForGate();
    const gate = ideationDraftGateStatus(latestInterviewState);
    if (!gate.ready) {
      const missingRequired = IDEATION_DRAFT_REQUIRED_SLOTS.filter((slot) => !slotStrictlyFilled(latestInterviewState ?? emptyProblemInterviewState(""), slot));
      const msg = missingRequired.length
        ? "아이디어 초안 생성 전 필수 정보(서비스 아이디어, 주 사용자, 핵심 문제, 기대 효과)를 먼저 확인해 주세요."
        : `아이디어 초안은 최소 ${IDEATION_DRAFT_MIN_FILLED_SLOTS}개 슬롯 확정 후 생성할 수 있습니다.`;
      setError(msg);
      showErrorToast(msg);
      return;
    }
    void handleGenerateDeliverables([...IDEATION_UNIFIED_PROPOSAL_OUTPUT]);
  }, [busy, deliverableGenerateBusy, remoteLocked, latestProblemInterviewStateForGate, handleGenerateDeliverables, showErrorToast]);

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

  const serviceFlowAlternativeCanvas = useServiceFlowSingleChatBridge({
    projectId: resolvedProjectId.trim(),
    projectName: headerProjectName,
    projectDescription: String(project?.description ?? ""),
    ideationParticipantHumanMemberIds,
    ideationAssets: (stateJsonRef.current.deliverableAssets ?? []).map((a) => ({
      type: a.type,
      title: a.title,
      content: a.content,
    })),
    flow: serviceFlow,
    onChangeFlow: (next) => void persistServiceFlow(next),
    members,
    currentUserId: sessionUser?.id ?? null,
    ideationReady: ideationReadyForServiceFlow,
    generatingDraft: serviceFlowDraftBusy,
    draftGenerationCount: serviceFlowDraft.serviceFlowDraftGenerationCount,
    persistedServiceFlowMessages: serviceFlowWorkshopPersisted,
    onAppendPersistedServiceFlowMessages: appendServiceFlowWorkshopMessages,
    platformScreenAiMemberIds: serviceFlowScreenCatalogIds,
    onSingleChatPromptTrace: appendSingleChatPromptTimeline,
    serviceFlowSendRef,
  });

  const onDownloadConversationMarkdown = useCallback(() => {
    const pid = resolvedProjectId.trim();
    const projectLabel = (project?.name ?? "").trim() || "서비스기획";
    const lines: string[] = [];
    lines.push(`# 서비스 기획 대화 내역`);
    lines.push("");
    lines.push(`- projectId: ${pid || "(미연결)"}`);
    lines.push(`- exportedAt: ${new Date().toISOString()}`);
    lines.push("");
    const list = ideationConversationOnly.length ? ideationConversationOnly : conversationMessages;
    const meLabel = String(sessionUser?.name ?? "").trim() || "나";
    for (const m of list) {
      const who =
        m.role === "user" ? meLabel : m.role === "ai" ? (m.speakerName ? `AI(${m.speakerName})` : "AI") : m.role === "human" ? (m.speakerName ? `멤버(${m.speakerName})` : "멤버") : "시스템";
      lines.push(`## ${who} · ${new Date(m.createdAt).toISOString()}`);
      lines.push("");
      lines.push(String(m.content ?? "").trim() || "(빈 메시지)");
      lines.push("");
      lines.push("---");
      lines.push("");
    }
    const md = lines.join("\n");
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = projectLabel.replace(/[^\p{L}\p{N}\-_ ]/gu, "").trim().replace(/\s+/g, "_").slice(0, 48) || "service_planning";
    a.download = `${safeName}_conversation.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
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
        serviceDesignStage={activeStage}
        proposalReadinessPercentVal={proposalReadinessPercentVal}
        problemInterviewCovered={problemInterviewCovered}
        progressSlotTotal={progressSlotTotal}
        orchestrationSlotSections={orchestrationSlotSectionsForUi}
        orchestrationStatusCounts={orchestrationStatusCounts}
        remainingQuestionsEstimate={remainingQuestionsEstimate}
        onForceGeneratePlanNow={onForceGeneratePlanNow}
        onInsertComposerPrompt={insertComposerPrompt}
        onInterviewSuggestionPick={(label) => {
          interviewSuggestionPickRef.current = label;
          insertComposerPrompt(label);
        }}
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
        organizeDisabled={busy || remoteLocked}
        draftDocTruthy={Boolean(draftDoc)}
        onOpenDraftView={() => setDraftDrawerOpen(true)}
        promptTimeline={promptTimelineUi ?? null}
        onOpenPromptTimeline={() => setPromptDrawerOpen(true)}
      />
    </div>
  );

  return (
    <div style={requirementsWorkspaceShellStyle}>
      <ScreenLabel label="요구사항-목록-페이지-섹션" visible={showScreenLabels} />

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
        onDownloadConversationMarkdown={() => void onDownloadConversationMarkdown()}
        onSummarizeConversation={() => void onSummarizeConversation()}
        resetConversationDisabled={
          remoteLocked ||
          busy ||
          resetConversationBusy ||
          conversationStatus !== "loaded" ||
          room.requirementsConversation.messages.length === 0
        }
        workflowGuidanceBanner={workflowGuidanceBanner}
        loadError={loadError}
        onClearLoadErrorAndRetry={() => {
          setLoadError(null);
          setFetchNonce((n) => n + 1);
        }}
        onGoHome={() => router.push("/")}
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
          deliverableViewerOpen={deliverableViewerOpen}
          onCloseDeliverableViewer={() => setDeliverableViewerOpen(false)}
          deliverableViewerAssets={deliverableViewerAssets}
          deliverableViewerFocusId={deliverableViewerFocusId}
        />
      ) : null}
    </div>
  );
}
