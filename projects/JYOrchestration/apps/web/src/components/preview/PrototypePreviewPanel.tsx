"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityLogCard,
  CurrentWorkUnitPanel,
  DeploymentStatusPanel,
  deriveActivityLogLines,
  FailureStateCard,
  WorkUnitPlanCard,
  type WorkUnitPlanStats,
} from "@/components/preview/prototypePreviewPanelCards";
import { workUnitProgressAllMerged } from "@/components/preview/prototypePreviewPanelHelpers";
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
  const [wideLayout, setWideLayout] = useState(false);

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
    const wuReadyRunning = s === "WORK_UNITS_READY" && !awaitingExecutionConfirm;
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

  const isCancelRequested = latestRun?.status === "CANCEL_REQUESTED";
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

          {!latestRun?.id ? (
            <div style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.5, marginTop: 4 }}>
              아직 생성된 작업계획이 없습니다. 프로토타입 생성 시작을 누르면 AI가 WorkUnit을 생성합니다.
            </div>
          ) : null}

          {latestRun?.id ? (
            <div
              style={{
                display: "grid",
                gap: 14,
                alignItems: "start",
                gridTemplateColumns: wideLayout ? "minmax(0, 13fr) minmax(0, 7fr)" : "minmax(0,1fr)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
                <WorkUnitPlanCard
                  latestRun={latestRun}
                  stats={workUnitPlanStats}
                  protoBusy={protoBusy}
                  plannerFeedback={plannerFeedback}
                  onPlannerFeedbackChange={setPlannerFeedback}
                  onApplyPlannerFeedbackRegenerate={() => applyPlannerFeedback()}
                  onRetryWorkUnit={(runId, order, mode) => retryWorkUnit(mode)(runId, order)}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
                {latestRun?.status === "FAILED" ? (
                  <FailureStateCard
                    summary={
                      [
                        latestRun?.statusReason ? `사유: ${latestRun.statusReason}` : "",
                        latestRun?.aiReviewSummary ? String(latestRun.aiReviewSummary) : "",
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
                <ActivityLogCard lines={activityLogLines} />
              </div>
            </div>
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
