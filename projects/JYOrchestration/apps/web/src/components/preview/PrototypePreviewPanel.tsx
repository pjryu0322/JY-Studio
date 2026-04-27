"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PrototypeMockFallbackPanel } from "@/components/preview/PrototypeMockFallbackPanel";
import { PrototypePreviewDraggableShell } from "@/components/preview/PrototypePreviewDraggableShell";
import type {
  PrototypeWorkspaceActor as PrototypePreviewActor,
  PrototypeWorkspaceFlowStep as PrototypePreviewFlowStep,
  PrototypeWorkspaceIdeationAsset,
} from "@/components/preview/prototypeWorkspaceTypes";
import {
  fetchExecutionSetup,
  postExecutionSetupValidate,
  type ExecutionSetupDto,
} from "@/components/project-spec/api";
import { buildCursorPrototypePromptPackage } from "@/lib/prototype/buildCursorPrototypePrompt";
import { analyzePrototypeContext } from "@/lib/prototype/prototypeContextAnalyzer";
import {
  loadPrototypeGenerationRecord,
  savePrototypeGenerationRecord,
  type PrototypeGenerationLocalRecord,
} from "@/lib/prototype/prototypeGenerationLocalStore";
import {
  fetchLatestPrototypeRun,
  postCreatePrototypeRun,
  postPrototypePreviewUrl,
  postPrototypeRunRefresh,
} from "@/lib/prototype/prototypeRunApiClient";
import type { PrototypeRun, PrototypeRunStatusReason } from "@/lib/prototype/prototypeRunTypes";
import { buildTimelineFromPrototypeRun, prototypeRunStatusLabelKo } from "@/lib/prototype/prototypeRunUiHelpers";
import { PROTOTYPE_TEMPLATES, type PrototypeTemplateType } from "@/lib/templates/prototypeTemplates";

type EnvBadge = "ok" | "needs" | "error" | "loading";
type EnvStatus = Readonly<{
  git: EnvBadge;
  github: EnvBadge;
  cursor: EnvBadge;
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
      return "수동 생성 · URL 미연결";
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
  const [record, setRecord] = useState<PrototypeGenerationLocalRecord>(() => loadPrototypeGenerationRecord(projectId));
  const [promptOpen, setPromptOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [mockOpen, setMockOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [templateOverride, setTemplateOverride] = useState<PrototypeTemplateType | null>(null);
  const [executionSetup, setExecutionSetup] = useState<ExecutionSetupDto | null>(null);
  const [envStatus, setEnvStatus] = useState<EnvStatus>({
    git: "loading",
    github: "loading",
    cursor: "loading",
    runnable: "loading",
    message: null,
  });
  const [envBusy, setEnvBusy] = useState(false);
  const [latestRun, setLatestRun] = useState<PrototypeRun | null>(null);
  const [automationAvailable, setAutomationAvailable] = useState(false);
  const [automationBlockReason, setAutomationBlockReason] = useState<PrototypeRunStatusReason>(null);
  const [protoBusy, setProtoBusy] = useState(false);

  const refreshRecord = useCallback(() => {
    setRecord(loadPrototypeGenerationRecord(projectId));
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
    const score = (b: EnvBadge) => (b === "ok" ? 25 : b === "needs" ? 10 : b === "loading" ? 0 : 0);
    const raw = score(envStatus.git) + score(envStatus.github) + score(envStatus.cursor) + score(envStatus.runnable);
    return Math.min(100, Math.max(0, raw));
  }, [envStatus.cursor, envStatus.git, envStatus.github, envStatus.runnable]);

  const canRequestGeneration = useMemo(() => {
    const designOk = ideaOk && actorsOk && flowOk && ownerAssignedRatio >= 60;
    const envOk = envStatus.runnable === "ok" || (envStatus.git === "ok" && envStatus.cursor === "ok");
    return { designOk, envOk, ok: designOk && envOk };
  }, [ideaOk, actorsOk, flowOk, ownerAssignedRatio, envStatus.runnable, envStatus.git, envStatus.cursor]);

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

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptPackage);
      showToast("복사했습니다.");
    } catch {
      showToast("복사에 실패했습니다.");
    }
  };

  const onCopyGenerationPrompt = async () => {
    if (!canRequestGeneration.designOk) return;
    setProtoBusy(true);
    try {
      try {
        await navigator.clipboard.writeText(promptPackage);
      } catch {
        showToast("복사에 실패했습니다.");
        return;
      }
      const res = await postCreatePrototypeRun({
        projectId,
        selectedTemplate: effectiveTemplate,
        promptSnapshot: promptPackage.slice(0, 50_000),
        startCursorAgent: false,
      });
      if (res.success && res.data?.run) {
        setLatestRun(res.data.run);
        setAutomationAvailable(res.data.automationAvailable);
        setAutomationBlockReason(res.data.automationBlockReason);
      } else {
        showToast(res.message ?? "서버 실행 기록 생성에 실패했습니다.");
      }
      const now = new Date().toISOString();
      savePrototypeGenerationRecord(projectId, {
        runStatus: "awaiting_preview",
        fingerprintAtRequest: designFingerprint,
        lastRequestedAt: now,
        lastError: null,
        selectedTemplate: effectiveTemplate,
        lastPromptSnapshot: promptPackage.slice(0, 30_000),
      });
      refreshRecord();
      showToast("생성 요청 후 결과 URL을 연결하세요.");
    } finally {
      setProtoBusy(false);
      void refreshLatestRun();
    }
  };

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

  const onStartGeneration = async () => {
    if (!canRequestGeneration.designOk) return;
    setProtoBusy(true);
    try {
      const res = await postCreatePrototypeRun({
        projectId,
        selectedTemplate: effectiveTemplate,
        promptSnapshot: promptPackage.slice(0, 50_000),
        startCursorAgent: false,
      });
      if (res.success && res.data?.run) {
        setLatestRun(res.data.run);
        setAutomationAvailable(res.data.automationAvailable);
        setAutomationBlockReason(res.data.automationBlockReason);
        showToast("생성 실행이 시작되었습니다. 프롬프트 복사로 이어가세요.");
      } else {
        showToast(res.message ?? "실행 생성에 실패했습니다.");
      }
    } finally {
      setProtoBusy(false);
      void refreshLatestRun();
    }
  };

  const onRefreshPrototypeStatus = async () => {
    if (!latestRun?.id) {
      showToast("먼저 생성 시작 또는 프롬프트 복사로 실행을 만드세요.");
      return;
    }
    setProtoBusy(true);
    try {
      const res = await postPrototypeRunRefresh(latestRun.id, { projectId });
      if (res.success && res.data?.run) {
        setLatestRun(res.data.run);
        showToast("상태를 갱신했습니다.");
      } else {
        showToast(res.message ?? "갱신에 실패했습니다.");
      }
    } finally {
      setProtoBusy(false);
      void refreshLatestRun();
    }
  };

  const applyPreviewUrl = async () => {
    const u = urlDraft.trim();
    if (!isLikelyPreviewUrl(u)) {
      savePrototypeGenerationRecord(projectId, { lastError: "http(s) URL만 지원합니다.", runStatus: "failed" });
      refreshRecord();
      return;
    }
    setProtoBusy(true);
    try {
      let runId = latestRun?.id ?? null;
      if (!runId) {
        const cr = await postCreatePrototypeRun({
          projectId,
          selectedTemplate: effectiveTemplate,
          promptSnapshot: promptPackage.slice(0, 50_000),
          startCursorAgent: false,
        });
        if (!cr.success || !cr.data?.run) {
          savePrototypeGenerationRecord(projectId, { previewUrl: u, runStatus: "preview_ready", lastError: null });
          refreshRecord();
          showToast("서버 기록 없이 로컬에만 URL을 저장했습니다.");
          return;
        }
        runId = cr.data.run.id;
        setLatestRun(cr.data.run);
      }
      const att = await postPrototypePreviewUrl(runId, { projectId, previewUrl: u });
      if (att.success && att.data?.run) {
        setLatestRun(att.data.run);
        savePrototypeGenerationRecord(projectId, { previewUrl: u, runStatus: "preview_ready", lastError: null });
        refreshRecord();
        showToast("URL 적용");
      } else {
        savePrototypeGenerationRecord(projectId, { previewUrl: u, runStatus: "preview_ready", lastError: att.message ?? null });
        refreshRecord();
        showToast(att.message ?? "서버 반영 실패 — 로컬에만 저장했습니다.");
      }
    } finally {
      setProtoBusy(false);
      void refreshLatestRun();
    }
  };

  const clearPreviewUrl = () => {
    savePrototypeGenerationRecord(projectId, { previewUrl: null, runStatus: "idle", lastError: null });
    setUrlDraft("");
    refreshRecord();
  };

  const settingsHref = useMemo(
    () => `/project-admin/settings?projectId=${encodeURIComponent(projectId)}&envNote=${encodeURIComponent("prototype")}`,
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
      const runnable: EnvBadge = vData ? (vData.git === "ok" && vData.cursor === "ok" ? "ok" : "needs") : "needs";
      const msg = vData?.messages?.[0] ? vData.messages[0] : null;
      setEnvStatus({ git, cursor, github, runnable, message: msg });
    } catch {
      setEnvStatus({ git: "error", github: "error", cursor: "error", runnable: "error", message: "환경 확인에 실패했습니다." });
    } finally {
      setEnvBusy(false);
    }
  }, [projectId]);

  useEffect(() => {
    const t = window.setTimeout(() => void loadEnv(), 0);
    return () => window.clearTimeout(t);
  }, [loadEnv]);

  const tpl = PROTOTYPE_TEMPLATES.find((t) => t.id === effectiveTemplate);
  const isRecommended = effectiveTemplate === analysis.recommendedTemplate && !templateOverride;
  const expectedPageCount = Math.max(3, Math.min(9, Math.round((analysis.recommendedPages?.length ?? 5) || 5)));
  const difficultyKr = analysis.workflowComplexity === "high" ? "높음" : analysis.workflowComplexity === "low" ? "낮음" : "보통";

  const timeline: Array<{ label: string; status: TimelineStepStatus }> = useMemo(() => {
    return buildTimelineFromPrototypeRun(latestRun).map((row) => ({
      label: row.label,
      status: row.status as TimelineStepStatus,
    }));
  }, [latestRun]);

  const pipelineStatusText = useMemo(() => {
    if (latestRun) return prototypeRunStatusLabelKo(latestRun.status);
    return statusLabel(record.runStatus, Boolean(previewUrl));
  }, [latestRun, record.runStatus, previewUrl]);

  return (
    <div style={{ position: "relative" }}>
      {toast ? (
        <div style={toastStyle}>
          {toast}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 520px) minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
          <div style={card}>
            <div style={cardTitle}>설계 준비도 {designReadinessPercentLocal}%</div>
            <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
              <div style={{ width: `${designReadinessPercentLocal}%`, height: "100%", background: "#0f766e", borderRadius: 999 }} />
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 6, fontSize: 12.5, color: "#0f172a" }}>
              <div style={row}><span style={envPill(ideaOk ? "ok" : "needs")}>{ideaOk ? "OK" : "필요"}</span>아이디어 구체화 완료</div>
              <div style={row}><span style={envPill(actorsOk ? "ok" : "needs")}>{actorsOk ? "OK" : "필요"}</span>액터 정의 완료</div>
              <div style={row}><span style={envPill(flowOk ? "ok" : "needs")}>{flowOk ? "OK" : "필요"}</span>서비스 흐름 정의 완료</div>
              <div style={row}><span style={envPill(ownersOk ? "ok" : "needs")}>{ownersOk ? "OK" : `${ownerAssignedRatio}%`}</span>담당자 지정</div>
              <div style={row}><span style={envPill(featureDraftTitles?.length ? "ok" : "loading")}>{featureDraftTitles?.length ? "있음" : "선택"}</span>기능 정리</div>
            </div>
            {checklistGapLabels.length ? (
              <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: "#b45309" }}>
                남은 항목: {checklistGapLabels.slice(0, 4).join(" · ")}
              </div>
            ) : null}
            {unresolvedChecklistCount > 0 ? (
              <div style={{ marginTop: 6, fontSize: 12.5, color: "#64748b" }}>미해결 항목 {unresolvedChecklistCount}개</div>
            ) : null}
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" onClick={() => onNavigateFix?.()} style={btnPrimary}>지금 보완</button>
            </div>
          </div>

          <div style={card}>
            <div style={cardTitle}>실행 환경 준비도 {envReadinessPercent}%</div>
            <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
              <div style={{ width: `${envReadinessPercent}%`, height: "100%", background: "#0f766e", borderRadius: 999 }} />
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 8, fontSize: 12.5, color: "#0f172a" }}>
              <div style={row}><span style={envPill(envStatus.git)}>{labelEnv(envStatus.git)}</span>Git 연결</div>
              <div style={row}><span style={envPill(envStatus.github)}>{labelEnv(envStatus.github)}</span>GitHub 인증</div>
              <div style={row}><span style={envPill(envStatus.cursor)}>{labelEnv(envStatus.cursor)}</span>Cursor 연결</div>
              <div style={row}><span style={envPill(envStatus.runnable)}>{labelEnv(envStatus.runnable)}</span>실행 가능</div>
            </div>
            {executionSetup?.gitRepoName ? (
              <div style={{ marginTop: 10, fontSize: 12.5, color: "#475569" }}>
                저장소: <strong>{executionSetup.gitRepoName}</strong>
                <span style={{ marginLeft: 10, color: "#64748b" }}>기본 브랜치: {executionSetup.baseBranch}</span>
              </div>
            ) : null}
            {envStatus.message ? <div style={{ marginTop: 10, fontSize: 12.5, color: "#475569" }}>{envStatus.message}</div> : null}
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <a href={settingsHref} style={{ ...btn, textDecoration: "none" }}>환경설정</a>
              <button type="button" onClick={() => void loadEnv()} disabled={envBusy} style={{ ...btnMuted, opacity: envBusy ? 0.6 : 1 }}>
                다시 점검
              </button>
              <button type="button" onClick={() => setMockOpen(true)} style={btnMuted}>예시 템플릿 보기</button>
            </div>
          </div>

          <div style={card}>
            <div style={cardTitle}>설계·실행 준비</div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800 }}>
                <span style={{ color: "#64748b", fontWeight: 700 }}>[설계]</span>
                <span style={{ color: canRequestGeneration.designOk ? "#047857" : "#b45309" }}>
                  {canRequestGeneration.designOk ? "프롬프트 작성 가능" : "설계 보완 필요"}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800 }}>
                <span style={{ color: "#64748b", fontWeight: 700 }}>[환경]</span>
                <span style={{ color: canRequestGeneration.envOk ? "#047857" : "#b45309" }}>
                  {canRequestGeneration.envOk ? "실행 준비 완료" : "환경설정 필요"}
                </span>
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 12.5, color: "#475569", lineHeight: 1.5 }}>
              프롬프트 복사는 설계가 충족되면 가능합니다. 커밋·푸시·PR까지 하려면 환경을 완료하세요.
            </div>
            {!canRequestGeneration.envOk ? (
              <div style={{ marginTop: 10 }}>
                <a href={settingsHref} style={{ ...btnPrimary, textDecoration: "none" }}>환경설정으로 이동</a>
              </div>
            ) : null}
          </div>

          <div style={card}>
            <div style={cardTitle}>템플릿 선택</div>
            <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>{tpl?.nameKo}</div>
              {isRecommended ? <span style={badge}>추천됨</span> : <span style={badgeMuted}>사용자 선택</span>}
            </div>
            <div style={{ marginTop: 8, fontSize: 12.5, color: "#475569" }}>
              예상 화면 수: {expectedPageCount} · 난이도: {difficultyKr}
              <span style={{ marginLeft: 8, color: "#64748b" }}>AI 추천 기준: 현재 서비스 흐름 분석</span>
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select
                value={effectiveTemplate}
                onChange={(e) => {
                  const next = e.target.value as PrototypeTemplateType;
                  setTemplateOverride(next);
                  savePrototypeGenerationRecord(projectId, { selectedTemplate: next });
                  refreshRecord();
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
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={cardTitle}>생성 요청</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={automationAvailable ? badge : badgeMuted}>{automationAvailable ? "자동 생성 모드" : "수동 생성 모드"}</span>
                {latestRun?.id ? (
                  <span style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 700 }}>실행 {latestRun.id.slice(0, 8)}…</span>
                ) : null}
              </div>
            </div>
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {!latestRun?.id && canRequestGeneration.designOk ? (
                <button
                  type="button"
                  onClick={() => void onStartGeneration()}
                  disabled={protoBusy}
                  style={{ ...btnPrimary, opacity: protoBusy ? 0.65 : 1 }}
                >
                  생성 시작
                </button>
              ) : null}
              {automationAvailable && canRequestGeneration.designOk ? (
                <button
                  type="button"
                  onClick={() => void onCursorAutoRequest()}
                  disabled={protoBusy || !canRequestGeneration.designOk}
                  style={{ ...btnPrimary, opacity: protoBusy ? 0.65 : 1 }}
                >
                  Cursor 자동 생성 요청
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void onCopyGenerationPrompt()}
                disabled={!canRequestGeneration.designOk || protoBusy}
                style={
                  automationAvailable && canRequestGeneration.designOk
                    ? { ...btn, opacity: canRequestGeneration.designOk && !protoBusy ? 1 : 0.55 }
                    : { ...btnPrimary, opacity: canRequestGeneration.designOk && !protoBusy ? 1 : 0.55 }
                }
              >
                생성 프롬프트 복사
              </button>
              <button type="button" onClick={() => setPromptOpen((v) => !v)} style={btn} disabled={protoBusy}>
                생성 프롬프트 보기
              </button>
              <button type="button" onClick={() => void copyPrompt()} style={btn} disabled={protoBusy}>
                복사
              </button>
              {latestRun?.id ? (
                <button type="button" onClick={() => void onRefreshPrototypeStatus()} disabled={protoBusy} style={btnMuted}>
                  상태 새로고침
                </button>
              ) : null}
              <span style={{ marginLeft: "auto", fontSize: 12.5, color: "#64748b" }}>
                상태: <span style={{ fontWeight: 900, color: "#0f172a" }}>{pipelineStatusText}</span>
              </span>
            </div>
            {!canRequestGeneration.envOk && canRequestGeneration.designOk ? (
              <div style={{ marginTop: 10, fontSize: 12.5, color: "#b45309", lineHeight: 1.5, fontWeight: 700 }}>
                환경설정이 완료되지 않았습니다. Cursor 실행 전 Git/GitHub/Cursor 설정을 완료하세요.
              </div>
            ) : null}
            <div style={{ marginTop: 10, fontSize: 12.5, color: "#64748b", lineHeight: 1.5 }}>
              {automationAvailable
                ? "자동 생성 모드: Cursor Cloud Agent API로 에이전트를 시작할 수 있습니다. 수동으로 진행하려면 프롬프트 복사만 사용하세요."
                : "수동 생성 모드: Cursor API 자동 실행을 쓰려면 실행 환경 검증(validated)과 Cursor API 키가 필요합니다. (스텁·미설정 시 수동만 가능)"}
              {automationBlockReason ? (
                <span style={{ display: "block", marginTop: 6, color: "#b45309", fontWeight: 700 }}>
                  자동 불가 사유: {automationBlockReason}
                </span>
              ) : null}
            </div>
            {promptOpen ? (
              <textarea
                readOnly
                value={promptPackage}
                style={{
                  marginTop: 10,
                  width: "100%",
                  minHeight: 260,
                  fontSize: 11.5,
                  fontFamily: "ui-monospace, monospace",
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  padding: 10,
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
              />
            ) : null}
            {staleRegenerate ? (
              <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 900, color: "#92400e" }}>설계 변경됨 — 다시 생성 필요</div>
            ) : null}
          </div>

          <div style={card}>
            <div style={cardTitle}>진행 상태</div>
            <div style={{ marginTop: 8, border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, background: "#f8fafc" }}>
              <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a" }}>파이프라인 저장</div>
              <div style={{ marginTop: 6, fontSize: 12.5, color: "#475569", lineHeight: 1.45 }}>
                실행 기록은 서버 측 파일 저장소에 보관됩니다(DB 마이그레이션 전). PR/Merge 전용 경로는 ENV_TEST와 분리되어 있습니다.
              </div>
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {timeline.map((s) => (
                <div key={s.label} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12.5, color: "#0f172a" }}>
                  <span style={timelineDot(s.status)} />
                  <span style={{ fontWeight: 800 }}>{s.label}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 12.5, color: "#64748b" }}>
              <span style={{ marginRight: 12 }}><span style={timelineDot("success")} /> 실제 완료</span>
              <span style={{ marginRight: 12 }}><span style={timelineDot("running")} /> 진행 가능</span>
              <span style={{ marginRight: 12 }}><span style={timelineDot("pending")} /> 미연동</span>
              <span style={{ marginRight: 12 }}><span style={timelineDot("blocked")} /> 수동 처리</span>
              <span><span style={timelineDot("failed")} /> 오류</span>
            </div>
          </div>

          <div style={card}>
            <div style={cardTitle}>실제 결과물 미리보기</div>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                value={urlDraft || record.previewUrl || ""}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="https://…"
                style={inputStyle}
              />
              <button type="button" onClick={() => void applyPreviewUrl()} disabled={protoBusy} style={btnPrimary}>
                URL 적용
              </button>
              {previewUrl ? (
                <>
                  <button type="button" onClick={() => setResultOpen(true)} style={btnMuted}>결과물 보기</button>
                  <a href={previewUrl} target="_blank" rel="noreferrer" style={{ ...btnMuted, textDecoration: "none" }}>새 탭 열기</a>
                  <button type="button" onClick={clearPreviewUrl} style={btn}>초기화</button>
                </>
              ) : null}
            </div>
            <div style={{ marginTop: 10, fontSize: 12.5, color: "#475569" }}>
              {previewUrl ? "결과가 준비되었습니다." : "아직 결과물이 연결되지 않았습니다."}
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 6, fontSize: 12.5, color: "#64748b" }}>
              <div>결과 URL: {previewUrl ? <span style={{ color: "#0f172a", fontWeight: 800 }}>{previewUrl}</span> : "아직 결과물이 연결되지 않았습니다."}</div>
              <div>
                최근 생성 요청 시간:{" "}
                {latestRun?.updatedAt
                  ? new Date(latestRun.updatedAt).toLocaleString()
                  : record.lastRequestedAt
                    ? new Date(record.lastRequestedAt).toLocaleString()
                    : "—"}
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={cardTitle}>향후 자동화 파이프라인</div>
            <ol style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12.5, color: "#475569", lineHeight: 1.55 }}>
              <li>Cursor 수동 생성 → API 연동(예정)</li>
              <li>Git Commit 감지</li>
              <li>AI 기획자 소스 점검</li>
              <li>보완 요청(필요시)</li>
              <li>PR 생성</li>
              <li>Merge</li>
              <li>자동 배포</li>
              <li>결과물 연결</li>
            </ol>
          </div>
        </div>
      </div>

      <PrototypePreviewDraggableShell
        open={mockOpen}
        onClose={() => setMockOpen(false)}
        title="예시 템플릿 보기"
        modalWidth="min(860px, calc(100vw - 20px))"
      >
        <div style={{ fontSize: 12.5, fontWeight: 900, color: "#92400e", marginBottom: 10 }}>
          예시 화면이며 실제 생성 결과가 아닙니다.
        </div>
        <PrototypeMockFallbackPanel
          projectName={projectName}
          projectDescription={projectDescription}
          ideationAssets={ideationAssets}
          flowSteps={flowSteps}
          actors={actors}
          recommendedTemplateOverride={effectiveTemplate}
        />
      </PrototypePreviewDraggableShell>

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
    </div>
  );
}

// Re-export alias for new name usage (same behavior).
export const PrototypeGenerationWorkspace = PrototypePreviewPanel;

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

const inputStyle: CSSProperties = {
  flex: "1 1 260px",
  minWidth: 0,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  fontSize: 12.5,
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
