"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "@/components/project-spec/types";
import type { WorkspaceChatMessage } from "@/components/workspace/WorkspaceChatPanel";
import { fetchProjectWithRetry } from "@/components/project-spec/api";
import { detectLikelyProcessStepPlanningArtifact } from "@/lib/featurePlanning/featurePlanningProcessStepHeuristic";
import { sanitizeFeaturePlanningUserVisibleKorean } from "@/lib/featurePlanning/featurePlanningUserVisibleSanitize";
import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import {
  buildOrderedSlotsVisible,
  orderedSlotsForFeaturePlanningUi,
} from "@/lib/featurePlanning/featurePlanningLegacyRoleSlots";
import type { FeaturePlanningWorkspaceChatMessageV1, FeaturePlanningWorkspaceChatV1 } from "@/lib/featurePlanning/featurePlanningWorkspaceChat";
import { buildSingleSlotDigestForChat, newFeaturePlanningMessageId } from "@/lib/featurePlanning/featurePlanningWorkspaceChat";
import { mergeRequirementsStateJson, parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { patchSpecWorkspaceRequest } from "@/lib/project/specWorkspaceClient";
import {
  FEATURE_PLANNING_SERVICE_FLOW_INCOMPLETE_MESSAGE,
  isServiceFlowApprovedForFeaturePlanning,
} from "@/lib/featurePlanning/featurePlanningServiceFlowGate";
import { computeChecklistProgress } from "@/lib/featurePlanning/featurePlanningDynamicChecklist";

function isoNow(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  try {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  } catch {
    return `${prefix}_${Date.now()}`;
  }
}

function workspaceMessagesFromState(chat: FeaturePlanningWorkspaceChatV1 | null | undefined): WorkspaceChatMessage[] {
  const rows = chat?.messages ?? [];
  return rows.map((m: FeaturePlanningWorkspaceChatMessageV1) => ({
    id: m.id,
    role: m.role,
    text: m.text,
    at: m.at,
    ...(m.resultSummary ? { resultSummary: m.resultSummary } : {}),
    ...(m.slotNavChips?.length ? { slotNavChips: m.slotNavChips } : {}),
  }));
}

function toWorkspaceChatV1Messages(rows: readonly WorkspaceChatMessage[]): FeaturePlanningWorkspaceChatMessageV1[] {
  return rows.map((m) => ({
    id: m.id,
    role: m.role,
    text: m.text,
    at: m.at,
    ...(m.resultSummary ? { resultSummary: m.resultSummary } : {}),
    ...(m.slotNavChips?.length ? { slotNavChips: m.slotNavChips } : {}),
  }));
}

export const FEATURE_PLANNING_REGENERATE_WARNING =
  "기존에 정리된 기능 초안과 대화 맥락이 변경될 수 있습니다.";

export const FEATURE_PLANNING_RESET_CHAT_WARNING =
  "지금까지의 대화 기록이 사라지고, 저장된 기능 정리 초안을 기준으로 처음부터 이어갑니다. 초안 자체는 바꾸지 않습니다.";

const SAVE_DEBOUNCE_MS = 650;

const SERVICE_FLOW_GATE_MSG_ID = "fp_service_flow_incomplete_notice";

type ApiInitData = {
  generated?: boolean;
  artifact?: FeaturePlanningSlotsArtifactV1;
  slots?: unknown;
  messages: WorkspaceChatMessage[];
};

type ApiInitResponse = { success: boolean; message?: string; code?: string; data?: ApiInitData };

type ApiChatData = {
  artifact?: FeaturePlanningSlotsArtifactV1;
  slots?: unknown;
  messages: WorkspaceChatMessage[];
  plannerMeta?: { nextQuestions?: readonly string[] };
};

type ApiChatResponse = { success: boolean; message?: string; code?: string; data?: ApiChatData };

export function useFeaturePlanningWorkspace(projectId: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [artifact, setArtifact] = useState<FeaturePlanningSlotsArtifactV1 | null>(null);
  const [messages, setMessages] = useState<WorkspaceChatMessage[]>([]);
  const [activeSlotId, setActiveSlotId] = useState("");
  const [initLoading, setInitLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [resetChatLoading, setResetChatLoading] = useState(false);
  const [slotDigestLoading, setSlotDigestLoading] = useState(false);
  const [slotsSaving, setSlotsSaving] = useState(false);
  const [composer, setComposer] = useState("");
  const [plannerInputHint, setPlannerInputHint] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [initErrorCode, setInitErrorCode] = useState<string | null>(null);
  const [approvalEpoch, setApprovalEpoch] = useState(0);

  const initStartedRef = useRef(false);
  const wasServiceFlowBlockedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const artifactRef = useRef<FeaturePlanningSlotsArtifactV1 | null>(null);
  const projectRef = useRef<Project | null>(null);
  artifactRef.current = artifact;
  projectRef.current = project;

  const pushNotice = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 4200);
  }, []);

  const hydrateFromProject = useCallback((p: Project) => {
    if (!isServiceFlowApprovedForFeaturePlanning(p.requirementsStateJson)) {
      setInitError(null);
      setInitErrorCode(null);
      setArtifact(null);
      setMessages([
        {
          id: SERVICE_FLOW_GATE_MSG_ID,
          role: "ai",
          text: FEATURE_PLANNING_SERVICE_FLOW_INCOMPLETE_MESSAGE.trim(),
          at: isoNow(),
        },
      ]);
      setActiveSlotId("");
      return;
    }
    const st = parseRequirementsStateJson(p.requirementsStateJson);
    const fp = st.featurePlanningSlotsV1 ?? null;
    setArtifact(fp);
    setMessages(workspaceMessagesFromState(st.featurePlanningWorkspaceChatV1));
    const ordered = fp ? orderedSlotsForFeaturePlanningUi(fp) : [];
    setActiveSlotId(ordered[0]?.slotId ?? "");
  }, []);

  const persistArtifact = useCallback(
    async (next: FeaturePlanningSlotsArtifactV1, pid: string, proj: Project) => {
      const base = parseRequirementsStateJson(proj.requirementsStateJson);
      const merged = mergeRequirementsStateJson(base, { featurePlanningSlotsV1: next });
      const { res, json } = await patchSpecWorkspaceRequest(pid, { requirementsStateJson: merged });
      const raw = json as { success?: boolean; message?: string };
      if (!res.ok || raw?.success === false) {
        pushNotice(raw?.message ?? "기능 정리 내용 저장에 실패했습니다.");
        return false;
      }
      setProject((p) => (p ? { ...p, requirementsStateJson: merged } : p));
      return true;
    },
    [pushNotice]
  );

  const schedulePersist = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      const pid = projectId.trim();
      const art = artifactRef.current;
      const proj = projectRef.current;
      if (!pid || !art || !proj) return;
      void (async () => {
        setSlotsSaving(true);
        try {
          await persistArtifact(art, pid, proj);
        } finally {
          setSlotsSaving(false);
        }
      })();
    }, SAVE_DEBOUNCE_MS);
  }, [persistArtifact, projectId]);

  const updateArtifactItem = useCallback(
    (slotId: string, itemId: string, patch: Partial<{ name: string; description: string; roleTags: readonly string[] }>) => {
      setArtifact((prev) => {
        if (!prev) return prev;
        const slots = prev.slots.map((s) => {
          if (s.slotId !== slotId) return s;
          return {
            ...s,
            items: s.items.map((it) => (it.id !== itemId ? it : { ...it, ...patch })),
          };
        });
        return { ...prev, slots, userEdited: true, updatedAt: new Date().toISOString() };
      });
      schedulePersist();
    },
    [schedulePersist]
  );

  useEffect(() => {
    initStartedRef.current = false;
    wasServiceFlowBlockedRef.current = false;
    setPlannerInputHint(null);
  }, [projectId]);

  useEffect(() => {
    if (!project) return;
    const ok = isServiceFlowApprovedForFeaturePlanning(project.requirementsStateJson);
    if (wasServiceFlowBlockedRef.current && ok) {
      initStartedRef.current = false;
      setApprovalEpoch((e) => e + 1);
    }
    wasServiceFlowBlockedRef.current = !ok;
  }, [project]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { project: p, errorMessage } = await fetchProjectWithRetry(projectId);
      if (cancelled) return;
      setProject(p);
      setLoadError(errorMessage);
      if (p) hydrateFromProject(p);
      else {
        setArtifact(null);
        setMessages([]);
        setActiveSlotId("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, hydrateFromProject]);

  const runFeatureEntryAnalyze = useCallback(
    async (forceRegenerate: boolean) => {
      const pid = projectId.trim();
      if (!pid) return;
      const proj = projectRef.current;
      if (!proj || !isServiceFlowApprovedForFeaturePlanning(proj.requirementsStateJson)) {
        return;
      }
      setInitLoading(true);
      setInitError(null);
      setInitErrorCode(null);
      try {
        const res = await fetch("/api/features/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ projectId: pid, forceRegenerate }),
        });
        const json = (await res.json()) as ApiInitResponse;
        if (!json.success || !json.data) {
          const msg = json.message ?? "기능 정리 분석에 실패했습니다. 다시 시도해 주세요.";
          setInitError(msg);
          setInitErrorCode(json.code ?? null);
          pushNotice(msg);
          return;
        }
        const d = json.data;
        if (d.artifact) {
          setArtifact(d.artifact);
          const ordered = orderedSlotsForFeaturePlanningUi(d.artifact);
          setActiveSlotId(ordered[0]?.slotId ?? "");
        }
        if (Array.isArray(d.messages)) {
          setMessages(d.messages);
        }
        if (d.generated) {
          pushNotice(forceRegenerate ? "기능 정리 분석을 다시 적용했습니다." : "기능 정리 분석을 적용했습니다.");
        }
      } catch {
        const msg = "기능 정리 분석 요청 중 오류가 발생했습니다.";
        setInitError(msg);
        setInitErrorCode("NETWORK");
        pushNotice(msg);
      } finally {
        setInitLoading(false);
      }

      try {
        const { project: p } = await fetchProjectWithRetry(pid);
        setProject(p ?? null);
        if (p) hydrateFromProject(p);
      } catch {
        pushNotice("프로젝트 정보를 다시 불러오지 못했습니다.");
      }
    },
    [hydrateFromProject, projectId, pushNotice]
  );

  const retryInitialize = useCallback(() => {
    void runFeatureEntryAnalyze(false);
  }, [runFeatureEntryAnalyze]);

  useEffect(() => {
    if (!projectId.trim() || !project || loadError) return;
    if (!isServiceFlowApprovedForFeaturePlanning(project.requirementsStateJson)) {
      initStartedRef.current = true;
      return;
    }
    if (initStartedRef.current) return;
    initStartedRef.current = true;
    void runFeatureEntryAnalyze(false);
  }, [approvalEpoch, loadError, project, projectId, runFeatureEntryAnalyze]);

  useEffect(() => {
    if (!artifact?.slots.length) return;
    const ids = new Set(artifact.slots.map((s) => s.slotId));
    if (!activeSlotId || !ids.has(activeSlotId)) {
      setActiveSlotId(orderedSlotsForFeaturePlanningUi(artifact)[0]?.slotId ?? "");
    }
  }, [artifact, activeSlotId]);

  const onRegenerateSlots = useCallback(() => {
    const proj = projectRef.current;
    if (!proj || !isServiceFlowApprovedForFeaturePlanning(proj.requirementsStateJson)) {
      pushNotice(FEATURE_PLANNING_SERVICE_FLOW_INCOMPLETE_MESSAGE.trim());
      return;
    }
    const ok = window.confirm(`${FEATURE_PLANNING_REGENERATE_WARNING}\n계속하시겠습니까?`);
    if (!ok) return;
    void runFeatureEntryAnalyze(true);
  }, [pushNotice, runFeatureEntryAnalyze]);

  const expandSlotPreviewInChat = useCallback(
    async (slotId: string) => {
      const pid = projectId.trim();
      const art = artifactRef.current;
      const proj = projectRef.current;
      if (!pid || !proj || !isServiceFlowApprovedForFeaturePlanning(proj.requirementsStateJson)) {
        pushNotice(FEATURE_PLANNING_SERVICE_FLOW_INCOMPLETE_MESSAGE.trim());
        return;
      }
      if (!art?.slots?.length || chatLoading || initLoading || resetChatLoading || slotDigestLoading) return;
      const slot =
        orderedSlotsForFeaturePlanningUi(art).find((s) => s.slotId === slotId) ?? art.slots.find((s) => s.slotId === slotId);
      if (!slot) return;
      setSlotDigestLoading(true);
      try {
        const digest = buildSingleSlotDigestForChat(art, slotId);
        const text = sanitizeFeaturePlanningUserVisibleKorean(digest).slice(0, 32000);
        const aiMsg: FeaturePlanningWorkspaceChatMessageV1 = {
          id: newFeaturePlanningMessageId(),
          role: "ai",
          text,
          at: isoNow(),
        };
        const base = parseRequirementsStateJson(proj.requirementsStateJson);
        const nextV1 = [...toWorkspaceChatV1Messages(messages), aiMsg];
        const merged = mergeRequirementsStateJson(base, { featurePlanningWorkspaceChatV1: { messages: nextV1 } });
        const { res, json } = await patchSpecWorkspaceRequest(pid, { requirementsStateJson: merged });
        const rawRes = json as { success?: boolean; message?: string };
        if (!res.ok || rawRes?.success === false) {
          pushNotice(rawRes?.message ?? "초안 표시 저장에 실패했습니다.");
          return;
        }
        setProject((p) => (p ? { ...p, requirementsStateJson: merged } : p));
        setMessages(workspaceMessagesFromState(merged.featurePlanningWorkspaceChatV1));
        setActiveSlotId(slotId);
      } catch {
        pushNotice("초안을 불러오는 중 오류가 발생했습니다.");
      } finally {
        setSlotDigestLoading(false);
      }
    },
    [
      chatLoading,
      initLoading,
      messages,
      projectId,
      pushNotice,
      resetChatLoading,
      slotDigestLoading,
    ]
  );

  const resetChat = useCallback(async () => {
    const pid = projectId.trim();
    const art = artifactRef.current;
    const proj = projectRef.current;
    if (!pid || !proj || !isServiceFlowApprovedForFeaturePlanning(proj.requirementsStateJson)) {
      pushNotice(FEATURE_PLANNING_SERVICE_FLOW_INCOMPLETE_MESSAGE.trim());
      return;
    }
    if (!art?.slots?.length || chatLoading || initLoading || resetChatLoading || slotDigestLoading) return;
    const ok = window.confirm(`${FEATURE_PLANNING_RESET_CHAT_WARNING}\n계속하시겠습니까?`);
    if (!ok) return;
    setResetChatLoading(true);
    try {
      const res = await fetch("/api/feature-planning/reseed-first-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId: pid }),
      });
      const json = (await res.json()) as ApiInitResponse;
      if (!json.success || !json.data) {
        pushNotice(json.message ?? "대화 초기화에 실패했습니다.");
        return;
      }
      const d = json.data;
      if (d.artifact) {
        setArtifact(d.artifact);
        const ordered = orderedSlotsForFeaturePlanningUi(d.artifact);
        setActiveSlotId(ordered[0]?.slotId ?? "");
      }
      if (Array.isArray(d.messages)) {
        setMessages(d.messages);
      }
      setComposer("");
      pushNotice("대화를 초기화하고 전담 AI의 첫 메시지를 다시 받았습니다.");
      const { project: p } = await fetchProjectWithRetry(pid);
      setProject(p ?? null);
      if (p) hydrateFromProject(p);
    } catch {
      pushNotice("대화 초기화 중 오류가 발생했습니다.");
    } finally {
      setResetChatLoading(false);
    }
  }, [chatLoading, hydrateFromProject, initLoading, projectId, pushNotice, resetChatLoading, slotDigestLoading]);

  const sendMessage = useCallback(
    async (rawText: string) => {
      const t = rawText.trim();
      const pid = projectId.trim();
      const proj = projectRef.current;
      if (!proj || !isServiceFlowApprovedForFeaturePlanning(proj.requirementsStateJson)) {
        pushNotice(FEATURE_PLANNING_SERVICE_FLOW_INCOMPLETE_MESSAGE.trim());
        return;
      }
      if (!t || !pid || chatLoading || initLoading || resetChatLoading || slotDigestLoading) return;
      const tempId = newId("u_temp");
      const userBubble: WorkspaceChatMessage = { id: tempId, role: "user", text: t, at: isoNow() };
      setComposer("");
      setMessages((prev) => [...prev, userBubble]);
      setPlannerInputHint(null);
      setChatLoading(true);
      try {
        // TODO(service-design-harness): pass payload.serviceDesignStage and payload.mentionedAI into this stage API (shared composer phase).
        const res = await fetch("/api/features/planner-turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ projectId: pid, message: t }),
        });
        const json = (await res.json()) as ApiChatResponse;
        if (!json.success || !json.data) {
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          pushNotice(json.message ?? "AI 응답에 실패했습니다.");
          return;
        }
        const hint = json.data.plannerMeta?.nextQuestions?.map((q) => String(q ?? "").trim()).find(Boolean);
        setPlannerInputHint(hint && hint.length > 2 ? hint.slice(0, 200) : null);
        const { project: p } = await fetchProjectWithRetry(pid);
        setProject(p ?? null);
        if (p) hydrateFromProject(p);
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        pushNotice("채팅 요청 중 오류가 발생했습니다.");
      } finally {
        setChatLoading(false);
      }
    },
    [chatLoading, hydrateFromProject, initLoading, projectId, pushNotice, resetChatLoading, slotDigestLoading]
  );

  const send = useCallback(async () => {
    await sendMessage(composer);
  }, [composer, sendMessage]);

  const requestPlannerOrganize = useCallback(async () => {
    await sendMessage(
      "지금 [4]에 적힌 currentServiceStep만 기준으로, 빠진 사용자 기능이 있으면 후보 3~6개와 추천 0~2개를 제시하고 질문은 한 문장만 해 주세요. 다른 단계 기능은 제외해 주세요."
    );
  }, [sendMessage]);

  const planningAreaCount = artifact ? buildOrderedSlotsVisible(artifact).length : 0;
  const checklistProgress = useMemo(() => {
    if (!artifact?.planningChecklistV1) return null;
    return computeChecklistProgress(artifact.planningChecklistV1);
  }, [artifact]);
  const initLoadingHint = "AI 기능설계자가 서비스 흐름을 바탕으로 기능 정리 분석을 실행하고 있습니다.";
  const serviceFlowReady = project ? isServiceFlowApprovedForFeaturePlanning(project.requirementsStateJson) : false;

  const showStructuralRegenerateHint = Boolean(
    artifact?.slots?.length && !artifact.userEdited && detectLikelyProcessStepPlanningArtifact(artifact)
  );

  return {
    project,
    loadError,
    serviceFlowReady,
    initError,
    initErrorCode,
    retryInitialize,
    artifact,
    activeSlotId,
    setActiveSlotId,
    initLoading,
    initLoadingHint,
    chatLoading,
    resetChatLoading,
    slotDigestLoading,
    expandSlotPreviewInChat,
    chatLoadingHint: "응답을 작성하는 중입니다.",
    resetChatLoadingHint: "대화를 초기화하는 중입니다.",
    slotDigestLoadingHint: "선택한 영역 초안을 불러오는 중입니다.",
    slotsSaving,
    updateArtifactItem,
    onRegenerateSlots,
    resetChat,
    planningAreaCount,
    checklistProgress,
    requestPlannerOrganize,
    showStructuralRegenerateHint,
    composer,
    setComposer,
    plannerInputHint,
    loading: chatLoading,
    messages,
    notice,
    pushNotice,
    send,
  };
}
