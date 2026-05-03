"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchProjectById } from "@/components/project-spec/api";
import type { ParticipantOption } from "@/components/requirements/RequirementsParticipantBar";
import { RequirementsMemberInviteModal } from "@/components/requirements/RequirementsMemberInviteModal";
import { RequirementsMembersModal } from "@/components/requirements/RequirementsMembersModal";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LoadingState } from "@/components/ui/LoadingState";
import { useMediaQuery } from "@/components/ui/useMediaQuery";
import {
  addDraftFeatureToStage,
  appendAiChatMessage,
  appendUserChatMessage,
  applyFeatureAnalyzeResultToWorkspace,
  cycleFeatureItemPriority,
  cycleFeatureItemStatus,
  lastAiMessageText,
  mergeFeatureWorkspaceStagesWithFlow,
  newFeatureWorkspaceItemId,
  parseFeatureTitlesFromDraft,
  pickBalancedStageKey,
  popStagePlannerQuestion,
  removeFeatureItemFromWorkspace,
  patchFeatureItemInWorkspace,
  suggestPlannerHintFromGaps,
} from "@/lib/features/featureWorkspaceDefaults";
import type { FeatureAnalyzeStageWire } from "@/lib/features/featureWorkspaceOpenAI";
import { patchSpecWorkspaceRequest } from "@/lib/project/specWorkspaceClient";
import type { SpecWorkspaceProjectPatchResponseBody } from "@/lib/types/specWorkspaceProjectPatch";
import {
  mergeRequirementsStateJson,
  parseRequirementsStateJson,
  type FeatureWorkspaceItemV1,
  type FeatureWorkspaceV1,
  type RequirementsServiceFlowV1,
  type RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import {
  displayedAiOrchestrator,
  displayedAiStatusForStage,
  showInternalAgents,
  visibleStageFromRequirementsStage,
} from "@/lib/ai-member/visibleAiOrchestrator";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import type { MemberRow, SessionUser } from "@/lib/requirements/requirementsWorkspaceHelpers";
import { VIRTUAL_AI_PLANNER_ID } from "@/lib/project/requirementsRoomState";
import { appFlowStepHref } from "@/lib/workflow/flow-state";
import { notifyAppFlowProjectContextRefresh } from "@/lib/workflow/appFlowModel";
import { FeaturePlannerPanel, type FeaturePlannerProgressSummary } from "./FeaturePlannerPanel";
import { FeatureServiceContextColumn } from "./FeatureServiceContextColumn";
import { FeatureSlotBoard } from "./FeatureSlotBoard";

type FeatureWorkspaceSaveState = "idle" | "saving" | "saved" | "error";

function isoNow(): string {
  return new Date().toISOString();
}

function coerceAnalyzeStages(raw: unknown): FeatureAnalyzeStageWire[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  const arr = Array.isArray(o.stages) ? o.stages : [];
  const out: FeatureAnalyzeStageWire[] = [];
  for (const row of arr) {
    if (!row || typeof row !== "object") continue;
    const s = row as Record<string, unknown>;
    const stageKey = typeof s.stageKey === "string" ? s.stageKey.trim().slice(0, 128) : "";
    const title = typeof s.title === "string" ? s.title.trim().slice(0, 500) : "";
    if (!stageKey || !title) continue;
    const actorMappings = Array.isArray(s.actorMappings)
      ? s.actorMappings.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 48)
      : [];
    const questions = Array.isArray(s.questions)
      ? s.questions.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 24)
      : [];
    const sfRaw = Array.isArray(s.suggestedFeatures) ? s.suggestedFeatures : [];
    const suggestedFeatures: Array<{ title: string; detail?: string; priority?: string; reason?: string }> = [];
    for (const fr of sfRaw) {
      if (!fr || typeof fr !== "object") continue;
      const f = fr as Record<string, unknown>;
      const t = typeof f.title === "string" ? f.title.trim().slice(0, 500) : "";
      if (!t) continue;
      suggestedFeatures.push({
        title: t,
        detail: typeof f.detail === "string" ? f.detail.trim().slice(0, 8000) : undefined,
        priority: typeof f.priority === "string" ? f.priority.trim().slice(0, 32) : undefined,
        reason: typeof f.reason === "string" ? f.reason.trim().slice(0, 2000) : undefined,
      });
      if (suggestedFeatures.length >= 12) break;
    }
    out.push({
      stageKey,
      title,
      ...(actorMappings.length ? { actorMappings } : {}),
      ...(questions.length ? { questions } : {}),
      ...(suggestedFeatures.length ? { suggestedFeatures } : {}),
    });
  }
  return out;
}

export function FeatureWorkspace({ projectId }: { readonly projectId: string }) {
  const router = useRouter();
  const isDesktop = useMediaQuery("(min-width: 1100px)");
  const [mobileTab, setMobileTab] = useState<"evidence" | "slots" | "chat">("slots");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flow, setFlow] = useState<RequirementsServiceFlowV1 | null>(null);
  const [workspace, setWorkspace] = useState<FeatureWorkspaceV1 | null>(null);
  const [composer, setComposer] = useState("");
  const [saveState, setSaveState] = useState<FeatureWorkspaceSaveState>("idle");
  const [analyzing, setAnalyzing] = useState(false);
  const [llmBusy, setLlmBusy] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const stateJsonRef = useRef<RequirementsStateJson>({});
  const requirementsRawRef = useRef<unknown>(null);
  const skipNextAutosave = useRef(true);
  const workspaceRef = useRef<FeatureWorkspaceV1 | null>(null);
  workspaceRef.current = workspace;
  const bootstrapRanRef = useRef(false);

  const persistFeatureWorkspace = useCallback(
    async (next: FeatureWorkspaceV1 | null) => {
      const pid = projectId.trim();
      if (!pid) return;
      const ts = isoNow();
      const merged = mergeRequirementsStateJson(stateJsonRef.current, {
        featureWorkspaceV1: next,
        lastSavedAt: ts,
      });
      stateJsonRef.current = merged;
      setSaveState("saving");
      try {
        const { res, json: raw } = await patchSpecWorkspaceRequest(pid, { requirementsStateJson: merged });
        const json = raw as SpecWorkspaceProjectPatchResponseBody;
        if (!res.ok || !json.success || !json.data?.project) {
          setSaveState("error");
          return;
        }
        if (json.data.patchApplied === false) {
          setSaveState("error");
          return;
        }
        stateJsonRef.current = parseRequirementsStateJson(json.data.project.requirementsStateJson);
        const fw = stateJsonRef.current.featureWorkspaceV1 ?? null;
        skipNextAutosave.current = true;
        setWorkspace(fw && fw.version === 1 ? fw : null);
        notifyAppFlowProjectContextRefresh();
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    [projectId],
  );

  const reloadMembers = useCallback(async () => {
    const pid = projectId.trim();
    if (!pid) return;
    const res = await credentialsIncludeFetch(`/api/project/members?projectId=${encodeURIComponent(pid)}`);
    const json = (await res.json()) as { success?: boolean; data?: MemberRow[] };
    if (!res.ok || !json.success || !Array.isArray(json.data)) {
      setMembers([]);
      return;
    }
    setMembers(json.data);
  }, [projectId]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await credentialsIncludeFetch("/api/auth/me");
        const json = (await res.json()) as { success?: boolean; data?: SessionUser | null };
        if (res.ok && json.success && json.data) setSessionUser(json.data);
        else setSessionUser(null);
      } catch {
        setSessionUser(null);
      }
    })();
  }, []);

  useEffect(() => {
    void reloadMembers();
  }, [reloadMembers]);

  const aiMembers = useMemo(() => members.filter((m) => m.memberType === "AI"), [members]);
  const aiPlannerStatusLabel = useMemo(() => displayedAiStatusForStage("features"), []);

  const participants = useMemo((): ParticipantOption[] => {
    const list: ParticipantOption[] = [];
    const activeStage = "features";
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
          roleLabel: "AI",
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
        roleLabel: m.isOwner ? "소유자" : "전문가",
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

  const existingHumanUserIds = useMemo(
    () => new Set(members.filter((m) => m.memberType === "HUMAN" && m.userId).map((m) => m.userId as string)),
    [members],
  );

  useEffect(() => {
    bootstrapRanRef.current = false;
  }, [projectId]);

  useEffect(() => {
    if (!projectId.trim()) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const { project, errorMessage } = await fetchProjectById(projectId);
        if (cancelled) return;
        if (!project) {
          setError(errorMessage ?? "프로젝트를 불러오지 못했습니다.");
          return;
        }
        setProjectTitle(project.name?.trim() ?? "");
        setProjectDescription(project.description?.trim() ?? "");
        requirementsRawRef.current = project.requirementsStateJson ?? null;
        const parsed = parseRequirementsStateJson(project.requirementsStateJson);
        stateJsonRef.current = parsed;
        setFlow(parsed.serviceFlowV1 ?? null);
        const fw = parsed.featureWorkspaceV1 ?? null;
        setWorkspace(fw && fw.version === 1 ? fw : null);
        skipNextAutosave.current = true;
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (loading) return;
    if (!projectId.trim()) return;
    if (workspace !== null) return;
    if (bootstrapRanRef.current) return;
    bootstrapRanRef.current = true;
    setAnalyzing(true);
    window.setTimeout(() => {
      const merged = mergeFeatureWorkspaceStagesWithFlow(null, flow, { appendIntroChat: false });
      setWorkspace(merged);
      setAnalyzing(false);
    }, 240);
  }, [loading, workspace, flow, projectId]);

  useEffect(() => {
    if (!projectId.trim()) return;
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    if (workspace === null) return;
    const t = window.setTimeout(() => {
      void persistFeatureWorkspace(workspaceRef.current);
    }, 900);
    return () => window.clearTimeout(t);
  }, [workspace, projectId, persistFeatureWorkspace]);

  const runAutoAnalyze = useCallback(async () => {
    if (!workspace) return;
    const pid = projectId.trim();
    if (!pid) return;
    setLlmBusy(true);
    try {
      let actorWorkspaceV1: unknown = undefined;
      const raw = requirementsRawRef.current;
      if (raw && typeof raw === "object" && "actorWorkspaceV1" in raw) {
        actorWorkspaceV1 = (raw as Record<string, unknown>).actorWorkspaceV1;
      }
      const res = await credentialsIncludeFetch("/api/features/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: pid,
          projectTitle: projectTitle,
          projectDescription: projectDescription,
          actorWorkspaceV1,
          serviceFlowV1: flow,
          featureWorkspaceV1: workspace,
        }),
      });
      const json = (await res.json()) as { success?: boolean; data?: unknown; message?: string };
      if (!res.ok || !json.success) {
        const msg = json.message ?? "자동 분석에 실패했습니다.";
        setWorkspace((w) => (w ? appendAiChatMessage(w, msg) : w));
        return;
      }
      const stages = coerceAnalyzeStages(json.data);
      if (!stages.length) {
        setWorkspace((w) =>
          w
            ? appendAiChatMessage(
                w,
                "분석 결과가 비어 있습니다. 승인된 서비스 흐름 단계가 있는지 확인한 뒤 다시 시도해 주세요.",
              )
            : w,
        );
        return;
      }
      let next = applyFeatureAnalyzeResultToWorkspace(workspace, flow, stages);
      next = appendAiChatMessage(next, "자동 분석을 반영해 기능 후보와 확인 질문을 갱신했습니다.");
      setWorkspace(next);
    } finally {
      setLlmBusy(false);
    }
  }, [workspace, projectId, projectTitle, projectDescription, flow]);

  const onAiQuestion = useCallback(async () => {
    if (!workspace) return;
    const sk =
      workspace.selectedStageKey && workspace.stages.some((s) => s.stageKey === workspace.selectedStageKey)
        ? workspace.selectedStageKey
        : workspace.stages[0]?.stageKey ?? null;
    if (!sk) return;

    const popped = popStagePlannerQuestion(workspace, sk);
    if (popped.question) {
      setWorkspace(appendAiChatMessage(popped.next, popped.question));
      return;
    }

    const pid = projectId.trim();
    if (!pid) return;
    setLlmBusy(true);
    try {
      const res = await credentialsIncludeFetch("/api/features/planner-turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: pid,
          projectTitle,
          projectDescription,
          serviceFlowV1: flow,
          selectedStageKey: sk,
          workspace,
          userMessage: "현재 단계에서 기능 합의를 위해 가장 중요한 확인 질문 하나만 제시해 주세요.",
        }),
      });
      const json = (await res.json()) as { success?: boolean; data?: { text?: string }; message?: string };
      if (!res.ok || !json.success || !json.data?.text) {
        const msg = json.message ?? "AI 질문을 가져오지 못했습니다.";
        setWorkspace((w) => (w ? appendAiChatMessage(w, msg) : w));
        return;
      }
      setWorkspace((w) => (w ? appendAiChatMessage(w, json.data!.text!) : w));
    } finally {
      setLlmBusy(false);
    }
  }, [workspace, projectId, projectTitle, projectDescription, flow]);

  const onSendChat = useCallback(async () => {
    const text = composer.trim();
    if (!text || !workspace) return;
    const { next: afterUser } = appendUserChatMessage(workspace, text);
    setComposer("");
    setWorkspace(afterUser);

    const pid = projectId.trim();
    if (!pid) return;
    setLlmBusy(true);
    try {
      const sk =
        afterUser.selectedStageKey && afterUser.stages.some((s) => s.stageKey === afterUser.selectedStageKey)
          ? afterUser.selectedStageKey
          : afterUser.stages[0]?.stageKey ?? null;
      const res = await credentialsIncludeFetch("/api/features/planner-turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: pid,
          projectTitle,
          projectDescription,
          serviceFlowV1: flow,
          selectedStageKey: sk,
          workspace: afterUser,
          userMessage: text,
        }),
      });
      const json = (await res.json()) as { success?: boolean; data?: { text?: string }; message?: string };
      if (!res.ok || !json.success || !json.data?.text) {
        const msg = json.message ?? "AI 응답을 가져오지 못했습니다. 네트워크·API 키를 확인해 주세요.";
        setWorkspace((w) => (w ? appendAiChatMessage(w, msg) : w));
        return;
      }
      setWorkspace((w) => (w ? appendAiChatMessage(w, json.data!.text!) : w));
    } finally {
      setLlmBusy(false);
    }
  }, [composer, workspace, projectId, projectTitle, projectDescription, flow]);

  const onApplyReflect = useCallback(() => {
    if (!workspace) return;
    const fromComposer = parseFeatureTitlesFromDraft(composer.trim());
    const fromHint = parseFeatureTitlesFromDraft(workspace.plannerHint ?? "");
    const fromAi = parseFeatureTitlesFromDraft(lastAiMessageText(workspace.chat));
    const useTitles = fromComposer.length ? fromComposer : fromHint.length ? fromHint : fromAi;
    if (!useTitles.length) return;
    let w = workspace;
    for (const title of useTitles) {
      const key = pickBalancedStageKey(w.stages);
      if (!key) break;
      const stage = w.stages.find((s) => s.stageKey === key);
      const nextOrder = stage?.features.length ? Math.max(...stage.features.map((f) => f.order)) + 1 : 0;
      const item: FeatureWorkspaceItemV1 = {
        id: newFeatureWorkspaceItemId(),
        title: title.slice(0, 500),
        priority: 2,
        order: nextOrder,
        status: "DRAFT",
      };
      w = {
        ...w,
        updatedAt: isoNow(),
        stages: w.stages.map((s) => (s.stageKey === key ? { ...s, features: [...s.features, item] } : s)),
      };
    }
    setWorkspace(appendAiChatMessage(w, `${useTitles.length}개의 기능 초안을 반영했습니다.`));
    setComposer("");
  }, [workspace, composer]);

  const onGapCheck = useCallback(() => {
    if (!workspace) return;
    const hint = suggestPlannerHintFromGaps(workspace.stages);
    const w = appendAiChatMessage({ ...workspace, plannerHint: hint, updatedAt: isoNow() }, hint);
    setWorkspace(w);
  }, [workspace]);

  const onSaveDraftNow = useCallback(async () => {
    if (!workspace) return;
    await persistFeatureWorkspace(workspace);
  }, [workspace, persistFeatureWorkspace]);

  const onNextStep = useCallback(() => {
    const pid = projectId.trim();
    router.push(appFlowStepHref("tasks", pid || null));
  }, [router, projectId]);

  const onSelectStage = useCallback((key: string) => {
    setWorkspace((w) => (w ? { ...w, selectedStageKey: key, updatedAt: isoNow() } : w));
  }, []);

  const onPatchItem = useCallback((stageKey: string, itemId: string, title: string, detail: string) => {
    setWorkspace((w) => (w ? patchFeatureItemInWorkspace(w, stageKey, itemId, { title, detail }) : w));
  }, []);

  const onRemoveItem = useCallback((stageKey: string, itemId: string) => {
    setWorkspace((w) => (w ? removeFeatureItemFromWorkspace(w, stageKey, itemId) : w));
  }, []);

  const onAddItem = useCallback((stageKey: string) => {
    setWorkspace((w) => (w ? addDraftFeatureToStage(w, stageKey, "새 기능") : w));
  }, []);

  const onCycleStatus = useCallback((stageKey: string, itemId: string) => {
    setWorkspace((w) => (w ? cycleFeatureItemStatus(w, stageKey, itemId) : w));
  }, []);

  const onCyclePriority = useCallback((stageKey: string, itemId: string) => {
    setWorkspace((w) => (w ? cycleFeatureItemPriority(w, stageKey, itemId) : w));
  }, []);

  const shell: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
    flex: 1,
    boxSizing: "border-box",
  };

  const progressSummary = useMemo((): FeaturePlannerProgressSummary | null => {
    if (!workspace?.stages?.length) {
      return { pct: 0, filledStages: 0, totalStages: 0, featureCount: 0, gapStageCount: 0 };
    }
    const totalStages = workspace.stages.length;
    const filledStages = workspace.stages.filter((s) => s.features.length > 0).length;
    const gapStageCount = workspace.stages.filter((s) => s.features.length === 0).length;
    const featureCount = workspace.stages.reduce((n, s) => n + s.features.length, 0);
    const pct = totalStages > 0 ? Math.round((filledStages / totalStages) * 100) : 0;
    return { pct, filledStages, totalStages, featureCount, gapStageCount };
  }, [workspace]);

  const toolbar = (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
        padding: "0 0 10px",
        flexShrink: 0,
      }}
    >
      <Button size="sm" variant="primary" type="button" loading={llmBusy} onClick={() => void runAutoAnalyze()}>
        자동 분석
      </Button>
      <Button size="sm" variant="secondary" type="button" loading={llmBusy} onClick={() => void onAiQuestion()}>
        AI 질문 받기
      </Button>
      <Button size="sm" variant="secondary" type="button" loading={saveState === "saving"} onClick={() => void onSaveDraftNow()}>
        초안 저장
      </Button>
      <Button size="sm" variant="secondary" type="button" onClick={onNextStep}>
        다음 단계
      </Button>
      {saveState === "saved" ? (
        <span style={{ fontSize: 11, fontWeight: 700, color: "#15803d" }}>저장됨</span>
      ) : saveState === "error" ? (
        <span style={{ fontSize: 11, fontWeight: 700, color: "#b91c1c" }}>저장 오류</span>
      ) : null}
    </div>
  );

  const chatPanel = workspace ? (
    <FeaturePlannerPanel
      progressSummary={progressSummary}
      messages={workspace.chat}
      composerValue={composer}
      onComposerChange={setComposer}
      onSend={() => void onSendChat()}
      onApplyReflect={onApplyReflect}
      onGapCheck={onGapCheck}
      memberCount={participants.length}
      onOpenMembers={() => setMembersModalOpen(true)}
      busy={analyzing || saveState === "saving" || llmBusy}
      typingIndicator={llmBusy}
      saveError={saveState === "error"}
      embedded={isDesktop}
    />
  ) : null;

  const slotBoard = workspace ? (
    <FeatureSlotBoard
      stages={workspace.stages}
      selectedStageKey={workspace.selectedStageKey ?? workspace.stages[0]?.stageKey ?? null}
      onSelectStage={onSelectStage}
      onPatchItem={onPatchItem}
      onRemoveItem={onRemoveItem}
      onAddItem={onAddItem}
      onCycleStatus={onCycleStatus}
      onCyclePriority={onCyclePriority}
    />
  ) : null;

  if (!projectId.trim()) {
    return <EmptyState title="프로젝트가 없습니다" description="URL에 ?projectId= 를 지정해 주세요." />;
  }

  if (loading) {
    return <LoadingState label="불러오는 중…" />;
  }

  if (error) {
    return <InlineAlert variant="danger">{error}</InlineAlert>;
  }

  return (
    <div style={{ ...shell, padding: "0 14px 14px", boxSizing: "border-box" }}>
      {toolbar}

      {isDesktop ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(200px, 0.9fr) minmax(280px, 1.4fr) minmax(300px, 1.2fr)",
            gap: 12,
            flex: 1,
            minHeight: 0,
            alignItems: "stretch",
          }}
        >
          <div style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
            <FeatureServiceContextColumn flow={flow} />
          </div>
          <div style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>{slotBoard}</div>
          <div style={{ minHeight: 0, display: "flex", flexDirection: "column", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
            {chatPanel}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {(
              [
                { id: "evidence" as const, label: "근거" },
                { id: "slots" as const, label: "기능슬롯" },
                { id: "chat" as const, label: "협의" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setMobileTab(t.id)}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  border: mobileTab === t.id ? "1px solid #0f766e" : "1px solid #e2e8f0",
                  background: mobileTab === t.id ? "#ecfdf5" : "#fff",
                  fontWeight: 900,
                  fontSize: 12,
                  padding: "8px 6px",
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {mobileTab === "evidence" ? (
              <FeatureServiceContextColumn flow={flow} />
            ) : mobileTab === "slots" ? (
              slotBoard
            ) : (
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
                {chatPanel}
              </div>
            )}
          </div>
        </div>
      )}

      <RequirementsMemberInviteModal
        open={inviteOpen && Boolean(projectId.trim())}
        projectId={projectId.trim()}
        onClose={() => setInviteOpen(false)}
        onInvited={() => void reloadMembers()}
        existingHumanUserIds={existingHumanUserIds}
      />

      <RequirementsMembersModal
        open={membersModalOpen}
        onClose={() => setMembersModalOpen(false)}
        participants={participants}
        showInvite={Boolean(projectId.trim())}
        inviteDisabled={!projectId.trim()}
        onInviteClick={() => setInviteOpen(true)}
      />
    </div>
  );
}
