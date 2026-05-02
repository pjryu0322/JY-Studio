"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchProjectById } from "@/components/project-spec/api";
import type { ParticipantOption } from "@/components/requirements/RequirementsParticipantBar";
import { RequirementsMemberInviteModal } from "@/components/requirements/RequirementsMemberInviteModal";
import { RequirementsMembersModal } from "@/components/requirements/RequirementsMembersModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  appendAiChatMessage,
  appendUserChatMessage,
  lastAiMessageText,
  mergeFeatureWorkspaceStagesWithFlow,
  newFeatureWorkspaceItemId,
  parseFeatureTitlesFromDraft,
  pickBalancedStageKey,
  plannerQuestionForStage,
  suggestPlannerHintFromGaps,
} from "@/lib/features/featureWorkspaceDefaults";
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
import { notifyAppFlowProjectContextRefresh } from "@/lib/workflow/appFlowModel";
import { FeaturePlannerPanel, type FeaturePlannerProgressSummary } from "./FeaturePlannerPanel";

type FeatureWorkspaceSaveState = "idle" | "saving" | "saved" | "error";

function isoNow(): string {
  return new Date().toISOString();
}

function actorLineFromFlow(flow: RequirementsServiceFlowV1 | null): string {
  if (!flow?.actors?.length) return "";
  return flow.actors
    .slice(0, 4)
    .map((a) => a.name)
    .filter(Boolean)
    .join(", ");
}

function heuristicAiReply(userLine: string, stageTitle: string): string {
  const clip = userLine.trim().slice(0, 600);
  return `「${stageTitle}」에 대한 답변으로 이해했습니다.\n\n${clip}\n\n기능으로 옮기려면 입력란에 줄 단위로 적은 뒤 + 메뉴의 「기능 반영」을 누르거나, AI가 제안한 목록이 있으면 그대로 반영할 수 있습니다.`;
}

function cycleSelectedStage(w: FeatureWorkspaceV1): FeatureWorkspaceV1 {
  if (w.stages.length <= 1) return w;
  const rawIdx = w.stages.findIndex((s) => s.stageKey === w.selectedStageKey);
  const idx = rawIdx < 0 ? 0 : rawIdx;
  const next = w.stages[(idx + 1) % w.stages.length]!;
  return { ...w, selectedStageKey: next.stageKey, updatedAt: isoNow() };
}

export function FeatureWorkspace({ projectId }: { readonly projectId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flow, setFlow] = useState<RequirementsServiceFlowV1 | null>(null);
  const [workspace, setWorkspace] = useState<FeatureWorkspaceV1 | null>(null);
  const [composer, setComposer] = useState("");
  const [saveState, setSaveState] = useState<FeatureWorkspaceSaveState>("idle");
  const [analyzing, setAnalyzing] = useState(false);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const stateJsonRef = useRef<RequirementsStateJson>({});
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
        // 서버에서 되돌린 state로 `setWorkspace` 하면 아래 autosave effect가 다시 PATCH를 예약해 무한 루프가 된다.
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

  /** 저장소에 워크스페이스가 없으면 승인 흐름으로 슬롯·초기 대화를 한 번 구성합니다(화면에는 슬롯 미표시). */
  useEffect(() => {
    if (loading) return;
    if (!projectId.trim()) return;
    if (workspace !== null) return;
    if (bootstrapRanRef.current) return;
    bootstrapRanRef.current = true;
    setAnalyzing(true);
    window.setTimeout(() => {
      let merged = mergeFeatureWorkspaceStagesWithFlow(null, flow);
      const stage = merged.stages.find((s) => s.stageKey === merged.selectedStageKey) ?? merged.stages[0];
      if (stage && merged.stages.length) {
        const line = actorLineFromFlow(flow);
        merged = appendAiChatMessage(merged, plannerQuestionForStage(stage.title, line));
      }
      setWorkspace(merged);
      setAnalyzing(false);
    }, 320);
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

  const onSendChat = useCallback(() => {
    const text = composer.trim();
    if (!text || !workspace) return;
    const stage =
      workspace.stages.find((s) => s.stageKey === workspace.selectedStageKey) ?? workspace.stages[0] ?? null;
    const stageTitle = stage?.title ?? "서비스 단계";
    const { next: afterUser } = appendUserChatMessage(workspace, text);
    const afterAi = appendAiChatMessage(afterUser, heuristicAiReply(text, stageTitle));
    setComposer("");
    setWorkspace(cycleSelectedStage(afterAi));
  }, [composer, workspace]);

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
      };
      w = {
        ...w,
        updatedAt: isoNow(),
        stages: w.stages.map((s) => (s.stageKey === key ? { ...s, features: [...s.features, item] } : s)),
      };
    }
    setWorkspace(appendAiChatMessage(w, `${useTitles.length}개의 기능을 서비스 흐름 단계(내부 슬롯)에 반영했습니다.`));
    setComposer("");
  }, [workspace, composer]);

  const onGapCheck = useCallback(() => {
    if (!workspace) return;
    const hint = suggestPlannerHintFromGaps(workspace.stages);
    const w = appendAiChatMessage({ ...workspace, plannerHint: hint, updatedAt: isoNow() }, hint);
    setWorkspace(w);
  }, [workspace]);

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
      {workspace ? (
        <FeaturePlannerPanel
          progressSummary={progressSummary}
          messages={workspace.chat}
          composerValue={composer}
          onComposerChange={setComposer}
          onSend={onSendChat}
          onApplyReflect={onApplyReflect}
          onGapCheck={onGapCheck}
          memberCount={participants.length}
          onOpenMembers={() => setMembersModalOpen(true)}
          busy={analyzing || saveState === "saving"}
          typingIndicator={analyzing}
          saveError={saveState === "error"}
        />
      ) : (
        <LoadingState label="워크스페이스 준비 중…" />
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
