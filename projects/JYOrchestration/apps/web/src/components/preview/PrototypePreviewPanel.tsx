"use client";

import type { CSSProperties, KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityLogCard,
  CurrentWorkUnitPanel,
  DeploymentStatusPanel,
  deriveActivityLogLines,
  FailureStateCard,
  WorkUnitPlanCard,
  type WorkUnitPlanStats,
} from "@/components/preview/prototypePreviewPanelCards";
import {
  buildDisplayedPlannerUserMessage,
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
import { PROTOTYPE_TEMPLATES, type PrototypeTemplateType } from "@/lib/templates/prototypeTemplates";
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
  const [plannerFeedback, setPlannerFeedback] = useState("");
  // --- chat-led UX (transient, state-derived) ---
  const [chatInput, setChatInput] = useState("");
  const [chatComposerFocused, setChatComposerFocused] = useState(false);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [chatUserLog, setChatUserLog] = useState<Array<{ id: string; text: string; at: number }>>([]);
  const [chatAiLog, setChatAiLog] = useState<Array<{ id: string; text: string; at: number }>>([]);
  const [protoSlots, setProtoSlots] = useState<Array<{ key: string; title: string; question: string; required: boolean }>>([]);
  const [protoSlotAnswers, setProtoSlotAnswers] = useState<Record<string, string>>({});
  const [protoCurrentSlotKey, setProtoCurrentSlotKey] = useState<string | null>(null);
  const [chatExpanded, setChatExpanded] = useState(false);
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

  const slotStats = useMemo(() => {
    const base = protoSlots.length ? protoSlots : [];
    const requiredSlots = base.filter((s) => s.required !== false);
    const effectiveSlots = requiredSlots.length ? requiredSlots : base;
    const total = effectiveSlots.length;
    const remaining = effectiveSlots.filter((s) => !String(protoSlotAnswers?.[s.key] ?? "").trim()).length;
    const completed = Math.max(0, total - remaining);
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, remaining, completed, percent };
  }, [protoSlots, protoSlotAnswers]);

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
          text: "실행계획 수립을 시작하기 전에 설계 정보(아이디어/액터/흐름)가 조금 더 필요합니다. 먼저 슬롯 질문에 답해 주세요.",
          at: aiNow,
        },
      ]);
      return;
    }

    setExecutionPlanConfirmed(true);
    const aiNow = Date.now();
    setChatAiLog((prev) => [
      ...prev,
      { id: `ai-${aiNow}-${Math.random()}`, text: "좋습니다. 실행계획(WorkUnit) 수립을 시작하겠습니다.", at: aiNow },
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

  const activityLogLines = useMemo(() => deriveActivityLogLines(latestRun, 24), [latestRun]);

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
      { id: `ai-plan-${now}-${Math.random()}`, text: `AI 작업계획을 생성했습니다. 총 ${count}개의 WorkUnit으로 나누었습니다.`, at: now },
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
      /^\s*(실행\s*계획\s*수립|실행계획\s*수립|실행계획수립|workunit|work\s*unit)\s*$/i.test(text);

    setChatUserLog((prev) => [...prev, { id: `user-${now}-${Math.random()}`, text, at: now }]);
    setChatInput("");

    if (wantsExecutionPlan) {
      await requestExecutionPlan();
      return;
    }

    // 프로토타입 생성 주도: 슬롯 기반 인터뷰(LLM) 우선
    if (!isRunningState) {
      const ensureSlots = async () => {
        if (protoSlots.length) return protoSlots;
        const ideationSummary = ideationAssets
          .map((a) => `${String(a.title ?? "").trim()}: ${String(a.content ?? "").trim()}`.trim())
          .filter(Boolean)
          .join("\n\n")
          .slice(0, 8_000);
        const actorFlowSummary = flowSteps.map((s) => `${s.title}: ${String(s.purpose ?? "").trim()}`).join("\n").slice(0, 6_000);
        const res = await fetch("/api/prototype-chat/slots", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            projectName,
            projectDescription,
            templateName: effectiveTemplateDef?.nameKo ?? String(effectiveTemplate),
            ideationSummary,
            actorFlowSummary,
          }),
        });
        const json = (await res.json()) as { success: boolean; data?: { slots: Array<{ key: string; title: string; question: string; required: boolean }> }; message?: string };
        if (json.success && json.data?.slots?.length) {
          setProtoSlots(json.data.slots);
          if (!protoCurrentSlotKey) setProtoCurrentSlotKey(json.data.slots[0]?.key ?? null);
          return json.data.slots;
        }
        throw new Error(json.message || "슬롯 생성에 실패했습니다.");
      };

      setProtoBusy(true);
      try {
        const slots = await ensureSlots();
        const res = await fetch("/api/prototype-chat/turn", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            projectName,
            projectDescription,
            templateName: effectiveTemplateDef?.nameKo ?? String(effectiveTemplate),
            slots,
            answers: protoSlotAnswers,
            currentSlotKey: protoCurrentSlotKey,
            userMessage: text,
            envOk: canRequestGeneration.envOk,
          }),
        });
        const json = (await res.json()) as {
          success: boolean;
          data?: {
            assistantMessage: string;
            slotKeyToFill: string | null;
            slotValue: string | null;
            nextSlotKey: string | null;
            nextQuestion: string | null;
          };
          message?: string;
        };
        if (json.success && json.data && json.data.assistantMessage) {
          const data = json.data;
          const aiNow = Date.now();
          setChatAiLog((prev) => [
            ...prev,
            {
              id: `ai-${aiNow}-${Math.random()}`,
              text: [
                data.assistantMessage,
                data.nextQuestion ? `\n\n${data.nextQuestion}` : "",
              ]
                .filter(Boolean)
                .join(""),
              at: aiNow,
            },
          ]);
          if (data.slotKeyToFill && data.slotValue) {
            const k = data.slotKeyToFill;
            const v = data.slotValue;
            setProtoSlotAnswers((prev) => ({ ...prev, [k]: v }));
          }
          if (data.nextSlotKey) {
            setProtoCurrentSlotKey(data.nextSlotKey);
          }
        } else {
          const aiNow = Date.now();
          setChatAiLog((prev) => [...prev, { id: `ai-${aiNow}-${Math.random()}`, text: json.message || "AI 응답 생성에 실패했습니다.", at: aiNow }]);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const aiNow = Date.now();
        setChatAiLog((prev) => [...prev, { id: `ai-${aiNow}-${Math.random()}`, text: msg, at: aiNow }]);
      } finally {
        setProtoBusy(false);
      }
      return;
    }

    if (isRunningState) {
      setChatAiLog((prev) => [
        ...prev,
        { id: `ai-${now}-${Math.random()}`, text: "실행 중에는 작업계획을 수정할 수 없습니다. 중단 후 재계획할 수 있습니다.", at: now },
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
    projectName,
    projectDescription,
    ideationAssets,
    flowSteps,
    effectiveTemplate,
    effectiveTemplateDef,
    canRequestGeneration.envOk,
    protoSlots,
    protoSlotAnswers,
    protoCurrentSlotKey,
    executionPlanConfirmed,
    requestExecutionPlan,
    plannerContextPayload,
    refreshLatestRun,
    onRequestAiWorkPlanOnly,
  ]);

  const onChatPlus = useCallback(() => {
    const el = chatInputRef.current;
    if (!el) return;

    const start = el.selectionStart ?? chatInput.length;
    const end = el.selectionEnd ?? chatInput.length;

    const next = `${chatInput.slice(0, start)}\n${chatInput.slice(end)}`;
    setChatInput(next);

    requestAnimationFrame(() => {
      try {
        el.selectionStart = el.selectionEnd = start + 1;
      } catch {
        // ignore
      }
      el.focus();
    });
  }, [chatInput]);

  const onChatComposerKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "Enter") return;
      if (e.nativeEvent.isComposing) return;
      if (e.shiftKey) return;
      e.preventDefault();
      if (protoBusy) return;
      if (!chatInput.trim()) return;
      void onSendChatMessage();
    },
    [chatInput, protoBusy, onSendChatMessage],
  );

  if (true) {
    return (
      <div
        style={{
          position: "relative",
          flex: "1 1 0%",
          width: "100%",
          minWidth: 0,
          minHeight: 0,
          height: "100%",
          overflow: "hidden",
          background: "#fff",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {toast ? <div style={toastStyle}>{toast}</div> : null}

        <div
          style={{
            display: "grid",
            gap: 14,
            alignItems: "stretch",
            gridTemplateColumns: chatExpanded ? "minmax(0, 1fr)" : "260px minmax(0, 1fr)",
            padding: 14,
            height: "100%",
            minHeight: 0,
          }}
        >
          {/* 좌측: 참여 멤버 */}
          {!chatExpanded ? (
            <div style={{ minWidth: 0, height: "100%", minHeight: 0, display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 14,
                  background: "#fff",
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 950, color: "#64748b" }}>참여 멤버</div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: isPlannerRunning ? "#2563eb" : isRunningState ? "#2563eb" : "#94a3b8" }} />
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", flex: "1 1 auto", minWidth: 0 }}>
                    AI기획자 · {isPlannerRunning ? "분석중" : isRunningState ? "실행중" : "대기"}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: "#16a34a" }} />
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", flex: "1 1 auto", minWidth: 0 }}>
                    사용자 · OWNER · 온라인
                  </div>
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
                  gap: 10,
                  flex: "1 1 auto",
                  minHeight: 0,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 950, color: "#64748b" }}>슬롯 목록</div>
                <div style={{ overflow: "auto", display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
                  {protoSlots.length ? (
                    protoSlots.map((s) => {
                      const filled = Boolean(String(protoSlotAnswers?.[s.key] ?? "").trim());
                      const active = protoCurrentSlotKey === s.key;
                      return (
                        <div
                          key={s.key}
                          style={{
                            border: active ? "1px solid #2563eb" : "1px solid #e2e8f0",
                            borderRadius: 12,
                            padding: "8px 10px",
                            background: filled ? "#ecfdf5" : "#fff",
                            display: "flex",
                            gap: 8,
                            alignItems: "flex-start",
                          }}
                        >
                          <span style={{ width: 10, height: 10, borderRadius: 999, background: filled ? "#16a34a" : "#cbd5e1", marginTop: 4, flexShrink: 0 }} />
                          <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                            <div style={{ fontSize: 12.5, fontWeight: 950, color: "#0f172a", lineHeight: 1.2 }}>
                              {s.title}
                              {s.required ? <span style={{ color: "#b45309", marginLeft: 6, fontWeight: 900, fontSize: 11.5 }}>(필수)</span> : null}
                            </div>
                            <div style={{ fontSize: 11.5, color: "#475569", lineHeight: 1.35, fontWeight: 750, marginTop: 4, whiteSpace: "pre-wrap" }}>
                              {filled ? "완료" : "미완료"}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: "#64748b" }}>슬롯을 생성하면 여기에 목록이 표시됩니다.</div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* 우측: AI기획자 영역 */}
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                background: "#fff",
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                height: "100%",
                minHeight: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 2 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 12, fontWeight: 950, color: "#64748b" }}>AI기획자</div>
                  <div style={{ fontSize: 12.5, fontWeight: 950, color: "#0f172a" }}>
                    프로토타입 완성도 {slotStats.percent}%
                    <span style={{ color: "#94a3b8", margin: "0 10px" }}>|</span>
                    남은 슬롯 {slotStats.remaining}개
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setChatExpanded((v) => !v)}
                  aria-label={chatExpanded ? "창 축소" : "창 확대"}
                  style={{ ...btnMuted, width: 38, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d={
                        chatExpanded
                          ? "M14 10V4h6v6h-2V7.41l-3.29 3.3L14 10Zm-4 4v6H4v-6h2v2.59l3.29-3.3L10 14Zm4 6v-6l.71.7 3.29 3.3V20h-4Zm-4-16v6l-.71-.7L6 6.71V4h4Z"
                          : "M14 4h6v6h-2V7.41l-3.29 3.3L14 10V4ZM10 20H4v-6h2v2.59l3.29-3.3L10 14v6Zm10-6v6h-6v-2h2.59l-3.3-3.29L14 14h6ZM4 10V4h6v2H7.41l3.3 3.29L10 10H4Z"
                      }
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </div>

              <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {/* 첫 진입 시 AI기획자는 환경설정 점검부터 안내합니다. */}
                {chatAiLog.length === 0 && chatUserLog.length === 0 ? (
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
                      fontWeight: 700,
                      color: "#0f172a",
                      marginTop: 2,
                    }}
                  >
                    AI기획자 · 프로토타입 실행 환경 점검
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
                    {envStatus.runnable === "loading" ? (
                      <span style={{ color: "#64748b", fontWeight: 900 }}>점검 중입니다…</span>
                    ) : canRequestGeneration.envOk ? (
                      <span style={{ color: "#0f766e", fontWeight: 950 }}>환경이 준비되었습니다. 이제 프로토타입을 진행할 수 있습니다.</span>
                    ) : (
                      <span>
                        환경이 미흡합니다. 아래 링크로 환경설정 화면을 열어 먼저 준비해 주세요.
                        {"\n"}
                        <a href={envSettingsHref} style={{ ...btnMuted, textDecoration: "none", marginTop: 8, display: "inline-block", fontWeight: 900 }}>
                          환경설정 열기
                        </a>
                      </span>
                    )}
                  </div>
                ) : null}

                {canRequestGeneration.envOk && !executionPlanConfirmed ? (
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
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    AI기획자 · 환경설정이 완료되었습니다. 지금 실행계획(WorkUnit) 수립을 진행할까요?
                    {"\n"}
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => void requestExecutionPlan()}
                        disabled={protoBusy}
                        style={btnPrimary}
                      >
                        실행계획수립
                      </button>
                    </div>
                  </div>
                ) : null}

                {[...chatAiLog.map((x) => ({ ...x, role: "ai" as const })), ...chatUserLog.map((x) => ({ ...x, role: "user" as const }))]
                  .sort((a, b) => a.at - b.at)
                  .map((e) => {
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
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  padding: "8px 10px",
                  borderRadius: 999,
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
                }}
              >
                <button
                  type="button"
                  onClick={() => onChatPlus()}
                  disabled={protoBusy}
                  aria-label="추가 입력 (+)"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    cursor: protoBusy ? "not-allowed" : "pointer",
                    opacity: protoBusy ? 0.55 : 1,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>

                <div style={{ flex: 1, minWidth: 0, background: "#f1f5f9", borderRadius: 16, padding: "2px 6px", position: "relative" }}>
                  {!chatInput.trim() && !chatComposerFocused ? (
                    <div
                      style={{
                        position: "absolute",
                        left: 12,
                        right: 12,
                        top: 10,
                        pointerEvents: "none",
                        fontSize: 13,
                        lineHeight: 1.45,
                        fontWeight: 650,
                        color: "#64748b",
                      }}
                    >
                      {isRunningState ? "실행 중에는 작업계획 수정이 불가합니다." : "메시지를 입력하세요"}
                    </div>
                  ) : null}
                  <textarea
                    ref={chatInputRef}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={onChatComposerKeyDown}
                    onFocus={() => setChatComposerFocused(true)}
                    onBlur={() => setChatComposerFocused(false)}
                    rows={1}
                    style={{
                      width: "100%",
                      resize: "none",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      padding: "10px 10px",
                      fontSize: 13,
                      lineHeight: 1.45,
                      fontWeight: 750,
                      color: "#0f172a",
                      maxHeight: 160,
                      minHeight: 40,
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void onSendChatMessage()}
                  disabled={protoBusy || !chatInput.trim()}
                  aria-label="메시지 전송"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    border: "none",
                    background: protoBusy || !chatInput.trim() ? "#94a3b8" : "#0f766e",
                    color: "#fff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    cursor: protoBusy || !chatInput.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                    <polygon points="8,6 18,12 8,18" fill="#ffffff" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 기존 모달 UI는 런 제어용이라 유지합니다. */}
        <PrototypePreviewDraggableShell
          open={templatePreviewOpen}
          onClose={() => setTemplatePreviewOpen(false)}
          title="템플릿 미리보기"
          modalWidth="min(980px, calc(100vw - 20px))"
          tone="showcase"
        >
          {effectiveTemplateDef ? (
            <div style={{ display: "grid", gap: 12 }}>
              <PrototypeTemplateMockPreview template={effectiveTemplateDef} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" onClick={() => setTemplatePreviewOpen(false)} style={btnMuted}>
                  닫기
                </button>
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

  return (
    <div style={{ position: "relative" }}>
      {toast ? (
        <div style={toastStyle}>
          {toast}
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <div style={card}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 12.5, color: "#475569" }}>
                <span style={{ fontWeight: 800, color: "#64748b" }}>템플릿:</span>
                <select
                  value={effectiveTemplate}
                  onChange={(e) => {
                    const next = e.target.value as PrototypeTemplateType;
                    setTemplateOverride(next);
                    savePrototypeGenerationRecord(projectId, { selectedTemplate: next });
                    refreshRecord();
                    // 템플릿 선택 즉시 Planner(Task packages) 생성: Cursor 실행은 사용자가 "자동 생성 시작"을 눌렀을 때만.
                    if (canRequestGeneration.designOk) {
                      void (async () => {
                        try {
                          setProtoBusy(true);
                          const cr = await postCreatePrototypeRun({
                            projectId,
                            selectedTemplate: next,
                            promptSnapshot: promptPackage.slice(0, 50_000),
                            startCursorAgent: false,
                            plannerContext: plannerContextPayload,
                          });
                          if (cr.success && cr.data?.run) setLatestRun(cr.data.run);
                        } finally {
                          setProtoBusy(false);
                        }
                      })();
                    }
                  }}
                  style={selectStyle}
                >
                  {PROTOTYPE_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>{t.nameKo}</option>
                  ))}
                </select>
                <div role="group" aria-label="템플릿 선택 방식" style={templateModeToggleWrap}>
                  <button
                    type="button"
                    aria-pressed={isRecommended}
                    onClick={() => {
                      if (!isRecommended) {
                        setTemplateOverride(null);
                        savePrototypeGenerationRecord(projectId, { selectedTemplate: null });
                        refreshRecord();
                      }
                    }}
                    style={{
                      ...templateModeToggleSeg,
                      ...(isRecommended ? templateModeToggleActive : templateModeToggleIdle),
                    }}
                  >
                    추천
                  </button>
                  <button
                    type="button"
                    aria-pressed={!isRecommended}
                    onClick={() => {
                      if (isRecommended) {
                        const t = analysis.recommendedTemplate;
                        setTemplateOverride(t);
                        savePrototypeGenerationRecord(projectId, { selectedTemplate: t });
                        refreshRecord();
                      }
                    }}
                    style={{
                      ...templateModeToggleSeg,
                      ...(!isRecommended ? templateModeToggleActive : templateModeToggleIdle),
                    }}
                  >
                    사용자 선택
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setTemplatePreviewOpen(true)}
                  style={btnMuted}
                >
                  템플릿 보기
                </button>
              </div>

              <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {!latestRun?.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void onRequestAiWorkPlanOnly()}
                      disabled={
                        !canRequestGeneration.designOk || protoBusy || isPlannerRunning || isRunningState
                      }
                      style={{
                        ...btn,
                        opacity:
                          !canRequestGeneration.designOk || protoBusy || isPlannerRunning || isRunningState
                            ? 0.55
                            : 1,
                        cursor:
                          !canRequestGeneration.designOk || protoBusy || isPlannerRunning || isRunningState
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      AI 작업계획 작성
                    </button>
                    <button
                      type="button"
                      onClick={() => void onCursorAutoRequest()}
                      disabled={!canStartPrototypeAutomation || protoBusy}
                      style={{
                        ...btnPrimary,
                        opacity: !canStartPrototypeAutomation || protoBusy ? 0.55 : 1,
                        cursor: !canStartPrototypeAutomation || protoBusy ? "not-allowed" : "pointer",
                      }}
                    >
                      프로토타입 자동 실행 시작
                    </button>
                    <button type="button" onClick={() => void onRefreshPrototypeStatus()} disabled={protoBusy} style={btnMuted}>
                      상태 새로고침
                    </button>
                  </>
                ) : awaitingExecutionConfirm ? (
                  <>
                    <button
                      type="button"
                      onClick={() => confirmExecution()}
                      disabled={protoBusy || !automationAvailable}
                      style={btnPrimary}
                    >
                      이 계획으로 실행
                    </button>
                    <button type="button" onClick={() => regeneratePlan()} disabled={protoBusy} style={btn}>
                      작업계획 다시 생성
                    </button>
                    <button type="button" onClick={() => void onRefreshPrototypeStatus()} disabled={protoBusy} style={btnMuted}>
                      상태 새로고침
                    </button>
                  </>
                ) : isRunningState ? (
                  <>
                    <button type="button" disabled style={{ ...btnPrimary, opacity: 0.55, cursor: "not-allowed" }}>
                      진행중
                    </button>
                    <button type="button" onClick={() => setCancelConfirmOpen(true)} disabled={protoBusy} style={btn}>
                      자동 생성 중단
                    </button>
                    <button type="button" onClick={() => void onRefreshPrototypeStatus()} disabled={protoBusy} style={btnMuted}>
                      상태 새로고침
                    </button>
                  </>
                ) : isCancelled || isFailed ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
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
                      disabled={protoBusy}
                      style={btnPrimary}
                    >
                      이어 진행
                    </button>
                    <button
                      type="button"
                      onClick={() => {
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
                      disabled={protoBusy}
                      style={btn}
                    >
                      처음부터 다시 생성
                    </button>
                    <button type="button" onClick={() => void onRefreshPrototypeStatus()} disabled={protoBusy} style={btnMuted}>
                      상태 새로고침
                    </button>
                  </>
                ) : isCompleted ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const u = previewUrl ?? latestRun?.previewUrl ?? "";
                        if (u) window.open(u, "_blank", "noopener,noreferrer");
                      }}
                      disabled={!previewUrl && !latestRun?.previewUrl}
                      style={btnPrimary}
                    >
                      결과 보기
                    </button>
                    <button
                      type="button"
                      onClick={() => {
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
                      disabled={protoBusy}
                      style={btn}
                    >
                      처음부터 다시 생성
                    </button>
                    {previewUrl || latestRun?.previewUrl ? (
                      <button
                        type="button"
                        onClick={() => {
                          const u = previewUrl ?? latestRun?.previewUrl ?? "";
                          if (u) navigator.clipboard?.writeText(u).catch(() => {});
                          showToast("결과 URL을 복사했습니다.");
                        }}
                        style={btnMuted}
                      >
                        URL 복사
                      </button>
                    ) : null}
                    <button type="button" onClick={() => void onRefreshPrototypeStatus()} disabled={protoBusy} style={btnMuted}>
                      상태 새로고침
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void onRequestAiWorkPlanOnly()}
                      disabled={
                        !canRequestGeneration.designOk || protoBusy || isPlannerRunning || isRunningState
                      }
                      style={{
                        ...btn,
                        opacity:
                          !canRequestGeneration.designOk || protoBusy || isPlannerRunning || isRunningState
                            ? 0.55
                            : 1,
                        cursor:
                          !canRequestGeneration.designOk || protoBusy || isPlannerRunning || isRunningState
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      AI 작업계획 작성
                    </button>
                    <button
                      type="button"
                      onClick={() => void onCursorAutoRequest()}
                      disabled={!canStartPrototypeAutomation || protoBusy || isRunningState}
                      style={{
                        ...btnPrimary,
                        opacity: !canStartPrototypeAutomation || protoBusy || isRunningState ? 0.55 : 1,
                        cursor: !canStartPrototypeAutomation || protoBusy || isRunningState ? "not-allowed" : "pointer",
                      }}
                    >
                      프로토타입 자동 실행 시작
                    </button>
                    <button type="button" onClick={() => void onRefreshPrototypeStatus()} disabled={protoBusy} style={btnMuted}>
                      상태 새로고침
                    </button>
                  </>
                )}
              </div>

              {protoBusy ? (
                <div
                  style={{
                    marginTop: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    fontSize: 12.5,
                    color: "#1e40af",
                    fontWeight: 800,
                    lineHeight: 1.5,
                  }}
                >
                  처리 중입니다. OpenAI로 작업계획을 만들 때는 보통 10~60초 걸릴 수 있습니다. 완료되면 WorkUnit 목록이 갱신됩니다.
                </div>
              ) : null}

              <details style={{ marginTop: 12 }}>
                <summary style={{ fontSize: 12.5, fontWeight: 900, color: "#334155", cursor: "pointer" }}>
                  AI 작업계획 요청 입력 (system + user 합본)
                </summary>
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(plannerCombinedInputPreview).catch(() => {});
                      showToast("요청 입력 합본을 복사했습니다.");
                    }}
                    style={btnMuted}
                  >
                    복사
                  </button>
                </div>
                <pre
                  style={{
                    marginTop: 8,
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    fontSize: 11,
                    lineHeight: 1.45,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxHeight: 520,
                    overflow: "auto",
                  }}
                >
                  {plannerCombinedInputPreview}
                </pre>
              </details>
          </div>

          {/* WorkUnit/실행 상태 패널은 채팅 영역에서만 렌더링합니다. */}
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: wideLayout ? "minmax(200px, 260px) minmax(0, 1fr)" : "220px minmax(0, 1fr)",
          gap: 14,
          alignItems: "start",
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
                AI · {isPlannerRunning ? "분석중" : isRunningState ? "실행중" : latestRun?.status === "PREVIEW_READY" ? "완료" : latestRun?.status === "DEPLOY_FAILED" || latestRun?.status === "FAILED" ? "오류" : "대기"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: "#16a34a", flexShrink: 0 }} />
              <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", flex: "1 1 auto", minWidth: 0 }}>
                사용자 · OWNER · 온라인
              </div>
            </div>
          </div>

          {latestRun?.workUnits?.length ? (
            <div style={{ paddingTop: 8, borderTop: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: 11.5, fontWeight: 900, color: "#334155", marginBottom: 6 }}>진행 요약</div>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.55, fontWeight: 800 }}>
                {(latestRun?.workUnits ?? []).filter((u) => u.status === "MERGED").length} / {(latestRun?.workUnits ?? []).length} 완료
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
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
            AI · 프로토타입 실행 환경 확인
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
                  AI · 프로토타입 유형을 선택해주세요.
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
                <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>AI · 선택한 템플릿으로 작업계획 생성</div>
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
                  AI · 이 계획으로 Cursor 실행을 시작할 수 있습니다.
                </div>
                <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.5, fontWeight: 800, marginBottom: 10 }}>
                  WorkUnit 1 / {(latestRun?.workUnits ?? []).length}부터 순차 진행합니다.
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
                    작업계획 다시 생성
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
                {isAi ? "AI · " : "사용자 · "}
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
                hidePlannerFeedback
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

          <CurrentWorkUnitPanel latestRun={latestRun} hideHeader />

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
            hideHeader
          />
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
            placeholder={
              isRunningState
                ? "실행 중에는 작업계획 수정이 불가합니다. 메시지는 안내로 응답됩니다."
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
