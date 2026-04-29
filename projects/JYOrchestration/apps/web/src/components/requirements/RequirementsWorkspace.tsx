"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { flushSync } from "react-dom";
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
import { OrganizeProposalDraggableModal } from "@/components/requirements/OrganizeProposalDraggableModal";
import { ProposalPlanPreviewModal } from "@/components/requirements/ProposalPlanPreviewModal";
import { RequirementsDeliverableViewerModal } from "@/components/requirements/RequirementsDeliverableViewerModal";
import { RequirementsDraftDocumentDrawer } from "@/components/requirements/RequirementsDraftDocumentDrawer";
import { RequirementsPromptDocumentDrawer } from "@/components/requirements/RequirementsPromptDocumentDrawer";
import { RequirementsSummaryModal } from "@/components/requirements/RequirementsSummaryModal";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import {
  displayedAiOrchestrator,
  displayedAiStatusForStage,
  showInternalAgents,
  visibleStageFromRequirementsStage,
} from "@/lib/ai-member/visibleAiOrchestrator";
import { isNextPublicDevWorkflowToolsEnabled } from "@/lib/env/devWorkflowTools";
import { isProbablyOriginalProjectDescription } from "@/lib/project/originalProjectDescription";
import {
  appendIdeationDeliverableAssets,
  extractPreviewLinesFromMarkdown,
  IDEATION_DELIVERABLE_LABELS,
  IDEATION_UNIFIED_PROPOSAL_OUTPUT,
  IDEATION_DELIVERABLE_RESULT_INTERNAL_TYPE,
  markDeliverableAssetsConfirmed,
  isIdeationDeliverableType,
  type IdeationDeliverableAsset,
  type IdeationDeliverableChatPayload,
  type IdeationDeliverableType,
} from "@/lib/requirements/ideationDeliverables";
import { ideationChecklistComplete, ideationChecklistItems } from "@/lib/requirements/ideationChecklist";
import { filterIdeationConversationMessages, isServiceFlowWorkshopMessage } from "@/lib/requirements/serviceFlowConversation";
import {
  IDEATION_INTERVIEW_BOOTSTRAP_INTERNAL_TYPE,
  IDEATION_PROBLEM_INTERVIEW_TURN_INTERNAL_TYPE,
  sanitizeIdeationInterviewFirstQuestion,
} from "@/lib/requirements/ideationInterviewBootstrap";
import {
  composeInterviewPlannerReply,
  coerceInterviewAnalyzerPayload,
  emergencyFallbackProblemInterviewFromUserMessageRegex,
  emptyProblemInterviewState,
  applyGlobalDelegationDefaults,
  interviewSlotLevelFromState,
  INTERVIEW_ANALYZER_CONFIDENCE_THRESHOLD,
  mergeAnalyzerIntoProblemInterview,
  getControlledQuestionForSlot,
  mergeImplicitAskedFromLastBootstrapQuestion,
  PROBLEM_INTERVIEW_SLOTS,
  pickNextAskableInterviewSlot,
  planNextInterviewTurn,
  problemInterviewStateToAnalyzerWire,
  problemInterviewStrictFilledCount,
  proposalInterviewCoachingHintLine,
  proposalInterviewReadinessPercent,
  PROBLEM_INTERVIEW_SLOT_TOTAL,
  slotStrictlyFilled,
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
import { getPlannerSlotSchema } from "@/lib/requirements/plannerSlots";
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

type RequirementsWorkspaceStage = "ideation" | "service-flow";

function resolveRequirementsWorkspaceStage(rawStage: string): RequirementsWorkspaceStage {
  return rawStage === "service-flow" ? "service-flow" : "ideation";
}

function StageRenderer({
  activeStage,
  ideationStage,
  serviceFlowStage,
}: {
  readonly activeStage: RequirementsWorkspaceStage;
  readonly ideationStage: ReactNode;
  readonly serviceFlowStage: ReactNode;
}) {
  return <>{activeStage === "service-flow" ? serviceFlowStage : ideationStage}</>;
}

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

/** `[ideation-send:…]` — 개발에서만 (요청된 이벤트 이름과 일치) */
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
    .filter((m) => m.role === "user" && !isServiceFlowWorkshopMessage(m))
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

const IDEATION_DRAFT_MIN_FILLED_SLOTS = 5;
const IDEATION_DRAFT_REQUIRED_SLOTS: readonly ProblemInterviewSlot[] = [
  "serviceIdea",
  "targetUser",
  "coreProblem",
  "expectedOutcome",
] as const;

function ideationDraftGateStatus(state: ProblemInterviewState | null | undefined) {
  const strictFilled = problemInterviewStrictFilledCount(state);
  const requiredCovered = Boolean(state && IDEATION_DRAFT_REQUIRED_SLOTS.every((slot) => slotStrictlyFilled(state, slot)));
  return {
    strictFilled,
    requiredCovered,
    ready: strictFilled >= IDEATION_DRAFT_MIN_FILLED_SLOTS && requiredCovered,
  };
}

function ideationInterviewMilestoneLine(
  prev: ProblemInterviewState | null | undefined,
  next: ProblemInterviewState | null | undefined
): string {
  const prevStrict = problemInterviewStrictFilledCount(prev);
  const nextStrict = problemInterviewStrictFilledCount(next);
  const prevReady = ideationDraftGateStatus(prev).ready;
  const nextReady = ideationDraftGateStatus(next).ready;
  if (!prevReady && nextReady) return "정리 요청 가능 상태입니다.";
  if (prevStrict < PROBLEM_INTERVIEW_SLOT_TOTAL && nextStrict >= PROBLEM_INTERVIEW_SLOT_TOTAL) return "필요한 핵심 정보가 모두 모였습니다.";
  if (prevStrict < PROBLEM_INTERVIEW_SLOT_TOTAL - 1 && nextStrict >= PROBLEM_INTERVIEW_SLOT_TOTAL - 1) return "마지막 정보 1개만 더 확인하겠습니다.";
  if (prevStrict < PROBLEM_INTERVIEW_SLOT_TOTAL / 2 && nextStrict >= PROBLEM_INTERVIEW_SLOT_TOTAL / 2) return "아이디어 정리도가 절반을 넘었습니다.";
  return "";
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

  const autoOpenPrototypePreview = useMemo(() => {
    const v = String(searchParams?.get("preview") ?? "").trim();
    return v === "1";
  }, [searchParams]);

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
  const [proposalPlanPreview, setProposalPlanPreview] = useState<{ open: boolean; assetId: string | null }>({
    open: false,
    assetId: null,
  });
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
  const [serviceFlowDraftBusy, setServiceFlowDraftBusy] = useState(false);
  const [serviceFlowDraftGenerationCount, setServiceFlowDraftGenerationCount] = useState(0);

  const stateJsonRef = useRef<RequirementsStateJson>({});
  const draftDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 인터뷰 자동 시작 이펙트 중복 실행(React StrictMode 등) 방지 */
  const ideationBootstrapFlightRef = useRef<string | null>(null);
  /** 서비스흐름 자동 초안 생성 1회 실행(StrictMode/rerender) 방지 */
  const serviceFlowAutoBootstrapRef = useRef<string | null>(null);
  /** 전송 핸들러 동시 실행(연타·Enter 이중) 방지 — React `busy`보다 먼저 잠금 */
  const requirementsSendFlightRef = useRef(false);
  /** 다음 정리 요청 1회만 전체 대화 원문(dialogueExcerpt) 폴백 사용 */
  const organizeRawFallbackRef = useRef(false);
  const sendDraftRestoreRef = useRef<string | null>(null);

  const stage = useMemo(() => {
    const urlStage = String(searchParams?.get("stage") ?? "").trim().toLowerCase();
    if (urlStage) return urlStage;
    const propStage = String(initialStage ?? "").trim().toLowerCase();
    return propStage;
  }, [searchParams, initialStage]);
  const activeStage = useMemo(() => resolveRequirementsWorkspaceStage(stage), [stage]);
  const inIdeationStage = activeStage === "ideation";

  const [serviceFlow, setServiceFlow] = useState<RequirementsServiceFlowV1 | null>(null);

  useEffect(() => {
    if (inIdeationStage) return;
    setSummaryModalOpen(false);
    setPromptDrawerOpen(false);
    setDraftDrawerOpen(false);
    setDeliverableViewerOpen(false);
    setDeliverableViewerIds([]);
    setDeliverableViewerFocusId(null);
    setPlannerTypePickerOpen(false);
    setProposalPlanPreview({ open: false, assetId: null });
    setReplyTo(null);
    setChatExpanded(false);
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
    if (showInternalAgents) {
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
    } else {
      const stageKey = visibleStageFromRequirementsStage(activeStage);
      const orch = displayedAiOrchestrator();
      list.push({
        id: "visible:ai-orchestrator",
        name: orch.name,
        kind: "ai",
        onlineHint: false,
        aiStatusLabel: displayedAiStatusForStage(stageKey),
        roleLabel: "AI",
      });

      // Optional expert (only if invited/added to project members)
      const expert = aiMembers.find((m) => {
        const r = String(m.aiOrchestrationRole ?? "").trim();
        return r === "domain-expert" || r === "domainExpert";
      });
      if (expert) {
        list.push({
          id: expert.memberId,
          name: "업무 전문가",
          kind: "ai",
          onlineHint: false,
          aiStatusLabel: aiPlannerStatusLabel,
          roleLabel: "전문가",
        });
      }
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
  }, [members, aiMembers, sessionUser?.id, aiPlannerStatusLabel, activeStage]);

  const conversation = room.requirementsConversation;
  const conversationMessages = conversation.messages;
  const ideationConversationOnly = useMemo(
    () => filterIdeationConversationMessages(conversationMessages),
    [conversationMessages],
  );
  const serviceFlowWorkshopPersisted = useMemo(
    () => conversationMessages.filter(isServiceFlowWorkshopMessage),
    [conversationMessages],
  );
  // 로딩 중에는 null로 전달해 "기록 없음"으로 오판하지 않게 합니다.
  const messages = conversationStatus === "loaded" ? conversationMessages : null;
  const draftDoc = room.requirementsDraft ?? null;

  useEffect(() => {
    if (!draftDoc) setDraftDrawerOpen(false);
  }, [draftDoc]);

  const onboardingKey = useMemo(() => (resolvedProjectId.trim() ? `pid:${resolvedProjectId.trim()}` : "no-pid"), [resolvedProjectId]);
  const [onboardingAppliedKey, setOnboardingAppliedKey] = useState<string | null>(null);

  const requirementsPending = project ? isRequirementsPendingWorkflow(project.workflowStatus) : true;

  const ideationSlice = useMemo(
    () => ({ goals, targetUsers, success, nfr }),
    [goals, targetUsers, success, nfr]
  );
  const ideationItems = useMemo(() => ideationChecklistItems(ideationSlice), [ideationSlice]);
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
  const interviewCoachingHint = useMemo(
    () => proposalInterviewCoachingHintLine(problemInterviewState, problemInterviewState?.askedSlots),
    [problemInterviewState]
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

  const latestUnifiedProposal = useMemo(() => {
    const list = deliverableAssetsFromProject.filter((a) => a.type === "full_plan");
    if (!list.length) return null;
    return [...list].sort((a, b) => b.version - a.version)[0] ?? null;
  }, [deliverableAssetsFromProject]);

  const proposalPreviewAsset = useMemo(() => {
    const id = proposalPlanPreview.assetId;
    if (!id) return null;
    return deliverableAssetsFromProject.find((a) => a.id === id) ?? null;
  }, [proposalPlanPreview.assetId, deliverableAssetsFromProject]);

  const proposalPreviewMarkdown = useMemo(() => proposalPreviewAsset?.content ?? "", [proposalPreviewAsset]);
  const proposalPreviewVersion = useMemo(() => proposalPreviewAsset?.version ?? 1, [proposalPreviewAsset]);

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
        if (meta) {
          stateJsonRef.current = mergeRequirementsStateJson(stateJsonRef.current, meta);
        }
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
      const deliverableAssetsSnapshot =
        meta && Array.isArray(meta.deliverableAssets) && meta.deliverableAssets.length ? meta.deliverableAssets : null;
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
      // 서버가 대형 JSONB 저장을 degrade(스킵)한 경우에도, 카드가 가리키는 산출물은 "문서 열기"에서 즉시 열려야 한다.
      if (deliverableAssetsSnapshot) {
        const after = stateJsonRef.current.deliverableAssets as IdeationDeliverableAsset[] | null | undefined;
        if (!Array.isArray(after) || after.length === 0) {
          stateJsonRef.current = mergeRequirementsStateJson(stateJsonRef.current, {
            deliverableAssets: deliverableAssetsSnapshot,
          });
        }
      }
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

  const roomRef = useRef(room);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

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

  const runPlannerOrganize = useCallback(async () => {
    const requestedType: IdeationDeliverableType = "full_plan";
    const pid = resolvedProjectId.trim();
    if (!pid) {
      setError("프로젝트에 연결된 뒤 정리 요청을 사용할 수 있습니다.");
      return;
    }
    if (conversationStatus !== "loaded") {
      setError("대화 이력을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    const hasConversationContent = ideationConversationOnly.some((m) => m.role === "user" && m.content.trim());
    if (!hasConversationContent) {
      setError("정리할 대화가 아직 없습니다. 먼저 AI 기획자와 아이디어를 대화로 다듬어 주세요.");
      return;
    }
    if (busy || organizeState === "running") return;
    if (draftDebounceTimerRef.current) {
      clearTimeout(draftDebounceTimerRef.current);
      draftDebounceTimerRef.current = null;
    }
    const gate = ideationDraftGateStatus(problemInterviewState);
    if (!gate.ready) {
      const missingRequired = IDEATION_DRAFT_REQUIRED_SLOTS.filter((slot) => !slotStrictlyFilled(problemInterviewState ?? emptyProblemInterviewState(""), slot));
      const msg = missingRequired.length
        ? "아이디어 초안 생성 전 필수 정보(서비스 아이디어, 주 사용자, 핵심 문제, 기대 효과)를 먼저 확인해 주세요."
        : `아이디어 초안은 최소 ${IDEATION_DRAFT_MIN_FILLED_SLOTS}개 슬롯 확정 후 생성할 수 있습니다.`;
      setError(msg);
      showErrorToast(msg);
      return;
    }
    setServiceFlowDraftBusy(true);
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
        messages: ideationConversationOnly,
        latestUserMessage: `정리요청(통합 기획안): ${schema.labelKr}`,
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
      const recentBlock = formatOrganizeRecentMessages(ideationConversationOnly, recentCount, 12_000);
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
      const excerpt = formatDialogueExcerpt(ideationConversationOnly);
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
          `현재 정보로 ${schema.labelKr} 생성을 시작합니다.`,
        speakerType: "AI",
        speakerId: VIRTUAL_AI_PLANNER_ID,
        speakerName: "AI 기획자",
        messageType: "ANSWER",
      });

      {
        // writer: 통합 기획안(full_plan) 단일 문서 생성 + 저장 + 채팅 NOTICE
        const planBaseName = (project?.name ?? "").trim() || "프로젝트";
        const excerptForDeliverable = formatDialogueExcerpt(ideationConversationOnly);
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
            outputTypes: [...IDEATION_UNIFIED_PROPOSAL_OUTPUT],
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
          typesRequested: [...IDEATION_UNIFIED_PROPOSAL_OUTPUT],
          getAssetTitle: (t, v) => (t === "full_plan" ? `${planBaseName} 아이디어 초안 v${v}` : undefined),
        });
        if (!created.length) {
          throw new Error("생성된 본문이 비어 있습니다.");
        }

        const notices = created.map((c) => {
          const payload: IdeationDeliverableChatPayload = {
            kind: IDEATION_DELIVERABLE_RESULT_INTERNAL_TYPE,
            mode: "single",
            headline:
              c.type === "full_plan" ? `${planBaseName} 아이디어 초안이 생성되었습니다.` : `${IDEATION_DELIVERABLE_LABELS[c.type]} 초안이 생성되었습니다.`,
            requestedTypes: [c.type],
            items: [
              {
                assetId: c.id,
                type: c.type,
                title: c.title,
                version: c.version,
                previewLines: extractPreviewLinesFromMarkdown(c.content),
              },
            ],
          };
          return newChatMessage({
            role: "ai",
            body: JSON.stringify(payload),
            speakerType: "AI",
            speakerId: VIRTUAL_AI_PLANNER_ID,
            speakerName: "AI 기획자",
            messageType: "NOTICE",
            meta: { internalType: IDEATION_DELIVERABLE_RESULT_INTERNAL_TYPE },
          });
        });
        const fp = created.find((c) => c.type === "full_plan");
        if (fp) setProposalPlanPreview({ open: true, assetId: fp.id });
        const afterWrite: RequirementsRoomStateV3 = {
        ...room,
        requirementsConversation: {
          ...room.requirementsConversation,
          projectId: pid,
            messages: [...conversationMessages, readyNotice, ...notices],
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
      showSuccessToast(`${(project?.name ?? "").trim() || "프로젝트"} 아이디어 초안 생성 완료`);
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
    ideationConversationOnly,
    organizeState,
    problemInterviewState,
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
    setProposalPlanPreview,
    showErrorToast,
  ]);

  const handleGenerateDeliverables = useCallback(
    async (types: readonly IdeationDeliverableType[], opts?: { readonly revisionRequest?: string }) => {
      const pid = resolvedProjectId.trim();
      if (!pid) {
        setError("프로젝트에 연결된 뒤 산출물 생성을 사용할 수 있습니다.");
        throw new Error("GUARD");
      }
      if (conversationStatus !== "loaded") {
        setError("대화 이력을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
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

        const excerpt = formatDialogueExcerpt(ideationConversationOnly);
        const planBaseName = (project?.name ?? "").trim() || "프로젝트";
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
            revisionRequest: opts?.revisionRequest ?? "",
            outputTypes: types,
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
          getAssetTitle: (t, v) => (t === "full_plan" ? `${planBaseName} 아이디어 초안 v${v}` : undefined),
        });
        if (!created.length) {
          throw new Error("생성된 본문이 비어 있습니다.");
        }

        const notices = created.map((c) => {
          const payload: IdeationDeliverableChatPayload = {
            kind: IDEATION_DELIVERABLE_RESULT_INTERNAL_TYPE,
            mode: "single",
            headline:
              c.type === "full_plan" ? `${planBaseName} 아이디어 초안이 생성되었습니다.` : `${IDEATION_DELIVERABLE_LABELS[c.type]} 초안이 생성되었습니다.`,
            requestedTypes: [c.type],
            items: [
              {
                assetId: c.id,
                type: c.type,
                title: c.title,
                version: c.version,
                previewLines: extractPreviewLinesFromMarkdown(c.content),
              },
            ],
          };
          return newChatMessage({
            role: "ai",
            body: JSON.stringify(payload),
            speakerType: "AI",
            speakerId: VIRTUAL_AI_PLANNER_ID,
            speakerName: "AI 기획자",
            messageType: "NOTICE",
            meta: { internalType: IDEATION_DELIVERABLE_RESULT_INTERNAL_TYPE },
          });
        });
        const nextRoom: RequirementsRoomStateV3 = {
          ...room,
          requirementsConversation: {
            ...room.requirementsConversation,
            projectId: pid,
            messages: [...conversationMessages, ...notices],
          },
        };
        await persistRemote(nextRoom, {}, { deliverableAssets: merged });
        if (types.length === 1 && types[0] === "full_plan") {
          const fp = created.find((c) => c.type === "full_plan");
          if (fp) setProposalPlanPreview({ open: true, assetId: fp.id });
          showSuccessToast(`${planBaseName} 아이디어 초안 생성 완료`);
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
      setProposalPlanPreview,
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
      const sendTraceId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `send-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
      const replyMode = Boolean(replyTo?.id?.trim());
      ideationSendDevLog("start", `mode=${replyMode ? "reply" : "normal"}`);
    setServiceFlowDraftBusy(true);
    setError(null);
      const mentionRefs = participants.map((p) => ({ id: p.id, name: p.name }));
      const fromMentions = computedTargetsFromInput(text, mentionRefs);
      const targets = dedupeMemberRefs(
        fromMentions.length ? fromMentions : [{ id: VIRTUAL_AI_PLANNER_ID, name: "AI 기획자" }]
      );
      const anyAi = targets.some((t) => isAiTarget(t.id));
      const primaryAi = targets.find((t) => isAiTarget(t.id));
      const combinedLabel = targets.map((t) => t.name).join(" · ");
      const effectiveReplyTo = inferRecentAiQuestionReplyParentId(ideationConversationOnly, replyTo?.id ?? null);

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

      if (anyAi) {
        const primaryId = primaryAi?.id ?? targets[0].id;
        const aiName = primaryId === VIRTUAL_AI_PLANNER_ID ? "AI 기획자" : primaryAi?.name ?? targets[0].name;
        const promptMetaIso = new Date().toISOString();
        const pv = buildPromptPresenterView({
          projectName: project?.name ?? "",
          projectDescription: project?.description ?? "",
          targetName: combinedLabel,
          messages: ideationConversationOnly,
          latestUserMessage: text,
        });
        const withCalling: RequirementsRoomStateV3 = {
          ...room,
          requirementsConversation: { ...room.requirementsConversation, projectId: resolvedProjectId.trim(), messages: msgs },
        };
        const problemInterviewSnapshot =
          (stateJsonRef.current.problemInterview as ProblemInterviewState | null | undefined) ?? null;
        await persistRemote(withCalling, {}, {
          lastPromptView: pv,
          lastPromptText: pv.copyText,
          lastPromptGeneratedAt: promptMetaIso,
          lastUserDraftText: text,
          ...(problemInterviewSnapshot ? { problemInterview: problemInterviewSnapshot } : {}),
        });
        const piAfterUserPersist = stateJsonRef.current.problemInterview as ProblemInterviewState | null | undefined;
        if (problemInterviewSnapshot && (piAfterUserPersist === undefined || piAfterUserPersist === null)) {
          stateJsonRef.current = mergeRequirementsStateJson(stateJsonRef.current, {
            problemInterview: problemInterviewSnapshot,
          });
          ideationSendDevLog("problemInterview-restored", `id=${sendTraceId}`);
        }
        ideationSendDevLog("user-appended", `id=${sendTraceId}`);
        setAiInvokePending(true);
        const pid = resolvedProjectId.trim();

        type IdeationPlannerTail = { needsTailPersist: true; finalRoom: RequirementsRoomStateV3 } | { needsTailPersist: false };

        const msgsIdeationOnly = filterIdeationConversationMessages(msgs);
        const excerpt = augmentDialogueExcerptForReplyParent(
          formatDialogueExcerpt(msgsIdeationOnly),
          msgsIdeationOnly,
          effectiveReplyTo
        );
        const endpoint = "/api/requirements/ai-facilitator";

        const isIdeationProblemInterviewPlannerContext = (): boolean => {
          if (primaryId !== VIRTUAL_AI_PLANNER_ID) return false;
          if (stateJsonRef.current.organizePlannerState) return false;
          const lastAi = [...msgsIdeationOnly].reverse().find((m) => m.role === "ai");
          const internal =
            lastAi && typeof (lastAi as { meta?: { internalType?: string } }).meta?.internalType === "string"
              ? String((lastAi as { meta?: { internalType?: string } }).meta?.internalType)
              : "";
          const boot = internal === IDEATION_INTERVIEW_BOOTSTRAP_INTERNAL_TYPE;
          const interviewTurn = internal === IDEATION_PROBLEM_INTERVIEW_TURN_INTERNAL_TYPE;
          const looksLikeComposedInterview =
            lastAi?.speakerId === VIRTUAL_AI_PLANNER_ID &&
            /\n\n질문:\n/.test(String((lastAi as { content?: string }).content ?? ""));
          const pi = stateJsonRef.current.problemInterview as ProblemInterviewState | null | undefined;
          const active = Boolean(pi && pi.active !== false);
          return boot || interviewTurn || looksLikeComposedInterview || active;
        };

        type InterviewAnalyzerCallOutcome =
          | { kind: "parsed"; payload: InterviewAnalyzerPayload }
          | { kind: "http-ok-parse-fail" }
          | { kind: "remote-fail" };

        const levelRank = (l: "empty" | "partial" | "filled" | null | undefined): number => {
          if (l === "filled") return 2;
          if (l === "partial") return 1;
          return 0;
        };

        const commitInterviewPlannerReplyOnce = async (
          merged: ProblemInterviewState,
          analyzerForPlan: InterviewAnalyzerPayload | null,
          ctx?: { prevState?: ProblemInterviewState; lastAskedSlot?: ProblemInterviewSlot | null }
        ): Promise<IdeationPlannerTail> => {
          const nowIso = new Date().toISOString();
          // 직전 AI가 물은 슬롯(있다면). 사용자가 다른 얘기를 해도 전체 슬롯 분석/저장은 유지하되,
          // 직전 슬롯에서 진전이 없으면 같은 슬롯을 즉시 반복 질문하지 않게 한다.
          const lastAskedSlot = ctx?.lastAskedSlot ?? null;
          const prev = ctx?.prevState ?? merged;
          const prevLevel = lastAskedSlot ? interviewSlotLevelFromState(prev, lastAskedSlot) : null;
          const nextLevel = lastAskedSlot ? interviewSlotLevelFromState(merged, lastAskedSlot) : null;
          const avoidImmediateRepeat =
            lastAskedSlot ? levelRank(nextLevel) <= levelRank(prevLevel) : false;
          const avoidSlotsForNext = avoidImmediateRepeat && lastAskedSlot ? ([lastAskedSlot] as const) : null;

          // LLM analyzer intent 기반 위임 처리: delegate_to_ai면 기본안을 반영하고 같은 슬롯을 다시 묻지 않는다.
          let mergedForPlan = merged;
          let autoAppliedDelegationDefault = false;
          let delegatedSlot: ProblemInterviewSlot | null = null;
          let delegatedDefaultLine = "";
          const globalDelegation = Boolean(analyzerForPlan && analyzerForPlan.globalDelegation === true);
          if (analyzerForPlan && analyzerForPlan.intent === "delegate_to_ai") {
            delegatedSlot = analyzerForPlan.delegatedSlot ?? lastAskedSlot ?? null;
            delegatedDefaultLine = (analyzerForPlan.delegatedDefault || "AI 기본 추천안 적용").trim();
            if (delegatedSlot && !slotStrictlyFilled(merged, delegatedSlot)) {
              // 위임=기본안 확정으로 처리(재질문 금지 + 진행률 증가)
              const nextRow = { ...(merged as unknown as Record<string, unknown>) } as Record<string, unknown>;
              nextRow[delegatedSlot] = true;
              const partial = { ...(merged.partial ?? {}) } as Record<string, boolean>;
              if (delegatedSlot in partial) delete partial[delegatedSlot];
              const notes = { ...(merged.notes ?? {}) } as Record<string, string>;
              notes[delegatedSlot] = notes[delegatedSlot]
                ? `${notes[delegatedSlot]}\n${delegatedDefaultLine}`.trim()
                : delegatedDefaultLine;
              mergedForPlan = {
                ...(merged as unknown as Record<string, unknown>),
                ...nextRow,
                partial,
                notes,
                updatedAt: nowIso,
              } as unknown as ProblemInterviewState;
              autoAppliedDelegationDefault = true;
            }
          }

          // 글로벌 위임이면 남은 슬롯을 기본 템플릿으로 보완하고, 조기 종료(>=85%)를 허용한다.
          const mergedWithGlobalDelegation = globalDelegation ? applyGlobalDelegationDefaults(mergedForPlan, nowIso) : mergedForPlan;

          const plan = planNextInterviewTurn(
            mergedWithGlobalDelegation,
            analyzerForPlan,
            mergedWithGlobalDelegation.askedSlots,
            turn,
            INTERVIEW_ANALYZER_CONFIDENCE_THRESHOLD,
            text,
            { avoidNextSlot: [
              ...(avoidSlotsForNext ?? []),
              ...(autoAppliedDelegationDefault && (delegatedSlot ?? lastAskedSlot) ? [((delegatedSlot ?? lastAskedSlot) as ProblemInterviewSlot)] : []),
            ],
              ...(globalDelegation ? { allowEarlyFinishScore: 8.5 } : {}),
            }
          );
          if (plan) {
            const milestone = ideationInterviewMilestoneLine(prev, mergedWithGlobalDelegation);
            const extra = autoAppliedDelegationDefault
              ? "해당 항목은 AI 기본안으로 반영하겠습니다."
              : "";
            const mergedSummary = [milestone, extra].filter(Boolean).join("\n");
            const aiBody = composeInterviewPlannerReply(mergedSummary, plan.question);
            const slotForAsked =
              plan.kind === "slot"
                ? plan.slot
                : pickNextAskableInterviewSlot(mergedWithGlobalDelegation, mergedWithGlobalDelegation.askedSlots, null, {
                    avoidSlots: [
                      ...(avoidSlotsForNext ?? []),
                      ...(autoAppliedDelegationDefault && (delegatedSlot ?? lastAskedSlot) ? [((delegatedSlot ?? lastAskedSlot) as ProblemInterviewSlot)] : []),
                    ],
                  }) ??
                  ("painPoint" as ProblemInterviewSlot);
            const asked = withAskedSlot(mergedWithGlobalDelegation, slotForAsked, nowIso);
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
              ideationSendDevLog("return", `interview-dedupe-no-ai id=${sendTraceId}`);
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
                    meta: {
                      internalType: IDEATION_PROBLEM_INTERVIEW_TURN_INTERNAL_TYPE,
                      problemInterviewLastSlot: slotForAsked,
                    },
                  }),
                ],
              },
            };
            await persistRemote(interviewNextRoom, {}, { problemInterview: asked, ...(globalDelegation ? { globalDelegation: true } : {}) });
            setAiLastInvoke({ ok: true, at: new Date().toISOString() });
            ideationSendDevLog("return", `interview-next ok=${Boolean(analyzerForPlan)} id=${sendTraceId}`);
            setInput("");
            setReplyTo(null);
            return { needsTailPersist: false };
          }

          const nextSlot = pickNextAskableInterviewSlot(mergedWithGlobalDelegation, mergedWithGlobalDelegation.askedSlots, null, {
            avoidSlots: avoidSlotsForNext,
          });
          if (nextSlot) {
            const question = getControlledQuestionForSlot(nextSlot, turn);
            const milestone = ideationInterviewMilestoneLine(prev, mergedWithGlobalDelegation);
            const aiBody = composeInterviewPlannerReply(
              milestone,
              question
            );
            const asked = withAskedSlot(mergedWithGlobalDelegation, nextSlot, nowIso);
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
                    meta: {
                      internalType: IDEATION_PROBLEM_INTERVIEW_TURN_INTERNAL_TYPE,
                      problemInterviewLastSlot: nextSlot,
                    },
                  }),
                ],
              },
            };
            await persistRemote(interviewNextRoom, {}, { problemInterview: asked, ...(globalDelegation ? { globalDelegation: true } : {}) });
            setAiLastInvoke({ ok: true, at: new Date().toISOString() });
            ideationSendDevLog("return", `interview-gated-next id=${sendTraceId}`);
            setInput("");
            setReplyTo(null);
            return { needsTailPersist: false };
          }

          const blockedBody = "정리는 하단 + 메뉴의 [정리 요청]에서 실행할 수 있습니다.\n먼저 아이디어 구체화에 필요한 정보를 조금 더 확인하겠습니다.";
          const blockedState = { ...mergedWithGlobalDelegation, active: true, updatedAt: nowIso } as ProblemInterviewState;
          const blockedRoom: RequirementsRoomStateV3 = {
            ...withCalling,
            aiQuestionIndex: turn + 1,
            requirementsConversation: {
              ...withCalling.requirementsConversation,
              messages: [
                ...withCalling.requirementsConversation.messages,
                newChatMessage({
                  role: "ai",
                  body: blockedBody,
                  speakerType: "AI",
                  speakerId: primaryId,
                  speakerName: aiName,
                  messageType: "ANSWER",
                  meta: { internalType: IDEATION_PROBLEM_INTERVIEW_TURN_INTERNAL_TYPE },
                }),
              ],
            },
          };
          await persistRemote(blockedRoom, {}, { problemInterview: blockedState, ...(globalDelegation ? { globalDelegation: true } : {}) });
          setAiLastInvoke({ ok: true, at: new Date().toISOString() });
          ideationSendDevLog("return", `interview-gated-block id=${sendTraceId}`);
          setInput("");
          setReplyTo(null);
          return { needsTailPersist: false };
        };

        /** 문제정의 인터뷰: 분석기 성공 경로와 실패 경로를 분리하고, 각각 한 번의 AI append 후 즉시 반환한다. */
        const runIdeationProblemInterviewPipeline = async (): Promise<IdeationPlannerTail> => {
          const nowIso = new Date().toISOString();
          const prevPi = (stateJsonRef.current.problemInterview as ProblemInterviewState | null | undefined) ?? null;
          const seeded = prevPi ?? emptyProblemInterviewState(nowIso);
          const latestAiTurn = [...msgs].reverse().find((m) => m.role === "ai");
          const latestAiQuestion = String(latestAiTurn?.content ?? "").trim();

          let outcome: InterviewAnalyzerCallOutcome = { kind: "remote-fail" };
          if (pid) {
            try {
              ideationSendDevLog("analyzer-request", `id=${sendTraceId}`);
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
              const remotePayloadOk = ar.ok && Boolean(aj.success) && aj.data != null;
              if (remotePayloadOk) {
                const parsed = coerceInterviewAnalyzerPayload(aj.data);
                if (parsed) {
                  outcome = { kind: "parsed", payload: parsed };
                } else {
                  outcome = { kind: "http-ok-parse-fail" };
                }
              } else {
                outcome = { kind: "remote-fail" };
              }
            } catch {
              outcome = { kind: "remote-fail" };
            }
          }

          if (outcome.kind === "parsed") {
            ideationSendDevLog("analyzer-success", `id=${sendTraceId}`);
            const merged = mergeImplicitAskedFromLastBootstrapQuestion(
              msgs,
              mergeAnalyzerIntoProblemInterview(seeded, outcome.payload, nowIso)
            );
            const lastSlotRaw = String(latestAiTurn?.meta?.problemInterviewLastSlot ?? "").trim();
            const lastSlot: ProblemInterviewSlot | null =
              lastSlotRaw && (PROBLEM_INTERVIEW_SLOTS as readonly string[]).includes(lastSlotRaw) ? (lastSlotRaw as ProblemInterviewSlot) : null;
            return commitInterviewPlannerReplyOnce(merged, outcome.payload, { prevState: seeded, lastAskedSlot: lastSlot });
          }

          if (outcome.kind === "http-ok-parse-fail") {
            ideationSendDevLog("analyzer-fallback", `reason=parse-or-coerce id=${sendTraceId}`);
          } else {
            ideationSendDevLog("analyzer-fallback", `reason=request-or-empty id=${sendTraceId}`);
          }
          const mergedFallback =
            outcome.kind === "http-ok-parse-fail"
              ? { ...seeded, updatedAt: nowIso }
              : emergencyFallbackProblemInterviewFromUserMessageRegex(seeded, text, nowIso);
          const merged = mergeImplicitAskedFromLastBootstrapQuestion(msgs, mergedFallback);
          const lastSlotRaw = String(latestAiTurn?.meta?.problemInterviewLastSlot ?? "").trim();
          const lastSlot: ProblemInterviewSlot | null =
            lastSlotRaw && (PROBLEM_INTERVIEW_SLOTS as readonly string[]).includes(lastSlotRaw) ? (lastSlotRaw as ProblemInterviewSlot) : null;
          return commitInterviewPlannerReplyOnce(merged, null, { prevState: seeded, lastAskedSlot: lastSlot });
        };

        const runFacilitatorOrDraftPipeline = async (): Promise<IdeationPlannerTail> => {
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
                ? `요구사항 문서 초안을 만들었습니다.\n\n- 개요 ${createdDraft.overview}\n- 사용자 ${createdDraft.users.join(", ")}\n- 기능 ${createdDraft.features.join(", ")}\n- 기준 ${createdDraft.successCriteria.join(", ")}\n${createdDraft.openIssues.length ? `- 남은 확인사항 ${createdDraft.openIssues.join(", ")}` : ""}`.trim()
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
                ideationSendDevLog("return", `facilitator-dedupe id=${sendTraceId}`);
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
                ideationSendDevLog("return", `facilitator-ai id=${sendTraceId}`);
              }
          } else {
            const errMsg = json.message || "응답 생성 실패";
            setAiLastInvoke({ ok: false, at: new Date().toISOString(), detail: errMsg });
              showErrorToast("AI 기획자 응답에 실패했습니다. 다시 시도해 주세요.");
              facilitatorFinalRoom = { ...withCalling, aiQuestionIndex: turn + 1 };
              ideationSendDevLog("return", `facilitator-http id=${sendTraceId}`);
            }
            return { needsTailPersist: true, finalRoom: facilitatorFinalRoom };
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          setAiLastInvoke({ ok: false, at: new Date().toISOString(), detail: errMsg });
            showErrorToast("AI 기획자 응답에 실패했습니다. 다시 시도해 주세요.");
            ideationSendDevLog("return", `facilitator-throw id=${sendTraceId}`);
            return { needsTailPersist: true, finalRoom: { ...withCalling, aiQuestionIndex: turn + 1 } };
          }
        };

        const runAiPlannerAfterUserPersist = async (): Promise<IdeationPlannerTail> => {
          if (isIdeationProblemInterviewPlannerContext()) {
            return runIdeationProblemInterviewPipeline();
          }
          return runFacilitatorOrDraftPipeline();
        };

        let plannerTail: IdeationPlannerTail;
        try {
          plannerTail = await runAiPlannerAfterUserPersist();
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
        const nextRoom: RequirementsRoomStateV3 = {
          ...room,
          requirementsConversation: {
            ...room.requirementsConversation,
            projectId: resolvedProjectId.trim(),
            messages: msgs,
          },
        };
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
    showSuccessToast,
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

  const openDeliverableList = useCallback(
    (focusId: string | null) => {
      const allIds = deliverableAssetsFromProject.map((a) => a.id);
      openDeliverableViewer(allIds, focusId ?? allIds[0] ?? null);
    },
    [deliverableAssetsFromProject, openDeliverableViewer]
  );

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
      const res = await fetch(`/api/projects/${encodeURIComponent(pid)}/spec-workspace`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirementsStateJson: completedState,
          confirmedSpecMarkdown: confirmedFullPlan.content,
          workflowStatus: null,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        message?: string;
        data?: { project?: Project; patchApplied?: boolean; message?: string };
      };
      if (!res.ok || !json.success || !json.data?.project || json.data.patchApplied === false) {
        const msg = json.data?.message || json.message || "아이디어 초안 확정 저장에 실패했습니다.";
        setError(msg);
        showErrorToast(msg);
        return;
      }
      setProject(json.data.project);
      stateJsonRef.current = parseRequirementsStateJson(json.data.project.requirementsStateJson);
      setProposalPlanPreview({ open: false, assetId: null });
      setDeliverableViewerOpen(false);
      setAiInvokePending(false);
      notifyAppFlowProjectContextChanged();
      showSuccessToast("아이디어 초안이 확정되었습니다. 다음 단계로 이동합니다.");
      router.push(`/requirements?projectId=${encodeURIComponent(pid)}&stage=service-flow`);
    },
    [resolvedProjectId, project?.requirementsStateJson, persistStateJsonOnly, router, showErrorToast, showSuccessToast]
  );

  const handleGenerateServiceFlowDraft = useCallback(async (opts?: { silent?: boolean }) => {
    const pid = resolvedProjectId.trim();
    if (!pid) {
      setError("프로젝트에 연결된 뒤 사용할 수 있습니다.");
      return;
    }
    if (!ideationReadyForServiceFlow) {
      setError(ideationReadyNotice);
      return;
    }
    setServiceFlowDraftBusy(true);
    setError(null);
    try {
      const assets = (stateJsonRef.current.deliverableAssets ?? []).map((a) => ({
        type: a.type,
        title: a.title,
        content: a.content,
      }));
      const extraAssets: Array<{ type?: string; title?: string; content?: string }> = [];
      const lastPrompt = String(stateJsonRef.current.lastPromptText ?? "").trim();
      if (lastPrompt) extraAssets.push({ type: "ideation_summary", title: "아이디어 요약", content: lastPrompt });
      const draftText = String(stateJsonRef.current.lastUserDraftText ?? "").trim();
      if (draftText) extraAssets.push({ type: "requirements_draft", title: "사용자 초안", content: draftText });
      const convo = concatUserContext(room.requirementsConversation.messages).trim();
      if (convo) extraAssets.push({ type: "requirements_conversation", title: "최근 대화", content: convo.slice(0, 8000) });
      const res = await fetch("/api/requirements/service-flow-draft", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: pid,
          projectName: project?.name ?? "",
          projectDescription: project?.description ?? "",
          ideationAssets: [...assets, ...extraAssets],
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
          let primaryActorId = actorIdByName.get(primaryName) ?? "";
          if (!primaryActorId && primaryName) {
            primaryActorId = `actor:${primaryName}`;
            actorIdByName.set(primaryName, primaryActorId);
            actors.push({ id: primaryActorId, name: primaryName, kind: "human" as const, description: null });
          }
          if (!primaryActorId) primaryActorId = actors[0]!.id;
          const secondary = Array.isArray(s?.secondary) ? s.secondary.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
          const secondaryActorIds = secondary
            .map((nm) => {
              const known = actorIdByName.get(nm);
              if (known) return known;
              const id = `actor:${nm}`;
              actorIdByName.set(nm, id);
              actors.push({ id, name: nm, kind: "system" as const, description: null });
              return id;
            })
            .filter((id) => id !== primaryActorId);
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
      setServiceFlowDraftGenerationCount((n) => n + 1);
      if (!opts?.silent) showSuccessToast("서비스 흐름 초안 생성 완료");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "오류";
      setError(msg);
      if (!opts?.silent) showErrorToast(msg);
    } finally {
      setServiceFlowDraftBusy(false);
    }
  }, [
    resolvedProjectId,
    ideationReadyForServiceFlow,
    ideationReadyNotice,
    project?.name,
    project?.description,
    persistServiceFlow,
    serviceFlow?.createdAt,
    showSuccessToast,
    showErrorToast,
    room,
    ideationConversationOnly,
  ]);

  useEffect(() => {
    if (activeStage !== "service-flow") return;
    if (serviceFlowDraftBusy) return;
    const pid = resolvedProjectId.trim();
    if (!pid) return;
    const flowEmpty = !serviceFlow || !(serviceFlow.actors?.length || serviceFlow.steps?.length);
    if (!flowEmpty) return;
    const assets = stateJsonRef.current.deliverableAssets ?? [];
    const hasIdeationAssets = assets.length > 0;
    const hasConversation = ideationConversationOnly.some((m) => m.role === "human" && String(m.content ?? "").trim());
    if (!(hasIdeationAssets || hasConversation)) return;
    if (!ideationReadyForServiceFlow) return;
    const flightKey = `${pid}:${fetchNonce}:${assets.length}`;
    if (serviceFlowAutoBootstrapRef.current === flightKey) return;
    serviceFlowAutoBootstrapRef.current = flightKey;
    void handleGenerateServiceFlowDraft({ silent: true });
  }, [activeStage, serviceFlowDraftBusy, resolvedProjectId, serviceFlow, ideationReadyForServiceFlow, fetchNonce, ideationConversationOnly, handleGenerateServiceFlowDraft]);

  const handleApproveAllServiceFlowSteps = useCallback(async () => {
    if (!serviceFlow) return;
    const actorIds = new Set(serviceFlow.actors.map((a) => a.id));
    const serviceFlowText = `${serviceFlow.actors.map((a) => `${a.name} ${a.description ?? ""}`).join(" ")} ${serviceFlow.steps.map((s) => `${s.title} ${s.purpose}`).join(" ")}`;
    const hasHumanActors = serviceFlow.actors.some((a) => a.kind === "human");
    const hasSystemActors = serviceFlow.actors.some((a) => a.kind === "system");
    const hasMainFlow = serviceFlow.steps.length >= 3;
    const hasActorResponsibility = Boolean(serviceFlow.steps.length) && serviceFlow.steps.every((s) => s.primaryActorId && actorIds.has(s.primaryActorId));
    const invalid =
      !hasHumanActors ||
      !hasSystemActors ||
      !hasMainFlow ||
      !hasActorResponsibility;
    if (invalid) {
      const missing = [
        !hasHumanActors ? "사람 액터" : "",
        !hasSystemActors ? "시스템 액터" : "",
        !hasMainFlow ? "주요 흐름 3단계 이상" : "",
        !hasActorResponsibility ? "단계별 주 담당 액터" : "",
      ].filter(Boolean);
      const msg = `전체 승인 전 필수 슬롯을 확인해 주세요: ${missing.join(", ")}`;
      setError(msg);
      showErrorToast(msg);
      return;
    }
    const recommendedMissing = [
      /예외|수정|반려|재처리|실패|오류|누락/.test(serviceFlowText) ? "" : "예외 흐름",
      /권한|열람|수정 가능|공유 범위|접근|관리자/.test(serviceFlowText) ? "" : "권한 범위",
      /기능|후보|알림|업로드|공유|승인|요청|관리/.test(serviceFlowText) ? "" : "기능 후보",
    ].filter(Boolean);
    if (recommendedMissing.length) {
      showErrorToast(`권장 슬롯이 비어 있지만 승인합니다: ${recommendedMissing.join(", ")}`);
    }
    const now = new Date().toISOString();
    const next: RequirementsServiceFlowV1 = {
      ...serviceFlow,
      updatedAt: now,
      steps: serviceFlow.steps.map((s) => ({ ...s, approved: true, updatedAt: now })),
    };
    const featureCandidates = Array.from(
      new Set(
        next.steps
          .map((s) => {
            const title = s.title.trim();
            if (!title) return "";
            if (title.includes("업로드")) return "파일 업로드";
            if (title.includes("텍스트") || title.includes("변환")) return "음성 텍스트 변환";
            if (title.includes("화자")) return "화자 구분";
            if (title.includes("수정")) return "수정 요청 워크플로우";
            if (title.includes("승인")) return "승인 기능";
            if (title.includes("알림")) return "알림 기능";
            if (title.includes("공유") || title.includes("배포")) return "공유/배포";
            return title;
          })
          .filter(Boolean)
      )
    );
    const actorDrivenCandidates = [
      next.actors.some((a) => a.name.includes("관리자")) ? "권한 관리" : "",
      "모바일 대응",
    ].filter(Boolean);
    const priorityFeatureText = [...featureCandidates, ...actorDrivenCandidates].map((x) => `- ${x}`).join("\n");
    await persistServiceFlow(next);
    await persistStateJsonOnly({ serviceFlowCompletedAt: now, serviceFlowV1: next, priorityFeatures: priorityFeatureText });
    setPriorityFeatures(priorityFeatureText);
    notifyAppFlowProjectContextChanged();
    showSuccessToast("전체 단계 승인 완료. 기능 정리 단계로 이동합니다.");
    const pid = resolvedProjectId.trim();
    router.push(pid ? `/features?projectId=${encodeURIComponent(pid)}` : "/features");
  }, [serviceFlow, persistServiceFlow, persistStateJsonOnly, resolvedProjectId, router, showSuccessToast, showErrorToast]);

  const inviteEmphasis = humanOthers.length === 0;

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
  const shellStyle = { display: "flex", flexDirection: "column" as const, gap: 0, minHeight: 0 };
  const mainRow: CSSProperties = {
    flex: "1 1 auto",
    gap: 0,
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    overflow: "hidden",
    background: "#fff",
    boxShadow: "0 18px 50px -24px rgba(15, 23, 42, 0.18)",
  };

  const chatPanel = (
    <div className="jyo-requirements-chat-panel-shell" style={{ flex: "1 1 0%", minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <ScreenLabel label="요구사항-채팅영역-대화이력복원" visible={showScreenLabels} />
      <RequirementsChatPanel
        messages={conversationStatus === "loaded" ? ideationConversationOnly : null}
        typingIndicator={aiInvokePending}
        expandControls={{ expanded: chatExpanded, onToggle: () => setChatExpanded((v) => !v) }}
        ideationInterviewUi={
          inIdeationStage && conversationStatus === "loaded"
            ? {
                active: Boolean(problemInterviewState && problemInterviewState.active !== false),
                readinessPercent: proposalReadinessPercentVal,
                covered: problemInterviewCovered,
                strictFilled: problemInterviewStrictFilled,
                total: PROBLEM_INTERVIEW_SLOT_TOTAL,
                nextSlot: nextNeededSlot,
                remainingQuestionsEstimate,
                slotState: problemInterviewState,
                recentAskedSlots: ((problemInterviewState?.askedSlots ?? []).slice(-8) as unknown) as ProblemInterviewSlot[],
                onForceGeneratePlanNow,
              }
            : null
        }
        onInsertComposerPrompt={insertComposerPrompt}
        onSetReplyTo={(messageId, preview) => {
          setReplyTo({ id: messageId, preview });
          window.setTimeout(() => composerTextAreaRef.current?.focus(), 0);
        }}
        onOpenDeliverableDocument={(id) => openDeliverableViewer([id], id)}
        onOpenDeliverableList={(focusId) => openDeliverableList(focusId)}
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

  const ideationStage = (
    <div key="ideation" style={{ display: "contents" }}>
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
    </div>
  );

  const serviceFlowStage = (
    <div key="service-flow" style={{ display: "contents" }}>
      <ServiceFlowWorkspace
        projectId={resolvedProjectId.trim()}
        projectName={headerProjectName}
        projectDescription={String(project?.description ?? "")}
        ideationParticipantHumanMemberIds={(() => {
          // "아이디어 구체화에 참여했던 멤버" = requirementsConversation에서 role==="human"으로 발화한 멤버(memberId 기준)
          const ids = new Set<string>();
          for (const m of ideationConversationOnly) {
            if (m.role !== "human") continue;
            const id = String(m.speakerId ?? "").trim();
            if (id) ids.add(id);
          }
          return [...ids];
        })()}
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
        draftGenerationCount={serviceFlowDraftGenerationCount}
        members={members}
        currentUserId={sessionUser?.id ?? null}
        onInviteMember={() => setInviteOpen(true)}
        onRetryGate={() => setFetchNonce((n) => n + 1)}
        onGenerateAiDraft={() => void handleGenerateServiceFlowDraft()}
        onApproveAll={() => void handleApproveAllServiceFlowSteps()}
        onUpdateFlow={(next) => void persistServiceFlow(next)}
      />
    </div>
  );

  return (
    <div style={shellStyle}>
      <ScreenLabel label="요구사항-목록-페이지-섹션" visible={showScreenLabels} />

      {inIdeationStage ? (
        <OrganizeProposalDraggableModal
          open={plannerTypePickerOpen}
          onClose={() => setPlannerTypePickerOpen(false)}
          busy={busy || deliverableGenerateBusy || organizeState === "running"}
          showRegenerate={Boolean(latestUnifiedProposal)}
          regenerateDisabled={busy || deliverableGenerateBusy || remoteLocked}
          onRegenerate={() => {
            setPlannerTypePickerOpen(false);
            void handleGenerateDeliverables([...IDEATION_UNIFIED_PROPOSAL_OUTPUT]);
          }}
          onStart={() => {
            void organizeStartGenerateFinalProposal();
          }}
        >
          <div>
            현재 확보된 내용을 바탕으로{" "}
            <strong style={{ color: "#0f172a" }}>{(project?.name ?? "").trim() || "프로젝트"} 기획안</strong>을 생성합니다.
          </div>
        </OrganizeProposalDraggableModal>
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
      inIdeationStage &&
      conversationStatus === "loaded" &&
      ideationComplete &&
      !(problemInterviewState && problemInterviewState.active !== false && problemInterviewStrictFilled < PROBLEM_INTERVIEW_SLOT_TOTAL) ? (
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
            정리 요청으로 아이디어 초안을 만들 수 있습니다.
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

      {inIdeationStage && resolvedProjectId.trim() && conversationStatus === "loaded" && problemInterviewState && problemInterviewState.active !== false ? (
        <div
          style={{
            marginTop: 6,
            marginBottom: 10,
            padding: "8px 2px",
            borderRadius: 10,
            color: "#64748b",
            fontSize: 12.5,
            fontWeight: 700,
            lineHeight: 1.45,
          }}
        >
          아이디어 구체화 단계입니다. 핵심만 짧게 확인하고, 상세 액터·흐름·기능·Task는 다음 탭에서 이어서 정리합니다.
        </div>
      ) : null}

      <div
        style={{
          ...mainRow,
          ...(chatExpanded && inIdeationStage ? { minHeight: 640 } : null),
        }}
        className="jyo-requirements-workspace-main"
      >
        <StageRenderer activeStage={activeStage} ideationStage={ideationStage} serviceFlowStage={serviceFlowStage} />
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
                  setOrganizeState("idle");
                  setOrganizeError(null);
                  setError(null);
                  void organizeStartGenerateFinalProposal();
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
                기획안 생성 다시 시도
          </button>
              <div style={{ marginTop: 6, fontSize: 12, color: "#64748b", fontWeight: 600 }}>현재 확보된 내용으로 기획안을 다시 생성합니다</div>
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

      {inIdeationStage ? (
        <>
          <RequirementsPromptDocumentDrawer
            open={promptDrawerOpen}
            onClose={() => setPromptDrawerOpen(false)}
            view={persistedPromptState.lastPromptView ?? null}
            lastPromptText={persistedPromptState.lastPromptText}
            lastPromptGeneratedAt={persistedPromptState.lastPromptGeneratedAt}
            conversationMessages={conversationStatus === "loaded" ? ideationConversationOnly : null}
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

          <ProposalPlanPreviewModal
            open={proposalPlanPreview.open}
            title={`${(project?.name ?? "").trim() || "프로젝트"} 아이디어 초안 미리보기`}
            markdown={proposalPreviewMarkdown}
            projectName={(project?.name ?? "").trim() || "프로젝트"}
            version={proposalPreviewVersion}
            busy={busy || deliverableGenerateBusy}
            onClose={() => setProposalPlanPreview({ open: false, assetId: null })}
            onRegenerate={() => void handleGenerateDeliverables([...IDEATION_UNIFIED_PROPOSAL_OUTPUT])}
            onRequestRevision={(text) => void handleGenerateDeliverables([...IDEATION_UNIFIED_PROPOSAL_OUTPUT], { revisionRequest: text })}
            onConfirm={() => {
              const id = proposalPlanPreview.assetId;
              if (!id) return;
              void handleConfirmDeliverableAssets([id]);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
