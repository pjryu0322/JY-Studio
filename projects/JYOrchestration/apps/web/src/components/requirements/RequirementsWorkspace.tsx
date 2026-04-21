"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { fetchProjectById } from "@/components/project-spec/api";
import type { Project } from "@/components/project-spec/types";
import { RequirementsChatPanel } from "@/components/requirements/RequirementsChatPanel";
import { RequirementsComposerGpt } from "@/components/requirements/RequirementsComposerGpt";
import type { RequirementsComposerTargetPickerItem } from "@/components/requirements/RequirementsComposerGpt";
import { RequirementsHeader } from "@/components/requirements/RequirementsHeader";
import { RequirementsMemberInviteModal } from "@/components/requirements/RequirementsMemberInviteModal";
import { RequirementsMemberSidebar } from "@/components/requirements/RequirementsMemberSidebar";
import type { ParticipantOption } from "@/components/requirements/RequirementsParticipantBar";
import { RequirementsDeliverableViewerModal } from "@/components/requirements/RequirementsDeliverableViewerModal";
import { RequirementsDraftDocumentDrawer } from "@/components/requirements/RequirementsDraftDocumentDrawer";
import { RequirementsPromptDocumentDrawer } from "@/components/requirements/RequirementsPromptDocumentDrawer";
import { RequirementsSummaryModal } from "@/components/requirements/RequirementsSummaryModal";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { isNextPublicDevWorkflowToolsEnabled } from "@/lib/env/devWorkflowTools";
import { readAiResponseStyle } from "@/lib/preferences/globalPreferences";
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
import { bumpDraftVersion, type RequirementsDraftDoc } from "@/lib/requirements/draftStore";
import { buildPromptPresenterView } from "@/lib/requirements/promptPresenter";
import {
  mergeRequirementsStateJson,
  parseRequirementsStateJson,
  type RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import { REQUIREMENTS_ANALYSIS_INCOMPLETE_REDIRECT_MESSAGE_KR } from "@/lib/project/requirementsAnalysisGate";
import { joinSuccessCriteriaAndNfr, splitSuccessCriteriaAndNfr } from "@/lib/project/requirementsSuccessCriteriaSplit";
import { isRequirementsPendingWorkflow } from "@/lib/project/projectWorkflowStatus";
import {
  newChatMessage,
  parseRequirementsRoomState,
  VIRTUAL_AI_PLANNER_ID,
  type RequirementsRoomStateV3,
} from "@/lib/project/requirementsRoomState";
import { coerceRequirementsMessage, type RequirementsMessage, type RequirementsMessageTarget } from "@/lib/requirements/requirementsMessage";
import { dedupeMemberRefs, resolveMentionTargetsFromText, getMessageTargets } from "@/lib/requirements/requirementsTargets";
import { newConversation, type RequirementsConversation } from "@/lib/requirements/conversationStore";
import { APP_FLOW_LAST_PROJECT_KEY, APP_FLOW_PROJECT_CONTEXT_REFRESH_EVENT } from "@/lib/workflow/appFlowModel";

const IDEATION_COMPLETION_NOTICE =
  "핵심 정보가 정리되었습니다. 이제 「정리 요청」으로 정리본을 만들 수 있습니다. 필요하면 상단 워크플로에서 「기능 정리」로 이동하세요.";

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
}: {
  readonly initialProjectId: string;
  readonly initialWorkflowNotice: string;
}) {
  const router = useRouter();
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
  const [selectedMembers, setSelectedMembers] = useState<RequirementsMessageTarget[]>([
    { id: VIRTUAL_AI_PLANNER_ID, name: "AI 기획자" },
  ]);
  const [fetchNonce, setFetchNonce] = useState(0);
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
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
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
      const sm = state.selectedMembers;
      if (Array.isArray(sm) && sm.length > 0) {
        setSelectedMembers(dedupeMemberRefs(sm as RequirementsMessageTarget[]));
      } else if (typeof state.selectedTargetId === "string" && state.selectedTargetId.trim()) {
        setSelectedMembers([{ id: state.selectedTargetId.trim(), name: "AI 기획자" }]);
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

  useEffect(() => {
    setSelectedMembers((prev) => {
      const onlyVirtual = prev.length === 1 && prev[0].id === VIRTUAL_AI_PLANNER_ID;
      if (!onlyVirtual) return prev;
      const planner = aiMembers.find((m) => m.aiOrchestrationRole === "planner" && m.orchestrationStage === "spec");
      if (!planner) return prev;
      return dedupeMemberRefs([
        { id: planner.memberId, name: (planner.displayName ?? "AI 기획자").trim() || "AI 기획자" },
      ]);
    });
  }, [aiMembers]);

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
      });
    }
    for (const m of aiMembers) {
      list.push({
        id: m.memberId,
        name: (m.displayName || m.email || "AI").slice(0, 24),
        kind: "ai",
        onlineHint: false,
        aiStatusLabel: aiPlannerStatusLabel,
      });
    }
    for (const m of members) {
      if (m.memberType !== "HUMAN") continue;
      const uid = m.userId ?? null;
      list.push({
        id: m.memberId,
        name: (m.displayName || m.email || "멤버").slice(0, 24),
        kind: "human",
        onlineHint: Boolean(sessionUser?.id && uid && sessionUser.id === uid),
      });
    }
    const seen = new Set<string>();
    return list.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [members, aiMembers, sessionUser?.id, aiPlannerStatusLabel]);

  useEffect(() => {
    setSelectedMembers((prev) => {
      if (!prev.length) return prev;
      const refs = participants.map((p) => ({ id: p.id, name: p.name }));
      let changed = false;
      const next = prev.map((m) => {
        const hit = refs.find((r) => r.id === m.id);
        if (hit && hit.name !== m.name) {
          changed = true;
          return { id: m.id, name: hit.name };
        }
        return m;
      });
      return changed ? dedupeMemberRefs(next) : prev;
    });
  }, [participants]);

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

  const actionBtn: CSSProperties = useMemo(
    () => ({
      padding: "8px 14px",
      borderRadius: 10,
      border: "1px solid #e2e8f0",
      background: "#fff",
      fontWeight: 700,
      fontSize: 13,
      cursor: "pointer",
      color: "#0f172a",
      boxShadow: "0 1px 2px rgba(15, 23, 42, 0.05)",
    }),
    []
  );

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

  const ideationNoticeSent = useMemo(
    () => Boolean(parseRequirementsStateJson(project?.requirementsStateJson).ideationCompletionAiNoticeSent),
    [project?.requirementsStateJson]
  );

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

  const toggleMemberTarget = useCallback(
    (id: string, name: string) => {
      setSelectedMembers((prev) => {
        const exists = prev.some((x) => x.id === id);
        let next: RequirementsMessageTarget[];
        if (exists) {
          if (prev.length <= 1) return prev;
          next = prev.filter((x) => x.id !== id);
        } else {
          next = dedupeMemberRefs([...prev, { id, name }]);
        }
        const pid = resolvedProjectId.trim();
        if (pid) {
          void persistStateJsonOnly({
            selectedMembers: next,
            selectedTargetId: next[0]?.id ?? null,
          });
        }
        return next;
      });
    },
    [resolvedProjectId, persistStateJsonOnly]
  );

  const removeMemberTarget = useCallback(
    (id: string) => {
      setSelectedMembers((prev) => {
        if (prev.length <= 1) return prev;
        const next = prev.filter((x) => x.id !== id);
        const pid = resolvedProjectId.trim();
        if (pid) {
          void persistStateJsonOnly({
            selectedMembers: next,
            selectedTargetId: next[0]?.id ?? null,
          });
        }
        return next;
      });
    },
    [resolvedProjectId, persistStateJsonOnly]
  );

  const handleComposerInputChange = useCallback(
    (v: string) => {
      setInput(v);
      const refs = participants.map((p) => ({ id: p.id, name: p.name }));
      const extra = resolveMentionTargetsFromText(v, refs);
      if (!extra.length) return;
      setSelectedMembers((prev) => {
        const merged = dedupeMemberRefs([...prev, ...extra]);
        const unchanged =
          merged.length === prev.length && merged.every((m, i) => m.id === prev[i]?.id && m.name === prev[i]?.name);
        if (unchanged) return prev;
        const pid = resolvedProjectId.trim();
        if (pid) {
          void persistStateJsonOnly({
            selectedMembers: merged,
            selectedTargetId: merged[0]?.id ?? null,
          });
        }
        return merged;
      });
    },
    [participants, resolvedProjectId, persistStateJsonOnly]
  );

  const composerPlaceholder = useMemo(() => {
    if (selectedMembers.length === 0) return "예: 내부 직원이 회의록을 작성·검색·공유할 수 있는 서비스를 만들고 싶어요";
    if (selectedMembers.length === 1) return `${selectedMembers[0].name}에게 질문하세요`;
    return `선택한 ${selectedMembers.length}명에게 질문하세요`;
  }, [selectedMembers]);

  const targetPickerItems = useMemo<readonly RequirementsComposerTargetPickerItem[]>(() => {
    const humans = participants.filter((p) => p.kind === "human").map((p) => ({ id: p.id, name: p.name }));
    const all = participants.map((p) => ({ id: p.id, name: p.name }));
    const plannerAi = participants.find((p) => p.kind === "ai" && /기획/.test(p.name)) ?? null;
    const plannerTarget = plannerAi ? { id: plannerAi.id, name: plannerAi.name } : { id: VIRTUAL_AI_PLANNER_ID, name: "AI 기획자" };
    return [
      { id: "picker:ai-planner", label: "AI 기획자", targets: [plannerTarget] },
      { id: "picker:humans", label: "사람 멤버", targets: humans },
      { id: "picker:all", label: "전체 멤버", targets: all },
    ];
  }, [participants]);

  const addMemberTargets = useCallback(
    (targets: readonly { id: string; name: string }[]) => {
      if (!targets.length) return;
      setSelectedMembers((prev) => {
        const merged = dedupeMemberRefs([...prev, ...(targets as RequirementsMessageTarget[])]);
        const pid = resolvedProjectId.trim();
        if (pid) {
          void persistStateJsonOnly({
            selectedMembers: merged,
            selectedTargetId: merged[0]?.id ?? null,
          });
        }
        return merged;
      });
    },
    [resolvedProjectId, persistStateJsonOnly]
  );

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
        selectedTargetId: selectedMembers[0]?.id ?? stateJsonRef.current.selectedTargetId ?? null,
        selectedMembers: selectedMembers.length ? [...selectedMembers] : null,
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
      if (userBlob) {
        body.description = userBlob.slice(0, 60000);
      }
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
      selectedMembers,
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
          await persistRemote(nextRoom, {}, { onboardingShown: true });
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

  useEffect(() => {
    if (conversationStatus !== "loaded") return;
    const pid = resolvedProjectId.trim();
    if (!pid || !project) return;
    if (loadedConversationProjectId !== pid) return;
    if (!ideationComplete) return;
    if (ideationNoticeSent) return;
    const msgs = room.requirementsConversation.messages;
    const already = msgs.some((m) => m.role === "ai" && m.content.trim() === IDEATION_COMPLETION_NOTICE);
    if (already) return;
    const notice = newChatMessage({
      role: "ai",
      body: IDEATION_COMPLETION_NOTICE,
      speakerType: "AI",
      speakerId: VIRTUAL_AI_PLANNER_ID,
      speakerName: "AI 기획자",
      messageType: "NOTICE",
    });
    const nextRoom: RequirementsRoomStateV3 = {
      ...room,
      requirementsConversation: {
        ...room.requirementsConversation,
        projectId: pid,
        messages: [...msgs, notice],
      },
    };
    void persistRemote(nextRoom, {}, { ideationCompletionAiNoticeSent: true }).catch((e) => {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    });
  }, [
    conversationStatus,
    resolvedProjectId,
    loadedConversationProjectId,
    project,
    ideationComplete,
    ideationNoticeSent,
    room,
    persistRemote,
  ]);

  const onOrganizeRequirements = useCallback(async () => {
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
      const organizeUserMessage =
        "지금까지의 대화를 바탕으로 아이디어를 문서 형태로 정리해줘. 필수 항목(개요/사용자/기능/성공기준)이 빠지면 추론해서 채우고, 불확실하면 미결정 이슈로 남겨줘.";
      const promptMetaIso = new Date().toISOString();
      const organizePromptView = buildPromptPresenterView({
        projectName: project?.name ?? "",
        projectDescription: project?.description ?? "",
        targetName: "AI 기획자",
        messages: conversationMessages,
        latestUserMessage: organizeUserMessage,
      });
      await persistStateJsonOnly({
        lastPromptView: organizePromptView,
        lastPromptText: organizePromptView.copyText,
        lastPromptGeneratedAt: promptMetaIso,
        lastUserDraftText: input,
      });
      const excerpt = formatDialogueExcerpt(conversationMessages);
      const res = await fetch("/api/requirements/draft-generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: pid,
          projectName: project?.name ?? "",
          projectDescription: project?.description ?? "",
          stage: "requirements",
          userMessage: organizeUserMessage,
          dialogueExcerpt: excerpt,
          existingDraft: draftDoc,
          aiResponseStyle: readAiResponseStyle(),
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        code?: string;
        message?: string;
        data?: {
          draft?: {
            overview: string;
            goals: string[];
            users: string[];
            features: string[];
            excluded: string[];
            nonFunctional: string[];
            successCriteria: string[];
            openIssues: string[];
          };
        };
      };
      if (!res.ok || !json.success || !json.data?.draft) {
        const code = String(json.code ?? "");
        if (code === "NO_KEY") {
          throw new Error("AI 정리를 사용하려면 서버에 OPENAI_API_KEY 설정이 필요합니다.");
        }
        throw new Error(json.message || "정리 요청 처리에 실패했습니다.");
      }

      const nextDraft = bumpDraftVersion(draftDoc, {
        projectId: pid,
        overview: json.data.draft.overview,
        goals: json.data.draft.goals,
        users: json.data.draft.users,
        features: json.data.draft.features,
        excluded: json.data.draft.excluded,
        nonFunctional: json.data.draft.nonFunctional,
        successCriteria: json.data.draft.successCriteria,
        openIssues: json.data.draft.openIssues,
        createdAt: new Date().toISOString(),
        source: { messageCount: conversationMessages.length, lastMessageAt: conversationMessages[conversationMessages.length - 1]?.createdAt },
      });

      const nextRoom: RequirementsRoomStateV3 = {
        ...room,
        requirementsDraft: nextDraft,
        requirementsConversation: {
          ...room.requirementsConversation,
          projectId: pid,
          messages: conversationMessages,
        },
      };
      const organizedIso = new Date().toISOString();
      setOrganizedAt(organizedIso);
      await persistRemote(nextRoom, {}, { lastOrganizedAt: organizedIso });
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
        const json = (await res.json()) as {
          success?: boolean;
          code?: string;
          message?: string;
          data?: { outputs?: Partial<Record<IdeationDeliverableType, string>> };
        };
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
      } catch (e) {
        const msg = e instanceof Error ? e.message : "오류";
        if (msg !== "GUARD") {
          setError(msg);
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
    if (draftDebounceTimerRef.current) {
      clearTimeout(draftDebounceTimerRef.current);
      draftDebounceTimerRef.current = null;
    }
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const targets = dedupeMemberRefs(
        selectedMembers.length ? selectedMembers : [{ id: VIRTUAL_AI_PLANNER_ID, name: "AI 기획자" }]
      );
      const anyAi = targets.some((t) => isAiTarget(t.id));
      const primaryAi = targets.find((t) => isAiTarget(t.id));
      const combinedLabel = targets.map((t) => t.name).join(" · ");

      const userMsg = newChatMessage({
        role: "user",
        body: text,
        targets,
        ...(replyTo?.id ? { replyTo: replyTo.id } : {}),
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
        setAiInvokePending(true);
        const pid = resolvedProjectId.trim();
        let finalRoom: RequirementsRoomStateV3;
        try {
          const excerpt = formatDialogueExcerpt(conversationMessages);
          const endpoint = isDraftIntent(text) ? "/api/requirements/draft-generate" : "/api/requirements/ai-facilitator";
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
              replyTo: replyTo?.id ?? null,
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

            finalRoom = {
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
          } else {
            const errMsg = json.message || "응답 생성 실패";
            setAiLastInvoke({ ok: false, at: new Date().toISOString(), detail: errMsg });
            finalRoom = {
              ...withCalling,
              aiQuestionIndex: turn + 1,
              requirementsConversation: {
                ...withCalling.requirementsConversation,
                messages: [
                  ...withCalling.requirementsConversation.messages,
                  newChatMessage({
                    role: "system",
                    body: "AI 기획자 응답에 실패했습니다. 다시 시도해 주세요.",
                    speakerType: "SYSTEM",
                    speakerId: "system",
                    speakerName: "시스템",
                    messageType: "FRIENDLY_ERROR",
                  }),
                ],
              },
            };
          }
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          setAiLastInvoke({ ok: false, at: new Date().toISOString(), detail: errMsg });
          finalRoom = {
            ...withCalling,
            aiQuestionIndex: turn + 1,
            requirementsConversation: {
              ...withCalling.requirementsConversation,
              messages: [
                ...withCalling.requirementsConversation.messages,
                newChatMessage({
                  role: "system",
                  body: "AI 기획자 응답에 실패했습니다. 다시 시도해 주세요.",
                  speakerType: "SYSTEM",
                  speakerId: "system",
                  speakerName: "시스템",
                  messageType: "FRIENDLY_ERROR",
                }),
              ],
            },
          };
        } finally {
          setAiInvokePending(false);
        }
        setInput("");
        setReplyTo(null);
        await persistRemote(finalRoom, {}, { lastUserDraftText: "" });
      } else {
        const nextRoom: RequirementsRoomStateV3 = {
          ...room,
          requirementsConversation: {
            ...room.requirementsConversation,
            projectId: resolvedProjectId.trim(),
            messages: [
              ...msgs,
              newChatMessage({
                role: "system",
                body: `${targets.map((t) => `@${t.name}`).join(", ")}님께 공개 질문으로 전달되었습니다. 답변은 이 대화에 이어서 남겨 주세요.`,
                speakerType: "SYSTEM",
                speakerId: "system",
                speakerName: "시스템",
                messageType: "NOTICE",
              }),
            ],
          },
        };
        setInput("");
        setReplyTo(null);
        await persistRemote(nextRoom, {}, { lastUserDraftText: "" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }, [
    input,
    busy,
    room,
    conversationMessages,
    selectedMembers,
    isAiTarget,
    persistRemote,
    resolvedProjectId,
    sessionUser?.id,
    sessionUser?.name,
    project?.name,
    project?.description,
    draftDoc,
    replyTo,
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
    minHeight: 0,
  };

  return (
    <div style={shellStyle}>
      <ScreenLabel label="요구사항-목록-페이지-섹션" visible={showScreenLabels} />

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

      <RequirementsHeader
        projectName={headerProjectName}
        showProjectWorkflowNav={Boolean(resolvedProjectId.trim())}
      />

      {resolvedProjectId.trim() && conversationStatus === "loaded" && ideationComplete ? (
        <div
          style={{
            marginTop: 8,
            marginBottom: 6,
            padding: "8px 12px",
            borderRadius: 10,
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            fontSize: 13,
            fontWeight: 700,
            color: "#065f46",
          }}
        >
          정리본 생성이 가능합니다. 입력창 왼쪽 + 메뉴에서 「정리 요청」 또는 「산출물 생성」을 선택하세요.
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

      <div style={mainRow} className="jyo-requirements-workspace-main">
        <RequirementsMemberSidebar
          participants={participants}
          selectedMemberIds={selectedMembers.map((m) => m.id)}
          onToggleMember={toggleMemberTarget}
          showInvite={Boolean(resolvedProjectId.trim())}
          inviteDisabled={remoteLocked}
          inviteEmphasis={inviteEmphasis}
          onInviteClick={() => setInviteOpen(true)}
        />
        <div style={{ flex: "1 1 0%", minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <ScreenLabel label="요구사항-채팅영역-대화이력복원" visible={showScreenLabels} />
          <RequirementsChatPanel
            messages={messages}
            typingIndicator={aiInvokePending}
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
                  onChange={handleComposerInputChange}
                  onSend={() => void onSend()}
                  busy={busy}
                  disabled={false}
                  placeholder={composerPlaceholder}
                  questionTargets={selectedMembers}
                  onRemoveQuestionTarget={removeMemberTarget}
                  targetPickerItems={targetPickerItems}
                  onAddQuestionTargets={addMemberTargets}
                  toolsMenu={{
                    onOrganizeRequirements: () => void onOrganizeRequirements(),
                    organizeDisabled: busy || remoteLocked,
                    draftViewAvailable: Boolean(draftDoc),
                    onOpenDraftView: () => setDraftDrawerOpen(true),
                    onOpenPromptView: () => setPromptDrawerOpen(true),
                    onOpenSummaryEdit: () => setSummaryModalOpen(true),
                    onGenerateDeliverables: handleGenerateDeliverables,
                    deliverableGenerateBusy,
                    onAttachFiles: (files) => {
                      const names = Array.from(files)
                        .map((f) => f.name.trim())
                        .filter(Boolean);
                      if (!names.length) return;
                      setInput((prev) => {
                        const tail = prev && !/\n$/.test(prev) ? "\n" : "";
                        return `${prev}${tail}[첨부: ${names.join(", ")}]\n`;
                      });
                    },
                    devAckStep: isNextPublicDevWorkflowToolsEnabled()
                      ? { onClick: () => void ackDev(), disabled: busy || remoteLocked || !resolvedProjectId.trim() }
                      : null,
                  }}
                />
              </div>
            }
          />
        </div>
      </div>

      {error ? (
        <p style={{ color: "#b91c1c", fontWeight: 600, fontSize: 13 }} role="alert">
          {error}
        </p>
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
