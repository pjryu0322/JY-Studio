"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Project } from "@/components/project-spec/types";
import type { RequirementsComposerTargetPickerItem } from "@/components/requirements/RequirementsComposerGpt";
import { RequirementsChatPanel } from "@/components/requirements/RequirementsChatPanel";
import { RequirementsIdeationChatPanel } from "@/components/requirements/RequirementsIdeationChatPanel";
import { RequirementsIdeationDocumentDrawers } from "@/components/requirements/RequirementsIdeationDocumentDrawers";
import { RequirementsOrganizeProposalWorkspaceOverlay } from "@/components/requirements/RequirementsOrganizeProposalWorkspaceOverlay";
import { RequirementsFeaturePlanningStagePanel } from "@/components/requirements/RequirementsFeaturePlanningStagePanel";
import { RequirementsServiceFlowStagePanel } from "@/components/requirements/RequirementsServiceFlowStagePanel";
import { RequirementsServiceDesignStageNav } from "@/components/requirements/RequirementsServiceDesignStageNav";
import { RequirementsWorkspaceErrorBand } from "@/components/requirements/RequirementsWorkspaceErrorBand";
import { RequirementsWorkspaceTopChrome } from "@/components/requirements/RequirementsWorkspaceTopChrome";
import { ServiceDesignComposer } from "@/components/requirements/ServiceDesignComposer";
import {
  requirementsWorkspaceMainRowStyle,
  requirementsWorkspaceShellStyle,
} from "@/components/requirements/requirementsWorkspaceLayoutStyles";
import { RequirementsMemberInviteModal } from "@/components/requirements/RequirementsMemberInviteModal";
import { WorkspaceParticipantsModal } from "@/components/workspace/WorkspaceParticipantsModal";
import { useWorkspaceSaveToast } from "@/components/workspace/useWorkspaceSaveToast";
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
import { IDEATION_INTERVIEW_BOOTSTRAP_INTERNAL_TYPE, sanitizeIdeationInterviewFirstQuestion } from "@/lib/requirements/ideationInterviewBootstrap";
import {
  emptyProblemInterviewState,
  pickNextAskableInterviewSlot,
  problemInterviewStateFromAnalyzerWireInput,
  problemInterviewStrictFilledCount,
  proposalInterviewReadinessPercent,
  PROBLEM_INTERVIEW_SLOT_TOTAL,
  slotStrictlyFilled,
  type ProblemInterviewState,
} from "@/lib/requirements/problemInterview";
import {
  mergeRequirementsStateJson,
  parseRequirementsStateJson,
  type RequirementsStateJson,
  type RequirementsServiceFlowV1,
} from "@/lib/requirements/requirementsStateJson";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { REQUIREMENTS_ANALYSIS_INCOMPLETE_REDIRECT_MESSAGE_KR } from "@/lib/project/requirementsAnalysisGate";
import { joinSuccessCriteriaAndNfr } from "@/lib/project/requirementsSuccessCriteriaSplit";
import { isRequirementsPendingWorkflow } from "@/lib/project/projectWorkflowStatus";
import { publishProjectRailParticipantCount } from "@/lib/layout/projectRailParticipants";
import { REQUIREMENTS_IDEATION_HTTP, requirementsAiConnectionUrl } from "@/lib/requirements/requirementsIdeationHttp";
import { IDEATION_AI_DISPLAY_NAME } from "@/lib/requirements/ideationAiDisplayName";
import { isServiceFlowApprovedForFeaturePlanning } from "@/lib/featurePlanning/featurePlanningServiceFlowGate";
import type { ServiceDesignHarnessPayload } from "@/lib/service-design/serviceDesignTurnPayload";
import { pickWorkspaceAiHandoffMember } from "@/components/requirements/workspace/pickWorkspaceAiHandoffMember";
import { useRequirementsStageRouteRedirect } from "@/components/requirements/workspace/useRequirementsStageRouteRedirect";
import { patchSpecWorkspaceRequest } from "@/lib/project/specWorkspaceClient";
import type { SpecWorkspaceProjectPatchResponseBody } from "@/lib/types/specWorkspaceProjectPatch";
import {
  newChatMessage,
  parseRequirementsRoomState,
  patchRequirementsRoomConversationMessages,
  VIRTUAL_AI_PLANNER_ID,
  type RequirementsRoomStateV3,
} from "@/lib/project/requirementsRoomState";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { APP_FLOW_LAST_PROJECT_KEY, notifyAppFlowProjectContextRefresh } from "@/lib/workflow/appFlowModel";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import { sessionUserFromAuthMe, type AuthMeDataWire } from "@/lib/user/platformProfile";
import {
  ideationDraftGateStatus,
  ideationSendDevLog,
  shouldSkipIdeationDuplicateAppend,
  IDEATION_DRAFT_MIN_FILLED_SLOTS,
  IDEATION_DRAFT_REQUIRED_SLOTS,
  resolveRequirementsWorkspaceStage,
  type MemberRow,
  type RequirementsWorkspaceStage,
  type SessionUser,
} from "@/lib/requirements/requirementsWorkspaceHelpers";
import { RequirementsWorkspaceStageRenderer } from "@/components/requirements/RequirementsWorkspaceStageRenderer";
import { buildPlatformMemberActivityFromRequirementsMessages } from "@/lib/ai-member/buildPlatformMemberActivityFromRequirementsMessages";
import { extractHandoffSnippetFromRequirementsMessages } from "@/lib/ai-member/extractHandoffSnippetFromRequirementsMessages";
import { publishWorkspaceAiScreenHandoff } from "@/lib/ai-member/workspaceAiHandoff";
import { requirementsWorkspaceStageToScreenKey } from "@/lib/requirements/requirementsWorkspaceScreenBridge";
import { resolveEnabledCatalogKeysForScreen } from "@/lib/workspace-ai/workspaceScreenKeys";
import type { WorkspaceAiGraphMemberWire } from "@/lib/workspace-ai/workspaceAiGraphWire";
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
  initialStage,
}: {
  readonly initialProjectId: string;
  readonly initialWorkflowNotice: string;
  readonly initialStage?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showScreenLabels = useShowScreenLabels();
  useRequirementsStageRouteRedirect(initialProjectId, initialStage);

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

  const [serviceFlow, setServiceFlow] = useState<RequirementsServiceFlowV1 | null>(null);
  const serviceFlowSendRef = useRef<((payload: ServiceDesignHarnessPayload, text: string) => void | Promise<void>) | null>(null);
  const featurePlanningSendRef = useRef<((payload: ServiceDesignHarnessPayload, text: string) => void | Promise<void>) | null>(null);

  const stage = useMemo(() => {
    const urlStage = String(searchParams?.get("stage") ?? "").trim().toLowerCase();
    if (urlStage) return urlStage;
    const propStage = String(initialStage ?? "").trim().toLowerCase();
    return propStage;
  }, [searchParams, initialStage]);
  const activeStage = useMemo((): RequirementsWorkspaceStage => {
    if (stage === "features") {
      return "ideation";
    }
    return resolveRequirementsWorkspaceStage(stage);
  }, [stage]);
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
  const requirementsWorkspacePrevStageRef = useRef<RequirementsWorkspaceStage>(activeStage);

  const { successToast, errorToast, showSuccessToast, showErrorToast } = useRequirementsWorkspaceToasts();
  const { saveToastVisible } = useWorkspaceSaveToast(saveState);

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

  // 현재 단계의 참여 멤버 수를 프로젝트 레일 배지로 올립니다.
  useEffect(() => {
    const pid = resolvedProjectId.trim();
    if (!pid) return;
    const key =
      inIdeationStage ? "requirements" : activeStage === "feature-planning" ? "features" : "service_flow";
    publishProjectRailParticipantCount(pid, key, participantBadgeCount);
  }, [inIdeationStage, activeStage, participantBadgeCount, resolvedProjectId]);

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

  const problemInterviewState = useMemo(
    () => parseRequirementsStateJson(project?.requirementsStateJson).problemInterview ?? null,
    [project?.requirementsStateJson]
  );
  const problemInterviewStrictFilled = useMemo(
    () => problemInterviewStrictFilledCount(problemInterviewState),
    [problemInterviewState]
  );
  const proposalReadinessPercentVal = useMemo(
    () => proposalInterviewReadinessPercent(problemInterviewState),
    [problemInterviewState]
  );
  const problemInterviewCovered = useMemo(
    () => problemInterviewStrictFilled,
    [problemInterviewStrictFilled]
  );
  const nextNeededSlot = useMemo(() => {
    const base = problemInterviewState ?? emptyProblemInterviewState("");
    return pickNextAskableInterviewSlot(base, base.askedSlots, null);
  }, [problemInterviewState]);
  const remainingQuestionsEstimate = useMemo(() => {
    const base = problemInterviewState ?? emptyProblemInterviewState("");
    const strict = problemInterviewStrictFilledCount(base);
    return Math.max(0, PROBLEM_INTERVIEW_SLOT_TOTAL - strict);
  }, [problemInterviewState]);

  const persistedPromptState = useMemo(
    () => parseRequirementsStateJson(project?.requirementsStateJson),
    [project?.requirementsStateJson]
  );

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

  const workflowGuidanceBanner = useMemo(() => {
    const fromUrl = initialWorkflowNotice.trim();
    if (fromUrl) return fromUrl;
    if (project && isRequirementsPendingWorkflow(project.workflowStatus)) {
      return REQUIREMENTS_ANALYSIS_INCOMPLETE_REDIRECT_MESSAGE_KR;
    }
    return null;
  }, [initialWorkflowNotice, project]);

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
    return participants.map((p) => ({
      id: `picker:participant:${p.id}`,
      label: p.invited ? `${p.name} (초대됨)` : p.name,
      targets: [{ id: p.id, name: p.name }],
    }));
  }, [participants]);

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
  const serviceFlowReadyForFeaturePlanning = useMemo(
    () => (project ? isServiceFlowApprovedForFeaturePlanning(project.requirementsStateJson) : false),
    [project?.requirementsStateJson]
  );
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
            },
          }),
        ]);
        const seeded = params.seedWire
          ? problemInterviewStateFromAnalyzerWireInput(params.seedWire, nowIso)
          : emptyProblemInterviewState(nowIso);
        const existingTimeline = Array.isArray(stateJsonRef.current.promptTimeline) ? stateJsonRef.current.promptTimeline : [];
        const incomingTimeline: RequirementsPromptTimelineEntry[] = params.promptTrace ? [params.promptTrace] : [];
        const nextTimeline = [...existingTimeline, ...incomingTimeline].slice(-50);
        console.debug("[PROMPT TIMELINE]", nextTimeline);
        try {
          await persistRemote(nextRoom, {}, {
            onboardingShown: true,
            problemInterview: seeded,
            ...(params.promptText ? { lastPromptText: params.promptText } : {}),
            ...(params.promptAtIso ? { lastPromptGeneratedAt: params.promptAtIso } : {}),
            ...(incomingTimeline.length ? { promptTimeline: nextTimeline } : {}),
          });
          if (!cancelled) setOnboardingAppliedKey(onboardingKey);
          return true;
        } catch (pe) {
          console.error("[PROMPT TIMELINE PERSIST FAIL]", pe);
          // keep in-memory buffer so prompt drawer can still show it even if DB save fails
          if (incomingTimeline.length) {
            stateJsonRef.current = {
              ...stateJsonRef.current,
              promptTimeline: nextTimeline,
            };
          }
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
            stage: "requirements",
            bootstrapInterview: true,
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
          };
          message?: string;
        };
        const okReply = res.ok && json.success && String(json.data?.reply ?? "").trim();
        const raw = okReply ? String(json.data?.reply) : "";
        const bodyText = sanitizeIdeationInterviewFirstQuestion(raw);
        if (cancelled) return;
        const seedWire = res.ok && json.success ? (json.data?.seedInterviewState ?? null) : null;
        const fallbackReason =
          okReply
            ? undefined
            : [String(json.code ?? "").trim(), String(json.message ?? "").trim(), `HTTP ${res.status}`].filter(Boolean).join(" · ");
        const coercePromptTrace = (raw: unknown): RequirementsPromptTimelineEntry | null => {
          if (!raw || typeof raw !== "object") {
            console.warn("[PROMPT TRACE DROPPED]", raw);
            return null;
          }
          const r = raw as Record<string, unknown>;
          const createdAt = typeof r.createdAt === "string" ? r.createdAt : "";
          const action = typeof r.action === "string" ? r.action : "";
          const stage = typeof r.stage === "string" ? r.stage : "";
          const source = typeof r.source === "string" ? r.source : "";
          if (!createdAt || !action || !stage || !source) {
            console.warn("[PROMPT TRACE DROPPED]", raw);
            return null;
          }
          return {
            stage,
            action,
            source,
            createdAt,
            ...(typeof r.aiMember === "string" ? { aiMember: r.aiMember } : {}),
            ...(typeof r.promptText === "string" ? { promptText: r.promptText } : {}),
            ...(typeof r.responseText === "string" ? { responseText: r.responseText } : {}),
            ...(typeof r.error === "string" ? { error: r.error } : {}),
            ...(typeof r.fallbackText === "string" ? { fallbackText: r.fallbackText } : {}),
            ...(typeof r.model === "string" || r.model === null ? { model: r.model as any } : {}),
            ...(typeof r.provider === "string" || r.provider === null ? { provider: r.provider as any } : {}),
          };
        };
        const promptTrace = okReply
          ? coercePromptTrace((json.data as any)?.promptTrace)
          : coercePromptTrace((json as any)?.data?.promptTrace);

        const bodyTextFallback = sanitizeIdeationInterviewFirstQuestion("");
        const fallbackTrace: RequirementsPromptTimelineEntry = {
          stage: "ideation",
          action: "bootstrapInterview",
          aiMember: "AI 기획자",
          source: "fallback",
          error: fallbackReason || "bootstrap_failed",
          fallbackText: okReply ? "" : bodyText,
          createdAt: new Date().toISOString(),
        };

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
        });
        if (!ok && !cancelled) {
          ideationBootstrapFlightRef.current = null;
          await persistFirstQuestion({
            bodyText: sanitizeIdeationInterviewFirstQuestion(""),
            seedWire: null,
            source: "fallback",
            fallbackReason: "persist_failed",
            promptTrace: {
              stage: "ideation",
              action: "bootstrapInterview",
              aiMember: "AI 기획자",
              source: "fallback",
              error: "persist_failed",
              fallbackText: sanitizeIdeationInterviewFirstQuestion(""),
              createdAt: new Date().toISOString(),
            },
          });
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "인터뷰 시작에 실패했습니다.");
        ideationBootstrapFlightRef.current = null;
        const bodyText = sanitizeIdeationInterviewFirstQuestion("");
        await persistFirstQuestion({
          bodyText,
          seedWire: null,
          source: "fallback",
          fallbackReason: e instanceof Error ? e.message : "bootstrap_failed",
          promptTrace: {
            stage: "ideation",
            action: "bootstrapInterview",
            aiMember: "AI 기획자",
            source: "fallback",
            error: e instanceof Error ? e.message : "bootstrap_failed",
            fallbackText: bodyText,
            createdAt: new Date().toISOString(),
          },
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
      const ok = window.confirm("대화 내역을 모두 삭제하고 아이디어 구체화를 다시 시작할까요? 이 작업은 되돌릴 수 없습니다.");
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
      await persistRemote(nextRoom, {}, { onboardingShown: false, problemInterview: emptyProblemInterviewState(nowIso), lastUserDraftText: "" });
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
      const replyMode = Boolean(replyTo?.id?.trim());
      ideationSendDevLog("start", `mode=${replyMode ? "reply" : "normal"}`);
      setServiceFlowDraftBusy(true);
      setError(null);
      const { targets, anyAi, effectiveReplyTo, msgs, turn } = composeIdeationSendUserTurn({
        text,
        replyToId: replyTo?.id ?? null,
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
          });
        } finally {
          setAiInvokePending(false);
        }
        if (plannerTail.needsTailPersist) {
          await persistRemote(plannerTail.finalRoom, {}, { lastUserDraftText: "" });
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
  ]);

  const runServiceFlowSend = useCallback(
    async (payload: ServiceDesignHarnessPayload) => {
      const text = input.trim();
      await dispatchServiceFlowSingleChatSend({
        payload,
        text,
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
      router.push(`/requirements?projectId=${encodeURIComponent(pid)}&stage=service-flow`);
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
  const ideationStage = (
    <div key="ideation" style={{ display: "contents" }}>
      <RequirementsIdeationChatPanel
        showScreenLabels={showScreenLabels}
        conversationStatus={conversationStatus}
        ideationConversationOnly={ideationConversationOnly}
        participantAiMemberId={participantAiMemberId}
        aiInvokePending={aiInvokePending}
        inIdeationStage={inIdeationStage}
        participantBadgeCount={participantBadgeCount}
        onOpenMembersModal={() => setMembersModalOpen(true)}
        proposalReadinessPercentVal={proposalReadinessPercentVal}
        problemInterviewCovered={problemInterviewCovered}
        problemInterviewStrictFilled={problemInterviewStrictFilled}
        nextNeededSlot={nextNeededSlot}
        remainingQuestionsEstimate={remainingQuestionsEstimate}
        problemInterviewState={problemInterviewState}
        onForceGeneratePlanNow={onForceGeneratePlanNow}
        onInsertComposerPrompt={insertComposerPrompt}
        onSetReplyTo={(messageId, preview) => setReplyTo({ id: messageId, preview })}
        openDeliverableDocument={(id) => openDeliverableViewer([id], id)}
        openDeliverableList={(focusId) => openDeliverableList(focusId)}
        openDeliverableDocuments={(ids) => openDeliverableViewer(ids, ids[0] ?? null)}
        onRegenerateDeliverables={(types) => void handleGenerateDeliverables(types)}
        onConfirmDeliverables={(ids) => void handleConfirmDeliverableAssets(ids)}
        replyTo={replyTo}
        onClearReplyTo={() => setReplyTo(null)}
        composerTextAreaRef={composerTextAreaRef}
        input={input}
        onInputChange={setInput}
        onSendIdeation={handleServiceDesignComposerSend}
        busy={busy}
        composerPlaceholder={composerPlaceholder}
        targetPickerItems={targetPickerItems}
        onOrganizeRequirements={() => void onOrganizeRequirements()}
        organizeDisabled={busy || remoteLocked}
        draftDocTruthy={Boolean(draftDoc)}
        onOpenDraftView={() => setDraftDrawerOpen(true)}
      />
    </div>
  );

  const featurePlanningStage = resolvedProjectId.trim() ? (
    <div style={{ display: "flex", flexDirection: "row", gap: 14, minWidth: 0, width: "100%" }}>
      <div style={{ flex: "1 1 520px", minWidth: 0 }}>
        <RequirementsChatPanel
          messages={conversationStatus === "loaded" ? conversationMessages : null}
          typingIndicator={false}
          screenAiMemberId="feature_planning"
          memberControls={null}
          ideationInterviewUi={null}
          onInsertComposerPrompt={() => {}}
          onSetReplyTo={() => {}}
          onOpenDeliverableDocument={() => {}}
          onOpenDeliverableList={() => {}}
          onOpenDeliverableDocuments={() => {}}
          onRegenerateDeliverables={() => {}}
          onConfirmDeliverables={() => {}}
          composer={
            <ServiceDesignComposer
              stage="feature-planning"
              value={input}
              onChange={setInput}
              busy={busy}
              disabled={busy || remoteLocked}
              placeholder={composerPlaceholder}
              targetPickerItems={targetPickerItems}
              onSendIdeation={async () => {}}
              onSendServiceFlow={async () => {}}
              onSendFeaturePlanning={runFeaturePlanningSend}
            />
          }
        />
      </div>
      <div style={{ flex: "1 1 520px", minWidth: 0 }}>
        <RequirementsFeaturePlanningStagePanel
          projectId={resolvedProjectId.trim()}
          singleChatSendRef={featurePlanningSendRef}
          onSingleChatAiMessages={appendFeaturePlanningAiTurnsToRequirementsConversation}
        />
      </div>
    </div>
  ) : (
    <div style={{ padding: 16, fontSize: 13, color: "#64748b" }}>프로젝트를 연결하면 기능 정리 단계를 사용할 수 있습니다.</div>
  );

  const serviceFlowStage = (
    <RequirementsServiceFlowStagePanel
      projectId={resolvedProjectId.trim()}
      projectName={headerProjectName}
      projectDescription={String(project?.description ?? "")}
      ideationParticipantHumanMemberIds={ideationParticipantHumanMemberIds}
      persistedServiceFlowMessages={serviceFlowWorkshopPersisted}
      onAppendPersistedServiceFlowMessages={appendServiceFlowWorkshopMessages}
      ideationAssets={(stateJsonRef.current.deliverableAssets ?? []).map((a) => ({
        type: a.type,
        title: a.title,
        content: a.content,
      }))}
      flow={serviceFlow}
      ideationReady={ideationReadyForServiceFlow}
      generatingDraft={serviceFlowDraftBusy}
      draftGenerationCount={serviceFlowDraft.serviceFlowDraftGenerationCount}
      members={members}
      currentUserId={sessionUser?.id ?? null}
      onInviteMember={() => setInviteOpen(true)}
      onRetryGate={() => setFetchNonce((n) => n + 1)}
      onUpdateFlow={(next) => void persistServiceFlow(next)}
      platformScreenAiMemberIds={serviceFlowScreenCatalogIds}
      onSendServiceFlow={runServiceFlowSend}
      serviceFlowSendRef={serviceFlowSendRef}
      singleChatMode
    />
  );

  return (
    <div style={requirementsWorkspaceShellStyle}>
      <ScreenLabel label="요구사항-목록-페이지-섹션" visible={showScreenLabels} />

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
        savePulse={saveToastVisible}
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
        serviceDesignStageNav={
          resolvedProjectId.trim() ? (
            <RequirementsServiceDesignStageNav
              projectId={resolvedProjectId.trim()}
              activeStage={activeStage}
              ideationReadyForServiceFlow={ideationReadyForServiceFlow}
              serviceFlowReadyForFeaturePlanning={serviceFlowReadyForFeaturePlanning}
            />
          ) : null
        }
      />

      <div className="jyo-requirements-workspace-body">
        <div style={requirementsWorkspaceMainRowStyle} className="jyo-requirements-workspace-main">
          <RequirementsWorkspaceStageRenderer
            activeStage={activeStage}
            ideationStage={ideationStage}
            serviceFlowStage={serviceFlowStage}
            featurePlanningStage={featurePlanningStage}
          />
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
        participants={participants}
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
          promptTimeline={persistedPromptState.promptTimeline ?? null}
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
