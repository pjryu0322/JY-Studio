"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  postPrototypeRunRefresh,
} from "@/lib/prototype/prototypeRunApiClient";
import { workUnitProgressFromRun } from "@/lib/prototype/prototypePlannerService";
import type { PrototypeRun, PrototypeRunStatusReason, PrototypeWorkUnit, PrototypeWorkUnitStatus } from "@/lib/prototype/prototypeRunTypes";
import { prototypeRunStatusLabelKo } from "@/lib/prototype/prototypeRunUiHelpers";
import { PROTOTYPE_TEMPLATES, type PrototypeTemplateType } from "@/lib/templates/prototypeTemplates";
import { PrototypeTemplateMockPreview } from "@/components/preview/PrototypeTemplateMockPreview";

const WU_STATUS_ORDER: PrototypeWorkUnitStatus[] = [
  "PENDING",
  "CURSOR_RUNNING",
  "CURSOR_DONE",
  "GIT_PUSHED",
  "REVIEWING",
  "REVIEW_PASS",
  "PR_OPENED",
  "MERGED",
];

function workUnitStatusRank(s: PrototypeWorkUnitStatus): number {
  if (s === "FAILED") return -1;
  if (s === "REVIEW_REWORK") return WU_STATUS_ORDER.indexOf("REVIEWING");
  const i = WU_STATUS_ORDER.indexOf(s);
  return i < 0 ? 0 : i;
}

function workUnitDetailLinesKo(u: PrototypeWorkUnit): readonly { label: string; state: string }[] {
  const r = workUnitStatusRank(u.status);
  const failed = u.status === "FAILED";
  const rework = u.status === "REVIEW_REWORK";
  const ix = (s: PrototypeWorkUnitStatus) => WU_STATUS_ORDER.indexOf(s);
  const cell = (label: string, doneIdx: number, runIdx: number) => {
    if (failed) return { label, state: "실패" };
    if (r >= doneIdx) return { label, state: "완료" };
    if (r >= runIdx) return { label, state: "진행중" };
    return { label, state: "대기" };
  };
  return [
    cell("Cursor", ix("CURSOR_DONE"), ix("CURSOR_RUNNING")),
    cell("Git", ix("GIT_PUSHED"), ix("CURSOR_DONE")),
    {
      label: rework ? "AI 검토(보완 필요)" : "AI 검토",
      state: failed ? "실패" : r >= ix("REVIEW_PASS") ? "완료" : r >= ix("GIT_PUSHED") ? "진행중" : "대기",
    },
    cell("PR", ix("PR_OPENED"), ix("REVIEW_PASS")),
    cell("Merge", ix("MERGED"), ix("PR_OPENED")),
  ];
}

function workUnitSummaryLabel(
  unit: PrototypeWorkUnit,
  run: PrototypeRun | null,
  prog: ReturnType<typeof workUnitProgressFromRun>,
): { dot: "done" | "running" | "pending"; text: string } {
  if (unit.status === "MERGED") return { dot: "done", text: "완료" };
  if (unit.status === "FAILED") return { dot: "pending", text: "실패" };
  if (!prog || prog.allMerged) return { dot: "done", text: "완료" };
  if (unit.order < prog.current) return { dot: "done", text: "완료" };
  if (unit.order > prog.current) return { dot: "pending", text: "대기" };
  if (unit.status === "PENDING" && run?.status === "WORK_UNITS_READY" && !run.cursorRunId) {
    return { dot: "pending", text: "대기" };
  }
  return { dot: "running", text: "진행중" };
}

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

  const staleRegenerate = Boolean(record.fingerprintAtRequest && record.fingerprintAtRequest !== designFingerprint);
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

  const pipelineStatusText = useMemo(() => {
    if (latestRun) return prototypeRunStatusLabelKo(latestRun.status);
    return statusLabel(record.runStatus, Boolean(previewUrl));
  }, [latestRun, record.runStatus, previewUrl]);

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

  const plannerSummary = useMemo(() => {
    const wu = latestRun?.workUnits ?? [];
    const prog = latestRun ? workUnitProgressFromRun(latestRun) : null;
    if (!latestRun) return { line1: pipelineStatusText, line2: "" };
    if (latestRun.status === "PLANNER_ANALYZING") return { line1: "AI 기획자 작업분해 중", line2: "" };
    if (latestRun.status === "WORK_UNITS_READY" && wu.length && awaitingExecutionConfirm) {
      return { line1: `WorkUnit ${wu.length}개 미리보기`, line2: "실행을 확정하면 Cursor가 시작됩니다." };
    }
    if (latestRun.status === "WORK_UNITS_READY" && wu.length && !latestRun.cursorRunId) {
      return { line1: `WorkUnit ${wu.length}개 생성 완료`, line2: "" };
    }
    if (latestRun.status === "CANCEL_REQUESTED") return { line1: "중단 요청됨", line2: "" };
    if (latestRun.status === "CANCELLED") {
      const merged = latestRun.workUnits.filter((u) => u.status === "MERGED").length;
      const nextWu = latestRun.workUnits.find((u) => u.status !== "MERGED" && u.status !== "FAILED");
      const t = latestRun.cancelRequestedAt ?? latestRun.updatedAt;
      return {
        line1: "이전 실행이 중단되었습니다. 이어 진행하거나 처음부터 다시 생성할 수 있습니다.",
        line2: `중단 시각: ${t} · 완료 WorkUnit: ${merged}개 · 다음 실행 예정: ${nextWu ? `[${nextWu.order}] ${nextWu.title}` : "없음"}`,
      };
    }
    if (latestRun.status === "DEPLOY_FAILED") {
      return { line1: "배포 실패", line2: latestRun.deployFailureDetail ?? "" };
    }
    if (prog && prog.total > 0) {
      if (prog.allMerged && latestRun.status === "PREVIEW_READY") {
        return { line1: "전체 WorkUnit 완료", line2: `(${prog.total} / ${prog.total} 완료)` };
      }
      if (prog.allMerged) {
        return { line1: "전체 WorkUnit 머지 완료", line2: `(${prog.total} / ${prog.total} 완료)` };
      }
      return { line1: "WorkUnit 자동화 진행중", line2: `(${prog.current} / ${prog.total})` };
    }
    if (wu.length) return { line1: "AI 기획자 분석 완료", line2: `WorkUnit ${wu.length}개` };
    return { line1: pipelineStatusText, line2: "" };
  }, [latestRun, pipelineStatusText, awaitingExecutionConfirm]);

  const isRunningState = useMemo(() => {
    const s = latestRun?.status;
    const prog = latestRun ? workUnitProgressFromRun(latestRun) : null;
    const mid =
      prog &&
      !prog.allMerged &&
      (s === "MERGED" || s === "PR_OPENED" || s === "DEPLOYING" || s === "CURSOR_REQUESTED" || s === "CURSOR_RUNNING");
    const wuReadyRunning = s === "WORK_UNITS_READY" && !awaitingExecutionConfirm;
    return (
      s === "PLANNER_ANALYZING" ||
      wuReadyRunning ||
      s === "CURSOR_REQUESTED" ||
      s === "CURSOR_RUNNING" ||
      s === "COMMIT_DETECTED" ||
      s === "PUSH_CONFIRMED" ||
      s === "AI_REVIEWING" ||
      s === "DEPLOY_CONFIGURING" ||
      s === "DEPLOYING" ||
      Boolean(mid)
    );
  }, [latestRun, awaitingExecutionConfirm]);

  const isCancelRequested = latestRun?.status === "CANCEL_REQUESTED";
  const isCancelled = latestRun?.status === "CANCELLED";
  const isFailed = latestRun?.status === "FAILED" || latestRun?.status === "DEPLOY_FAILED";
  const isDeployFailed = latestRun?.status === "DEPLOY_FAILED";
  const isCompleted = latestRun?.status === "PREVIEW_READY";

  const workUnitAggregate = useMemo(() => {
    const wu = latestRun?.workUnits ?? [];
    const total = wu.length;
    const merged = wu.filter((u) => u.status === "MERGED").length;
    const failed = wu.filter((u) => u.status === "FAILED").length;
    const running = wu.filter((u) => u.status === "CURSOR_RUNNING" || u.status === "CURSOR_DONE" || u.status === "GIT_PUSHED" || u.status === "REVIEWING" || u.status === "REVIEW_PASS" || u.status === "PR_OPENED").length;
    const pending = wu.filter((u) => u.status === "PENDING").length;
    const doneForProgress = merged + failed;
    const pct = total ? Math.round((doneForProgress / total) * 100) : 0;
    return { total, merged, running, pending, failed, pct };
  }, [latestRun?.workUnits]);

  const automationRows = useMemo(() => {
    const run = latestRun;
    type Row = { label: string; state: "done" | "running" | "pending"; key: string };
    const mk = (key: string, label: string, done: boolean, running: boolean): Row => ({
      key,
      label,
      state: done ? "done" : running ? "running" : "pending",
    });
    const rows: Row[] = [];
    if (!run?.workUnits?.length) {
      rows.push(
        mk(
          "planner",
          "AI 기획자 분석 완료",
          Boolean(run && run.status !== "DRAFT" && run.status !== "PROMPT_READY"),
          Boolean(run && run.status === "PLANNER_ANALYZING"),
        ),
      );
      return rows;
    }
    const prog = workUnitProgressFromRun(run);
    rows.push(
      mk(
        "planner-done",
        "AI 기획자 분석 완료",
        Boolean(prog && run.workUnits.length > 0 && run.status !== "PLANNER_ANALYZING"),
        Boolean(run.status === "PLANNER_ANALYZING"),
      ),
    );
    const sorted = [...run.workUnits].sort((a, b) => a.order - b.order);
    sorted.forEach((u) => {
      const { dot, text } = workUnitSummaryLabel(u, run, prog);
      rows.push({
        key: `wu:${u.id}`,
        label: `WorkUnit ${u.order} ${text} — ${u.title}`,
        state: dot,
      });
    });
    rows.push(
      mk(
        "gh-pages",
        "GitHub Pages 배포",
        run.status === "PREVIEW_READY" || (run.status === "DEPLOY_FAILED" && Boolean(run.pagesDeployWorkflowRunUrl)),
        run.status === "DEPLOYING" || run.status === "DEPLOY_CONFIGURING",
      ),
      mk(
        "preview-url",
        "결과 URL 연결",
        Boolean(run.previewUrl && run.status === "PREVIEW_READY"),
        Boolean(prog?.allMerged && (run.status === "MERGED" || run.status === "DEPLOYING" || run.status === "DEPLOY_CONFIGURING")),
      ),
    );
    return rows;
  }, [latestRun]);

  const progressSummaryLine = useMemo(() => {
    if (!latestRun?.id) {
      if (!canRequestGeneration.designOk) return "실행 없음 · 설계 보완 필요";
      return "자동화 대기 · 자동 생성 시작 가능";
    }
    return `${plannerSummary.line1}${plannerSummary.line2 ? ` ${plannerSummary.line2}` : ""}`;
  }, [latestRun, canRequestGeneration.designOk, plannerSummary.line1, plannerSummary.line2]);

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
              <div style={{ height: 6 }} />

              <div
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: "1px solid #e2e8f0",
                  fontSize: 13,
                  color: "#0f172a",
                  lineHeight: 1.55,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 950, color: "#64748b", marginBottom: 6 }}>진행 요약</div>
                <div style={{ fontWeight: 850, color: "#0f172a" }}>{progressSummaryLine}</div>
              </div>

              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {!latestRun?.id ? (
                  <>
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
                      프로토타입 생성 시작
                    </button>
                    <button type="button" onClick={() => void onRefreshPrototypeStatus()} disabled={protoBusy} style={btnMuted}>
                      상태 새로고침
                    </button>
                  </>
                ) : awaitingExecutionConfirm ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const rid = latestRun.id;
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
                      }}
                      disabled={protoBusy || !automationAvailable}
                      style={btnPrimary}
                    >
                      WorkUnit 실행 시작
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const rid = latestRun.id;
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
                            setPlannerFeedback("");
                          } finally {
                            setProtoBusy(false);
                            void refreshLatestRun();
                          }
                        })();
                      }}
                      disabled={protoBusy}
                      style={btn}
                    >
                      작업계획 다시 생성
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const text = latestRun.promptSnapshot ?? "";
                        if (!text) return;
                        navigator.clipboard?.writeText(text).catch(() => {});
                        showToast("Cursor 전달 프롬프트를 클립보드에 복사했습니다.");
                      }}
                      style={btnMuted}
                    >
                      Cursor 전달 프롬프트 보기
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
                        const rid = latestRun.id;
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
                        const rid = latestRun.id;
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
                    <button
                      type="button"
                      onClick={() => {
                        const parts = [
                          latestRun.statusReason ? `사유 코드: ${latestRun.statusReason}` : "",
                          latestRun.aiReviewSummary ? `요약: ${latestRun.aiReviewSummary}` : "",
                          latestRun.deployFailureDetail ? `배포: ${latestRun.deployFailureDetail}` : "",
                        ].filter(Boolean);
                        showToast(parts.join(" · ") || "상세 로그가 없습니다.");
                      }}
                      style={btnMuted}
                    >
                      상세 로그
                    </button>
                    {isDeployFailed && latestRun.pagesDeployWorkflowRunUrl ? (
                      <button
                        type="button"
                        onClick={() => window.open(latestRun.pagesDeployWorkflowRunUrl ?? "", "_blank", "noopener,noreferrer")}
                        style={btn}
                      >
                        GitHub Actions 열기
                      </button>
                    ) : null}
                    <button type="button" onClick={() => void onRefreshPrototypeStatus()} disabled={protoBusy} style={btnMuted}>
                      상태 새로고침
                    </button>
                  </>
                ) : isCompleted ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const u = previewUrl ?? latestRun.previewUrl ?? "";
                        if (u) window.open(u, "_blank", "noopener,noreferrer");
                      }}
                      disabled={!previewUrl && !latestRun.previewUrl}
                      style={btnPrimary}
                    >
                      결과 보기
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const rid = latestRun.id;
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
                    {latestRun.prUrl ? (
                      <button
                        type="button"
                        onClick={() => window.open(latestRun.prUrl ?? "", "_blank", "noopener,noreferrer")}
                        style={btn}
                      >
                        GitHub PR 보기
                      </button>
                    ) : null}
                    {previewUrl || latestRun.previewUrl ? (
                      <button
                        type="button"
                        onClick={() => {
                          const u = previewUrl ?? latestRun.previewUrl ?? "";
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
                      onClick={() => void onCursorAutoRequest()}
                      disabled={!canStartPrototypeAutomation || protoBusy || isRunningState}
                      style={{
                        ...btnPrimary,
                        opacity: !canStartPrototypeAutomation || protoBusy || isRunningState ? 0.55 : 1,
                        cursor: !canStartPrototypeAutomation || protoBusy || isRunningState ? "not-allowed" : "pointer",
                      }}
                    >
                      프로토타입 생성 시작
                    </button>
                    <button type="button" onClick={() => void onRefreshPrototypeStatus()} disabled={protoBusy} style={btnMuted}>
                      상태 새로고침
                    </button>
                  </>
                )}
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
            <div style={cardTitle}>AI 작업 계획 · 자동화 파이프라인 상태</div>

            <div style={{ fontSize: 12, fontWeight: 950, color: "#64748b", marginTop: 10, marginBottom: 6 }}>AI 작업 계획</div>
            {(latestRun?.workUnits?.length ?? 0) === 0 ? (
              <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.65 }}>
                <p style={{ margin: "0 0 10px" }}>
                  AI 기획자가 이전 단계 결과를 분석해 Cursor가 효율적으로 작업할 수 있는 구현 단위(WorkUnit)를 생성합니다.
                </p>
                <div style={{ fontWeight: 900, color: "#334155", marginBottom: 6 }}>반영 항목</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  <li>아이디어 구체화 반영</li>
                  <li>액터 및 서비스 흐름 반영</li>
                  <li>기능 정리 반영</li>
                  <li>선택 템플릿 반영</li>
                  <li>Cursor 실행 단위 최적화</li>
                </ul>
              </div>
            ) : awaitingExecutionConfirm ? (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>
                  AI 기획자가 {latestRun!.workUnits.length}개의 Cursor 작업단위를 생성했습니다.
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {[...latestRun!.workUnits]
                    .sort((a, b) => a.order - b.order)
                    .map((u) => (
                      <div
                        key={u.id}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: 12,
                          padding: 10,
                          background: "#f8fafc",
                        }}
                      >
                        <div style={{ fontSize: 12.5, fontWeight: 950, color: "#0f172a" }}>
                          [{u.order}] {u.title}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12.5, color: "#475569", lineHeight: 1.55 }}>{u.description}</div>
                        <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
                          대상: {u.targetArea || "—"} · 범위: {u.implementationScope || "—"} · 위험: {u.riskLevel} · 복잡도:{" "}
                          {u.estimatedComplexity}
                        </div>
                        {u.acceptanceCriteria.length ? (
                          <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12.5, color: "#475569" }}>
                            {u.acceptanceCriteria.map((c, i) => (
                              <li key={i}>{c}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 6 }}>사용자 의견 추가</div>
                  <textarea
                    value={plannerFeedback}
                    onChange={(e) => setPlannerFeedback(e.target.value)}
                    placeholder="작업계획에 반영할 의견을 입력하세요. 예: 채팅 기능도 추가해줘, 관리자 화면은 제외해줘."
                    rows={3}
                    style={{
                      width: "100%",
                      resize: "vertical",
                      borderRadius: 10,
                      border: "1px solid #cbd5e1",
                      padding: 10,
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: "#475569", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                {latestRun!.workUnits
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((u) => `WorkUnit ${u.order}. ${u.title}`)
                  .join("\n")}
              </div>
            )}
            {(latestRun?.workUnits?.length ?? 0) > 0 ? (
              <div style={{ marginTop: 10, fontSize: 12.5, color: "#64748b", lineHeight: 1.55 }}>
                총 WorkUnit: {workUnitAggregate.total} · 완료: {workUnitAggregate.merged} · 진행중: {workUnitAggregate.running} · 대기:{" "}
                {workUnitAggregate.pending} · 실패: {workUnitAggregate.failed} · 전체 진행률 {workUnitAggregate.pct}%
              </div>
            ) : null}
            {!awaitingExecutionConfirm ? (
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
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
            ) : null}
            {latestRun?.suggestedPreviewUrl && !latestRun.previewUrl && !isCompleted ? (
              <div style={{ marginTop: 10, fontSize: 12.5, color: "#64748b" }}>
                예상 URL:{" "}
                <span style={{ fontWeight: 900, color: "#0f172a" }}>{latestRun.suggestedPreviewUrl}</span>
                <span style={{ marginLeft: 8 }}>GitHub Pages 배포 대기중</span>
              </div>
            ) : null}

            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 950, color: "#64748b", marginBottom: 8 }}>자동화 파이프라인</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", fontSize: 12.5, color: "#475569" }}>
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
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {automationRows.map((r) => (
                  <div key={r.key} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
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
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, lineHeight: 1.55, color: "#0f172a", fontWeight: r.state === "running" ? 900 : 700 }}>
                        {r.label}
                      </div>
                      {r.key.startsWith("wu:") ? (
                        <div style={{ marginTop: 6, paddingLeft: 2, fontSize: 12.5, color: "#64748b", lineHeight: 1.65 }}>
                          {(() => {
                            const id = r.key.slice("wu:".length);
                            const u = latestRun?.workUnits.find((x) => x.id === id);
                            if (!u) return null;
                            return workUnitDetailLinesKo(u).map((line) => (
                              <div key={line.label}>
                                {line.label}: {line.state}
                              </div>
                            ));
                          })()}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
