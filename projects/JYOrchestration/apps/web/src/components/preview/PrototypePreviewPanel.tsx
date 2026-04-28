"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PrototypePreviewDraggableShell } from "@/components/preview/PrototypePreviewDraggableShell";
import type {
  PrototypeWorkspaceActor as PrototypePreviewActor,
  PrototypeWorkspaceFlowStep as PrototypePreviewFlowStep,
  PrototypeWorkspaceIdeationAsset,
} from "@/components/preview/prototypeWorkspaceTypes";
import {
  fetchEnvironmentTestLast,
  fetchExecutionSetup,
  postExecutionSetupValidate,
  type ExecutionSetupDto,
} from "@/components/project-spec/api";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";
import { projectExecutionSettingsHref } from "@/lib/project/projectExecutionSettingsHref";
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
  postPrototypeRunRefresh,
} from "@/lib/prototype/prototypeRunApiClient";
import type { PrototypeRun, PrototypeRunStatusReason } from "@/lib/prototype/prototypeRunTypes";
import { buildTimelineFromPrototypeRun, prototypeRunStatusLabelKo } from "@/lib/prototype/prototypeRunUiHelpers";
import { composeGithubPagesPreviewUrlFromRepoUrl, githubPagesSettingsUrl } from "@/lib/prototype/githubPagesPreviewUrl";
import { PROTOTYPE_TEMPLATES, type PrototypeTemplateType } from "@/lib/templates/prototypeTemplates";
import { PrototypeTemplateMockPreview } from "@/components/preview/PrototypeTemplateMockPreview";

type EnvBadge = "ok" | "needs" | "error" | "loading";
type EnvStatus = Readonly<{
  git: EnvBadge;
  github: EnvBadge;
  cursor: EnvBadge;
  connectionTest: EnvBadge;
  runnable: EnvBadge;
  message: string | null;
}>;

function isLikelyPreviewUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  return /^https?:\/\//i.test(u);
}

function labelEnv(b: EnvBadge): string {
  if (b === "ok") return "완료";
  if (b === "needs") return "필요";
  if (b === "loading") return "확인중";
  return "오류";
}

function envPill(b: EnvBadge): CSSProperties {
  if (b === "ok") return { ...pill, background: "#ecfdf5", borderColor: "#a7f3d0", color: "#047857" };
  if (b === "needs") return { ...pill, background: "#eff6ff", borderColor: "#bfdbfe", color: "#1e40af" };
  if (b === "loading") return { ...pill, background: "#f1f5f9", borderColor: "#e2e8f0", color: "#475569" };
  return { ...pill, background: "#fef2f2", borderColor: "#fecaca", color: "#b91c1c" };
}

function statusLabel(s: PrototypeGenerationLocalRecord["runStatus"], hasUrl: boolean): string {
  if (hasUrl) return "완료";
  switch (s) {
    case "awaiting_preview":
    case "prompt_ready":
      return "프롬프트 대기 · URL 미연결";
    case "preview_ready":
      return "완료";
    case "failed":
      return "실패";
    default:
      return "요청 대기";
  }
}

type TimelineStepStatus = "pending" | "running" | "success" | "failed" | "blocked";
function timelineDot(kind: TimelineStepStatus): CSSProperties {
  const base: CSSProperties = { width: 10, height: 10, borderRadius: 999, border: "1px solid #cbd5e1", background: "#fff" };
  if (kind === "success") return { ...base, borderColor: "#a7f3d0", background: "#22c55e" };
  if (kind === "running") return { ...base, borderColor: "#93c5fd", background: "#3b82f6" };
  if (kind === "failed") return { ...base, borderColor: "#fecaca", background: "#ef4444" };
  if (kind === "blocked") return { ...base, borderColor: "#fde68a", background: "#f59e0b" };
  return { ...base, borderColor: "#e2e8f0", background: "#cbd5e1" };
}

export function PrototypePreviewPanel({
  projectId,
  projectName,
  projectDescription,
  ideationAssets,
  flowSteps,
  actors,
  featureDraftTitles,
  designReadinessPercent,
  checklistGapLabels,
  unresolvedChecklistCount,
  designFingerprint,
  onNavigateFix,
}: {
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly ideationAssets: ReadonlyArray<PrototypeWorkspaceIdeationAsset>;
  readonly flowSteps: ReadonlyArray<PrototypePreviewFlowStep>;
  readonly actors: ReadonlyArray<PrototypePreviewActor>;
  readonly featureDraftTitles?: readonly string[];
  readonly designReadinessPercent: number;
  readonly checklistGapLabels: readonly string[];
  readonly unresolvedChecklistCount: number;
  readonly designFingerprint: string;
  readonly onNavigateFix?: () => void;
}) {
  // used in design readiness details
  // Avoid hydration mismatch: do not read sessionStorage in initial render.
  const [record, setRecord] = useState<PrototypeGenerationLocalRecord>(() => defaultPrototypeGenerationRecord());
  const [toast, setToast] = useState<string | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [templatePreviewOpen, setTemplatePreviewOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [templateOverride, setTemplateOverride] = useState<PrototypeTemplateType | null>(null);
  const [executionSetup, setExecutionSetup] = useState<ExecutionSetupDto | null>(null);
  const [envStatus, setEnvStatus] = useState<EnvStatus>({
    git: "loading",
    github: "loading",
    cursor: "loading",
    connectionTest: "loading",
    runnable: "loading",
    message: null,
  });
  const [envBusy, setEnvBusy] = useState(false);
  const [latestRun, setLatestRun] = useState<PrototypeRun | null>(null);
  const [automationAvailable, setAutomationAvailable] = useState(false);
  const [automationBlockReason, setAutomationBlockReason] = useState<PrototypeRunStatusReason>(null);
  const [protoBusy, setProtoBusy] = useState(false);
  // progress detail UI removed

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

  const ownersOk = flowSteps.length > 0 && flowSteps.every((s) => String(s.primaryActorId ?? "").trim());
  const ideaOk = projectDescription.trim().length > 24 || ideationAssets.some((a) => String(a.content ?? a.title ?? "").trim().length > 20);
  const actorsOk = actors.length >= 1;
  const flowOk = flowSteps.length >= 3;

  const ownerAssignedRatio = useMemo(() => {
    if (!flowSteps.length) return 0;
    const n = flowSteps.filter((s) => String(s.primaryActorId ?? "").trim()).length;
    return Math.round((n / flowSteps.length) * 100);
  }, [flowSteps]);

  const designReadinessPercentLocal = useMemo(() => {
    const base = Math.round(designReadinessPercent * 0.5 + analysis.confidence * 0.2);
    const bonus = (ideaOk ? 14 : 0) + (actorsOk ? 10 : 0) + (flowOk ? 10 : 0) + (ownersOk ? 12 : 0);
    return Math.min(100, base + bonus);
  }, [designReadinessPercent, analysis.confidence, ideaOk, actorsOk, flowOk, ownersOk]);

  const envReadinessPercent = useMemo(() => {
    const score = (b: EnvBadge) => (b === "ok" ? 20 : b === "needs" ? 8 : b === "loading" ? 0 : 0);
    const raw =
      score(envStatus.git) +
      score(envStatus.github) +
      score(envStatus.cursor) +
      score(envStatus.connectionTest) +
      score(envStatus.runnable);
    return Math.min(100, Math.max(0, raw));
  }, [envStatus.connectionTest, envStatus.cursor, envStatus.git, envStatus.github, envStatus.runnable]);

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

  const staleRegenerate = Boolean(record.fingerprintAtRequest && record.fingerprintAtRequest !== designFingerprint);
  const previewUrl = useMemo(() => {
    const fromServer =
      latestRun?.previewUrl && isLikelyPreviewUrl(latestRun.previewUrl) ? latestRun.previewUrl.trim() : null;
    if (fromServer) return fromServer;
    return record.previewUrl && isLikelyPreviewUrl(record.previewUrl) ? record.previewUrl.trim() : null;
  }, [latestRun?.previewUrl, record.previewUrl]);

  const repoUrlForButtons = useMemo(() => {
    const u = String(executionSetup?.gitRepoUrl ?? "").trim();
    return /^https?:\/\//i.test(u) ? u : null;
  }, [executionSetup?.gitRepoUrl]);

  const prUrlForButtons = useMemo(() => {
    const u = String(latestRun?.prUrl ?? "").trim();
    return /^https?:\/\//i.test(u) ? u : null;
  }, [latestRun?.prUrl]);

  const suggestedPreview = useMemo(() => {
    const fromRun = String(latestRun?.suggestedPreviewUrl ?? "").trim();
    if (fromRun && isLikelyPreviewUrl(fromRun)) return { url: fromRun, source: "run" as const };
    const repoUrl = String(executionSetup?.gitRepoUrl ?? "").trim();
    const composed = repoUrl ? composeGithubPagesPreviewUrlFromRepoUrl(repoUrl) : null;
    if (composed?.url) return { url: composed.url, source: "composed" as const, owner: composed.owner, repo: composed.repo };
    return null;
  }, [latestRun?.suggestedPreviewUrl, executionSetup?.gitRepoUrl]);

  const suggestedPreviewOwnerRepo = useMemo(() => {
    if (!suggestedPreview || suggestedPreview.source !== "composed") return null;
    const owner = String(suggestedPreview.owner ?? "").trim();
    const repo = String(suggestedPreview.repo ?? "").trim();
    return owner && repo ? { owner, repo } : null;
  }, [suggestedPreview]);

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
    setProtoBusy(true);
    try {
      const res = await postCreatePrototypeRun({
        projectId,
        selectedTemplate: effectiveTemplate,
        promptSnapshot: promptPackage.slice(0, 50_000),
        startCursorAgent: true,
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

  const onRefreshPrototypeStatus = async () => {
    if (!latestRun?.id) {
      showToast("먼저 프로토타입 자동 생성을 시작하세요.");
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

  // 수동 URL 입력 UX는 제거. 예상 URL(=GitHub Pages)만 읽기전용으로 표시한다.

  const settingsHref = useMemo(
    () => `${projectExecutionSettingsHref(projectId, { envNote: "prototype" })}#execution-setup-panel`,
    [projectId],
  );

  const loadEnv = useCallback(async () => {
    if (!projectId.trim()) return;
    setEnvBusy(true);
    try {
      const { res, json } = await fetchExecutionSetup(projectId);
      if (res.ok && json.success) setExecutionSetup(json.data ?? null);
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
    } finally {
      setEnvBusy(false);
    }
  }, [projectId]);

  useEffect(() => {
    const t = window.setTimeout(() => void loadEnv(), 0);
    return () => window.clearTimeout(t);
  }, [loadEnv]);

  const isRecommended = effectiveTemplate === analysis.recommendedTemplate && !templateOverride;

  const timeline: Array<{ label: string; status: TimelineStepStatus }> = useMemo(() => {
    return buildTimelineFromPrototypeRun(latestRun).map((row) => ({
      label: row.label,
      status: row.status as TimelineStepStatus,
    }));
  }, [latestRun]);

  // 기존 lifecycleRows(단순 단계 나열)는 "자동화 파이프라인" 카드에서 대체 표시한다.

  const canStartPrototypeAutomation = useMemo(
    () => automationAvailable && canRequestGeneration.designOk && canRequestGeneration.envOk,
    [automationAvailable, canRequestGeneration.designOk, canRequestGeneration.envOk],
  );

  const pipelineStatusText = useMemo(() => {
    if (latestRun) return prototypeRunStatusLabelKo(latestRun.status);
    return statusLabel(record.runStatus, Boolean(previewUrl));
  }, [latestRun, record.runStatus, previewUrl]);

  const plannerSummary = useMemo(() => {
    const tasks = latestRun?.plannerTasks ?? [];
    const total = latestRun?.cursorTaskTotal ?? (tasks.length || null);
    const current = latestRun?.cursorTaskCurrent ?? null;
    if (!latestRun) return { line1: pipelineStatusText, line2: "" };
    if (latestRun.status === "PLANNER_ANALYZING") return { line1: "AI 기획자 작업분해 중", line2: "" };
    if (latestRun.status === "TASK_PACKAGES_READY") return { line1: `Task ${tasks.length || 0}개 생성 완료`, line2: "" };
    if (latestRun.status === "CANCEL_REQUESTED") return { line1: "중단 요청됨", line2: "" };
    if (latestRun.status === "CANCELLED") return { line1: "사용자가 중단함", line2: "" };
    if (latestRun.status === "CURSOR_REQUESTED" || latestRun.status === "CURSOR_RUNNING") {
      if (total && current != null) return { line1: "Cursor 작업 진행중", line2: `(${current} / ${total})` };
      if (tasks.length) return { line1: "Cursor 작업 진행중", line2: `(1 / ${tasks.length})` };
      return { line1: "Cursor 작업 진행중", line2: "" };
    }
    if (tasks.length) return { line1: "AI 기획자 분석 완료", line2: `Task ${tasks.length}개` };
    return { line1: pipelineStatusText, line2: "" };
  }, [latestRun, pipelineStatusText]);

  const isRunningState = useMemo(() => {
    const s = latestRun?.status;
    return (
      s === "PLANNER_ANALYZING" ||
      s === "TASK_PACKAGES_READY" ||
      s === "CURSOR_REQUESTED" ||
      s === "CURSOR_RUNNING" ||
      s === "COMMIT_DETECTED" ||
      s === "PUSH_CONFIRMED" ||
      s === "AI_REVIEWING"
    );
  }, [latestRun]);

  const isCancelRequested = latestRun?.status === "CANCEL_REQUESTED";
  const isCancelled = latestRun?.status === "CANCELLED";
  const isFailed = latestRun?.status === "FAILED";
  const isCompleted = latestRun?.status === "PR_OPENED" || latestRun?.status === "MERGED" || latestRun?.status === "PREVIEW_READY";

  const automationRows = useMemo(() => {
    const run = latestRun;
    const tasks = run?.plannerTasks ?? [];
    const total = run?.cursorTaskTotal ?? tasks.length;
    const current = run?.cursorTaskCurrent ?? 0;
    type Row = { label: string; state: "done" | "running" | "pending" };
    const mk = (label: string, done: boolean, running: boolean): Row => ({ label, state: done ? "done" : running ? "running" : "pending" });
    const rows: Row[] = [];
    rows.push(mk("서비스 흐름 확정 완료", Boolean(run && run.status !== "DRAFT"), Boolean(run && run.status === "PROMPT_READY")));
    rows.push(
      mk(
        "AI 기획자 작업 분석 완료",
        Boolean(run && (run.status === "TASK_PACKAGES_READY" || run.status === "CURSOR_REQUESTED" || run.status === "CURSOR_RUNNING" || run.status === "COMMIT_DETECTED" || run.status === "PUSH_CONFIRMED" || run.status === "AI_REVIEWING" || run.status === "PR_OPENED" || run.status === "MERGED" || run.status === "PREVIEW_READY")),
        Boolean(run && run.status === "PLANNER_ANALYZING"),
      ),
    );
    rows.push(mk(`Cursor 작업단위 ${total || tasks.length || 0}개 생성`, Boolean(tasks.length), Boolean(run && run.status === "TASK_PACKAGES_READY")));
    if (tasks.length) {
      tasks.forEach((t) => {
        const isCursorPhase = run?.status === "CURSOR_REQUESTED" || run?.status === "CURSOR_RUNNING";
        const running = isCursorPhase && current === t.order;
        const done =
          !isCursorPhase &&
          (run?.status === "COMMIT_DETECTED" ||
            run?.status === "PUSH_CONFIRMED" ||
            run?.status === "AI_REVIEWING" ||
            run?.status === "PR_OPENED" ||
            run?.status === "MERGED" ||
            run?.status === "PREVIEW_READY");
        rows.push(mk(`Cursor Task ${t.order} ${running ? "진행중" : done ? "완료" : "대기"} — ${t.title}`, done, running));
      });
    }
    rows.push(
      mk(
        "Git 반영 대기",
        Boolean(run && (run.status === "COMMIT_DETECTED" || run.status === "PUSH_CONFIRMED" || run.status === "AI_REVIEWING" || run.status === "PR_OPENED" || run.status === "MERGED" || run.status === "PREVIEW_READY")),
        Boolean(run && (run.status === "CURSOR_RUNNING" || run.status === "CURSOR_REQUESTED")),
      ),
    );
    rows.push(mk("결과 URL 생성 대기", Boolean(run && Boolean(run.previewUrl)), Boolean(run && (run.status === "PR_OPENED" || run.status === "MERGED"))));
    return rows;
  }, [latestRun]);

  const progressSummaryLine = useMemo(() => {
    if (!latestRun?.id) {
      if (!canRequestGeneration.designOk) return "실행 없음 · 설계 보완 필요";
      return "자동화 대기 · 자동 생성 시작 가능";
    }
    return `${plannerSummary.line1}${plannerSummary.line2 ? ` ${plannerSummary.line2}` : ""}`;
  }, [latestRun, canRequestGeneration.designOk, plannerSummary.line1, plannerSummary.line2]);

  const resultUrlSummary = previewUrl ? "결과 URL 연결됨" : "결과 URL 없음";

  return (
    <div style={{ position: "relative" }}>
      {toast ? (
        <div style={toastStyle}>
          {toast}
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <span style={{ ...summaryChip, borderColor: "#bfdbfe", background: "#eff6ff", color: "#1e40af" }}>자동화 파이프라인</span>
          <span style={summaryChip}>{resultUrlSummary}</span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
            gap: 14,
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={cardTitle}>생성 요청</div>
                {latestRun?.id ? (
                  <span style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 700 }}>실행 {latestRun.id.slice(0, 8)}…</span>
                ) : null}
              </div>

              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 12.5, color: "#475569" }}>
                <span style={{ fontWeight: 800, color: "#64748b" }}>템플릿:</span>
                <select
                  value={effectiveTemplate}
                  onChange={(e) => {
                    const next = e.target.value as PrototypeTemplateType;
                    setTemplateOverride(next);
                    savePrototypeGenerationRecord(projectId, { selectedTemplate: next });
                    refreshRecord();
                    setTemplatePreviewOpen(true);
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
                <button
                  type="button"
                  onClick={() => {
                    setTemplateOverride(null);
                    savePrototypeGenerationRecord(projectId, { selectedTemplate: null });
                    refreshRecord();
                  }}
                  style={btn}
                >
                  추천으로
                </button>
                {isRecommended ? <span style={badge}>추천</span> : <span style={badgeMuted}>사용자 선택</span>}
              </div>
              <div style={{ height: 6 }} />

              <div style={{ marginTop: 10, fontSize: 12.5, color: "#64748b" }}>
                상태:{" "}
                <span style={{ fontWeight: 900, color: "#0f172a" }}>
                  {plannerSummary.line1} {plannerSummary.line2 ? <span style={{ opacity: 0.8 }}>{plannerSummary.line2}</span> : null}
                </span>
              </div>

              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
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
                  프로토타입 자동 생성 시작
                </button>
                {isRunningState ? (
                  <button type="button" onClick={() => setCancelConfirmOpen(true)} disabled={protoBusy} style={btn}>
                    자동 생성 중단
                  </button>
                ) : null}
                {isCancelled || isFailed ? (
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
                      disabled={protoBusy || !latestRun?.id}
                      style={btn}
                    >
                      이어서 진행
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
                      disabled={protoBusy || !latestRun?.id}
                      style={btn}
                    >
                      처음부터 다시 생성
                    </button>
                  </>
                ) : null}
                <button type="button" onClick={() => void onRefreshPrototypeStatus()} disabled={protoBusy} style={btnMuted}>
                  상태 새로고침
                </button>
              </div>

              {isCancelRequested ? (
                <div style={{ marginTop: 10, fontSize: 12.5, color: "#b45309", fontWeight: 900 }}>중단 요청됨 — 다음 단계 진행을 멈춥니다.</div>
              ) : null}
              {isCompleted ? (
                <div style={{ marginTop: 10, fontSize: 12.5, color: "#475569" }}>생성이 완료되었습니다. 필요하면 “처음부터 다시 생성”을 사용하세요.</div>
              ) : null}

              {!canRequestGeneration.designOk ? (
                <div style={{ marginTop: 10, fontSize: 12.5, color: "#64748b" }}>
                  설계를 완료하면 프로토타입 자동 생성을 시작할 수 있습니다.
                </div>
              ) : null}

              {!canRequestGeneration.envOk && automationAvailable ? (
                <div style={{ marginTop: 10, fontSize: 12.5, color: "#b45309", fontWeight: 700 }}>
                  자동 실행 환경설정이 필요합니다.
                </div>
              ) : null}
              {automationBlockReason ? (
                <div style={{ marginTop: 6, fontSize: 12.5, color: "#b45309", fontWeight: 700 }}>
                  자동 불가 사유: {automationBlockReason}
                </div>
              ) : null}
              {staleRegenerate ? (
                <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 900, color: "#92400e" }}>설계 변경됨 — 다시 생성 필요</div>
              ) : null}
            </div>

            <div style={card}>
              <div style={cardTitle}>실제 결과물 미리보기</div>
              {!previewUrl ? (
                <>
                  {latestRun &&
                  (latestRun.status === "PR_OPENED" || latestRun.status === "MERGED") ? (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 12,
                        borderRadius: 12,
                        border: "1px solid #fed7aa",
                        background: "#fff7ed",
                        color: "#7c2d12",
                        fontSize: 12.5,
                        lineHeight: 1.55,
                      }}
                    >
                      <div style={{ fontWeight: 900, marginBottom: 6, color: "#9a3412" }}>소스 생성 완료</div>
                      <div>PR/Merge까지 완료되었습니다. 결과 화면을 보려면 로컬 실행 또는 배포 URL을 연결하세요.</div>
                      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        {prUrlForButtons ? (
                          <a href={prUrlForButtons} target="_blank" rel="noreferrer" style={{ ...btnMuted, textDecoration: "none" }}>
                            GitHub PR 열기
                          </a>
                        ) : null}
                        {repoUrlForButtons ? (
                          <a href={repoUrlForButtons} target="_blank" rel="noreferrer" style={{ ...btnMuted, textDecoration: "none" }}>
                            GitHub 저장소 열기
                          </a>
                        ) : null}
                      </div>
                      {suggestedPreview?.url ? (
                        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed #fdba74" }}>
                          <div style={{ fontWeight: 900, marginBottom: 6, color: "#9a3412" }}>예상 미리보기 URL</div>
                          <div style={{ fontSize: 12.5, color: "#7c2d12", wordBreak: "break-all" }}>
                            <code style={{ fontSize: 11.5 }}>{suggestedPreview.url}</code>
                          </div>
                          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                            {suggestedPreviewOwnerRepo ? (
                              <a
                                href={githubPagesSettingsUrl(suggestedPreviewOwnerRepo.owner, suggestedPreviewOwnerRepo.repo)}
                                target="_blank"
                                rel="noreferrer"
                                style={{ ...btnMuted, textDecoration: "none" }}
                              >
                                GitHub Pages 설정 열기
                              </a>
                            ) : null}
                            <a
                              href={suggestedPreview.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ ...btnMuted, textDecoration: "none" }}
                            >
                              결과 열기(예상 URL)
                            </a>
                          </div>
                          <div style={{ marginTop: 8, fontSize: 11.5, color: "#9a3412" }}>
                            GitHub Pages를 활성화하면 위 URL에서 확인할 수 있습니다. (현재는 <strong>예상 URL</strong>입니다)
                          </div>
                        </div>
                      ) : null}
                      <div style={{ marginTop: 10, fontSize: 11.5, color: "#9a3412" }}>
                        로컬 실행 예: <code style={{ fontSize: 11 }}>pnpm install && pnpm dev</code>
                      </div>
                    </div>
                  ) : null}
                  <div style={{ marginTop: 10, fontSize: 12.5, color: "#64748b" }}>
                    아직 결과 URL이 확인되지 않았습니다. GitHub Pages 예상 URL을 참고하거나 배포 URL을 연결하세요.
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <button type="button" onClick={() => setResultOpen(true)} style={btnMuted}>결과물 보기</button>
                    <a href={previewUrl} target="_blank" rel="noreferrer" style={{ ...btnMuted, textDecoration: "none" }}>새 탭 열기</a>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12.5, color: "#64748b" }}>
                    결과 URL: <span style={{ color: "#0f172a", fontWeight: 800, wordBreak: "break-all" }}>{previewUrl}</span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12.5, color: "#64748b" }}>
                    최근 생성 요청 시간:{" "}
                    {latestRun?.updatedAt
                      ? new Date(latestRun.updatedAt).toLocaleString()
                      : record.lastRequestedAt
                        ? new Date(record.lastRequestedAt).toLocaleString()
                        : "—"}
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
            <div style={card}>
              <div style={cardTitle}>진행 상태</div>
              <div style={{ marginTop: 8, fontSize: 13, color: "#0f172a" }}>
                진행 상태: <span style={{ fontWeight: 800 }}>{progressSummaryLine}</span>
              </div>
            </div>

            <div style={card}>
              <div style={cardTitle}>자동화 파이프라인 상태</div>
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", fontSize: 12.5, color: "#475569" }}>
                <span style={{ display: "inline-flex", gap: 8, alignItems: "center", fontWeight: 900 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 999, background: "#22c55e", border: "2px solid #16a34a" }} />
                  완료
                </span>
                <span style={{ display: "inline-flex", gap: 8, alignItems: "center", fontWeight: 900 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 999, background: "#3b82f6", border: "2px solid #2563eb" }} />
                  진행중
                </span>
                <span style={{ display: "inline-flex", gap: 8, alignItems: "center", fontWeight: 900 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 999, background: "#e2e8f0", border: "2px solid #94a3b8" }} />
                  대기
                </span>
              </div>
              <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                {automationRows.map((r, idx) => (
                  <div key={`${idx}:${r.label}`} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 999,
                        marginTop: 3,
                        background: r.state === "done" ? "#22c55e" : r.state === "running" ? "#3b82f6" : "#e2e8f0",
                        border: `2px solid ${r.state === "done" ? "#16a34a" : r.state === "running" ? "#2563eb" : "#94a3b8"}`,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ fontSize: 13, lineHeight: 1.55, color: "#0f172a", fontWeight: r.state === "running" ? 900 : 700 }}>
                      {r.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={card}>
              <div style={cardTitle}>AI 작업 계획</div>
              <div style={{ marginTop: 10, fontSize: 12.5, color: "#475569", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                {(latestRun?.plannerTasks?.length ?? 0) > 0
                  ? latestRun!.plannerTasks.map((t) => `Task ${t.order}. ${t.title}`).join("\n")
                  : "아직 작업 계획이 없습니다. 템플릿을 선택하면 AI 기획자가 작업분해(Task packages)를 생성합니다."}
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button type="button" onClick={() => {}} style={{ ...btnMuted, opacity: 0.6, cursor: "default" }} disabled>
                  전체 보기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const text = latestRun?.promptSnapshot ?? "";
                    if (!text) return;
                    navigator.clipboard?.writeText(text).catch(() => {});
                    showToast("Cursor 전달 프롬프트를 클립보드에 복사했습니다.");
                  }}
                  style={btnMuted}
                >
                  Cursor 전달 프롬프트 보기
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PrototypePreviewDraggableShell
        open={resultOpen}
        onClose={() => setResultOpen(false)}
        title="결과물 보기"
        modalWidth="min(980px, calc(100vw - 20px))"
      >
        {previewUrl ? (
          <iframe
            title="프로토타입 결과"
            src={previewUrl}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            style={{ width: "100%", height: "70vh", border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff" }}
          />
        ) : (
          <div style={{ fontSize: 13, fontWeight: 800, color: "#64748b" }}>URL을 먼저 연결해 주세요.</div>
        )}
      </PrototypePreviewDraggableShell>

      <PrototypePreviewDraggableShell
        open={templatePreviewOpen}
        onClose={() => setTemplatePreviewOpen(false)}
        title="템플릿 미리보기"
        modalWidth="min(980px, calc(100vw - 20px))"
      >
        {effectiveTemplateDef ? (
          <div style={{ display: "grid", gap: 12 }}>
            <PrototypeTemplateMockPreview template={effectiveTemplateDef} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setTemplatePreviewOpen(false)} style={btnMuted}>닫기</button>
              <button type="button" onClick={() => void onCursorAutoRequest()} disabled={!canStartPrototypeAutomation || protoBusy || isRunningState} style={btnPrimary}>
                이 템플릿으로 자동 생성 시작
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

const cardTitle: CSSProperties = { fontSize: 12.5, fontWeight: 900, color: "#64748b" };

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
  borderColor: "#0f766e",
  background: "#0f766e",
  color: "#fff",
};

const btnMuted: CSSProperties = {
  ...btn,
  borderColor: "#e2e8f0",
  background: "#f8fafc",
  color: "#0f172a",
};

const badge: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 900,
  borderRadius: 999,
  padding: "4px 8px",
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e40af",
};

const badgeMuted: CSSProperties = {
  ...badge,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#64748b",
};

const pill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 22,
  minWidth: 42,
  padding: "0 8px",
  borderRadius: 999,
  border: "1px solid #e2e8f0",
  fontSize: 11.5,
  fontWeight: 900,
};

const row: CSSProperties = { display: "flex", gap: 10, alignItems: "center" };

const selectStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontSize: 12.5,
  fontWeight: 800,
  color: "#0f172a",
};

// manual preview URL input removed

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
