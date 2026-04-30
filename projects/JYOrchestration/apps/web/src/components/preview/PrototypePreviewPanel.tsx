"use client";

import type { CSSProperties, KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildPrototypeChatMessages,
  isPrototypeDeployPhase,
  type PrototypeChatAction,
  type PrototypePrePlanGate,
} from "@/lib/prototype/buildPrototypeChatMessages";
import {
  PrototypeChatInput,
  PrototypeChatShell,
  PrototypeChatTimeline,
  type TimelineEphemeralAi,
} from "@/components/preview/prototypeChatTimeline";
import {
  buildDisplayedPlannerUserMessage,
  mapWorkUnitPlanStatusKo,
  workUnitProgressAllMerged,
} from "@/components/preview/prototypePreviewPanelHelpers";
import { PrototypePreviewDraggableShell } from "@/components/preview/PrototypePreviewDraggableShell";
import type {
  PrototypeWorkspaceActor as PrototypePreviewActor,
  PrototypeWorkspaceFlowStep as PrototypePreviewFlowStep,
  PrototypeWorkspaceIdeationAsset,
} from "@/components/preview/prototypeWorkspaceTypes";
import { fetchEnvironmentTestLast, postExecutionSetupValidate } from "@/components/project-spec/api";
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
import { PROTOTYPE_PLANNER_SYSTEM_PROMPT } from "@/lib/prototype/prototypePlannerLlm";
import { computePrototypeExecutionSlots } from "@/lib/prototype/prototypeExecutionSlots";
import { PROTOTYPE_TEMPLATES, type PrototypeTemplateType } from "@/lib/templates/prototypeTemplates";
import { isNextPublicDevWorkflowToolsEnabled } from "@/lib/env/devWorkflowTools";
import { PrototypeTemplateMockPreview } from "@/components/preview/PrototypeTemplateMockPreview";
import { projectExecutionSettingsHref } from "@/lib/project/projectExecutionSettingsHref";

type EnvBadge = "ok" | "needs" | "error" | "loading";
type EnvStatus = Readonly<{
  git: EnvBadge;
  github: EnvBadge;
  cursor: EnvBadge;
  connectionTest: EnvBadge;
  runnable: EnvBadge;
  message: string | null;
}>;

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

export function PrototypePreviewPanel({
  projectId,
  projectName,
  projectDescription,
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
  const [templatePreviewOpen, setTemplatePreviewOpen] = useState(false);
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
  // --- chat-led UX (transient, state-derived) ---
  const [chatInput, setChatInput] = useState("");
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [chatUserLog, setChatUserLog] = useState<Array<{ id: string; text: string; at: number }>>([]);
  const [ephemeralAiReplies, setEphemeralAiReplies] = useState<TimelineEphemeralAi[]>([]);
  /** 작업계획 API 호출 전: 생성 버튼 → 프롬프트/작업 시작 대기 */
  const [prePlanGate, setPrePlanGate] = useState<PrototypePrePlanGate>("idle");
  const prePlannerNotesRef = useRef("");
  // 채팅에서 템플릿을 “선택 완료”했다고 간주하는 로컬 플래그
  const [chatTemplateSelected, setChatTemplateSelected] = useState(false);
  const [wideLayout, setWideLayout] = useState(false);

  // 이전 세션에서 템플릿이 저장돼 있으면 채팅에서도 “선택됨”으로 간주
  useEffect(() => {
    if (record.selectedTemplate != null) setChatTemplateSelected(true);
  }, [record.selectedTemplate]);

  const refreshRecord = useCallback(() => {
    setRecord(loadPrototypeGenerationRecord(projectId));
  }, [projectId]);

  useEffect(() => {
    // Load browser sessionStorage after mount (prevents SSR/client divergence).
    refreshRecord();
  }, [refreshRecord]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") queueMicrotask(() => refreshRecord());
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshRecord]);

  const refreshLatestRun = useCallback(async () => {
    if (!projectId.trim()) return;
    setProtoBusy(true);
    try {
      const r = await fetchLatestPrototypeRun(projectId);
      if (r.success && r.data) {
        setLatestRun(r.data.run);
        setAutomationAvailable(r.data.automationAvailable);
        setAutomationBlockReason(r.data.automationBlockReason);
      }
    } finally {
      setProtoBusy(false);
    }
  }, [projectId]);

  useEffect(() => {
    const t = window.setTimeout(() => void refreshLatestRun(), 0);
    return () => window.clearTimeout(t);
  }, [refreshLatestRun]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 960px)");
    const apply = () => setWideLayout(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

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
    const raw = record.selectedTemplate;
    const normalized = raw && PROTOTYPE_TEMPLATES.some((t) => t.id === raw) ? (raw as PrototypeTemplateType) : null;
    if (normalized) setTemplateOverride(normalized);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on project switch
  }, [projectId]);

  const effectiveTemplate = templateOverride ?? analysis.recommendedTemplate;
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

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

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
          setLatestRun(res.data.run);
          setAutomationAvailable(res.data.automationAvailable);
          setAutomationBlockReason(res.data.automationBlockReason);
          showToast(res.data.message ?? "완료");
        } else {
          showToast(res.message ?? "실패");
        }
      } catch {
        showToast("요청 실패");
      } finally {
        setProtoBusy(false);
        void refreshLatestRun();
      }
    },
    [canRequestGeneration.designOk, projectId, effectiveTemplate, promptPackage, plannerContextPayload, refreshLatestRun],
  );

  const commitTemplateSelection = useCallback(
    (resolvedId: PrototypeTemplateType) => {
      const recommendedId = analysis.recommendedTemplate;
      if (resolvedId === recommendedId) {
        setTemplateOverride(null);
        savePrototypeGenerationRecord(projectId, { selectedTemplate: null });
      } else {
        setTemplateOverride(resolvedId);
        savePrototypeGenerationRecord(projectId, { selectedTemplate: resolvedId });
      }
      refreshRecord();
      setChatTemplateSelected(true);
      const label = PROTOTYPE_TEMPLATES.find((t) => t.id === resolvedId)?.nameKo ?? String(resolvedId);
      const now = Date.now();
      setChatUserLog((prev) => [...prev, { id: `user-tmpl-${now}-${Math.random()}`, text: `${label} 템플릿을 선택했습니다.`, at: now }]);
      setEphemeralAiReplies((prev) => [
        ...prev,
        {
          id: `ai-tmpl-${now}-${Math.random()}`,
          text: `${label} 템플릿이 선택되었습니다. 아이디어 구체화와 액터 및 서비스 흐름 산출물을 바탕으로 작업계획을 생성할 수 있습니다.`,
          at: now + 1,
        },
      ]);
      setPrePlanGate("need_create_click");
    },
    [analysis.recommendedTemplate, projectId, refreshRecord],
  );

  const onChatSelectTemplate = useCallback(
    (next: PrototypeTemplateType | null) => {
      const recommendedId = analysis.recommendedTemplate;
      const resolvedId = next ?? recommendedId;
      commitTemplateSelection(resolvedId);
    },
    [analysis.recommendedTemplate, commitTemplateSelection],
  );

  useEffect(() => {
    if (!chatTemplateSelected) {
      setPrePlanGate("idle");
      return;
    }
    if (latestRun?.id) {
      setPrePlanGate("idle");
      return;
    }
    setPrePlanGate((g) => (g === "await_work_start" ? g : "need_create_click"));
  }, [chatTemplateSelected, latestRun?.id]);

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

  const isPlannerRunning = useMemo(() => {
    const r = latestRun;
    if (!r) return false;
    return r.status === "PLANNER_ANALYZING" || r.plannerStatus === "RUNNING";
  }, [latestRun]);

  /** 전송·Enter: 플래너/파이프라인 작업 중에는 입력 비활성 (계획 확정 전 수정 요청만 허용) */
  const isMessageInputBlocked = useMemo(() => {
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
  }, [protoBusy, isPlannerRunning, latestRun]);

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
  const isCompleted = latestRun?.status === "PREVIEW_READY";
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
    () => `${PROTOTYPE_PLANNER_SYSTEM_PROMPT}\n\n${plannerUserMessagePreview}`,
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

  const recommendedTemplateNameKo = useMemo(() => {
    const id = analysis.recommendedTemplate;
    return PROTOTYPE_TEMPLATES.find((t) => t.id === id)?.nameKo ?? String(id);
  }, [analysis.recommendedTemplate]);

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
        recommendedTemplateNameKo,
        templateChipTemplates: [],
        recommendedTemplateId: analysis.recommendedTemplate,
        chatTemplateSelected,
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
      }),
    [
      envStatus.git,
      envStatus.github,
      envStatus.cursor,
      envStatus.connectionTest,
      canRequestGeneration.envOk,
      canRequestGeneration.designOk,
      envSettingsHref,
      recommendedTemplateNameKo,
      analysis.recommendedTemplate,
      chatTemplateSelected,
      prePlanGate,
      latestRun,
      awaitingExecutionConfirm,
      isPlannerRunning,
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
    ],
  );

  const onSendChatMessage = useCallback(async () => {
    const text = chatInput.trim();
    if (!text) return;
    if (isMessageInputBlocked) return;

    const now = Date.now();
    const wantsExecutionPlan =
      canRequestGeneration.envOk &&
      canRequestGeneration.designOk &&
      !isRunningState &&
      /^\s*(작업\s*계획\s*생성|작업계획생성|실행\s*계획\s*수립|실행계획\s*수립|실행계획수립|workunit|work\s*unit)\s*$/i.test(text);

    setChatUserLog((prev) => [...prev, { id: `user-${now}-${Math.random()}`, text, at: now }]);
    setChatInput("");

    if (wantsExecutionPlan) {
      if (!chatTemplateSelected) {
        setEphemeralAiReplies((prev) => [...prev, { id: `ai-${now}-need-tmpl`, text: "먼저 템플릿을 선택해 주세요.", at: now }]);
        return;
      }
      setPrePlanGate("await_work_start");
      return;
    }

    if (latestRun?.status === "PREVIEW_READY") {
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

    if (!chatTemplateSelected) {
      setEphemeralAiReplies((prev) => [
        ...prev,
        { id: `ai-${now}-need-tmpl`, text: "먼저 템플릿을 선택해 주세요.", at: now },
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
    chatTemplateSelected,
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
          onChatSelectTemplate(null);
          return;
        case "SELECT_TEMPLATE":
          if (a.templateId) onChatSelectTemplate(a.templateId as PrototypeTemplateType);
          return;
        case "CREATE_PLAN":
          if (protoBusy) return;
          setPrePlanGate("await_work_start");
          return;
        case "OPEN_PLANNER_PROMPT_IN_CHAT": {
          const body = plannerCombinedInputPreview.trim();
          const t = Date.now();
          setEphemeralAiReplies((prev) => [
            ...prev,
            {
              id: `ai-planner-prompt-${t}`,
              text: body.length ? `플래너 입력 프롬프트:\n\n${body}` : "표시할 플래너 프롬프트가 아직 없습니다.",
              at: t,
            },
          ]);
          return;
        }
        case "START_WORK_PLAN_GENERATION": {
          if (protoBusy) return;
          if (!canRequestGeneration.designOk) return;
          const extra = prePlannerNotesRef.current.trim();
          prePlannerNotesRef.current = "";
          const t = Date.now();
          setEphemeralAiReplies((prev) => [
            ...prev,
            { id: `ai-plan-start-${t}`, text: "작업계획 생성을 시작합니다.", at: t },
          ]);
          void runPlannerCreate(extra || undefined);
          return;
        }
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
          const u = previewUrl ?? latestRun?.previewUrl ?? "";
          if (u) window.open(u, "_blank", "noopener,noreferrer");
          return;
        }
        case "COPY_PREVIEW_URL": {
          const u = previewUrl ?? latestRun?.previewUrl ?? "";
          if (!u) return;
          void navigator.clipboard?.writeText(u).catch(() => {});
          showToast("URL을 복사했습니다.");
          return;
        }
        default:
          return;
      }
    },
    [
      envSettingsHref,
      onChatSelectTemplate,
      runPlannerCreate,
      plannerCombinedInputPreview,
      canRequestGeneration.designOk,
      protoBusy,
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

  const chatPlaceholder = useMemo(() => {
    if (isMessageInputBlocked) {
      return "AI기획자가 작업 중입니다. 잠시 기다려주세요.";
    }
    if (latestRun?.status === "PREVIEW_READY") {
      return "완료된 실행입니다. 새로 시작하려면 타임라인의 「처음부터 다시 생성」을 이용해 주세요.";
    }
    if (isRunningState) {
      return "실행 중에는 작업계획을 수정할 수 없습니다.";
    }
    if (latestRun?.id && latestRun.status === "WORK_UNITS_READY" && latestRun.workUnitsExecutionConfirmed !== true) {
      return "수정 요청을 입력한 뒤 전송하면 작업계획을 다시 만듭니다.";
    }
    if (chatTemplateSelected && (!latestRun?.id || (latestRun.workUnits?.length ?? 0) === 0)) {
      return "작업계획 생성 전 추가 지시가 있으면 입력 후 전송하세요.";
    }
    return "메시지를 입력하세요.";
  }, [
    chatTemplateSelected,
    isMessageInputBlocked,
    isRunningState,
    latestRun?.id,
    latestRun?.status,
    latestRun?.workUnits?.length,
    latestRun?.workUnitsExecutionConfirmed,
  ]);

  return (
    <div style={{ position: "relative" }}>
      {toast ? (
        <div style={toastStyle}>
          {toast}
        </div>
      ) : null}


      <div
        style={{
          marginTop: 0,
          display: "grid",
          gridTemplateColumns: wideLayout ? "minmax(280px, 340px) minmax(0, 1fr)" : "minmax(0, 1fr)",
          gap: 14,
          alignItems: "stretch",
          minWidth: 0,
        }}
      >
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            background: "#fff",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            minHeight: wideLayout ? "min(70vh, 720px)" : undefined,
            height: wideLayout ? "min(70vh, 720px)" : "auto",
          }}
        >
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              padding: 12,
              gap: 8,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 950, color: "#64748b" }}>참여 멤버</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: isRunningState || isPlannerRunning ? "#2563eb" : "#94a3b8",
                    flexShrink: 0,
                  }}
                />
                <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", flex: "1 1 auto", minWidth: 0 }}>
                  AI기획자 ·{" "}
                  {isPlannerRunning
                    ? "분석중"
                    : isRunningState
                      ? "작업중"
                      : latestRun?.status === "PREVIEW_READY"
                        ? "완료"
                        : latestRun?.status === "DEPLOY_FAILED" || latestRun?.status === "FAILED"
                          ? "오류"
                          : "대기"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: "#16a34a", flexShrink: 0 }} />
                <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", flex: "1 1 auto", minWidth: 0 }}>
                  사용자 · OWNER · 온라인
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              flexDirection: "column",
              padding: 12,
              gap: 8,
              overflow: "hidden",
            }}
          >
            <div style={{ fontSize: 11.5, fontWeight: 900, color: "#334155" }}>작업 목록</div>
            {sortedWorkUnitsForSidebar.length ? (
              <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {sortedWorkUnitsForSidebar.map((u) => (
                  <div
                    key={u.id}
                    style={{
                      border: "1px solid #e8eef4",
                      borderRadius: 10,
                      padding: "8px 10px",
                      background: "#fafbfc",
                    }}
                  >
                    <div style={{ fontSize: 12.5, fontWeight: 950, color: "#0f172a", lineHeight: 1.25 }}>
                      {u.order}. {u.title}
                    </div>
                    <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4, fontWeight: 750 }}>
                      {mapWorkUnitPlanStatusKo(u.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 750, lineHeight: 1.45, flex: 1 }}>
                작업계획이 생성되면 여기에 표시됩니다.
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            minWidth: 0,
            flex: "1 1 auto",
            minHeight: wideLayout ? "min(70vh, 720px)" : "min(48vh, 480px)",
          }}
        >
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              background: "#fff",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 900, color: "#334155" }}>템플릿</span>
            <select
              value={String(effectiveTemplate)}
              onChange={(e) => commitTemplateSelection(e.target.value as PrototypeTemplateType)}
              disabled={Boolean(latestRun?.id) || protoBusy || isPlannerRunning}
              style={{
                minWidth: 160,
                flex: "1 1 180px",
                maxWidth: 360,
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                padding: "8px 10px",
                fontSize: 13,
                fontWeight: 800,
                color: "#0f172a",
                background: "#fff",
              }}
            >
              {PROTOTYPE_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nameKo}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setTemplatePreviewOpen(true)} style={{ ...btn, fontSize: 12.5, fontWeight: 900 }}>
              템플릿 미리보기
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <PrototypeChatShell>
              <PrototypeChatTimeline
                derived={derivedChatMessages}
                userBubbles={chatUserLog}
                ephemeralAi={ephemeralAiReplies}
                onAction={handleChatIntent}
                cursorPromptResolver={(order) => sortedWorkUnitsForSidebar.find((x) => x.order === order) ?? null}
              />
              {isNextPublicDevWorkflowToolsEnabled() ? (
                <details style={{ fontSize: 11, color: "#475569", flexShrink: 0 }}>
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
              <PrototypeChatInput
                value={chatInput}
                onChange={setChatInput}
                onSend={() => void onSendChatMessage()}
                onKeyDown={onChatTextareaKeyDown}
                placeholder={chatPlaceholder}
                disabled={isMessageInputBlocked}
                inputRef={chatInputRef}
              />
            </PrototypeChatShell>
          </div>
        </div>
      </div>

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
