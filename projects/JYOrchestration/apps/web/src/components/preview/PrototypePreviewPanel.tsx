"use client";

import type { CSSProperties, KeyboardEvent } from "react";
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
  PROTOTYPE_INLINE_TEMPLATE_AI_VALUE,
  PrototypeChatInput,
  PrototypeChatTimeline,
  type PrototypeInlineTemplatePickerProps,
  type TimelineEphemeralAi,
} from "@/components/preview/prototypeChatTimeline";
import { buildDisplayedPlannerUserMessage, workUnitProgressAllMerged } from "@/components/preview/prototypePreviewPanelHelpers";
import { shouldLockInlineChatTemplateSelection } from "@/lib/prototype/prototypeRunUiHelpers";
import { PrototypePreviewDraggableShell } from "@/components/preview/PrototypePreviewDraggableShell";
import type {
  PrototypeWorkspaceActor as PrototypePreviewActor,
  PrototypeWorkspaceFlowStep as PrototypePreviewFlowStep,
  PrototypeWorkspaceIdeationAsset,
} from "@/components/preview/prototypeWorkspaceTypes";
import { fetchEnvironmentTestLast, postExecutionSetupValidate } from "@/components/project-spec/api";
import { patchSpecWorkspaceRequest } from "@/lib/project/specWorkspaceClient";
import { VIRTUAL_AI_PLANNER_ID } from "@/lib/project/requirementsRoomState";
import type { ComposerAtAtPickerItem } from "@/lib/composer/composerAtAtPicker";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";
import { buildCursorPrototypePromptPackage } from "@/lib/prototype/buildCursorPrototypePrompt";
import { analyzePrototypeContext } from "@/lib/prototype/prototypeContextAnalyzer";
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
import { projectExecutionSettingsHref } from "@/lib/project/projectExecutionSettingsHref";
import {
  mergeRequirementsStateJson,
  parseRequirementsStateJson,
  type PrototypeWorkspaceTimelineCardV1,
} from "@/lib/requirements/requirementsStateJson";
import { RequirementsChatHeaderRow } from "@/components/requirements/RequirementsChatHeaderRow";
import { RequirementsChatComposerFooter } from "@/components/requirements/RequirementsChatComposerFooter";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import { resolveEnabledCatalogKeysForScreen } from "@/lib/workspace-ai/workspaceScreenKeys";
import type { WorkspaceAiGraphMemberWire } from "@/lib/workspace-ai/workspaceAiGraphWire";
import { ChatWindowScreenLabelBottom, ChatWindowScreenLabelTop } from "@/components/workspace/ChatWindowScreenLabelBoundaries";
import { WorkspaceParticipantsModal } from "@/components/workspace/WorkspaceParticipantsModal";
import type { ParticipantOption } from "@/components/workspace/workspaceParticipantTypes";
import { buildWorkspaceAiParticipantOptions } from "@/lib/ai-member/platformAiMembers";
import { WorkspaceAiMemberAvatar } from "@/components/ai-member/WorkspaceAiMemberAvatar";
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

const prototypeComposerColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  minWidth: 0,
};

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

/** 요구사항 협업실과 동일: 단일 열 채팅 셸 */
const prototypeStageShell: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  height: "100%",
  overflow: "hidden",
  background: "#fff",
};

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
}: {
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly requirementsStateJson: unknown;
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
  /** postCreate 호출 직후~응답 전: 입력 잠금·진행 UI용 */
  const [plannerCreatePending, setPlannerCreatePending] = useState(false);
  const [plannerProgressStep, setPlannerProgressStep] = useState(1);
  const planProgressStartedAtRef = useRef(0);
  /** 작업계획 생성 중복 클릭 방지 — state와 달리 동기적으로 잠금 */
  const planRequestInFlightRef = useRef(false);
  // --- chat-led UX (transient, state-derived) ---
  const [chatInput, setChatInput] = useState("");
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [chatUserLog, setChatUserLog] = useState<Array<{ id: string; text: string; at: number }>>([]);
  const [ephemeralAiReplies, setEphemeralAiReplies] = useState<TimelineEphemeralAi[]>([]);
  /** DB에 저장하는 타임라인 카드(작업계획·WorkUnit 완료), 재실행 후에도 유지 */
  const [timelineCards, setTimelineCards] = useState<readonly PrototypeWorkspaceTimelineCardV1[]>([]);
  const lastTimelineSnapRef = useRef<string>("");
  /** 작업계획 API 호출 전: 생성 버튼 → 프롬프트/작업 시작 대기 */
  const [prePlanGate, setPrePlanGate] = useState<PrototypePrePlanGate>("idle");
  const prePlannerNotesRef = useRef("");
  /** [확정]까지 눌러야 true — 콤보만으로는 true가 되지 않음 */
  const [templateConfirmed, setTemplateConfirmed] = useState(false);
  /** 콤보에서의 선택(미확정 포함). AI 추천 행은 `PROTOTYPE_INLINE_TEMPLATE_AI_VALUE` */
  const [draftPickerValue, setDraftPickerValue] = useState<string>(PROTOTYPE_INLINE_TEMPLATE_AI_VALUE);
  const [protoMembersModalOpen, setProtoMembersModalOpen] = useState(false);
  const [workspaceAiGraph, setWorkspaceAiGraph] = useState<WorkspaceAiGraphMemberWire[] | null>(null);
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
    const dbChat = db.prototypeWorkspaceChatV1;
    const userFromDb = dbChat?.userLog?.length ? dbChat.userLog : null;
    const aiFromDb = dbChat?.aiLog?.length ? dbChat.aiLog : null;
    setChatUserLog(userFromDb ? [...userFromDb] : r.chatUserLog ? [...r.chatUserLog] : []);
    setEphemeralAiReplies(aiFromDb ? [...aiFromDb] : r.chatAiLog ? [...r.chatAiLog] : []);
    const tc = db.prototypeWorkspaceTimelineCardsV1;
    setTimelineCards(Array.isArray(tc) && tc.length ? [...tc] : []);
    lastTimelineSnapRef.current = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on project switch
  }, [projectId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      savePrototypeGenerationRecord(projectId, {
        chatUserLog: chatUserLog.slice(-200),
        chatAiLog: ephemeralAiReplies.slice(-200),
      });
    }, 250);
    return () => window.clearTimeout(t);
  }, [projectId, chatUserLog, ephemeralAiReplies]);

  const lastPersistedChatFingerprintRef = useRef<string>("");
  const persistChatToDb = useCallback(async () => {
    const pid = projectId.trim();
    if (!pid) return;
    const userLog = chatUserLog.slice(-200);
    const aiLog = ephemeralAiReplies.slice(-200);
    const tc = [...timelineCards].slice(-300);
    const fingerprint = JSON.stringify({
      u: userLog.map((x) => [x.id, x.at]),
      a: aiLog.map((x) => [x.id, x.at]),
      t: tc.map((c) => [c.id, c.at]),
    });
    if (fingerprint === lastPersistedChatFingerprintRef.current) return;
    lastPersistedChatFingerprintRef.current = fingerprint;

    const base = parseRequirementsStateJson(requirementsStateJson);
    const merged = mergeRequirementsStateJson(base, {
      prototypeWorkspaceChatV1: { userLog, aiLog },
      prototypeWorkspaceTimelineCardsV1: tc,
      lastSavedAt: new Date().toISOString(),
    });

    void patchSpecWorkspaceRequest(pid, { requirementsStateJson: merged }).catch(() => {});
  }, [projectId, chatUserLog, ephemeralAiReplies, timelineCards, requirementsStateJson]);

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
    });
  }, [effectiveAnalysis, projectName, projectDescription, actors, flowSteps, featureDraftTitles, actorName]);

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
    const envOk =
      envStatus.runnable === "ok" ||
      (envStatus.git === "ok" &&
        envStatus.github === "ok" &&
        envStatus.cursor === "ok" &&
        envStatus.connectionTest === "ok");
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

  /** 작업계획 경로는 토스트 대신 타임라인에 남는 한 줄(사라지지 않음) */
  const pushEphemeralPlannerNotice = useCallback((text: string) => {
    const t = Date.now();
    setEphemeralAiReplies((prev) => [...prev, { id: `planner-line-${t}`, text, at: t }]);
  }, []);

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
        pushEphemeralPlannerNotice("프로젝트 정보가 없어 작업계획 요청을 보낼 수 없습니다.");
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
            if (rr.success && rr.data?.run) setLatestRun(rr.data.run);
            return;
          }
          /** 서버가 메시지 없이 같은 run만 돌려준 경우(플래너 진행 중 중복 요청 등)는 타임라인 카드만 유지 */
          if (wuN === 0 && serverMsg) pushEphemeralPlannerNotice(serverMsg);
        } else {
          pushEphemeralPlannerNotice(res.message?.trim() || "작업계획 생성에 실패했습니다.");
        }
      } catch {
        pushEphemeralPlannerNotice("네트워크 오류로 작업계획 요청에 실패했습니다.");
      } finally {
        setProtoBusy(false);
        void refreshLatestRun();
      }
    },
    [canRequestGeneration.designOk, projectId, effectiveTemplate, promptPackage, plannerContextPayload, refreshLatestRun, pushEphemeralPlannerNotice],
  );

  /**
   * 동기 진입점: `async`로 두면 클릭 직후 첫 줄이 한 박자 늦게 실행되어 연타 시 API가 여러 번 나갈 수 있음.
   * ref·flushSync·pending은 이 함수 본문이 끝나기 전에 모두 반영됨.
   */
  const startWorkPlanGenerationFromChat = useCallback(() => {
    if (planRequestInFlightRef.current) return;
    if (protoBusy) return;
    if (!templateConfirmed) return;
    if (!canRequestGeneration.designOk) return;
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
  }, [protoBusy, templateConfirmed, canRequestGeneration.designOk, runPlannerCreate]);

  const confirmTemplate = useCallback(async () => {
    if (protoBusy) return;
    if (shouldLockInlineChatTemplateSelection(latestRun)) return;
    const resolvedId =
      draftPickerValue === PROTOTYPE_INLINE_TEMPLATE_AI_VALUE
        ? analysis.recommendedTemplate
        : (draftPickerValue as PrototypeTemplateType);
    const recommendedId = analysis.recommendedTemplate;

    /** 플래너 진행 중 템플릿 확정 시: 현재 실행을 재시작해 새 템플릿으로 작업계획을 다시 생성 */
    const planning = (latestRun?.status === "PLANNER_ANALYZING" || plannerCreatePending) && (latestRun?.workUnits?.length ?? 0) === 0;
    if (planning && latestRun?.id) {
      setProtoBusy(true);
      try {
        const r = await postPrototypeRunResume(latestRun.id, { projectId, mode: "restart" });
        if (r.success && r.data?.run) setLatestRun(r.data.run);
      } finally {
        setProtoBusy(false);
      }
    }

    if (resolvedId === recommendedId) {
      setTemplateOverride(null);
      savePrototypeGenerationRecord(projectId, { selectedTemplate: null, templateCommittedToPlan: true });
    } else {
      setTemplateOverride(resolvedId);
      savePrototypeGenerationRecord(projectId, { selectedTemplate: resolvedId, templateCommittedToPlan: true });
    }
    refreshRecord();
    setTemplateConfirmed(true);
    setPrePlanGate("need_create_click");
  }, [
    analysis.recommendedTemplate,
    draftPickerValue,
    latestRun,
    plannerCreatePending,
    projectId,
    protoBusy,
    refreshRecord,
  ]);

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
    if (!templateConfirmed) {
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
  }, [templateConfirmed, latestRun?.id, latestRun?.status, latestRun?.workUnits?.length]);

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
          if (res.success && res.data?.run) setLatestRun(res.data.run);
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
  ]);

  const loadEnv = useCallback(async () => {
    if (!projectId.trim()) return;
    try {
      const v = await postExecutionSetupValidate(projectId, { scope: "all" });
      const vData = v.res.ok && v.json.success ? v.json.data : null;
      const git: EnvBadge = vData?.git ?? "needs";
      const cursor: EnvBadge = vData?.cursor ?? "needs";
      const github: EnvBadge = vData?.githubOperableOk === true ? "ok" : "needs";
      let connectionTest: EnvBadge = "needs";
      try {
        const conn = await fetchEnvironmentTestLast(projectId);
        if (conn.res.ok && conn.json.success && conn.json.data?.last) {
          const last = conn.json.data.last;
          const wf = String(last.workflowStatus ?? "").trim().toLowerCase();
          const terminal = last.isTerminal === true;
          const failLine = String(last.envTestStage1FailureLine ?? "").trim();
          const failed =
            wf === EXECUTION_WORKFLOW.FAILED ||
            wf === EXECUTION_WORKFLOW.VERIFY_FAILED ||
            Boolean(failLine);
          const mode = last.connectionTestMergeMode ?? "auto";
          const ok =
            terminal &&
            !failed &&
            (wf === EXECUTION_WORKFLOW.MERGED || (wf === EXECUTION_WORKFLOW.PR_OPENED && mode === "skip"));
          connectionTest = ok ? "ok" : terminal && failed ? "error" : "needs";
        }
      } catch {
        connectionTest = "error";
      }
      const runnable: EnvBadge = vData
        ? vData.git === "ok" && vData.cursor === "ok" && vData.githubOperableOk === true && connectionTest === "ok"
          ? "ok"
          : "needs"
        : "needs";
      const msg = vData?.messages?.[0] ? vData.messages[0] : null;
      setEnvStatus({ git, cursor, github, connectionTest, runnable, message: msg });
    } catch {
      setEnvStatus({
        git: "error",
        github: "error",
        cursor: "error",
        connectionTest: "error",
        runnable: "error",
        message: "환경 확인에 실패했습니다.",
      });
    }
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
        if (r.success && r.data?.run) setLatestRun(r.data.run);
        if (r.message) showToast(r.message);
        await postPrototypeRunRefresh(rid, { projectId }).then((x) => {
          if (x.success && x.data?.run) setLatestRun(x.data.run);
        });
      } finally {
        setProtoBusy(false);
        void refreshLatestRun();
      }
    })();
  }, [latestRun?.id, projectId, refreshLatestRun]);

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

  const derivedChatMessages = useMemo(
    () =>
      buildPrototypeChatMessages({
        env: {
          git: envStatus.git,
          github: envStatus.github,
          cursor: envStatus.cursor,
          connectionTest: envStatus.connectionTest,
        },
        canRequestGenerationEnvOk: canRequestGeneration.envOk,
        canRequestGenerationDesignOk: canRequestGeneration.designOk,
        envSettingsHref,
        templateChipTemplates: [],
        recommendedTemplateId: analysis.recommendedTemplate,
        templateConfirmed,
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
      envStatus.git,
      envStatus.github,
      envStatus.cursor,
      envStatus.connectionTest,
      canRequestGeneration.envOk,
      canRequestGeneration.designOk,
      envSettingsHref,
      analysis.recommendedTemplate,
      templateConfirmed,
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

  const onSendChatMessage = useCallback(async () => {
    const text = chatInput.trim();
    if (!text) return;
    if (isMessageInputBlocked) return;

    const now = Date.now();
    const wantsExecutionPlan =
      canRequestGeneration.envOk &&
      canRequestGeneration.designOk &&
      !isRunningState &&
      /^\s*(작업\s*계획\s*생성|작업계획생성|작업\s*계획\s*수립|작업계획수립|실행\s*계획\s*수립|실행계획\s*수립|실행계획수립|workunit|work\s*unit)\s*$/i.test(
        text,
      );

    setChatUserLog((prev) => [...prev, { id: `user-${now}-${Math.random()}`, text, at: now }]);
    setChatInput("");

    if (wantsExecutionPlan) {
      if (!templateConfirmed) {
        setEphemeralAiReplies((prev) => [
          ...prev,
          {
            id: `ai-${now}-need-tmpl`,
            text: canRequestGeneration.envOk
              ? "타임라인의 「템플릿 선택」말풍선에서 유형을 고른 뒤 [확정]을 눌러 주세요."
              : "먼저 실행 환경 점검을 완료해 주세요.",
            at: now,
          },
        ]);
        return;
      }
      startWorkPlanGenerationFromChat();
      return;
    }

    if (isDraftGenerationComplete) {
      setEphemeralAiReplies((prev) => [
        ...prev,
        {
          id: `ai-${now}-done-hint`,
          text: "새 요청은 「처음부터 다시 생성」으로 진행해 주세요. 타임라인의 버튼을 사용하거나 실행 설정에서 다시 시작할 수 있습니다.",
          at: now,
        },
      ]);
      return;
    }

    if (isRunningState) {
      setEphemeralAiReplies((prev) => [
        ...prev,
        {
          id: `ai-${now}-run-guard`,
          text: "실행 중에는 작업계획을 수정할 수 없습니다. 중단 후 재계획할 수 있습니다.",
          at: now,
        },
      ]);
      return;
    }

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
      return;
    }

    if (!templateConfirmed) {
      setEphemeralAiReplies((prev) => [
        ...prev,
        {
          id: `ai-${now}-need-tmpl`,
          text: canRequestGeneration.envOk
            ? "타임라인의 「템플릿 선택」말풍선에서 유형을 고른 뒤 [확정]을 눌러 주세요."
            : "먼저 실행 환경 점검을 완료해 주세요.",
          at: now,
        },
      ]);
      return;
    }

    if (!run?.id) {
      const cur = prePlannerNotesRef.current.trim();
      prePlannerNotesRef.current = cur ? `${cur}\n\n${text}` : text;
      return;
    }

    showToast("지금 단계에서는 입력을 처리할 수 없습니다. 상태를 확인해 주세요.");
  }, [
    chatInput,
    isMessageInputBlocked,
    isRunningState,
    latestRun,
    projectId,
    canRequestGeneration.envOk,
    canRequestGeneration.designOk,
    plannerContextPayload,
    refreshLatestRun,
    templateConfirmed,
    startWorkPlanGenerationFromChat,
    isDraftGenerationComplete,
  ]);

  const onChatTextareaKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "Enter") return;
      if (e.nativeEvent.isComposing) return;
      if (e.shiftKey) return;
      e.preventDefault();
      if (isMessageInputBlocked || !chatInput.trim()) return;
      void onSendChatMessage();
    },
    [chatInput, isMessageInputBlocked, onSendChatMessage],
  );

  const handleChatIntent = useCallback(
    (a: PrototypeChatAction) => {
      switch (a.intent) {
        case "OPEN_ENV_SETTINGS":
          window.location.assign(envSettingsHref);
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
          if (!templateConfirmed) return;
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
          if (u) window.open(u, "_blank", "noopener,noreferrer");
          return;
        }
        case "OPEN_PR_URL": {
          const ord = a.workUnitOrder;
          if (typeof ord !== "number") return;
          const wu = sortedWorkUnitsForSidebar.find((x) => x.order === ord);
          const u = wu?.prUrl?.trim();
          if (u) window.open(u, "_blank", "noopener,noreferrer");
          return;
        }
        case "OPEN_PREVIEW": {
          const u = previewUrl ?? latestRun?.previewUrl ?? latestRun?.suggestedPreviewUrl ?? "";
          if (u) window.open(u, "_blank", "noopener,noreferrer");
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
      templateConfirmed,
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
      templateConfirmed &&
      (!latestRun?.id || (latestRun.workUnits?.length ?? 0) === 0) &&
      !isWorkPlanPlanningUi
    ) {
      return "작업계획 생성 전 추가 지시가 있으면 입력 후 전송하세요.";
    }
    return "메시지를 입력하세요.";
  }, [
    prototypeAiTitle,
    templateConfirmed,
    isWorkPlanPlanningUi,
    isMessageInputBlocked,
    isRunningState,
    latestRun?.id,
    latestRun?.status,
    latestRun?.workUnits?.length,
    latestRun?.workUnitsExecutionConfirmed,
    isDraftGenerationComplete,
  ]);

  const chatInlineTemplatePicker = useMemo((): PrototypeInlineTemplatePickerProps | null => {
    if (!canRequestGeneration.envOk) return null;
    if (shouldLockInlineChatTemplateSelection(latestRun)) return null;
    const frozen = shouldLockInlineChatTemplateSelection(latestRun) || protoBusy;
    const snapshot = templateOverride === null ? PROTOTYPE_INLINE_TEMPLATE_AI_VALUE : templateOverride;
    const confirmDisabled = templateConfirmed && draftPickerValue === snapshot;
    return {
      value: draftPickerValue,
      recommendedTemplateId: analysis.recommendedTemplate,
      onChange: (id: string) => {
        setDraftPickerValue(id);
        setTemplateConfirmed((c) => {
          if (c) savePrototypeGenerationRecord(projectId, { templateCommittedToPlan: false });
          return false;
        });
      },
      onPreview: () => setTemplatePreviewOpen(true),
      onConfirm: () => void confirmTemplate(),
      confirmDisabled,
      disabled: frozen,
    };
  }, [
    canRequestGeneration.envOk,
    latestRun,
    protoBusy,
    templateOverride,
    templateConfirmed,
    draftPickerValue,
    analysis.recommendedTemplate,
    projectId,
    confirmTemplate,
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
    const platformAi = buildWorkspaceAiParticipantOptions({
      currentMemberIds: prototypeScreenCatalogIds?.length ? [...prototypeScreenCatalogIds] : ["prototype_build"],
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
    prototypeScreenCatalogIds,
  ]);

  const prototypeHeaderPill = useMemo(() => {
    const run = latestRun;
    if (!run) {
      return { left: "프로토타입 생성", right: null as string | null };
    }
    const total = run.totalWorkUnits > 0 ? run.totalWorkUnits : run.workUnits.length;
    if (!total) {
      if (run.status === "PLANNER_ANALYZING") return { left: "작업계획", right: "생성 중" };
      return { left: "프로토타입 생성", right: "준비" };
    }
    const done = run.workUnits.filter((u) => u.status === "MERGED" || u.status === "SKIPPED").length;
    const pct = Math.min(100, Math.round((done / total) * 100));
    return { left: `프로토타입 작업 ${pct}%`, right: `${done}/${total}` };
  }, [latestRun]);

  return (
    <div
      className="jyo-prototype-generation-root"
      style={{
        position: "relative",
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
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

      <div className="jyo-prototype-stage-shell" style={{ ...prototypeStageShell, height: "100%" }}>
        <div
          data-testid="prototype-generation-chat-panel"
          className="chat-viewport"
          style={{
            display: "flex",
            flexDirection: "column",
            flex: "1 1 auto",
            height: "100%",
            minHeight: 0,
            minWidth: 280,
            maxWidth: "100%",
            overflow: "hidden",
          }}
          role="region"
          aria-label="프로토타입 생성 채팅"
        >
          <div className="chat-header">
            <ChatWindowScreenLabelTop />
          <RequirementsChatHeaderRow
            memberControls={{
              count: prototypeModalParticipants.length,
              onOpen: () => setProtoMembersModalOpen(true),
            }}
            leading={
              <div style={{ position: "relative", minWidth: 0 }}>
                <div
                  role="status"
                  aria-live="polite"
                  title="현재 진행 상태"
                  style={{
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    borderRadius: 999,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 900,
                    color: "#0f172a",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    maxWidth: "min(100%, 420px)",
                  }}
                >
                  <WorkspaceAiMemberAvatar memberId="prototype_build" size={22} />
                  <span style={{ whiteSpace: "nowrap" }}>{prototypeHeaderPill.left}</span>
                  {prototypeHeaderPill.right ? (
                    <>
                      <span style={{ color: "#94a3b8", fontWeight: 900 }}>·</span>
                      <span style={{ whiteSpace: "nowrap", color: "#334155" }}>{prototypeHeaderPill.right}</span>
                    </>
                  ) : null}
                </div>
              </div>
            }
          />
          </div>

              <div
                className="chat-messages"
                style={{
                  position: "relative",
                  padding: "18px 18px 12px",
                  background: "linear-gradient(180deg, #f1f5f9 0%, #eef2f7 50%, #f8fafc 100%)",
                }}
              >
                <div style={{ maxWidth: 720, margin: "0 auto", width: "100%", minWidth: 0 }}>
                  <PrototypeChatTimeline
                    derived={mergedChatMessages}
                    userBubbles={chatUserLog}
                    ephemeralAi={ephemeralAiReplies}
                    onAction={handleChatIntent}
                    cursorPromptResolver={(order) => sortedWorkUnitsForSidebar.find((x) => x.order === order) ?? null}
                    timelineInScrollParent
                    templatePicker={chatInlineTemplatePicker}
                  />
                  {isNextPublicDevWorkflowToolsEnabled() ? (
                    <details style={{ fontSize: 11, color: "#475569", flexShrink: 0, marginTop: 12 }}>
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
              </div>

              <div className="chat-input">
                <ChatWindowScreenLabelBottom />
              <RequirementsChatComposerFooter>
                <div style={prototypeComposerColumnStyle}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 10,
                      borderRadius: 22,
                      border: "1px solid #e2e8f0",
                      background: "#fff",
                      boxShadow: "0 10px 40px -18px rgba(15, 23, 42, 0.18)",
                      padding: "8px 10px",
                    }}
                  >
                    <PrototypeChatInput
                      value={chatInput}
                      onChange={setChatInput}
                      onSend={() => void onSendChatMessage()}
                      onKeyDown={onChatTextareaKeyDown}
                      placeholder={chatPlaceholder}
                      disabled={isMessageInputBlocked}
                      inputRef={chatInputRef}
                      embedInComposer
                      targetPickerItems={prototypeComposerAtAtItems}
                    />
                  </div>
                </div>
              </RequirementsChatComposerFooter>
              </div>
        </div>
      </div>

      <WorkspaceParticipantsModal
        open={protoMembersModalOpen}
        onClose={() => setProtoMembersModalOpen(false)}
        participants={prototypeModalParticipants}
        showInvite={false}
        inviteDisabled
        onInviteClick={() => {}}
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
