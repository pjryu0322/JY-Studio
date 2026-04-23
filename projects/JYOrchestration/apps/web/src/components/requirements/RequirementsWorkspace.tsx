"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { fetchProjectById } from "@/components/project-spec/api";
import type { Project } from "@/components/project-spec/types";
import { RequirementsChatPanel } from "@/components/requirements/RequirementsChatPanel";
import { RequirementsComposerGpt } from "@/components/requirements/RequirementsComposerGpt";
import type { RequirementsComposerTargetPickerItem } from "@/components/requirements/RequirementsComposerGpt";
import { RequirementsHeader } from "@/components/requirements/RequirementsHeader";
import { RequirementsMemberInviteModal } from "@/components/requirements/RequirementsMemberInviteModal";
import { RequirementsMemberSidebar } from "@/components/requirements/RequirementsMemberSidebar";
import { ServiceFlowWorkspace } from "@/components/service-flow/ServiceFlowWorkspace";
import type { ParticipantOption } from "@/components/requirements/RequirementsParticipantBar";
import { RequirementsDeliverableViewerModal } from "@/components/requirements/RequirementsDeliverableViewerModal";
import { RequirementsDraftDocumentDrawer } from "@/components/requirements/RequirementsDraftDocumentDrawer";
import { RequirementsPromptDocumentDrawer } from "@/components/requirements/RequirementsPromptDocumentDrawer";
import { RequirementsSummaryModal } from "@/components/requirements/RequirementsSummaryModal";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { isNextPublicDevWorkflowToolsEnabled } from "@/lib/env/devWorkflowTools";
import { readAiResponseStyle } from "@/lib/preferences/globalPreferences";
import { isProbablyOriginalProjectDescription } from "@/lib/project/originalProjectDescription";
import {
  appendIdeationDeliverableAssets,
  extractPreviewLinesFromMarkdown,
  IDEATION_DELIVERABLE_LABELS,
  IDEATION_DELIVERABLE_RESULT_INTERNAL_TYPE,
  markDeliverableAssetsConfirmed,
  isIdeationDeliverableType,
  type IdeationDeliverableChatPayload,
  type IdeationDeliverableType,
} from "@/lib/requirements/ideationDeliverables";
import { ideationChecklistComplete, ideationChecklistItems } from "@/lib/requirements/ideationChecklist";
import {
  IDEATION_INTERVIEW_BOOTSTRAP_INTERNAL_TYPE,
  sanitizeIdeationInterviewFirstQuestion,
} from "@/lib/requirements/ideationInterviewBootstrap";
import {
  composeInterviewPlannerReply,
  coerceInterviewAnalyzerPayload,
  emergencyFallbackProblemInterviewFromUserMessageRegex,
  emptyProblemInterviewState,
  INTERVIEW_ANALYZER_CONFIDENCE_THRESHOLD,
  INTERVIEW_COMPLETION_NOTICE_KR,
  mergeAnalyzerIntoProblemInterview,
  pickNextAskableInterviewSlot,
  planNextInterviewTurn,
  problemInterviewCoveredCount,
  problemInterviewIsCovered,
  problemInterviewSlotLabelKr,
  problemInterviewStateToAnalyzerWire,
  PROBLEM_INTERVIEW_SLOTS,
  withAskedSlot,
  type InterviewAnalyzerPayload,
  type ProblemInterviewSlot,
  type ProblemInterviewState,
} from "@/lib/requirements/problemInterview";
import { bumpDraftVersion, type RequirementsDraftDoc } from "@/lib/requirements/draftStore";
import { buildPromptPresenterView } from "@/lib/requirements/promptPresenter";
import {
  mergeRequirementsStateJson,
  parseRequirementsStateJson,
  type RequirementsStateJson,
  type RequirementsServiceFlowV1,
} from "@/lib/requirements/requirementsStateJson";
import { getPlannerSlotSchema, plannerDeliverableLabelKr, PLANNER_DELIVERABLE_TYPES } from "@/lib/requirements/plannerSlots";
import {
  bootstrapOrganizeMemoryFacts,
  buildRollingSummaryFromIdeationFields,
  DEFAULT_ORGANIZE_RECENT_MESSAGE_COUNT,
  formatOrganizeRecentMessages,
  mergeOrganizeContextAfterDraft,
  mergeOrganizeMemoryFactsPreserveMandatory,
} from "@/lib/requirements/requirementsOrganizeContext";
import { REQUIREMENTS_ANALYSIS_INCOMPLETE_REDIRECT_MESSAGE_KR } from "@/lib/project/requirementsAnalysisGate";
import { joinSuccessCriteriaAndNfr, splitSuccessCriteriaAndNfr } from "@/lib/project/requirementsSuccessCriteriaSplit";
import { isRequirementsPendingWorkflow } from "@/lib/project/projectWorkflowStatus";
import {
  newChatMessage,
  parseRequirementsRoomState,
  VIRTUAL_AI_PLANNER_ID,
  type RequirementsRoomStateV3,
} from "@/lib/project/requirementsRoomState";
import {
  augmentDialogueExcerptForReplyParent,
  inferRecentAiQuestionReplyParentId,
} from "@/lib/requirements/requirementsAnswerContext";
import { coerceRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { dedupeMemberRefs, computedTargetsFromInput, getMessageTargets } from "@/lib/requirements/requirementsTargets";
import { newConversation, type RequirementsConversation } from "@/lib/requirements/conversationStore";
import { APP_FLOW_LAST_PROJECT_KEY, APP_FLOW_PROJECT_CONTEXT_REFRESH_EVENT } from "@/lib/workflow/appFlowModel";

function notifyAppFlowProjectContextChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(APP_FLOW_PROJECT_CONTEXT_REFRESH_EVENT));
}

const LOCAL_SHELL_KEY = "jyo:requirements-workspace-local-v3";

type LocalShell = {
  room: RequirementsRoomStateV3;
  goals: string;
  scopeIn: string;
  scopeOut: string;
  targetUsers: string;
  success: string;
  nfr: string;
  openIssues: string;
  priorityFeatures: string;
};

function readLocalShell(): LocalShell | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LOCAL_SHELL_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as LocalShell;
    if (!o || typeof o !== "object") return null;
    return {
      room: parseRequirementsRoomState(o.room),
      goals: String(o.goals ?? ""),
      scopeIn: String(o.scopeIn ?? ""),
      scopeOut: String(o.scopeOut ?? ""),
      targetUsers: String(o.targetUsers ?? ""),
      success: String(o.success ?? ""),
      nfr: String(o.nfr ?? ""),
      openIssues: String(o.openIssues ?? ""),
      priorityFeatures: String(o.priorityFeatures ?? ""),
    };
  } catch {
    return null;
  }
}

function unwrapDbJsonField(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const s = raw.trim();
  if (!s) return null;
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return null;
  }
}

function parseRequirementsConversationJson(raw: unknown, projectId: string): RequirementsConversation {
  const root = unwrapDbJsonField(raw);
  if (!root || typeof root !== "object") return newConversation(projectId);
  const o = root as Record<string, unknown>;
  const stage = o.stage === "REQUIREMENTS" ? "REQUIREMENTS" : "REQUIREMENTS";
  const msgsRaw = Array.isArray(o.messages) ? o.messages : [];
  const msgs: RequirementsMessage[] = [];
  for (const m of msgsRaw) {
    const row = coerceRequirementsMessage(m);
    if (row) msgs.push(row);
  }
  return {
    projectId: typeof o.projectId === "string" && o.projectId.trim() ? String(o.projectId) : projectId,
    stage,
    messages: msgs,
  };
}

function writeLocalShell(s: LocalShell) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(LOCAL_SHELL_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

const IDEATION_SEND_DEV = process.env.NODE_ENV !== "production";

function ideationSendDevLog(event: string, detail?: string) {
  if (!IDEATION_SEND_DEV) return;
  console.log(`[ideation-send:${event}]${detail ? ` ${detail}` : ""}`);
}

/** 연속 전송·이중 핸들러에 대한 안전망(본래는 단일 경로로만 append 되어야 함). */
function shouldSkipIdeationDuplicateAppend(params: {
  messages: readonly RequirementsMessage[];
  role: "user" | "ai";
  body: string;
  speakerId?: string;
  /** true면 가상 AI 기획자 턴만 동일 본문으로 간주 */
  matchVirtualPlannerAi?: boolean;
}): boolean {
  const { messages, role, body, speakerId, matchVirtualPlannerAi } = params;
  const norm = String(body ?? "").trim();
  if (!norm) return false;
  const windowMs = 10_000;
  const now = Date.now();
  const tail = messages.slice(-5);
  for (let i = tail.length - 1; i >= 0; i--) {
    const m = tail[i]!;
    if (m.role !== role) continue;
    const t = String(m.content ?? "").trim();
    if (t !== norm) continue;
    const created = Date.parse(String(m.createdAt ?? ""));
    if (!Number.isFinite(created) || now - created > windowMs) continue;
    if (role === "user" && speakerId && String(m.speakerId) !== String(speakerId)) continue;
    if (role === "ai" && matchVirtualPlannerAi && m.speakerId !== VIRTUAL_AI_PLANNER_ID) continue;
    return true;
  }
  return false;
}

function concatUserContext(messages: RequirementsRoomStateV3["requirementsConversation"]["messages"]): string {
  return messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.trim())
    .filter(Boolean)
    .join("\n\n");
}

function formatDialogueExcerpt(messages: RequirementsRoomStateV3["requirementsConversation"]["messages"], maxChars = 12000): string {
  const lines = messages.slice(-48).map((m) => {
    const who =
      m.role === "user"
        ? "사용자"
        : m.role === "ai"
          ? `AI${m.speakerName ? `(${m.speakerName})` : ""}`
          : m.role === "human"
            ? `멤버${m.speakerName ? `(${m.speakerName})` : ""}`
            : "시스템";
    const tg = getMessageTargets(m);
    const arrow = tg.length ? ` → ${tg.map((t) => t.name).join(", ")}` : "";
    return `${who}${arrow}: ${m.content}`;
  });
  return lines.join("\n").slice(-maxChars);
}

type MemberRow = {
  memberId: string;
  displayName: string | null;
  email: string | null;
  memberType: string;
  role: string;
  isOwner?: boolean;
  userId?: string | null;
  aiOrchestrationRole?: string | null;
  orchestrationStage?: string | null;
};

type SessionUser = { id: string; email: string; name: string };

async function fetchProjectWithRetry(projectId: string): Promise<{ project: Project | null; errorMessage: string | null }> {
  const first = await fetchProjectById(projectId);
  if (first.project) return first;
  await new Promise((r) => setTimeout(r, 450));
  return fetchProjectById(projectId);
}

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

  const [resolvedProjectId, setResolvedProjectId] = useState(() => initialProjectId.trim());
  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
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
  const [fetchNonce, setFetchNonce] = useState(0);
  const [aiConnPhase, setAiConnPhase] = useState<"checking" | "ready" | "no_key" | "error">("checking");
  const [aiConnDetail, setAiConnDetail] = useState<string | undefined>();
  const [aiInvokePending, setAiInvokePending] = useState(false);
  const [aiLastInvoke, setAiLastInvoke] = useState<{ ok: boolean; at: string; detail?: string } | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; preview: string } | null>(null);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [draftDrawerOpen, setDraftDrawerOpen] = useState(false);
  const [deliverableGenerateBusy, setDeliverableGenerateBusy] = useState(false);
  const [deliverableViewerOpen, setDeliverableViewerOpen] = useState(false);
  const [deliverableViewerIds, setDeliverableViewerIds] = useState<string[]>([]);
  const [deliverableViewerFocusId, setDeliverableViewerFocusId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [plannerTypePickerOpen, setPlannerTypePickerOpen] = useState(false);
  const [plannerTypePicked, setPlannerTypePicked] = useState<IdeationDeliverableType>("problem_statement");
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const successToastHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const errorToastHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveToastVisible, setSaveToastVisible] = useState(false);
  const saveToastHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSaveStateRef = useRef<"idle" | "saving" | "saved" | "error">("idle");
  const [organizeState, setOrganizeState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [organizeError, setOrganizeError] = useState<string | null>(null);
  const [organizedAt, setOrganizedAt] = useState<string | null>(null);

  const stateJsonRef = useRef<RequirementsStateJson>({});
  const draftDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 인터뷰 자동 시작 이펙트 중복 실행(React StrictMode 등) 방지 */
  const ideationBootstrapFlightRef = useRef<string | null>(null);
  /** 전송 핸들러 동시 실행(연타·Enter 이중) 방지 — React `busy`보다 먼저 잠금 */
  const requirementsSendFlightRef = useRef(false);
  /** 다음 정리 요청 1회만 전체 대화 원문(dialogueExcerpt) 폴백 사용 */
  const organizeRawFallbackRef = useRef(false);

  const stage = useMemo(() => {
    const urlStage = String(searchParams?.get("stage") ?? "").trim().toLowerCase();
    if (urlStage) return urlStage;
    const propStage = String(initialStage ?? "").trim().toLowerCase();
    return propStage;
  }, [searchParams, initialStage]);
  const inServiceFlowStage = stage === "service-flow";

  const [serviceFlow, setServiceFlow] = useState<RequirementsServiceFlowV1 | null>(null);

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
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const json = (await res.json()) as { success?: boolean; data?: SessionUser | null };
        if (res.ok && json.success && json.data) setSessionUser(json.data);
        else setSessionUser(null);
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
        const res = await fetch("/api/requirements/ai-connection", { credentials: "include" });
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
  }, []);

  useEffect(() => {
    if (!resolvedProjectId) {
      stateJsonRef.current = {};
      const local = readLocalShell();
      if (local) {
        setRoom(local.room);
        setGoals(local.goals);
        setScopeIn(local.scopeIn);
        setScopeOut(local.scopeOut);
        setTargetUsers(local.targetUsers);
        setSuccess(local.success);
        setNfr(local.nfr);
        setOpenIssues(local.openIssues);
        setPriorityFeatures(local.priorityFeatures);
      }
      setConversationStatus("loaded");
      return;
    }
    let cancelled = false;
    void (async () => {
      setConversationStatus("loading");
      setLoadedConversationProjectId("");
      setLoadError(null);
      const { project: p, errorMessage } = await fetchProjectWithRetry(resolvedProjectId);
      if (cancelled) return;
      if (!p) {
        setProject(null);
        setLoadError(errorMessage || "프로젝트 정보를 잠시 불러오지 못했습니다.");
        setMembers([]);
        setConversationStatus("error");
        return;
      }
      setProject(p);
      setLoadError(null);
      const pid = resolvedProjectId.trim();
      const conv = parseRequirementsConversationJson(p.requirementsConversationJson, pid);
      const draft = (p.requirementsDraftJson as RequirementsDraftDoc | null | undefined) ?? null;
      const state = parseRequirementsStateJson(p.requirementsStateJson);
      stateJsonRef.current = mergeRequirementsStateJson(state, {});
      const legacy = parseRequirementsRoomState(p.requirementsRoomState);
      const legacyConv = legacy.requirementsConversation;
      const convUserCount = conv.messages.filter((m) => m.role === "user").length;
      const legacyUserCount = legacyConv.messages.filter((m) => m.role === "user").length;
      let chosenConversation: RequirementsConversation;
      if (conv.messages.length === 0 && legacyConv.messages.length > 0) {
        chosenConversation = legacyConv;
      } else if (legacyUserCount > convUserCount && legacyConv.messages.length > conv.messages.length) {
        // split JSON이 비어 있거나(onboarding만 등) 예전 방보다 메시지가 적을 때 레거시 복원
        chosenConversation = legacyConv;
      } else {
        chosenConversation = conv.messages.length > 0 ? conv : legacyConv;
      }
      const r: RequirementsRoomStateV3 = {
        v: 3,
        requirementsConversation: chosenConversation,
        requirementsDraft: draft ?? legacy.requirementsDraft ?? null,
        aiQuestionIndex: legacy.aiQuestionIndex ?? 0,
      };
      setRoom(r);
      setLoadedConversationProjectId(resolvedProjectId);
      setGoals(String(p.specCoreGoals ?? "").trim());
      setScopeIn(String(p.specScopeIn ?? "").trim());
      setScopeOut(String(p.specScopeOut ?? "").trim());
      setTargetUsers(String(p.specTargetUsers ?? "").trim());
      const sc = splitSuccessCriteriaAndNfr(p.specSuccessCriteria);
      setSuccess(sc.success);
      setNfr(sc.nfr);
      setOpenIssues(state.openIssues ?? legacy.openIssues ?? "");
      setPriorityFeatures(state.priorityFeatures ?? legacy.priorityFeatures ?? "");
      setLastSavedAt(state.lastSavedAt ?? null);
      setOrganizedAt(state.lastOrganizedAt ?? null);
      setServiceFlow(state.serviceFlowV1 ?? null);
      if (typeof state.originalProjectDescription !== "string") {
        const cur = (p.description ?? "").trim();
        if (isProbablyOriginalProjectDescription(cur)) void persistStateJsonOnly({ originalProjectDescription: cur });
      }
      if (typeof state.lastUserDraftText === "string" && state.lastUserDraftText.trim()) {
        setInput(state.lastUserDraftText);
      }
      setConversationStatus("loaded");

      const res = await fetch(`/api/project/members?projectId=${encodeURIComponent(resolvedProjectId)}`, {
        credentials: "include",
      });
      const json = (await res.json()) as { success?: boolean; data?: MemberRow[] };
      if (cancelled) return;
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        setMembers([]);
        return;
      }
      setMembers(json.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedProjectId, fetchNonce]);

  const reloadMembers = useCallback(async () => {
    const pid = resolvedProjectId.trim();
    if (!pid) return;
    const res = await fetch(`/api/project/members?projectId=${encodeURIComponent(pid)}`, { credentials: "include" });
    const json = (await res.json()) as { success?: boolean; data?: MemberRow[] };
    if (!res.ok || !json.success || !Array.isArray(json.data)) {
      setMembers([]);
      return;
    }
    setMembers(json.data);
  }, [resolvedProjectId]);

  const humanOthers = useMemo(() => members.filter((m) => m.memberType === "HUMAN" && !m.isOwner), [members]);
  const aiMembers = useMemo(() => members.filter((m) => m.memberType === "AI"), [members]);

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

  const participants = useMemo((): ParticipantOption[] => {
    const list: ParticipantOption[] = [];
    if (aiMembers.length === 0) {
      list.push({
        id: VIRTUAL_AI_PLANNER_ID,
        name: "AI 기획자",
        kind: "ai",
        onlineHint: false,
        aiStatusLabel: aiPlannerStatusLabel,
        roleLabel: "AI",
      });
    }
    for (const m of aiMembers) {
      list.push({
        id: m.memberId,
        name: (m.displayName || m.email || "AI").slice(0, 24),
        kind: "ai",
        onlineHint: false,
        aiStatusLabel: aiPlannerStatusLabel,
        roleLabel: (m.aiOrchestrationRole || m.role || "AI").slice(0, 32),
      });
    }
    for (const m of members) {
      if (m.memberType !== "HUMAN") continue;
      const uid = m.userId ?? null;
      const invited = !uid;
      list.push({
        id: m.memberId,
        name: (m.displayName || m.email || "멤버").slice(0, 24),
        kind: "human",
        onlineHint: Boolean(sessionUser?.id && uid && sessionUser.id === uid),
        roleLabel: (m.role || "멤버").slice(0, 32),
        invited,
      });
    }
    const seen = new Set<string>();
    return list.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [members, aiMembers, sessionUser?.id, aiPlannerStatusLabel]);

  const conversation = room.requirementsConversation;
  const conversationMessages = conversation.messages;
  // 로딩 중에는 null로 전달해 "기록 없음"으로 오판하지 않게 합니다.
  const messages = conversationStatus === "loaded" ? conversationMessages : null;
  const draftDoc = room.requirementsDraft ?? null;

  useEffect(() => {
    if (!draftDoc) setDraftDrawerOpen(false);
  }, [draftDoc]);

  const onboardingKey = useMemo(() => (resolvedProjectId.trim() ? `pid:${resolvedProjectId.trim()}` : "no-pid"), [resolvedProjectId]);
  const [onboardingAppliedKey, setOnboardingAppliedKey] = useState<string | null>(null);

  const isDraftIntent = useCallback((text: string) => {
    const t = text.trim();
    if (!t) return false;
    return /(초안|문서화|문서 형태|정리해줘|정리해 줘|요구사항.*(만들|작성)|요구사항\s*초안\s*생성|아이디어.*(정리|문서))/i.test(t);
  }, []);

  const requirementsPending = project ? isRequirementsPendingWorkflow(project.workflowStatus) : true;

  const ideationSlice = useMemo(
    () => ({ goals, targetUsers, success, nfr }),
    [goals, targetUsers, success, nfr]
  );
  const ideationItems = useMemo(() => ideationChecklistItems(ideationSlice), [ideationSlice]);
  const ideationComplete = useMemo(() => ideationChecklistComplete(ideationSlice), [ideationSlice]);
  const ideationStatusLine = useMemo(() => {
    const pid = resolvedProjectId.trim();
    if (!pid) return null;
    if (ideationComplete) return "아이디어 구체화 완료 ✓";
    const done = ideationItems.filter((i) => i.done).length;
    return `아이디어 구체화 진행 중 (${done}/4)`;
  }, [resolvedProjectId, ideationComplete, ideationItems]);

  const problemInterviewState = useMemo(
    () => parseRequirementsStateJson(project?.requirementsStateJson).problemInterview ?? null,
    [project?.requirementsStateJson]
  );
  const problemInterviewCovered = useMemo(
    () => problemInterviewCoveredCount(problemInterviewState),
    [problemInterviewState]
  );

  useEffect(() => {
    const pid = resolvedProjectId.trim();
    window.dispatchEvent(
      new CustomEvent("jyo:requirementsStatus", {
        detail: { statusLine: ideationStatusLine, projectId: pid || null },
      })
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent("jyo:requirementsStatus", { detail: { statusLine: null, projectId: null } })
      );
    };
  }, [ideationStatusLine, resolvedProjectId]);

  const persistedPromptState = useMemo(
    () => parseRequirementsStateJson(project?.requirementsStateJson),
    [project?.requirementsStateJson]
  );

  const deliverableAssetsFromProject = useMemo(
    () => persistedPromptState.deliverableAssets ?? [],
    [persistedPromptState.deliverableAssets]
  );

  const deliverableViewerAssets = useMemo(
    () => deliverableAssetsFromProject.filter((a) => deliverableViewerIds.includes(a.id)),
    [deliverableAssetsFromProject, deliverableViewerIds]
  );

  const workflowGuidanceBanner = useMemo(() => {
    const fromUrl = initialWorkflowNotice.trim();
    if (fromUrl) return fromUrl;
    if (project && isRequirementsPendingWorkflow(project.workflowStatus)) {
      return REQUIREMENTS_ANALYSIS_INCOMPLETE_REDIRECT_MESSAGE_KR;
    }
    return null;
  }, [initialWorkflowNotice, project]);

  const persistStateJsonOnly = useCallback(
    async (patch: Partial<RequirementsStateJson>) => {
      const pid = resolvedProjectId.trim();
      if (!pid) return;
      const ts = new Date().toISOString();
      const merged = mergeRequirementsStateJson(stateJsonRef.current, { ...patch, lastSavedAt: patch.lastSavedAt ?? ts });
      stateJsonRef.current = merged;
      setSaveState("saving");
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(pid)}/spec-workspace`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requirementsStateJson: merged }),
        });
        const json = (await res.json()) as {
          success?: boolean;
          message?: string;
          data?: { project?: Project; patchApplied?: boolean; message?: string };
        };
        if (!res.ok || !json.success || !json.data?.project) {
          setSaveState("error");
          return;
        }
        if (json.data.patchApplied === false) {
          setSaveState("error");
          return;
        }
        setProject(json.data.project);
        stateJsonRef.current = parseRequirementsStateJson(json.data.project.requirementsStateJson);
        notifyAppFlowProjectContextChanged();
        setSaveState("saved");
        setLastSavedAt(merged.lastSavedAt ?? ts);
      } catch {
        setSaveState("error");
      }
    },
    [resolvedProjectId]
  );

  const persistServiceFlow = useCallback(
    async (next: RequirementsServiceFlowV1 | null) => {
      setServiceFlow(next);
      await persistStateJsonOnly({ serviceFlowV1: next });
    },
    [persistStateJsonOnly]
  );

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
  const ideationReadyNotice = "현재 단계로 이동하려면\n아이디어 구체화 단계에서\n기획 산출물 정리가 필요합니다.";

  const persistRemote = useCallback(
    async (nextRoom: RequirementsRoomStateV3, spec: Partial<Project>, meta?: Partial<RequirementsStateJson>) => {
      const pid = resolvedProjectId.trim();
      setRoom(nextRoom);
      if (!pid) {
        const g = spec.specCoreGoals !== undefined ? String(spec.specCoreGoals ?? "") : goals;
        const si = spec.specScopeIn !== undefined ? String(spec.specScopeIn ?? "") : scopeIn;
        const so = spec.specScopeOut !== undefined ? String(spec.specScopeOut ?? "") : scopeOut;
        const tu = spec.specTargetUsers !== undefined ? String(spec.specTargetUsers ?? "") : targetUsers;
        const sc = spec.specSuccessCriteria !== undefined ? String(spec.specSuccessCriteria ?? "") : joinSuccessCriteriaAndNfr(success, nfr);
        const scParts = splitSuccessCriteriaAndNfr(sc);
        writeLocalShell({
          room: nextRoom,
          goals: g,
          scopeIn: si,
          scopeOut: so,
          targetUsers: tu,
          success: scParts.success,
          nfr: scParts.nfr,
          openIssues: nextRoom.openIssues ?? openIssues,
          priorityFeatures: nextRoom.priorityFeatures ?? priorityFeatures,
        });
        return null;
      }
      setSaveState("saving");
      const userBlob = concatUserContext(nextRoom.requirementsConversation.messages).trim();
      const nextSavedAt = new Date().toISOString();
      const baseState = mergeRequirementsStateJson(stateJsonRef.current, {
        lastSavedAt: nextSavedAt,
        lastOrganizedAt: organizedAt ?? stateJsonRef.current.lastOrganizedAt,
        selectedTargetId: null,
        selectedMembers: null,
        // Project card description should remain bound to the original creation description.
        originalProjectDescription: stateJsonRef.current.originalProjectDescription ?? "",
        onboardingShown: meta?.onboardingShown ?? onboardingAppliedKey === onboardingKey,
        openIssues: meta?.openIssues ?? (openIssues.trim() || ""),
        priorityFeatures: meta?.priorityFeatures ?? (priorityFeatures.trim() || ""),
      });
      const mergedState = meta ? mergeRequirementsStateJson(baseState, meta) : baseState;
      stateJsonRef.current = mergedState;
      const body: Record<string, unknown> = {
        requirementsConversationJson: nextRoom.requirementsConversation,
        requirementsDraftJson: nextRoom.requirementsDraft ?? null,
        requirementsStateJson: mergedState,
        requirementsRoomState: {
          ...nextRoom,
          openIssues: openIssues.trim() || undefined,
          priorityFeatures: priorityFeatures.trim() || undefined,
        },
      };
      if (spec.specCoreGoals !== undefined) body.specCoreGoals = spec.specCoreGoals;
      if (spec.specScopeIn !== undefined) body.specScopeIn = spec.specScopeIn;
      if (spec.specScopeOut !== undefined) body.specScopeOut = spec.specScopeOut;
      if (spec.specTargetUsers !== undefined) body.specTargetUsers = spec.specTargetUsers;
      if (spec.specSuccessCriteria !== undefined) body.specSuccessCriteria = spec.specSuccessCriteria;
      const res = await fetch(`/api/projects/${encodeURIComponent(pid)}/spec-workspace`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        success?: boolean;
        message?: string;
        code?: string;
        data?: { project?: Project; patchApplied?: boolean; message?: string };
      };
      if (!res.ok || !json.success || !json.data?.project) {
        setSaveState("error");
        throw new Error(json.message || "저장에 실패했습니다.");
      }
      if (json.data.patchApplied === false) {
        setSaveState("error");
        throw new Error(
          json.data.message ||
            json.message ||
            "저장이 DB에 반영되지 않았습니다. 마이그레이션 적용 여부를 확인하거나 잠시 후 다시 시도해 주세요."
        );
      }
      setProject(json.data.project);
      stateJsonRef.current = parseRequirementsStateJson(json.data.project.requirementsStateJson);
      notifyAppFlowProjectContextChanged();
      setSaveState("saved");
      setLastSavedAt(mergedState.lastSavedAt ?? nextSavedAt);
      return json.data.project;
    },
    [
      resolvedProjectId,
      openIssues,
      priorityFeatures,
      organizedAt,
      onboardingAppliedKey,
      onboardingKey,
      goals,
      scopeIn,
      scopeOut,
      targetUsers,
      success,
      nfr,
    ]
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

  useEffect(() => {
    const prev = prevSaveStateRef.current;
    prevSaveStateRef.current = saveState;
    if (prev === "saving" && saveState === "saved") {
      if (saveToastHideTimerRef.current) clearTimeout(saveToastHideTimerRef.current);
      setSaveToastVisible(true);
      saveToastHideTimerRef.current = setTimeout(() => {
        setSaveToastVisible(false);
        saveToastHideTimerRef.current = null;
      }, 2000);
    }
  }, [saveState]);

  useEffect(() => {
    return () => {
      if (saveToastHideTimerRef.current) {
        clearTimeout(saveToastHideTimerRef.current);
        saveToastHideTimerRef.current = null;
      }
    };
  }, []);

  const showSuccessToast = useCallback((message: string) => {
    if (successToastHideTimerRef.current) {
      clearTimeout(successToastHideTimerRef.current);
      successToastHideTimerRef.current = null;
    }
    setSuccessToast(message);
    successToastHideTimerRef.current = setTimeout(() => {
      setSuccessToast(null);
      successToastHideTimerRef.current = null;
    }, 2000);
  }, []);

  const showErrorToast = useCallback((message: string) => {
    if (errorToastHideTimerRef.current) {
      clearTimeout(errorToastHideTimerRef.current);
      errorToastHideTimerRef.current = null;
    }
    setErrorToast(message);
    errorToastHideTimerRef.current = setTimeout(() => {
      setErrorToast(null);
      errorToastHideTimerRef.current = null;
    }, 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (successToastHideTimerRef.current) {
        clearTimeout(successToastHideTimerRef.current);
        successToastHideTimerRef.current = null;
      }
      if (errorToastHideTimerRef.current) {
        clearTimeout(errorToastHideTimerRef.current);
        errorToastHideTimerRef.current = null;
      }
    };
  }, []);

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
      const persistFirstQuestion = async (bodyText: string): Promise<boolean> => {
        const nowIso = new Date().toISOString();
        const nextRoom: RequirementsRoomStateV3 = {
          ...room,
          requirementsConversation: {
            ...room.requirementsConversation,
            projectId: pid,
            messages: [
              newChatMessage({
                role: "ai",
                body: bodyText,
                speakerType: "AI",
                speakerId: VIRTUAL_AI_PLANNER_ID,
                speakerName: "AI 기획자",
                messageType: "ANSWER",
                meta: { internalType: IDEATION_INTERVIEW_BOOTSTRAP_INTERNAL_TYPE },
              }),
            ],
          },
        };
        try {
          await persistRemote(nextRoom, {}, { onboardingShown: true, problemInterview: emptyProblemInterviewState(nowIso) });
          if (!cancelled) setOnboardingAppliedKey(onboardingKey);
          return true;
        } catch (pe) {
          if (!cancelled) {
            setError(pe instanceof Error ? pe.message : "저장에 실패했습니다.");
            ideationBootstrapFlightRef.current = null;
          }
          return false;
        }
      };

      try {
        const res = await fetch("/api/requirements/ai-facilitator", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: pid,
            projectName: project.name ?? "",
            projectDescription: project.description ?? "",
            stage: "requirements",
            bootstrapInterview: true,
          }),
        });
        const json = (await res.json()) as { success?: boolean; data?: { reply?: string }; message?: string };
        const raw = res.ok && json.success && json.data?.reply ? String(json.data.reply) : "";
        const bodyText = sanitizeIdeationInterviewFirstQuestion(raw);
        if (cancelled) return;
        const ok = await persistFirstQuestion(bodyText);
        if (!ok && !cancelled) {
          ideationBootstrapFlightRef.current = null;
          await persistFirstQuestion(sanitizeIdeationInterviewFirstQuestion(""));
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "인터뷰 시작에 실패했습니다.");
        ideationBootstrapFlightRef.current = null;
        await persistFirstQuestion(sanitizeIdeationInterviewFirstQuestion(""));
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

  const runPlannerOrganize = useCallback(async (requestedType: IdeationDeliverableType) => {
    const pid = resolvedProjectId.trim();
    if (!pid) {
      setError("프로젝트에 연결된 뒤 정리 요청을 사용할 수 있습니다.");
      return;
    }
    if (conversationStatus !== "loaded") {
      setError("대화 이력을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    const hasConversationContent = conversationMessages.some((m) => m.role === "user" && m.content.trim());
    if (!hasConversationContent) {
      setError("정리할 대화가 아직 없습니다. 먼저 AI 기획자와 아이디어를 대화로 다듬어 주세요.");
      return;
    }
    if (busy || organizeState === "running") return;
    if (draftDebounceTimerRef.current) {
      clearTimeout(draftDebounceTimerRef.current);
      draftDebounceTimerRef.current = null;
    }
    setBusy(true);
    setError(null);
    setOrganizeState("running");
    setOrganizeError(null);
    try {
      const schema = getPlannerSlotSchema(requestedType);
      const promptMetaIso = new Date().toISOString();
      const organizePromptView = buildPromptPresenterView({
        projectName: project?.name ?? "",
        projectDescription: project?.description ?? "",
        targetName: "AI 기획자",
        messages: conversationMessages,
        latestUserMessage: `정리요청(플래너 검토형): ${schema.labelKr}`,
      });
      await persistStateJsonOnly({
        lastPromptView: organizePromptView,
        lastPromptText: organizePromptView.copyText,
        lastPromptGeneratedAt: promptMetaIso,
        lastUserDraftText: input,
        organizePlannerState: {
          requestedType,
          requestedLabel: schema.labelKr,
          pendingQuestions: [],
          requiredSlots: [...schema.requiredSlots],
          slotStatus: null,
          lastAnalyzerResult: null,
        },
      });
      const prevCtx = stateJsonRef.current.organizeContext ?? null;
      const recentCount = prevCtx?.recentMessageCount ?? DEFAULT_ORGANIZE_RECENT_MESSAGE_COUNT;
      const recentBlock = formatOrganizeRecentMessages(conversationMessages, recentCount, 12_000);
      const bootFacts = bootstrapOrganizeMemoryFacts({
        goals,
        targetUsers,
        scopeIn,
        scopeOut,
        success,
        nfr,
        openIssues,
        priorityFeatures,
      });
      const memoryFactsForApi = mergeOrganizeMemoryFactsPreserveMandatory(prevCtx?.memoryFacts ?? undefined, bootFacts);
      const rolling =
        (typeof prevCtx?.rollingSummary === "string" && prevCtx.rollingSummary.trim()) ||
        buildRollingSummaryFromIdeationFields({
          goals,
          openIssues,
          priorityFeatures,
        });
      const useRaw = organizeRawFallbackRef.current;
      organizeRawFallbackRef.current = false;
      const excerpt = formatDialogueExcerpt(conversationMessages);
      const res = await fetch("/api/requirements/organize-analyze", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: pid,
          projectName: project?.name ?? "",
          projectDescription: project?.description ?? "",
          memoryFacts: memoryFactsForApi,
          rollingSummary: rolling,
          recentMessages: useRaw ? excerpt : recentBlock,
          requestedType,
          requiredSlots: schema.requiredSlots,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        code?: string;
        message?: string;
        data?: {
          ready?: boolean;
          message?: string;
          questions?: string[];
          slotStatus?: Record<string, "filled" | "missing">;
        };
      };
      if (!res.ok || !json.success || !json.data || typeof json.data.ready !== "boolean") {
        const code = String(json.code ?? "");
        if (code === "NO_KEY") {
          throw new Error("AI 정리를 사용하려면 서버에 OPENAI_API_KEY 설정이 필요합니다.");
        }
        throw new Error(json.message || "정리 요청 처리에 실패했습니다.");
      }

      const analyzerMessage = String(json.data.message ?? "").trim() || "확인 중입니다.";
      const questions = Array.isArray(json.data.questions)
        ? json.data.questions.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 1)
        : [];

      if (!json.data.ready) {
        const body = questions.length ? `${analyzerMessage}\n\n질문: ${questions[0]}` : analyzerMessage;
        const notice = newChatMessage({
          role: "ai",
          body,
          speakerType: "AI",
          speakerId: VIRTUAL_AI_PLANNER_ID,
          speakerName: "AI 기획자",
          messageType: "ANSWER",
        });
        const nextRoom: RequirementsRoomStateV3 = {
          ...room,
          requirementsConversation: {
            ...room.requirementsConversation,
            projectId: pid,
            messages: [...conversationMessages, notice],
          },
        };
        await persistRemote(nextRoom, {}, {
          organizePlannerState: {
            requestedType,
            requestedLabel: schema.labelKr,
            pendingQuestions: questions,
            requiredSlots: [...schema.requiredSlots],
            slotStatus: json.data.slotStatus ?? null,
            lastAnalyzerResult: {
              ready: false,
              message: analyzerMessage,
              questions,
              analyzedAt: new Date().toISOString(),
            },
          },
        });
        setOrganizeState("done");
        return;
      }

      const readyNotice = newChatMessage({
        role: "ai",
        body:
          analyzerMessage ||
          `현재 정보로 ${schema.labelKr} 초안 작성이 가능합니다.\n생성을 시작합니다.`,
        speakerType: "AI",
        speakerId: VIRTUAL_AI_PLANNER_ID,
        speakerName: "AI 기획자",
        messageType: "ANSWER",
      });

      {
        // writer: 산출물 1종 생성 + 저장 + 채팅 프리뷰 카드
        const excerptForDeliverable = formatDialogueExcerpt(conversationMessages);
        const chatSummary = [
          goals.trim() && `저장 요약 — 목표/핵심:\n${goals.trim()}`,
          targetUsers.trim() && `저장 요약 — 대상 사용자:\n${targetUsers.trim()}`,
          scopeIn.trim() && `저장 요약 — 범위(포함):\n${scopeIn.trim()}`,
          scopeOut.trim() && `저장 요약 — 범위(제외):\n${scopeOut.trim()}`,
          success.trim() && `저장 요약 — 성공 기준:\n${success.trim()}`,
          nfr.trim() && `저장 요약 — NFR 등:\n${nfr.trim()}`,
          openIssues.trim() && `저장 요약 — 열린 이슈:\n${openIssues.trim()}`,
          priorityFeatures.trim() && `저장 요약 — 우선 기능:\n${priorityFeatures.trim()}`,
        ]
          .filter(Boolean)
          .join("\n\n");

        const genRes = await fetch("/api/requirements/deliverables-generate", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: pid,
            projectName: project?.name ?? "",
            projectDescription: project?.description ?? "",
            chatSummary,
            dialogueExcerpt: excerptForDeliverable,
            outputTypes: [requestedType],
            aiResponseStyle: readAiResponseStyle(),
          }),
        });
        let genJson: {
          success?: boolean;
          code?: string;
          message?: string;
          data?: { outputs?: Partial<Record<IdeationDeliverableType, string>> };
        };
        try {
          genJson = (await genRes.json()) as typeof genJson;
        } catch {
          throw new Error(
            genRes.status === 502 || genRes.status === 503
              ? "산출물 생성 API가 비정상 응답을 반환했습니다. 서버 로그와 OpenAI(OPENAI_API_KEY·쿼터)를 확인해 주세요."
              : "산출물 생성 응답을 해석하지 못했습니다."
          );
        }
        if (!genRes.ok || !genJson.success || !genJson.data?.outputs) {
          const code = String(genJson.code ?? "");
          if (code === "NO_KEY") {
            throw new Error("AI 산출물 생성을 사용하려면 서버에 OPENAI_API_KEY 설정이 필요합니다.");
          }
          throw new Error(genJson.message || "산출물 생성에 실패했습니다.");
        }

        const existing =
          parseRequirementsStateJson(project?.requirementsStateJson).deliverableAssets ??
          stateJsonRef.current.deliverableAssets ??
          [];
        const { merged, created } = appendIdeationDeliverableAssets({
          projectId: pid,
          existing,
          outputs: genJson.data.outputs,
          typesRequested: [requestedType],
        });
        if (!created.length) {
          throw new Error("생성된 본문이 비어 있습니다.");
        }

        const items = created.map((c) => ({
          assetId: c.id,
          type: c.type,
          title: c.title,
          version: c.version,
          previewLines: extractPreviewLinesFromMarkdown(c.content),
        }));
        const payload: IdeationDeliverableChatPayload = {
          kind: IDEATION_DELIVERABLE_RESULT_INTERNAL_TYPE,
          mode: "single",
          headline: `${IDEATION_DELIVERABLE_LABELS[created[0].type]} 초안이 생성되었습니다.`,
          requestedTypes: [requestedType],
          items,
        };
        const notice = newChatMessage({
          role: "ai",
          body: JSON.stringify(payload),
          speakerType: "AI",
          speakerId: VIRTUAL_AI_PLANNER_ID,
          speakerName: "AI 기획자",
          messageType: "NOTICE",
          meta: { internalType: IDEATION_DELIVERABLE_RESULT_INTERNAL_TYPE },
        });
        const afterWrite: RequirementsRoomStateV3 = {
          ...room,
          requirementsConversation: {
            ...room.requirementsConversation,
            projectId: pid,
            messages: [...conversationMessages, readyNotice, notice],
          },
        };
        await persistRemote(afterWrite, {}, {
          deliverableAssets: merged,
          organizePlannerState: {
            requestedType,
            requestedLabel: schema.labelKr,
            pendingQuestions: [],
            requiredSlots: [...schema.requiredSlots],
            slotStatus: json.data.slotStatus ?? null,
            lastAnalyzerResult: {
              ready: true,
              message: analyzerMessage,
              questions: [],
              analyzedAt: new Date().toISOString(),
            },
          },
        });
      }
      await persistStateJsonOnly({ organizePlannerState: null, lastOrganizedAt: new Date().toISOString() });
      showSuccessToast(`${schema.labelKr} 생성 완료`);
      setOrganizeState("done");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "오류";
      setOrganizeState("error");
      setOrganizeError(msg);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [
    resolvedProjectId,
    busy,
    conversationStatus,
    conversationMessages,
    organizeState,
    project?.name,
    project?.description,
    draftDoc,
    room,
    persistRemote,
    persistStateJsonOnly,
    input,
    goals,
    targetUsers,
    scopeIn,
    scopeOut,
    success,
    nfr,
    openIssues,
    priorityFeatures,
  ]);

  const handleGenerateDeliverables = useCallback(
    async (types: readonly IdeationDeliverableType[]) => {
      const pid = resolvedProjectId.trim();
      if (!pid) {
        setError("프로젝트에 연결된 뒤 산출물 생성을 사용할 수 있습니다.");
        throw new Error("GUARD");
      }
      if (conversationStatus !== "loaded") {
        setError("대화 이력을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
        throw new Error("GUARD");
      }
      if (types.includes("full_plan") && types.length > 1) {
        setError("전체 기획안은 다른 산출물과 함께 선택할 수 없습니다.");
        throw new Error("GUARD");
      }
      setDeliverableGenerateBusy(true);
      setError(null);
      try {
        const chatSummary = [
          goals.trim() && `저장 요약 — 목표/핵심:\n${goals.trim()}`,
          targetUsers.trim() && `저장 요약 — 대상 사용자:\n${targetUsers.trim()}`,
          scopeIn.trim() && `저장 요약 — 범위(포함):\n${scopeIn.trim()}`,
          scopeOut.trim() && `저장 요약 — 범위(제외):\n${scopeOut.trim()}`,
          success.trim() && `저장 요약 — 성공 기준:\n${success.trim()}`,
          nfr.trim() && `저장 요약 — NFR 등:\n${nfr.trim()}`,
          openIssues.trim() && `저장 요약 — 열린 이슈:\n${openIssues.trim()}`,
          priorityFeatures.trim() && `저장 요약 — 우선 기능:\n${priorityFeatures.trim()}`,
        ]
          .filter(Boolean)
          .join("\n\n");

        const excerpt = formatDialogueExcerpt(conversationMessages);
        const res = await fetch("/api/requirements/deliverables-generate", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: pid,
            projectName: project?.name ?? "",
            projectDescription: project?.description ?? "",
            chatSummary,
            dialogueExcerpt: excerpt,
            outputTypes: types,
            aiResponseStyle: readAiResponseStyle(),
          }),
        });
        let json: {
          success?: boolean;
          code?: string;
          message?: string;
          data?: { outputs?: Partial<Record<IdeationDeliverableType, string>> };
        };
        try {
          json = (await res.json()) as typeof json;
        } catch {
          throw new Error(
            res.status === 502 || res.status === 503
              ? "산출물 생성 API가 비정상 응답을 반환했습니다. 서버 로그와 OpenAI(OPENAI_API_KEY·쿼터)를 확인해 주세요."
              : "산출물 생성 응답을 해석하지 못했습니다."
          );
        }
        if (!res.ok || !json.success || !json.data?.outputs) {
          const code = String(json.code ?? "");
          if (code === "NO_KEY") {
            throw new Error("AI 산출물 생성을 사용하려면 서버에 OPENAI_API_KEY 설정이 필요합니다.");
          }
          throw new Error(json.message || "산출물 생성에 실패했습니다.");
        }

        const existing =
          parseRequirementsStateJson(project?.requirementsStateJson).deliverableAssets ??
          stateJsonRef.current.deliverableAssets ??
          [];

        const { merged, created } = appendIdeationDeliverableAssets({
          projectId: pid,
          existing,
          outputs: json.data.outputs,
          typesRequested: types,
        });
        if (!created.length) {
          throw new Error("생성된 본문이 비어 있습니다.");
        }

        const items = created.map((c) => ({
          assetId: c.id,
          type: c.type,
          title: c.title,
          version: c.version,
          previewLines: extractPreviewLinesFromMarkdown(c.content),
        }));
        const mode: IdeationDeliverableChatPayload["mode"] = created.length === 1 ? "single" : "batch";
        const headline =
          mode === "single"
            ? `${IDEATION_DELIVERABLE_LABELS[created[0].type]} 초안이 생성되었습니다.`
            : `${created.length}개의 산출물이 생성되었습니다.`;
        const payload: IdeationDeliverableChatPayload = {
          kind: IDEATION_DELIVERABLE_RESULT_INTERNAL_TYPE,
          mode,
          headline,
          requestedTypes: [...types],
          items,
        };
        const notice = newChatMessage({
          role: "ai",
          body: JSON.stringify(payload),
          speakerType: "AI",
          speakerId: VIRTUAL_AI_PLANNER_ID,
          speakerName: "AI 기획자",
          messageType: "NOTICE",
          meta: { internalType: IDEATION_DELIVERABLE_RESULT_INTERNAL_TYPE },
        });
        const nextRoom: RequirementsRoomStateV3 = {
          ...room,
          requirementsConversation: {
            ...room.requirementsConversation,
            projectId: pid,
            messages: [...conversationMessages, notice],
          },
        };
        await persistRemote(nextRoom, {}, { deliverableAssets: merged });
        if (created.length === 1 && created[0]) {
          showSuccessToast(`${IDEATION_DELIVERABLE_LABELS[created[0].type]} 생성 완료`);
        } else {
          showSuccessToast(`${created.length}개 산출물 생성 완료`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "오류";
        if (msg !== "GUARD") {
          setError(msg);
          showErrorToast(msg);
        }
        throw e;
      } finally {
        setDeliverableGenerateBusy(false);
      }
    },
    [
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
      project?.name,
      project?.description,
      project?.requirementsStateJson,
      room,
      persistRemote,
      showSuccessToast,
      showErrorToast,
    ]
  );

  const isAiTarget = useCallback(
    (targetId: string) => {
      if (targetId === VIRTUAL_AI_PLANNER_ID) return true;
      const row = members.find((m) => m.memberId === targetId);
      return Boolean(row?.memberType === "AI");
    },
    [members]
  );

  const onSend = useCallback(async () => {
    if (requirementsSendFlightRef.current) {
      ideationSendDevLog("start", "id=(ignored-duplicate-in-flight)");
      return;
    }
    if (draftDebounceTimerRef.current) {
      clearTimeout(draftDebounceTimerRef.current);
      draftDebounceTimerRef.current = null;
    }
    const text = input.trim();
    if (!text || busy || aiInvokePending) return;
    if (
      shouldSkipIdeationDuplicateAppend({
        messages: conversationMessages,
        role: "user",
        body: text,
        speakerId: sessionUser?.id ?? "me",
      })
    ) {
      ideationSendDevLog("dedupe-user-skip", text.slice(0, 80));
      return;
    }
    requirementsSendFlightRef.current = true;
    const sendTraceId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `send-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    const replyMode = Boolean(replyTo?.id?.trim());
    ideationSendDevLog("start", `id=${sendTraceId} mode=${replyMode ? "reply" : "normal"}`);
    setBusy(true);
    setError(null);
    try {
      const mentionRefs = participants.map((p) => ({ id: p.id, name: p.name }));
      const fromMentions = computedTargetsFromInput(text, mentionRefs);
      const targets = dedupeMemberRefs(
        fromMentions.length ? fromMentions : [{ id: VIRTUAL_AI_PLANNER_ID, name: "AI 기획자" }]
      );
      const anyAi = targets.some((t) => isAiTarget(t.id));
      const primaryAi = targets.find((t) => isAiTarget(t.id));
      const combinedLabel = targets.map((t) => t.name).join(" · ");
      const effectiveReplyTo = inferRecentAiQuestionReplyParentId(conversationMessages, replyTo?.id ?? null);

      const userMsg = newChatMessage({
        role: "user",
        body: text,
        targets,
        ...(effectiveReplyTo ? { replyTo: effectiveReplyTo } : {}),
        speakerId: sessionUser?.id ?? "me",
        speakerName: sessionUser?.name ?? "나",
        speakerType: "USER",
        messageType: targets.length ? "QUESTION" : "STATEMENT",
      });
      const msgs = [...conversationMessages, userMsg];
      const turn = room.aiQuestionIndex ?? 0;
      const plannerState = stateJsonRef.current.organizePlannerState ?? null;

      if (anyAi) {
        const primaryId = primaryAi?.id ?? targets[0].id;
        const aiName = primaryId === VIRTUAL_AI_PLANNER_ID ? "AI 기획자" : primaryAi?.name ?? targets[0].name;
        const promptMetaIso = new Date().toISOString();
        const pv = buildPromptPresenterView({
          projectName: project?.name ?? "",
          projectDescription: project?.description ?? "",
          targetName: combinedLabel,
          messages: conversationMessages,
          latestUserMessage: text,
        });
        const withCalling: RequirementsRoomStateV3 = {
          ...room,
          requirementsConversation: { ...room.requirementsConversation, projectId: resolvedProjectId.trim(), messages: msgs },
        };
        await persistRemote(withCalling, {}, {
          lastPromptView: pv,
          lastPromptText: pv.copyText,
          lastPromptGeneratedAt: promptMetaIso,
          lastUserDraftText: text,
        });
        ideationSendDevLog("user-appended", `id=${sendTraceId} userMsg=${userMsg.id}`);
        setAiInvokePending(true);
        const pid = resolvedProjectId.trim();

        type IdeationPlannerTail = { needsTailPersist: true; finalRoom: RequirementsRoomStateV3 } | { needsTailPersist: false };

        const runExclusiveIdeationPlannerPipeline = async (): Promise<IdeationPlannerTail> => {
          // 정리요청(플래너 리뷰) 진행 중이면: 일반 대화 대신 Analyzer → (질문/생성) 흐름만 수행
          const pending = plannerState && plannerState.pendingQuestions && plannerState.pendingQuestions.length > 0;
          if (pending && pid) {
            const requestedType: IdeationDeliverableType = plannerState.requestedType;
            const schema = getPlannerSlotSchema(requestedType);
            const prevCtx = stateJsonRef.current.organizeContext ?? null;
            const recentCount = prevCtx?.recentMessageCount ?? DEFAULT_ORGANIZE_RECENT_MESSAGE_COUNT;
            const recentBlock = formatOrganizeRecentMessages(msgs, recentCount, 12_000);
            const bootFacts = bootstrapOrganizeMemoryFacts({
              goals,
              targetUsers,
              scopeIn,
              scopeOut,
              success,
              nfr,
              openIssues,
              priorityFeatures,
            });
            const memoryFactsForApi = mergeOrganizeMemoryFactsPreserveMandatory(prevCtx?.memoryFacts ?? undefined, bootFacts);
            const rolling =
              (typeof prevCtx?.rollingSummary === "string" && prevCtx.rollingSummary.trim()) ||
              buildRollingSummaryFromIdeationFields({ goals, openIssues, priorityFeatures });
            const excerpt = augmentDialogueExcerptForReplyParent(
              formatDialogueExcerpt(msgs),
              msgs,
              effectiveReplyTo
            );

            const res = await fetch("/api/requirements/organize-analyze", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                projectId: pid,
                projectName: project?.name ?? "",
                projectDescription: project?.description ?? "",
                requestedType,
                requiredSlots:
                  Array.isArray(plannerState.requiredSlots) && plannerState.requiredSlots.length
                    ? plannerState.requiredSlots
                    : schema.requiredSlots,
                memoryFacts: memoryFactsForApi,
                rollingSummary: rolling,
                recentMessages: excerpt || recentBlock,
              }),
            });
            const json = (await res.json()) as {
              success?: boolean;
              code?: string;
              message?: string;
              data?: { ready?: boolean; message?: string; questions?: string[]; slotStatus?: Record<string, "filled" | "missing"> };
            };
            if (!res.ok || !json.success || !json.data || typeof json.data.ready !== "boolean") {
              const errMsg = json.message || "정리 요청 처리에 실패했습니다.";
              setAiLastInvoke({ ok: false, at: new Date().toISOString(), detail: errMsg });
              showErrorToast(errMsg);
              const errRoom = { ...withCalling, aiQuestionIndex: turn + 1 };
              setInput("");
              setReplyTo(null);
              await persistRemote(errRoom, {}, { lastUserDraftText: "" });
              return { needsTailPersist: false };
            } else if (!json.data.ready) {
              const analyzerMessage = String(json.data.message ?? "").trim() || "좋은 초안을 위해 한 가지만 더 확인하겠습니다.";
              const questions = Array.isArray(json.data.questions)
                ? json.data.questions.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 1)
                : [];
              const body = questions.length ? `${analyzerMessage}\n\n질문: ${questions[0]}` : analyzerMessage;
              const moreQuestionsRoom = {
                ...withCalling,
                aiQuestionIndex: turn + 1,
                requirementsConversation: {
                  ...withCalling.requirementsConversation,
                  messages: [
                    ...withCalling.requirementsConversation.messages,
                    newChatMessage({
                      role: "ai",
                      body,
                      speakerType: "AI",
                      speakerId: primaryId,
                      speakerName: aiName,
                      messageType: "ANSWER",
                    }),
                  ],
                },
              };
              await persistRemote(moreQuestionsRoom, {}, {
                organizePlannerState: {
                  requestedType,
                  requestedLabel: plannerState.requestedLabel ?? schema.labelKr,
                  pendingQuestions: questions,
                  requiredSlots:
                    Array.isArray(plannerState.requiredSlots) && plannerState.requiredSlots.length
                      ? plannerState.requiredSlots
                      : [...schema.requiredSlots],
                  slotStatus: json.data.slotStatus ?? null,
                  lastAnalyzerResult: {
                    ready: false,
                    message: analyzerMessage,
                    questions,
                    analyzedAt: new Date().toISOString(),
                  },
                },
              });
              setAiLastInvoke({ ok: true, at: new Date().toISOString() });
              setInput("");
              setReplyTo(null);
              return { needsTailPersist: false };
            } else {
              const analyzerMessage = String(json.data.message ?? "").trim() || "현재 논의 내용으로 초안 작성이 가능합니다. 초안을 생성합니다.";
              const readyRoom = {
                ...withCalling,
                aiQuestionIndex: turn + 1,
                requirementsConversation: {
                  ...withCalling.requirementsConversation,
                  messages: [
                    ...withCalling.requirementsConversation.messages,
                    newChatMessage({
                      role: "ai",
                      body: analyzerMessage,
                      speakerType: "AI",
                      speakerId: primaryId,
                      speakerName: aiName,
                      messageType: "ANSWER",
                    }),
                  ],
                },
              };
              await persistRemote(readyRoom, {}, {
                organizePlannerState: {
                  requestedType,
                  requestedLabel: plannerState.requestedLabel ?? schema.labelKr,
                  pendingQuestions: [],
                  requiredSlots:
                    Array.isArray(plannerState.requiredSlots) && plannerState.requiredSlots.length
                      ? plannerState.requiredSlots
                      : [...schema.requiredSlots],
                  slotStatus: json.data.slotStatus ?? null,
                  lastAnalyzerResult: {
                    ready: true,
                    message: analyzerMessage,
                    questions: [],
                    analyzedAt: new Date().toISOString(),
                  },
                },
              });
              await handleGenerateDeliverables([requestedType]);
              const archivedAt = new Date().toISOString();
              const prevInterview = stateJsonRef.current.problemInterview as ProblemInterviewState | null | undefined;
              const prevHistory = (stateJsonRef.current.problemInterviewHistory as Array<{ archivedAt: string; state: ProblemInterviewState }> | null | undefined) ?? null;
              await persistStateJsonOnly({
                organizePlannerState: null,
                lastOrganizedAt: archivedAt,
                ...(prevInterview
                  ? {
                      problemInterview: null,
                      problemInterviewHistory: [
                        ...(Array.isArray(prevHistory) ? prevHistory : []),
                        { archivedAt, state: prevInterview },
                      ].slice(-24),
                    }
                  : {}),
              });
              showSuccessToast(`${plannerState.requestedLabel ?? schema.labelKr} 생성 완료`);
              setAiLastInvoke({ ok: true, at: new Date().toISOString() });
              setInput("");
              setReplyTo(null);
              return { needsTailPersist: false };
            }
          }

          const wantsDraftEndpoint = isDraftIntent(text);
          const excerpt = augmentDialogueExcerptForReplyParent(
            formatDialogueExcerpt(msgs),
            msgs,
            effectiveReplyTo
          );
          const endpoint = wantsDraftEndpoint ? "/api/requirements/draft-generate" : "/api/requirements/ai-facilitator";

          // --------------------------------------------------
          // 아이디어 구체화: 문제정의 인터뷰(반복 질문 방지)
          // 초안 의도(draft-generate)와 무관하게, 인터뷰 활성 시에는 이 블록만 타고 ai-facilitator는 호출하지 않는다.
          // --------------------------------------------------
          const runProblemInterviewAnalyzeFlow = (() => {
            if (wantsDraftEndpoint) return false;
            if (primaryId !== VIRTUAL_AI_PLANNER_ID) return false;
            if (stateJsonRef.current.organizePlannerState) return false;
            const lastAi = [...msgs].reverse().find((m) => m.role === "ai");
            const internal = lastAi && (lastAi as any).meta && (lastAi as any).meta.internalType;
            const boot = internal === IDEATION_INTERVIEW_BOOTSTRAP_INTERNAL_TYPE;
            const pi = stateJsonRef.current.problemInterview as ProblemInterviewState | null | undefined;
            const active = Boolean(pi && pi.active !== false);
            return boot || active;
          })();

          if (runProblemInterviewAnalyzeFlow) {
            const nowIso = new Date().toISOString();
            const prevPi = (stateJsonRef.current.problemInterview as ProblemInterviewState | null | undefined) ?? null;
            const seeded = prevPi ?? emptyProblemInterviewState(nowIso);
            const latestAiTurn = [...msgs].reverse().find((m) => m.role === "ai");
            const latestAiQuestion = String(latestAiTurn?.content ?? "").trim();

            let merged: ProblemInterviewState = seeded;
            let analyzer: InterviewAnalyzerPayload | null = null;
            let remoteAnalyzeOk = false;
            if (pid) {
              try {
                const ar = await fetch("/api/requirements/interview-analyze", {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    projectId: pid,
                    projectName: project?.name ?? "",
                    projectDescription: project?.description ?? "",
                    userMessage: text,
                    latestAiQuestion,
                    currentInterviewState: problemInterviewStateToAnalyzerWire(seeded),
                  }),
                });
                const aj = (await ar.json()) as { success?: boolean; data?: unknown };
                remoteAnalyzeOk = ar.ok && Boolean(aj.success) && aj.data != null;
                if (ar.ok && aj.success && aj.data) {
                  const parsed = coerceInterviewAnalyzerPayload(aj.data);
                  if (parsed) {
                    analyzer = parsed;
                    merged = mergeAnalyzerIntoProblemInterview(seeded, parsed, nowIso);
                    ideationSendDevLog("analyzer-success", `id=${sendTraceId}`);
                  }
                }
              } catch {
                remoteAnalyzeOk = false;
              }
            }
            if (!analyzer) {
              if (!remoteAnalyzeOk) {
                merged = emergencyFallbackProblemInterviewFromUserMessageRegex(seeded, text, nowIso);
                ideationSendDevLog("fallback-used", `id=${sendTraceId}`);
              } else {
                merged = { ...seeded, updatedAt: nowIso };
              }
            }

            const plan = planNextInterviewTurn(
              merged,
              analyzer,
              merged.askedSlots,
              turn,
              INTERVIEW_ANALYZER_CONFIDENCE_THRESHOLD,
              text
            );
            if (plan) {
              const aiBody = composeInterviewPlannerReply(plan.summary, plan.question);
              const slotForAsked =
                plan.kind === "slot"
                  ? plan.slot
                  : pickNextAskableInterviewSlot(merged, merged.askedSlots, null) ?? ("painPoint" as ProblemInterviewSlot);
              const asked = withAskedSlot(merged, slotForAsked, nowIso);
              const baseMsgs = withCalling.requirementsConversation.messages;
              if (
                primaryId === VIRTUAL_AI_PLANNER_ID &&
                shouldSkipIdeationDuplicateAppend({
                  messages: baseMsgs,
                  role: "ai",
                  body: aiBody,
                  matchVirtualPlannerAi: true,
                })
              ) {
                ideationSendDevLog("dedupe-ai-skip", `id=${sendTraceId}`);
                await persistRemote(withCalling, {}, { problemInterview: asked });
                setAiLastInvoke({ ok: true, at: new Date().toISOString() });
                setInput("");
                setReplyTo(null);
                return { needsTailPersist: false };
              }
              ideationSendDevLog("ai-appended", `id=${sendTraceId} kind=interview-next`);
              const interviewNextRoom: RequirementsRoomStateV3 = {
                ...withCalling,
                aiQuestionIndex: turn + 1,
                requirementsConversation: {
                  ...withCalling.requirementsConversation,
                  messages: [
                    ...withCalling.requirementsConversation.messages,
                    newChatMessage({
                      role: "ai",
                      body: aiBody,
                      speakerType: "AI",
                      speakerId: primaryId,
                      speakerName: aiName,
                      messageType: "ANSWER",
                    }),
                  ],
                },
              };
              await persistRemote(interviewNextRoom, {}, { problemInterview: asked });
              setAiLastInvoke({ ok: true, at: new Date().toISOString() });
              setInput("");
              setReplyTo(null);
              return { needsTailPersist: false };
            }

            const doneInterview = { ...merged, active: false, updatedAt: nowIso };
            const completionBody = INTERVIEW_COMPLETION_NOTICE_KR;
            if (
              primaryId === VIRTUAL_AI_PLANNER_ID &&
              shouldSkipIdeationDuplicateAppend({
                messages: withCalling.requirementsConversation.messages,
                role: "ai",
                body: completionBody,
                matchVirtualPlannerAi: true,
              })
            ) {
              ideationSendDevLog("dedupe-ai-skip", `id=${sendTraceId} kind=interview-complete`);
              await persistRemote(withCalling, {}, { problemInterview: doneInterview });
              setAiLastInvoke({ ok: true, at: new Date().toISOString() });
              setInput("");
              setReplyTo(null);
              return { needsTailPersist: false };
            }
            ideationSendDevLog("ai-appended", `id=${sendTraceId} kind=interview-complete`);
            const interviewDoneRoom: RequirementsRoomStateV3 = {
              ...withCalling,
              aiQuestionIndex: turn + 1,
              requirementsConversation: {
                ...withCalling.requirementsConversation,
                messages: [
                  ...withCalling.requirementsConversation.messages,
                  newChatMessage({
                    role: "ai",
                    body: completionBody,
                    speakerType: "AI",
                    speakerId: primaryId,
                    speakerName: aiName,
                    messageType: "ANSWER",
                  }),
                ],
              },
            };
            await persistRemote(interviewDoneRoom, {}, { problemInterview: doneInterview });
            setAiLastInvoke({ ok: true, at: new Date().toISOString() });
            setInput("");
            setReplyTo(null);
            return { needsTailPersist: false };
          }

          let facilitatorFinalRoom: RequirementsRoomStateV3;
          try {
            const res = await fetch(endpoint, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...(pid ? { projectId: pid } : {}),
                projectName: project?.name ?? "",
                projectDescription: project?.description ?? "",
                stage: "requirements",
                userMessage: text,
                dialogueExcerpt: excerpt,
                aiResponseStyle: readAiResponseStyle(),
                targets: targets.map((t) => ({ id: t.id, name: t.name })),
                sender: { id: sessionUser?.id ?? "", name: sessionUser?.name ?? "나" },
                replyTo: effectiveReplyTo ?? null,
              }),
            });
            const json = (await res.json()) as {
              success?: boolean;
              message?: string;
              data?: { reply?: string; draft?: { overview: string; goals: string[]; users: string[]; features: string[]; excluded: string[]; nonFunctional: string[]; successCriteria: string[]; openIssues: string[] } };
            };
            if (res.ok && json.success && (json.data?.reply || json.data?.draft)) {
              setAiLastInvoke({ ok: true, at: new Date().toISOString() });
              const createdDraft = json.data?.draft ?? null;
              const aiReply =
                json.data?.reply ??
                (createdDraft
                  ? `정리 초안을 만들었습니다.\n\n- 프로젝트 개요: ${createdDraft.overview}\n- 대상 사용자: ${createdDraft.users.join(", ")}\n- 핵심 기능: ${createdDraft.features.join(", ")}\n- 성공 기준: ${createdDraft.successCriteria.join(", ")}\n${createdDraft.openIssues.length ? `- 미결정 이슈: ${createdDraft.openIssues.join(", ")}` : ""}`.trim()
                  : "");

              const nextDraftDoc =
                createdDraft && pid
                  ? bumpDraftVersion(
                      draftDoc,
                      {
                        projectId: pid,
                        overview: createdDraft.overview,
                        goals: createdDraft.goals,
                        users: createdDraft.users,
                        features: createdDraft.features,
                        excluded: createdDraft.excluded,
                        nonFunctional: createdDraft.nonFunctional,
                        successCriteria: createdDraft.successCriteria,
                        openIssues: createdDraft.openIssues,
                        createdAt: new Date().toISOString(),
                        source: { messageCount: msgs.length, lastMessageAt: msgs[msgs.length - 1]?.createdAt },
                      }
                    )
                  : null;

              if (
                primaryId === VIRTUAL_AI_PLANNER_ID &&
                shouldSkipIdeationDuplicateAppend({
                  messages: withCalling.requirementsConversation.messages,
                  role: "ai",
                  body: aiReply,
                  matchVirtualPlannerAi: true,
                })
              ) {
                ideationSendDevLog("dedupe-ai-skip", `id=${sendTraceId} kind=facilitator`);
                facilitatorFinalRoom = { ...withCalling, aiQuestionIndex: turn + 1 };
              } else {
                ideationSendDevLog("ai-appended", `id=${sendTraceId} kind=facilitator`);
                facilitatorFinalRoom = {
                  ...withCalling,
                  aiQuestionIndex: turn + 1,
                  requirementsConversation: {
                    ...withCalling.requirementsConversation,
                    messages: [
                      ...withCalling.requirementsConversation.messages,
                      newChatMessage({
                        role: "ai",
                        body: aiReply,
                        speakerType: "AI",
                        speakerId: primaryId,
                        speakerName: aiName,
                        messageType: "ANSWER",
                      }),
                    ],
                  },
                  ...(nextDraftDoc ? { requirementsDraft: nextDraftDoc } : {}),
                };
              }
            } else {
              const errMsg = json.message || "응답 생성 실패";
              setAiLastInvoke({ ok: false, at: new Date().toISOString(), detail: errMsg });
              showErrorToast("AI 기획자 응답에 실패했습니다. 다시 시도해 주세요.");
              facilitatorFinalRoom = { ...withCalling, aiQuestionIndex: turn + 1 };
            }
            return { needsTailPersist: true, finalRoom: facilitatorFinalRoom };
          } catch (e) {
            const errMsg = e instanceof Error ? e.message : String(e);
            setAiLastInvoke({ ok: false, at: new Date().toISOString(), detail: errMsg });
            showErrorToast("AI 기획자 응답에 실패했습니다. 다시 시도해 주세요.");
            return { needsTailPersist: true, finalRoom: { ...withCalling, aiQuestionIndex: turn + 1 } };
          }
        };

        let plannerTail: IdeationPlannerTail;
        try {
          plannerTail = await runExclusiveIdeationPlannerPipeline();
        } finally {
          setAiInvokePending(false);
        }
        if (plannerTail.needsTailPersist) {
          await persistRemote(plannerTail.finalRoom, {}, { lastUserDraftText: "" });
        }
        setInput("");
        setReplyTo(null);
        ideationSendDevLog("end", `id=${sendTraceId}`);
      } else {
        const nextRoom: RequirementsRoomStateV3 = {
          ...room,
          requirementsConversation: {
            ...room.requirementsConversation,
            projectId: resolvedProjectId.trim(),
            messages: msgs,
          },
        };
        setInput("");
        setReplyTo(null);
        await persistRemote(nextRoom, {}, { lastUserDraftText: "" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
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
    participants,
    isAiTarget,
    persistRemote,
    resolvedProjectId,
    sessionUser?.id,
    sessionUser?.name,
    project?.name,
    project?.description,
    draftDoc,
    replyTo,
    showErrorToast,
    handleGenerateDeliverables,
    showSuccessToast,
    isDraftIntent,
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

  const ackDev = useCallback(async () => {
    const pid = resolvedProjectId.trim();
    if (!pid) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(pid)}/workflow/ack-requirements`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as { success?: boolean };
      if (!res.ok || !json.success) return;
      notifyAppFlowProjectContextChanged();
      router.push(`/projects/${encodeURIComponent(pid)}?view=workspace`);
    } finally {
      setBusy(false);
    }
  }, [resolvedProjectId, router]);

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

  const openDeliverableViewer = useCallback((ids: readonly string[], focusId?: string | null) => {
    setDeliverableViewerIds([...ids]);
    setDeliverableViewerFocusId(focusId ?? null);
    setDeliverableViewerOpen(true);
  }, []);

  const handleConfirmDeliverableAssets = useCallback(
    async (ids: readonly string[]) => {
      const pid = resolvedProjectId.trim();
      if (!pid) return;
      const cur =
        parseRequirementsStateJson(project?.requirementsStateJson).deliverableAssets ??
        stateJsonRef.current.deliverableAssets ??
        [];
      const next = markDeliverableAssetsConfirmed(cur, ids);
      await persistStateJsonOnly({ deliverableAssets: next });
    },
    [resolvedProjectId, project?.requirementsStateJson, persistStateJsonOnly]
  );

  const handleGenerateServiceFlowDraft = useCallback(async () => {
    const pid = resolvedProjectId.trim();
    if (!pid) {
      setError("프로젝트에 연결된 뒤 사용할 수 있습니다.");
      return;
    }
    if (!ideationReadyForServiceFlow) {
      setError(ideationReadyNotice);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const assets = (stateJsonRef.current.deliverableAssets ?? []).map((a) => ({
        type: a.type,
        title: a.title,
        content: a.content,
      }));
      const res = await fetch("/api/requirements/service-flow-draft", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: pid,
          projectName: project?.name ?? "",
          projectDescription: project?.description ?? "",
          ideationAssets: assets,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        code?: string;
        message?: string;
        data?: {
          steps?: Array<{ title?: string; purpose?: string; primary?: string; secondary?: string[] }>;
          actors?: Array<{ name?: string; kind?: string; description?: string }>;
          reviewPoints?: string[];
        };
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message || "AI 초안 생성에 실패했습니다.");
      }
      const now = new Date().toISOString();
      const actorsRaw = Array.isArray(json.data.actors) ? json.data.actors : [];
      const stepsRaw = Array.isArray(json.data.steps) ? json.data.steps : [];

      const actorIdByName = new Map<string, string>();
      const actors = actorsRaw
        .map((a) => {
          const name = String(a?.name ?? "").trim();
          const kind = String(a?.kind ?? "").trim().toLowerCase();
          if (!name) return null;
          const id = `actor:${name}`;
          actorIdByName.set(name, id);
          return {
            id,
            name,
            kind: kind === "system" ? ("system" as const) : ("human" as const),
            description: typeof a?.description === "string" ? a.description.trim() : null,
          };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x));
      if (!actors.length) {
        actors.push({ id: "actor:사용자", name: "사용자", kind: "human" as const, description: null });
      }

      const steps = stepsRaw
        .map((s, idx) => {
          const title = String(s?.title ?? "").trim();
          const purpose = String(s?.purpose ?? "").trim();
          const primaryName = String(s?.primary ?? "").trim();
          const primaryActorId = actorIdByName.get(primaryName) ?? (primaryName ? `actor:${primaryName}` : actors[0]!.id);
          const secondary = Array.isArray(s?.secondary) ? s.secondary.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
          const secondaryActorIds = secondary.map((nm) => actorIdByName.get(nm) ?? `actor:${nm}`);
          if (!title || !purpose) return null;
          return {
            id: `step:${idx + 1}:${title}`,
            order: idx + 1,
            title,
            purpose,
            primaryActorId,
            secondaryActorIds,
            approved: false,
            updatedAt: now,
          };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x));

      const next: RequirementsServiceFlowV1 = {
        createdAt: serviceFlow?.createdAt ?? now,
        updatedAt: now,
        steps,
        actors,
      };
      await persistServiceFlow(next);
      showSuccessToast("서비스 흐름 초안 생성 완료");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "오류";
      setError(msg);
      showErrorToast(msg);
    } finally {
      setBusy(false);
    }
  }, [resolvedProjectId, ideationReadyForServiceFlow, ideationReadyNotice, project?.name, project?.description, persistServiceFlow, serviceFlow?.createdAt, showSuccessToast, showErrorToast]);

  const handleApproveAllServiceFlowSteps = useCallback(async () => {
    if (!serviceFlow) return;
    const now = new Date().toISOString();
    const next: RequirementsServiceFlowV1 = {
      ...serviceFlow,
      updatedAt: now,
      steps: serviceFlow.steps.map((s) => ({ ...s, approved: true, updatedAt: now })),
    };
    await persistServiceFlow(next);
    showSuccessToast("전체 단계 승인 완료");
  }, [serviceFlow, persistServiceFlow, showSuccessToast]);

  const inviteEmphasis = humanOthers.length === 0;

  const existingHumanUserIds = useMemo(
    () => new Set(members.filter((m) => m.memberType === "HUMAN" && m.userId).map((m) => m.userId as string)),
    [members]
  );
  const remoteLocked = !resolvedProjectId.trim();

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
  const shellStyle = { display: "flex", flexDirection: "column" as const, gap: 0, minHeight: 0 };
  const mainRow: CSSProperties = {
    flex: "1 1 auto",
    gap: 0,
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    overflow: "hidden",
    background: "#fff",
    boxShadow: "0 18px 50px -24px rgba(15, 23, 42, 0.18)",
    minHeight: chatExpanded && !inServiceFlowStage ? 640 : 0,
  };

  const chatPanel = (
    <div style={{ flex: "1 1 0%", minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <ScreenLabel label="요구사항-채팅영역-대화이력복원" visible={showScreenLabels} />
      <RequirementsChatPanel
        messages={messages}
        typingIndicator={aiInvokePending}
        expandControls={{ expanded: chatExpanded, onToggle: () => setChatExpanded((v) => !v) }}
        onInsertComposerPrompt={insertComposerPrompt}
        onSetReplyTo={(messageId, preview) => {
          setReplyTo({ id: messageId, preview });
          window.setTimeout(() => composerTextAreaRef.current?.focus(), 0);
        }}
        onOpenDeliverableDocument={(id) => openDeliverableViewer([id], id)}
        onOpenDeliverableDocuments={(ids) => openDeliverableViewer(ids, ids[0] ?? null)}
        onRegenerateDeliverables={(types) => {
          const next = types.filter(isIdeationDeliverableType);
          if (next.length) void handleGenerateDeliverables(next);
        }}
        onConfirmDeliverables={(ids) => void handleConfirmDeliverableAssets(ids)}
        composer={
          <div
            style={{
              padding: "12px 18px 16px",
              background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
            }}
          >
            {replyTo ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: "#475569", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  답글 대상: <span style={{ fontWeight: 700, color: "#0f172a" }}>{replyTo.preview || replyTo.id}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  style={{
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#475569",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  취소 ×
                </button>
              </div>
            ) : null}
            <RequirementsComposerGpt
              textAreaRef={composerTextAreaRef}
              value={input}
              onChange={setInput}
              onSend={() => void onSend()}
              busy={busy || aiInvokePending}
              disabled={false}
              placeholder={composerPlaceholder}
              targetPickerItems={targetPickerItems}
              toolsMenu={{
                onOrganizeRequirements: () => void onOrganizeRequirements(),
                organizeDisabled: busy || remoteLocked,
                draftViewAvailable: Boolean(draftDoc),
                onOpenDraftView: () => setDraftDrawerOpen(true),
              }}
            />
          </div>
        }
      />
    </div>
  );

  return (
    <div style={shellStyle}>
      <ScreenLabel label="요구사항-목록-페이지-섹션" visible={showScreenLabels} />

      {plannerTypePickerOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="정리 요청 유형 선택"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPlannerTypePickerOpen(false);
          }}
        >
          <div
            style={{
              width: "min(560px, 100%)",
              background: "#fff",
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              boxShadow: "0 30px 80px -30px rgba(15, 23, 42, 0.45)",
              padding: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>정리 요청</div>
              <button
                type="button"
                onClick={() => setPlannerTypePickerOpen(false)}
                style={{
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  borderRadius: 999,
                  padding: "6px 10px",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  color: "#334155",
                }}
              >
                닫기
              </button>
            </div>
            <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.55, marginBottom: 12 }}>
              정보를 검토하고 부족한 내용을 질문한 뒤 결과물을 작성합니다.
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {PLANNER_DELIVERABLE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPlannerTypePicked(t)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: plannerTypePicked === t ? "2px solid #0f766e" : "1px solid #e2e8f0",
                    background: plannerTypePicked === t ? "#f0fdfa" : "#fff",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>{plannerDeliverableLabelKr(t)}</span>
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                    {getPlannerSlotSchema(t).requiredSlots.length} 슬롯
                  </span>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
              <button
                type="button"
                onClick={() => setPlannerTypePickerOpen(false)}
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
                취소
              </button>
              <button
                type="button"
                disabled={busy || remoteLocked}
                onClick={() => {
                  const picked = plannerTypePicked;
                  setPlannerTypePickerOpen(false);
                  void runPlannerOrganize(picked);
                }}
                style={{
                  border: "1px solid #0f766e",
                  background: "#0f766e",
                  borderRadius: 10,
                  padding: "9px 12px",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: busy || remoteLocked ? "not-allowed" : "pointer",
                  opacity: busy || remoteLocked ? 0.6 : 1,
                  color: "#fff",
                }}
              >
                시작
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {saveToastVisible ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: 72,
            right: 24,
            zIndex: 60,
            padding: "10px 16px",
            borderRadius: 10,
            background: "#0f172a",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            boxShadow: "0 12px 32px -8px rgba(15, 23, 42, 0.45)",
          }}
        >
          저장되었습니다 ✓
        </div>
      ) : null}

      {successToast ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: 120,
            right: 24,
            zIndex: 60,
            padding: "10px 16px",
            borderRadius: 10,
            background: "#0f766e",
            color: "#fff",
            fontSize: 14,
            fontWeight: 800,
            boxShadow: "0 12px 32px -8px rgba(15, 118, 110, 0.45)",
          }}
        >
          {successToast}
        </div>
      ) : null}

      {errorToast ? (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            position: "fixed",
            top: 176,
            right: 24,
            zIndex: 61,
            padding: "10px 16px",
            borderRadius: 10,
            background: "#b91c1c",
            color: "#fff",
            fontSize: 14,
            fontWeight: 800,
            boxShadow: "0 12px 32px -8px rgba(185, 28, 28, 0.45)",
            maxWidth: 360,
          }}
        >
          {errorToast}
        </div>
      ) : null}

      <RequirementsHeader
        projectName={headerProjectName}
        showProjectWorkflowNav={Boolean(resolvedProjectId.trim())}
      />

      {resolvedProjectId.trim() &&
      !inServiceFlowStage &&
      conversationStatus === "loaded" &&
      ideationComplete &&
      !(problemInterviewState && problemInterviewState.active !== false && problemInterviewCovered < 4) ? (
        <div
          style={{
            marginTop: 8,
            marginBottom: 6,
            padding: "10px 14px",
            borderRadius: 10,
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: "#065f46", lineHeight: 1.45 }}>
            정리 요청으로 문제정의서를 만들 수 있습니다.
          </span>
          <button
            type="button"
            data-testid="requirements-organize-cta"
            disabled={busy || remoteLocked}
            onClick={() => void onOrganizeRequirements()}
            style={{
              flexShrink: 0,
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #0f766e",
              background: "#0f766e",
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              cursor: busy || remoteLocked ? "not-allowed" : "pointer",
              opacity: busy || remoteLocked ? 0.55 : 1,
            }}
          >
            정리 요청
          </button>
        </div>
      ) : (
        <div style={{ marginBottom: 6 }} />
      )}

      {workflowGuidanceBanner ? (
        <div style={{ fontSize: 12, color: "#92400e", padding: "8px 10px", background: "#fffbeb", borderRadius: 8 }}>{workflowGuidanceBanner}</div>
      ) : null}

      {loadError ? (
        <div className="relative" style={{ position: "relative" }}>
          <ScreenLabel label="요구사항-상단-오류배너" visible={showScreenLabels} />
          <div style={{ fontSize: 12, color: "#64748b", padding: "8px 10px", background: "#f8fafc", borderRadius: 8 }} role="status">
            {loadError}{" "}
            <button
              type="button"
              onClick={() => {
                setLoadError(null);
                setFetchNonce((n) => n + 1);
              }}
              style={{ border: 0, background: "none", color: "#2563eb", fontWeight: 700, cursor: "pointer", textDecoration: "underline", padding: 0, font: "inherit" }}
            >
              다시 시도
            </button>
          </div>
        </div>
      ) : null}

      {remoteLocked ? (
        <div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>
          프로젝트가 연결되지 않았습니다.{" "}
          <button type="button" onClick={() => router.push("/")} style={{ border: 0, background: "none", color: "#2563eb", fontWeight: 700, cursor: "pointer", textDecoration: "underline", padding: 0, font: "inherit" }}>
            홈에서 프로젝트 만들기
          </button>
        </div>
      ) : null}

      {!inServiceFlowStage && resolvedProjectId.trim() && conversationStatus === "loaded" && problemInterviewState && problemInterviewState.active !== false ? (
        <div
          style={{
            marginTop: 6,
            marginBottom: 10,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            background: "#f8fafc",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
            justifyContent: "space-between",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>
              {problemInterviewCovered >= 4
                ? "문제정의 정보 확보 완료"
                : `문제정의 인터뷰 진행중 (${problemInterviewCovered}/4 확보)`}
            </div>
            <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: "#475569" }}>
              {(["currentMethod", "painPoint", "coreUser", "needForImprovement"] as const).map((slot) => {
                const filled = Boolean((problemInterviewState as any)[slot]);
                const partial = Boolean((problemInterviewState.partial ?? ({} as any))[slot]);
                const mark = filled ? "✓" : partial ? "△" : "□";
                return (
                  <span key={slot} style={{ fontWeight: filled ? 900 : partial ? 800 : 700 }}>
                    {mark} {problemInterviewSlotLabelKr(slot as unknown as ProblemInterviewSlot)}
                  </span>
                );
              })}
            </div>
          </div>
          {problemInterviewCovered >= 4 ? (
            <button
              type="button"
              data-testid="requirements-organize-cta-after-interview"
              disabled={busy || remoteLocked}
              onClick={() => void onOrganizeRequirements()}
              style={{
                flexShrink: 0,
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #0f766e",
                background: "#0f766e",
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                cursor: busy || remoteLocked ? "not-allowed" : "pointer",
                opacity: busy || remoteLocked ? 0.55 : 1,
              }}
            >
              정리 요청
            </button>
          ) : null}
        </div>
      ) : null}

      <div style={mainRow} className="jyo-requirements-workspace-main">
        {inServiceFlowStage ? (
          <div style={{ padding: 14, width: "100%", minWidth: 0, overflow: "auto" }}>
            <ServiceFlowWorkspace
              projectId={resolvedProjectId.trim()}
              project={project}
              participants={participants}
              chatPanel={chatPanel}
              flow={serviceFlow}
              ideationReady={ideationReadyForServiceFlow}
              onRetryGate={() => setFetchNonce((n) => n + 1)}
              onGenerateAiDraft={() => void handleGenerateServiceFlowDraft()}
              onApproveAll={() => void handleApproveAllServiceFlowSteps()}
              onUpdateFlow={(next) => void persistServiceFlow(next)}
            />
            <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setInviteOpen(true)} style={{ border: 0, background: "none", cursor: "pointer", fontWeight: 800, color: "#2563eb", textDecoration: "underline", padding: 6 }}>
                멤버 초대
              </button>
            </div>
          </div>
        ) : (
          <>
            {!chatExpanded ? (
              <RequirementsMemberSidebar
                participants={participants}
                showInvite={Boolean(resolvedProjectId.trim())}
                inviteDisabled={remoteLocked}
                inviteEmphasis={inviteEmphasis}
                onInviteClick={() => setInviteOpen(true)}
              />
            ) : null}
            {chatPanel}
          </>
        )}
      </div>

      {error ? (
        <div style={{ marginTop: 4 }}>
          <p style={{ color: "#b91c1c", fontWeight: 600, fontSize: 13 }} role="alert">
            {error}
          </p>
          {organizeState === "error" && organizeError ? (
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => {
                  organizeRawFallbackRef.current = true;
                  setOrganizeState("idle");
                  setOrganizeError(null);
                  setError(null);
                  const reuse = (stateJsonRef.current.organizePlannerState?.requestedType as IdeationDeliverableType | undefined) ?? undefined;
                  if (reuse) {
                    void runPlannerOrganize(reuse);
                    return;
                  }
                  void onOrganizeRequirements();
                }}
                style={{
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#0f172a",
                  cursor: "pointer",
                }}
              >
                같은 유형으로 전체 대화 기준 다시 시도
              </button>
              <div style={{ marginTop: 6, fontSize: 12, color: "#64748b", fontWeight: 600 }}>이전 선택 유형 유지</div>
            </div>
          ) : null}
        </div>
      ) : null}

      <RequirementsMemberInviteModal
        open={inviteOpen && Boolean(resolvedProjectId.trim())}
        projectId={resolvedProjectId.trim()}
        onClose={() => setInviteOpen(false)}
        onInvited={() => void reloadMembers()}
        existingHumanUserIds={existingHumanUserIds}
      />

      <RequirementsPromptDocumentDrawer
        open={promptDrawerOpen}
        onClose={() => setPromptDrawerOpen(false)}
        view={persistedPromptState.lastPromptView ?? null}
        lastPromptText={persistedPromptState.lastPromptText}
        lastPromptGeneratedAt={persistedPromptState.lastPromptGeneratedAt}
        conversationMessages={conversationStatus === "loaded" ? conversationMessages : null}
        exportBaseName={project?.name?.trim() ?? ""}
      />

      <RequirementsSummaryModal
        open={summaryModalOpen}
        onClose={() => setSummaryModalOpen(false)}
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
        onBlurSave={() => void onPanelBlurSave()}
      />

      {draftDoc ? (
        <RequirementsDraftDocumentDrawer
          open={draftDrawerOpen}
          onClose={() => setDraftDrawerOpen(false)}
          draft={draftDoc}
          exportBaseName={project?.name?.trim() ?? ""}
        />
      ) : null}

      <RequirementsDeliverableViewerModal
        open={deliverableViewerOpen}
        onClose={() => setDeliverableViewerOpen(false)}
        assets={deliverableViewerAssets}
        initialAssetId={deliverableViewerFocusId}
      />
    </div>
  );
}
