"use client";

import type { CSSProperties, KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CurrentWorkUnitPanel,
  DeploymentStatusPanel,
  FailureStateCard,
  WorkUnitPlanCard,
  type WorkUnitPlanStats,
} from "@/components/preview/prototypePreviewPanelCards";
import {
  buildDisplayedPlannerUserMessage,
  mapWorkUnitPlanStatusKo,
  resolveActiveWorkUnitForPanel,
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

function planTierKo(level: string): string {
  const u = level.trim().toLowerCase();
  if (u === "low") return "낮음";
  if (u === "high") return "높음";
  return "보통";
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
  const [plannerFeedback, setPlannerFeedback] = useState("");
  // --- chat-led UX (transient, state-derived) ---
  const [chatInput, setChatInput] = useState("");
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [chatUserLog, setChatUserLog] = useState<Array<{ id: string; text: string; at: number }>>([]);
  const [chatAiLog, setChatAiLog] = useState<Array<{ id: string; text: string; at: number }>>([]);
  const [executionPlanConfirmed, setExecutionPlanConfirmed] = useState(false);
  const [pendingChatFeedback, setPendingChatFeedback] = useState<string | null>(null);
  const [pendingChatAppliedRunId, setPendingChatAppliedRunId] = useState<string | null>(null);
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

  const activeWorkUnitForChat = useMemo(() => resolveActiveWorkUnitForPanel(latestRun), [latestRun]);

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

  const onRequestAiWorkPlanOnly = useCallback(async () => {
    if (!canRequestGeneration.designOk) return;
    setProtoBusy(true);
    try {
      const res = await postCreatePrototypeRun({
        projectId,
        selectedTemplate: effectiveTemplate,
        promptSnapshot: promptPackage.slice(0, 50_000),
        startCursorAgent: false,
        plannerContext: plannerContextPayload,
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
  }, [
    canRequestGeneration.designOk,
    projectId,
    effectiveTemplate,
    promptPackage,
    plannerContextPayload,
    refreshLatestRun,
  ]);

  const requestExecutionPlan = useCallback(async () => {
    if (executionPlanConfirmed) return;
    if (protoBusy) return;
    if (!canRequestGeneration.designOk) {
      const aiNow = Date.now();
      setChatAiLog((prev) => [
        ...prev,
        {
          id: `ai-${aiNow}-${Math.random()}`,
          text: "작업계획을 만들기 전에 설계 입력(아이디어 구체화, 액터·서비스 흐름, 단계 담당)을 조금 더 보완해 주세요.",
          at: aiNow,
        },
      ]);
      return;
    }

    setExecutionPlanConfirmed(true);
    const aiNow = Date.now();
    setChatAiLog((prev) => [
      ...prev,
      { id: `ai-${aiNow}-${Math.random()}`, text: "좋습니다. 기획 산출물을 바탕으로 AI 작업목록(WorkUnit)을 생성하겠습니다.", at: aiNow },
    ]);
    void onRequestAiWorkPlanOnly();
  }, [executionPlanConfirmed, protoBusy, canRequestGeneration.designOk, onRequestAiWorkPlanOnly]);

  const onChatSelectTemplate = useCallback(
    (next: PrototypeTemplateType | null) => {
      const now = Date.now();
      const recommendedId = analysis.recommendedTemplate;
      const resolvedId = next ?? recommendedId;

      const tmpl = PROTOTYPE_TEMPLATES.find((t) => t.id === resolvedId);
      const label = tmpl?.nameKo ?? String(resolvedId);

      // 추천은 UI에서 “추천 모드”로 취급하기 위해 templateOverride를 null로 둡니다.
      if (next == null) {
        setTemplateOverride(null);
        savePrototypeGenerationRecord(projectId, { selectedTemplate: null });
      } else {
        setTemplateOverride(next);
        savePrototypeGenerationRecord(projectId, { selectedTemplate: next });
      }
      refreshRecord();

      setChatTemplateSelected(true);

      setChatUserLog((prev) => [...prev, { id: `user-tmpl-${now}-${Math.random()}`, text: `${label}으로 진행할게요.`, at: now }]);
      const aiAt = now + 1;
      setChatAiLog((prev) => [
        ...prev,
        { id: `ai-tmpl-${aiAt}-${Math.random()}`, text: `${label} 기준으로 작업계획을 수립하겠습니다.`, at: aiAt },
      ]);
    },
    [analysis.recommendedTemplate, projectId, refreshRecord],
  );

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

  const isRecommended = effectiveTemplate === analysis.recommendedTemplate && !templateOverride;

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

  const hasCompletedWorkPlan = useMemo(
    () => (latestRun?.workUnits?.length ?? 0) > 0,
    [latestRun?.workUnits],
  );

  const canStartFullPrototypePipeline = useMemo(
    () => canStartPrototypeAutomation && hasCompletedWorkPlan && !isPlannerRunning,
    [canStartPrototypeAutomation, hasCompletedWorkPlan, isPlannerRunning],
  );

  const isCancelled = latestRun?.status === "CANCELLED";
  const isFailed = latestRun?.status === "FAILED" || latestRun?.status === "DEPLOY_FAILED";
  const isCompleted = latestRun?.status === "PREVIEW_READY";

  const workUnitPlanStats = useMemo((): WorkUnitPlanStats => {
    const wu = latestRun?.workUnits ?? [];
    const total = wu.length;
    const mergedForBar = wu.filter((u) => u.status === "MERGED").length;
    const progressPercent = total ? Math.round((mergedForBar / total) * 100) : 0;
    const summaryMerged = wu.filter((u) => u.status === "MERGED" || u.status === "SKIPPED").length;
    const summaryRunning = wu.filter((u) =>
      [
        "CURSOR_RUNNING",
        "CURSOR_DONE",
        "GIT_PUSHED",
        "REVIEWING",
        "REVIEW_PASS",
        "PR_OPENED",
        "REVIEW_REWORK",
      ].includes(u.status),
    ).length;
    const summaryPending = wu.filter((u) => u.status === "PENDING").length;
    const summaryFailed = wu.filter((u) => u.status === "FAILED").length;
    return { total, mergedForBar, progressPercent, summaryMerged, summaryRunning, summaryPending, summaryFailed };
  }, [latestRun?.workUnits]);

  const plannerUserMessagePreview = useMemo(
    () =>
      buildDisplayedPlannerUserMessage({
        projectName: projectName.trim() || "프로젝트",
        plannerContext: plannerContextPayload,
        selectedTemplate: effectiveTemplate,
        promptSnapshot: promptPackage.slice(0, 50_000),
        userFeedback: plannerFeedback,
        latestRun,
      }),
    [projectName, plannerContextPayload, effectiveTemplate, promptPackage, plannerFeedback, latestRun],
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
          userFeedback: plannerFeedback.trim() || undefined,
          plannerContext: plannerContextPayload,
        });
        if (r.success && r.data?.run) setLatestRun(r.data.run);
        if (r.message) showToast(r.message);
        if (r.success) setPlannerFeedback("");
      } finally {
        setProtoBusy(false);
        void refreshLatestRun();
      }
    })();
  }, [latestRun?.id, plannerContextPayload, plannerFeedback, projectId, refreshLatestRun]);

  const regeneratePlanWithUserFeedback = useCallback(
    (feedback: string) => {
      const rid = latestRun?.id;
      if (!rid) return;
      const clean = String(feedback ?? "").trim();
      void (async () => {
        setProtoBusy(true);
        try {
          const r = await postPrototypeRegeneratePlan(rid, {
            projectId,
            userFeedback: clean || undefined,
            plannerContext: plannerContextPayload,
          });
          if (r.success && r.data?.run) setLatestRun(r.data.run);
          if (r.message) showToast(r.message);
          if (r.success) setPlannerFeedback("");
        } finally {
          setProtoBusy(false);
          void refreshLatestRun();
        }
      })();
    },
    [latestRun?.id, plannerContextPayload, projectId, refreshLatestRun],
  );

  useEffect(() => {
    if (!pendingChatFeedback) return;
    if (!latestRun?.id) return;
    if (latestRun.status !== "WORK_UNITS_READY") return;
    if (latestRun.workUnitsExecutionConfirmed === true) return;
    if (pendingChatAppliedRunId === latestRun.id) return;

    const runId = latestRun.id;
    const feedback = pendingChatFeedback;
    setPendingChatAppliedRunId(runId);

    void (async () => {
      setProtoBusy(true);
      try {
        const r = await postPrototypeRegeneratePlan(runId, {
          projectId,
          userFeedback: feedback.trim() || undefined,
          plannerContext: plannerContextPayload,
        });
        if (r.success && r.data?.run) setLatestRun(r.data.run);
        if (r.message) showToast(r.message);
        if (r.success) {
          const now = Date.now();
          setChatAiLog((prev) => [
            ...prev,
            { id: `ai-${now}-${Math.random()}`, text: "의견을 반영해 작업계획을 다시 구성했습니다.", at: now },
          ]);
        }
      } finally {
        setProtoBusy(false);
        void refreshLatestRun();
        setPendingChatFeedback(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pendingChatFeedback를 최신값으로 쓰기 위함
  }, [pendingChatFeedback, pendingChatAppliedRunId, latestRun?.id, latestRun?.status, latestRun?.workUnitsExecutionConfirmed]);

  const lastPlanAnnounceRef = useRef<{ runId: string; count: number } | null>(null);
  useEffect(() => {
    if (!latestRun?.id) return;
    if (!latestRun.workUnits?.length) return;
    if (latestRun.plannerStatus !== "DONE") return;
    const rid = latestRun.id;
    const count = latestRun.workUnits.length;
    const last = lastPlanAnnounceRef.current;
    if (last && last.runId === rid && last.count === count) return;

    lastPlanAnnounceRef.current = { runId: rid, count };
    const now = Date.now();
    setChatAiLog((prev) => [
      ...prev,
      { id: `ai-plan-${now}-${Math.random()}`, text: `AI 작업계획을 생성했습니다. 총 ${count}개의 구현 작업으로 나누었습니다.`, at: now },
    ]);
  }, [latestRun?.id, latestRun?.workUnits, latestRun?.plannerStatus]);

  const applyPlannerFeedback = useCallback(() => {
    const rid = latestRun?.id;
    if (!rid) return;
    void (async () => {
      setProtoBusy(true);
      try {
        const r = await postPrototypeRegeneratePlan(rid, {
          projectId,
          userFeedback: plannerFeedback.trim() || undefined,
          plannerContext: plannerContextPayload,
        });
        if (r.success && r.data?.run) setLatestRun(r.data.run);
        if (r.message) showToast(r.message);
        if (r.success) setPlannerFeedback("");
      } finally {
        setProtoBusy(false);
        void refreshLatestRun();
      }
    })();
  }, [latestRun?.id, plannerContextPayload, plannerFeedback, projectId, refreshLatestRun]);

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

  const onSendChatMessage = useCallback(async () => {
    const text = chatInput.trim();
    if (!text) return;
    if (protoBusy) return;

    const now = Date.now();
    const wantsExecutionPlan =
      canRequestGeneration.envOk &&
      !executionPlanConfirmed &&
      !isRunningState &&
      /^\s*(작업\s*계획\s*생성|작업계획생성|실행\s*계획\s*수립|실행계획\s*수립|실행계획수립|workunit|work\s*unit)\s*$/i.test(text);

    setChatUserLog((prev) => [...prev, { id: `user-${now}-${Math.random()}`, text, at: now }]);
    setChatInput("");

    if (wantsExecutionPlan) {
      await requestExecutionPlan();
      return;
    }

    if (isRunningState) {
      setChatAiLog((prev) => [
        ...prev,
        { id: `ai-${now}-${Math.random()}`, text: "실행 중에는 계획 수정이 제한됩니다. 필요하면 자동 생성을 중단한 뒤 다시 작업계획을 만들 수 있습니다.", at: now },
      ]);
      return;
    }

    const run = latestRun;
    if (run?.id && run.status === "WORK_UNITS_READY" && run.workUnitsExecutionConfirmed !== true) {
      const aiNow = Date.now();
      setChatAiLog((prev) => [
        ...prev,
        { id: `ai-${aiNow}-${Math.random()}`, text: "의견을 반영해 작업계획을 다시 구성하는 중입니다…", at: aiNow },
      ]);
      setProtoBusy(true);
      try {
        const r = await postPrototypeRegeneratePlan(run.id, {
          projectId,
          userFeedback: text,
          plannerContext: plannerContextPayload,
        });
        if (r.success && r.data?.run) setLatestRun(r.data.run);
        if (r.message) showToast(r.message);
        if (r.success) {
          const doneAt = Date.now();
          setChatAiLog((prev) => [
            ...prev,
            { id: `ai-${doneAt}-${Math.random()}`, text: "의견을 반영해 작업계획을 다시 구성했습니다.", at: doneAt },
          ]);
        }
      } finally {
        setProtoBusy(false);
        void refreshLatestRun();
      }
      return;
    }

    // 아직 WorkUnit 계획이 없으면 생성 → 생성 완료 후 의견 반영(자동)
    const aiNow = Date.now();
    setChatAiLog((prev) => [
      ...prev,
      { id: `ai-${aiNow}-${Math.random()}`, text: "작업계획을 생성한 뒤, 입력한 의견을 반영하겠습니다. 잠시만 기다려 주세요.", at: aiNow },
    ]);
    setPendingChatFeedback(text);
    setPendingChatAppliedRunId(null);
    void onRequestAiWorkPlanOnly();
  }, [
    chatInput,
    protoBusy,
    isRunningState,
    latestRun,
    projectId,
    canRequestGeneration.envOk,
    executionPlanConfirmed,
    requestExecutionPlan,
    plannerContextPayload,
    refreshLatestRun,
    onRequestAiWorkPlanOnly,
  ]);

  const onChatTextareaKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "Enter") return;
      if (e.nativeEvent.isComposing) return;
      if (e.shiftKey) return;
      e.preventDefault();
      if (protoBusy || !chatInput.trim()) return;
      void onSendChatMessage();
    },
    [chatInput, protoBusy, onSendChatMessage],
  );

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
          gridTemplateColumns: wideLayout
            ? "minmax(200px, 260px) minmax(0, 1fr) minmax(260px, 340px)"
            : "minmax(0, 1fr)",
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
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            minWidth: 0,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 950, color: "#64748b" }}>참여 멤버</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: isRunningState || isPlannerRunning ? "#2563eb" : "#94a3b8", flexShrink: 0 }} />
              <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", flex: "1 1 auto", minWidth: 0 }}>
                AI기획자 · {isPlannerRunning ? "분석중" : isRunningState ? "실행중" : latestRun?.status === "PREVIEW_READY" ? "완료" : latestRun?.status === "DEPLOY_FAILED" || latestRun?.status === "FAILED" ? "오류" : "대기"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: "#16a34a", flexShrink: 0 }} />
              <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", flex: "1 1 auto", minWidth: 0 }}>
                사용자 · OWNER · 온라인
              </div>
            </div>
          </div>

          <div style={{ paddingTop: 8, borderTop: "1px solid #f1f5f9", flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11.5, fontWeight: 900, color: "#334155" }}>작업 목록</div>
            {sortedWorkUnitsForSidebar.length ? (
              <div style={{ overflow: "auto", display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
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
                      #{u.order} {u.title}
                    </div>
                    <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4, fontWeight: 750 }}>
                      상태: {mapWorkUnitPlanStatusKo(u.status)}
                      <span style={{ color: "#cbd5e1", margin: "0 6px" }}>|</span>
                      난이도: {planTierKo(u.estimatedComplexity)}
                      <span style={{ color: "#cbd5e1", margin: "0 6px" }}>|</span>
                      위험: {planTierKo(u.riskLevel)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 750, lineHeight: 1.45 }}>
                작업계획이 생성되면 실제 작업 목록이 여기에 표시됩니다.
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0, minHeight: 0, flex: "1 1 auto" }}>
          <div
            style={{
              alignSelf: "flex-start",
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: "10px 12px",
              maxWidth: "85%",
              whiteSpace: "pre-wrap",
              fontSize: 12.5,
              lineHeight: 1.5,
              fontWeight: 650,
              color: "#0f172a",
            }}
          >
            AI기획자 · 실행 환경 점검
            {"\n"}
            Git 저장소:{" "}
            <span style={{ color: envStatus.git === "ok" ? "#16a34a" : envStatus.git === "loading" ? "#64748b" : "#b45309", fontWeight: 900 }}>
              {envStatus.git === "ok" ? "완료" : envStatus.git === "loading" ? "대기" : envStatus.git === "error" ? "오류" : "필요"}
            </span>
            {"\n"}
            GitHub 인증:{" "}
            <span style={{ color: envStatus.github === "ok" ? "#16a34a" : envStatus.github === "loading" ? "#64748b" : "#b45309", fontWeight: 900 }}>
              {envStatus.github === "ok" ? "완료" : envStatus.github === "loading" ? "대기" : envStatus.github === "error" ? "오류" : "필요"}
            </span>
            {"\n"}
            Cursor API:{" "}
            <span style={{ color: envStatus.cursor === "ok" ? "#16a34a" : envStatus.cursor === "loading" ? "#64748b" : "#b45309", fontWeight: 900 }}>
              {envStatus.cursor === "ok" ? "완료" : envStatus.cursor === "loading" ? "대기" : envStatus.cursor === "error" ? "오류" : "필요"}
            </span>
            {"\n"}
            연결 테스트:{" "}
            <span style={{ color: envStatus.connectionTest === "ok" ? "#16a34a" : envStatus.connectionTest === "loading" ? "#64748b" : "#b45309", fontWeight: 900 }}>
              {envStatus.connectionTest === "ok" ? "완료" : envStatus.connectionTest === "loading" ? "대기" : envStatus.connectionTest === "error" ? "오류" : "필요"}
            </span>
            {"\n"}
            {"\n"}
            {!canRequestGeneration.envOk ? (
              <a href={envSettingsHref} style={{ ...btnMuted, textDecoration: "none", marginTop: 8, display: "inline-block", fontWeight: 900 }}>
                환경설정 열기
              </a>
            ) : (
              <span style={{ color: "#0f766e", fontWeight: 950 }}>환경이 준비되었습니다.</span>
            )}
          </div>

          {workUnitPlanStats.total > 0 ? (
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: "10px 12px",
                background: "#f8fafc",
                fontSize: 12.5,
                fontWeight: 850,
                color: "#0f172a",
              }}
            >
              작업 진행 {workUnitPlanStats.mergedForBar} / {workUnitPlanStats.total} 완료 ({workUnitPlanStats.progressPercent}%)
              {activeWorkUnitForChat ? (
                <div style={{ marginTop: 6, fontSize: 12, color: "#475569", fontWeight: 800 }}>
                  현재 작업: {activeWorkUnitForChat.title}
                </div>
              ) : null}
            </div>
          ) : null}

          <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            {!latestRun?.id && !chatTemplateSelected ? (
              <div
                style={{
                  alignSelf: "flex-start",
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 14,
                  padding: "10px 12px",
                  maxWidth: "85%",
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>
                  AI기획자 · 템플릿 선택
                </div>
                <div style={{ fontSize: 12.5, color: "#475569", fontWeight: 800, marginBottom: 10, lineHeight: 1.45 }}>
                  현재 설계 기준 추천은 <span style={{ color: "#0f766e", fontWeight: 950 }}>{recommendedTemplateNameKo}</span> 입니다.
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => onChatSelectTemplate(null)}
                    style={{ ...btnMuted, padding: "6px 10px", fontSize: 12.5, fontWeight: 900 }}
                  >
                    추천: {recommendedTemplateNameKo}
                  </button>
                  {PROTOTYPE_TEMPLATES.filter((t) => t.id !== analysis.recommendedTemplate).slice(0, 6).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onChatSelectTemplate(t.id as PrototypeTemplateType)}
                      style={{ ...btnMuted, padding: "6px 10px", fontSize: 12.5, fontWeight: 900 }}
                    >
                      {t.nameKo}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTemplatePreviewOpen(true)}
                    style={{ ...btn, padding: "6px 10px", fontSize: 12.5, fontWeight: 900 }}
                  >
                    템플릿 보기
                  </button>
                </div>
              </div>
            ) : null}

            {!latestRun?.id && chatTemplateSelected ? (
              <div
                style={{
                  alignSelf: "flex-start",
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 14,
                  padding: "10px 12px",
                  maxWidth: "85%",
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>AI기획자 · 기획 산출물 분석 및 작업계획</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => void onRequestAiWorkPlanOnly()}
                    disabled={!canRequestGeneration.designOk || protoBusy || isPlannerRunning || isRunningState}
                    style={{
                      ...btnPrimary,
                      padding: "6px 10px",
                      fontSize: 12.5,
                      fontWeight: 900,
                      opacity: !canRequestGeneration.designOk || protoBusy || isPlannerRunning || isRunningState ? 0.55 : 1,
                      cursor: !canRequestGeneration.designOk || protoBusy || isPlannerRunning || isRunningState ? "not-allowed" : "pointer",
                    }}
                  >
                    작업계획 생성
                  </button>
                  <button
                    type="button"
                    onClick={() => void onRefreshPrototypeStatus()}
                    disabled={protoBusy}
                    style={{ ...btnMuted, padding: "6px 10px", fontSize: 12.5, fontWeight: 900 }}
                  >
                    상태 새로고침
                  </button>
                </div>
              </div>
            ) : null}

            {awaitingExecutionConfirm && latestRun?.id ? (
              <div
                style={{
                  alignSelf: "flex-start",
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 14,
                  padding: "10px 12px",
                  maxWidth: "85%",
                  marginTop: 6,
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>
                  AI기획자 · 계획 검토
                </div>
                <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.5, fontWeight: 800, marginBottom: 10 }}>
                  총 {(latestRun?.workUnits ?? []).length}개 작업이 생성되었습니다. 1번부터 순서대로 진행합니다.
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => confirmExecution()}
                    disabled={protoBusy || !automationAvailable}
                    style={btnPrimary}
                  >
                    이 계획으로 실행
                  </button>
                  <button type="button" onClick={() => regeneratePlan()} disabled={protoBusy} style={btn}>
                    다시 생성
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPlannerFeedback()}
                    disabled={protoBusy || !plannerFeedback.trim()}
                    style={btnMuted}
                    title="아래 작업계획 카드에 입력한 의견을 반영합니다."
                  >
                    의견 반영
                  </button>
                </div>
              </div>
            ) : null}
          {[...chatAiLog.map((x) => ({ ...x, role: "ai" as const })), ...chatUserLog.map((x) => ({ ...x, role: "user" as const }))].sort(
            (a, b) => a.at - b.at,
          ).map((e) => {
            const isAi = e.role === "ai";
            return (
              <div
                key={e.id}
                style={{
                  alignSelf: isAi ? "flex-start" : "flex-end",
                  background: isAi ? "#fff" : "#ecfdf5",
                  border: isAi ? "1px solid #e2e8f0" : "1px solid #bbf7d0",
                  borderRadius: 14,
                  padding: "10px 12px",
                  maxWidth: "85%",
                  whiteSpace: "pre-wrap",
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  fontWeight: isAi ? 650 : 800,
                  color: "#0f172a",
                }}
              >
                {isAi ? "AI기획자 · " : "사용자 · "}
                {e.text}
              </div>
            );
          })}

          {latestRun?.workUnits?.length ? (
            <div style={{ marginTop: 6 }}>
              <WorkUnitPlanCard
                latestRun={latestRun!}
                stats={workUnitPlanStats}
                protoBusy={protoBusy}
                plannerFeedback={plannerFeedback}
                onPlannerFeedbackChange={setPlannerFeedback}
                onApplyPlannerFeedbackRegenerate={() => applyPlannerFeedback()}
                onRetryWorkUnit={(runId, order, mode) => retryWorkUnit(mode)(runId, order)}
                hideHeader
                hidePlannerFeedback={!awaitingExecutionConfirm}
              />
            </div>
          ) : null}

          {latestRun?.status === "FAILED" ? (
            <FailureStateCard
              summary={
                [
                  latestRun?.statusReason ? `사유: ${latestRun?.statusReason}` : "",
                  latestRun?.aiReviewSummary ? String(latestRun?.aiReviewSummary) : "",
                ]
                  .filter(Boolean)
                  .join(" · ") || "실행이 중단되었거나 오류가 발생했습니다."
              }
              protoBusy={protoBusy}
              onResume={() => {
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
              }}
              onRestart={() => {
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
              }}
            />
          ) : null}
          </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            padding: 10,
            background: "#fff",
          }}
        >
          <textarea
            ref={chatInputRef}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={onChatTextareaKeyDown}
            placeholder={
              isRunningState
                ? "실행 중에는 계획 수정이 제한됩니다."
                : "추가 의견을 입력하세요. 예: 관리자 화면은 제외하고 요약 패널을 먼저 만들어줘."
            }
            rows={2}
            style={{
              flex: 1,
              resize: "none",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              padding: 8,
              fontSize: 12.5,
              lineHeight: 1.45,
              fontWeight: 800,
            }}
          />
          <button type="button" onClick={() => void onSendChatMessage()} disabled={protoBusy || !chatInput.trim()} style={btnPrimary}>
            전송
          </button>
        </div>
        </div>

        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            background: "#fff",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            minWidth: 0,
            minHeight: 0,
            overflow: "auto",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 950, color: "#64748b" }}>실행 · 배포 · 결과</div>
          <CurrentWorkUnitPanel latestRun={latestRun} />
          <DeploymentStatusPanel
            latestRun={latestRun}
            previewUrl={previewUrl}
            pagesSettingsHref={pagesSettingsHref}
            onOpenPreview={() => {
              const u = previewUrl ?? latestRun?.previewUrl ?? "";
              if (u) window.open(u, "_blank", "noopener,noreferrer");
            }}
            onCopyPreviewUrl={() => {
              const u = previewUrl ?? latestRun?.previewUrl ?? "";
              if (!u) return;
              void navigator.clipboard?.writeText(u).catch(() => {});
              showToast("URL을 복사했습니다.");
            }}
          />
          {isRunningState ? (
            <button type="button" onClick={() => setCancelConfirmOpen(true)} disabled={protoBusy} style={btn}>
              자동 생성 중단
            </button>
          ) : null}
          {isNextPublicDevWorkflowToolsEnabled() ? (
            <details style={{ fontSize: 11, color: "#475569" }}>
              <summary style={{ cursor: "pointer", fontWeight: 900, color: "#334155" }}>내부 오케스트레이션 (개발)</summary>
              <pre
                style={{
                  marginTop: 8,
                  fontSize: 10,
                  lineHeight: 1.35,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  background: "#f8fafc",
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
