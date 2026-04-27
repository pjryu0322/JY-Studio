"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PrototypeMockFallbackPanel } from "@/components/preview/PrototypeMockFallbackPanel";
import { PrototypePreviewDraggableShell } from "@/components/preview/PrototypePreviewDraggableShell";
import type {
  PrototypeWorkspaceActor,
  PrototypeWorkspaceFlowStep,
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
import { PROTOTYPE_TEMPLATES, type PrototypeTemplateType } from "@/lib/templates/prototypeTemplates";

export type PrototypeGenerationWorkspaceProps = Readonly<{
  projectId: string;
  projectName: string;
  projectDescription: string;
  ideationAssets: ReadonlyArray<PrototypeWorkspaceIdeationAsset>;
  flowSteps: ReadonlyArray<PrototypeWorkspaceFlowStep>;
  actors: ReadonlyArray<PrototypeWorkspaceActor>;
  featureDraftTitles?: readonly string[];
  /** 서비스 흐름 체크리스트 진행률 등 */
  designReadinessPercent: number;
  checklistGapLabels: readonly string[];
  unresolvedChecklistCount: number;
  /** 액터·흐름·아이디어 기반 설계 지문 */
  designFingerprint: string;
  onNavigateFix?: () => void;
}>;

function statusLabel(s: PrototypeGenerationLocalRecord["runStatus"], hasUrl: boolean): string {
  if (hasUrl) return "미리보기 준비됨";
  switch (s) {
    case "awaiting_preview":
    case "prompt_ready":
      return "생성중 (Cursor 작업 대기)";
    case "preview_ready":
      return "미리보기 준비됨";
    case "failed":
      return "실패";
    default:
      return "대기중";
  }
}

function isLikelyPreviewUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  return /^https?:\/\//i.test(u);
}

type EnvBadge = "ok" | "needs" | "error" | "loading";
type EnvStatus = Readonly<{
  git: EnvBadge;
  github: EnvBadge;
  cursor: EnvBadge;
  runnable: EnvBadge;
  message: string | null;
}>;

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

export function PrototypeGenerationWorkspace(props: PrototypeGenerationWorkspaceProps) {
  const {
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
  } = props;

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
    // restore user's last selected template if present
    const raw = record.selectedTemplate;
    const normalized = raw && PROTOTYPE_TEMPLATES.some((t) => t.id === raw) ? (raw as PrototypeTemplateType) : null;
    if (normalized) setTemplateOverride(normalized);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally on project switch only
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

  const prototypeReadinessPercent = useMemo(() => {
    const ownersOk = flowSteps.length > 0 && flowSteps.every((s) => String(s.primaryActorId ?? "").trim());
    const ideaOk =
      projectDescription.trim().length > 24 ||
      ideationAssets.some((a) => String(a.content ?? a.title ?? "").trim().length > 20);
    const base = Math.round(designReadinessPercent * 0.42 + analysis.confidence * 0.28);
    const bonus = (ideaOk ? 12 : 0) + (ownersOk ? 14 : 0) + (actors.length >= 2 ? 10 : 0) + (flowSteps.length >= 3 ? 8 : 0);
    const urlBonus = record.previewUrl && isLikelyPreviewUrl(record.previewUrl) ? 18 : 0;
    return Math.min(100, base + bonus + urlBonus);
  }, [
    designReadinessPercent,
    analysis.confidence,
    flowSteps,
    projectDescription,
    ideationAssets,
    actors.length,
    record.previewUrl,
  ]);

  const staleRegenerate = Boolean(record.fingerprintAtRequest && record.fingerprintAtRequest !== designFingerprint);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptPackage);
      showToast("프롬프트를 클립보드에 복사했습니다.");
    } catch {
      showToast("복사에 실패했습니다. 프롬프트 보기에서 직접 선택해 주세요.");
    }
  };

  const onCursorRequest = async () => {
    await copyPrompt();
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
  };

  const applyPreviewUrl = () => {
    const u = urlDraft.trim();
    if (!isLikelyPreviewUrl(u)) {
      savePrototypeGenerationRecord(projectId, { lastError: "http(s) URL만 지원합니다.", runStatus: "failed" });
      refreshRecord();
      return;
    }
    savePrototypeGenerationRecord(projectId, {
      previewUrl: u,
      runStatus: "preview_ready",
      lastError: null,
    });
    refreshRecord();
    showToast("미리보기 URL을 적용했습니다.");
  };

  const clearPreviewUrl = () => {
    savePrototypeGenerationRecord(projectId, { previewUrl: null, runStatus: "idle", lastError: null });
    setUrlDraft("");
    refreshRecord();
  };

  const proceedWithGaps = () => {
    savePrototypeGenerationRecord(projectId, { proceedWithGaps: true });
    refreshRecord();
  };

  const tpl = PROTOTYPE_TEMPLATES.find((t) => t.id === effectiveTemplate);
  const isRecommended = effectiveTemplate === analysis.recommendedTemplate && !templateOverride;
  const expectedPageCount = Math.max(3, Math.min(8, Math.round((analysis.recommendedPages?.length ?? 5) || 5)));
  const difficultyKr = analysis.workflowComplexity === "high" ? "높음" : analysis.workflowComplexity === "low" ? "낮음" : "보통";

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

  return (
    <div style={{ position: "relative" }}>
      {toast ? (
        <div
          style={{
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
          }}
        >
          {toast}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 520px) minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
          <div style={card}>
            <div style={cardTitle}>생성 준비도</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{prototypeReadinessPercent}%</div>
              <div style={{ fontSize: 12.5, color: "#64748b" }}>미해결 {unresolvedChecklistCount}개</div>
            </div>
            <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
              <div style={{ width: `${prototypeReadinessPercent}%`, height: "100%", background: "#0f766e", borderRadius: 999 }} />
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 6, fontSize: 12.5, color: "#0f172a" }}>
              <div style={checkRow}><span style={envPill(projectDescription.trim().length > 24 || ideationAssets.length ? "ok" : "needs")}>{projectDescription.trim().length > 24 || ideationAssets.length ? "OK" : "필요"}</span>아이디어 요약</div>
              <div style={checkRow}><span style={envPill(actors.length >= 2 ? "ok" : "needs")}>{actors.length >= 2 ? "OK" : "필요"}</span>액터 정의 완료</div>
              <div style={checkRow}><span style={envPill(flowSteps.length >= 3 ? "ok" : "needs")}>{flowSteps.length >= 3 ? "OK" : "필요"}</span>서비스 흐름 정의 완료</div>
              <div style={checkRow}><span style={envPill(flowSteps.length > 0 && flowSteps.every((s) => String(s.primaryActorId ?? "").trim()) ? "ok" : "needs")}>{flowSteps.length > 0 && flowSteps.every((s) => String(s.primaryActorId ?? "").trim()) ? "OK" : "필요"}</span>담당자 지정 완료</div>
              <div style={checkRow}><span style={envPill(featureDraftTitles?.length ? "ok" : "loading")}>{featureDraftTitles?.length ? "있음" : "선택"}</span>기능 정리 초안</div>
            </div>
            {checklistGapLabels.length ? (
              <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: "#b45309" }}>
                미해결: {checklistGapLabels.slice(0, 4).join(" · ")}
              </div>
            ) : null}
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" onClick={() => onNavigateFix?.()} style={btnPrimary}>지금 보완</button>
              <button type="button" onClick={proceedWithGaps} style={btn}>미정의로 진행</button>
            </div>
          </div>

          <div style={card}>
            <div style={cardTitle}>추천 템플릿</div>
            <div style={{ marginTop: 6, display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>{tpl?.nameKo}</div>
              {isRecommended ? <span style={badge}>추천됨</span> : <span style={badgeMuted}>사용자 선택</span>}
            </div>
            <div style={{ marginTop: 6, fontSize: 12.5, color: "#475569" }}>
              예상 화면 수: {expectedPageCount}개 · 난이도: {difficultyKr}
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
              <button type="button" onClick={() => setMockOpen(true)} style={btnMuted}>예시 템플릿 보기</button>
            </div>
          </div>

          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={cardTitle}>환경 상태</div>
              <button type="button" onClick={() => void loadEnv()} disabled={envBusy} style={{ ...btn, marginLeft: "auto", opacity: envBusy ? 0.6 : 1 }}>
                다시 점검
              </button>
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 8, fontSize: 12.5, color: "#0f172a" }}>
              <div style={checkRow}><span style={envPill(envStatus.git)}>{labelEnv(envStatus.git)}</span>Git 연결</div>
              <div style={checkRow}><span style={envPill(envStatus.github)}>{labelEnv(envStatus.github)}</span>GitHub 인증</div>
              <div style={checkRow}><span style={envPill(envStatus.cursor)}>{labelEnv(envStatus.cursor)}</span>Cursor 연결</div>
              <div style={checkRow}><span style={envPill(envStatus.runnable)}>{labelEnv(envStatus.runnable)}</span>실행 가능</div>
            </div>
            {envStatus.message ? <div style={{ marginTop: 10, fontSize: 12.5, color: "#475569" }}>{envStatus.message}</div> : null}
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <a href={settingsHref} style={{ ...btn, textDecoration: "none" }}>설정으로 이동</a>
              {executionSetup?.gitRepoName ? <span style={{ fontSize: 11.5, color: "#64748b" }}>{executionSetup.gitRepoName}</span> : null}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
          <div style={card}>
            <div style={cardTitle}>생성 요청 / 진행 상태</div>
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <button type="button" onClick={() => setPromptOpen((v) => !v)} style={btn}>생성 프롬프트 보기</button>
              <button type="button" onClick={() => void copyPrompt()} style={btn}>복사</button>
              <button type="button" onClick={() => void onCursorRequest()} style={btnPrimary}>Cursor 생성 요청</button>
              <span style={{ marginLeft: "auto", fontSize: 12.5, color: "#64748b" }}>
                상태: <span style={{ fontWeight: 900, color: "#0f172a" }}>{statusLabel(record.runStatus, Boolean(record.previewUrl && isLikelyPreviewUrl(record.previewUrl)))}</span>
              </span>
            </div>
            {promptOpen ? (
              <textarea
                readOnly
                value={promptPackage}
                style={{
                  marginTop: 10,
                  width: "100%",
                  minHeight: 240,
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
            <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
              <div style={timelineRow}><span style={timelineDot(record.lastRequestedAt ? "success" : "pending")} />생성 요청됨</div>
              <div style={timelineRow}><span style={timelineDot(record.runStatus === "awaiting_preview" ? "running" : record.lastRequestedAt ? "pending" : "blocked")} />Cursor 작업중</div>
              <div style={timelineRow}><span style={timelineDot(record.previewUrl && isLikelyPreviewUrl(record.previewUrl) ? "success" : record.lastRequestedAt ? "pending" : "blocked")} />결과 URL 연결</div>
              <div style={timelineRow}><span style={timelineDot(record.previewUrl && isLikelyPreviewUrl(record.previewUrl) ? "success" : "pending")} />결과물 확인</div>
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
              <button type="button" onClick={applyPreviewUrl} style={btnPrimary}>URL 적용</button>
              <button type="button" onClick={clearPreviewUrl} style={btn}>초기화</button>
              {record.previewUrl && isLikelyPreviewUrl(record.previewUrl) ? (
                <>
                  <button type="button" onClick={() => setResultOpen(true)} style={btnMuted}>결과물 보기</button>
                  <a href={record.previewUrl.trim()} target="_blank" rel="noreferrer" style={{ ...btnMuted, textDecoration: "none" }}>새 탭 열기</a>
                </>
              ) : null}
            </div>
            <div style={{ marginTop: 10, fontSize: 12.5, color: "#475569" }}>
              {record.previewUrl && isLikelyPreviewUrl(record.previewUrl) ? "결과가 준비되었습니다." : "생성이 완료되면 실제 결과물이 표시됩니다."}
            </div>
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
        title="생성 결과 보기"
        modalWidth="min(980px, calc(100vw - 20px))"
      >
        {record.previewUrl && isLikelyPreviewUrl(record.previewUrl) ? (
          <iframe
            title="프로토타입 결과"
            src={record.previewUrl.trim()}
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

const checkRow: CSSProperties = { display: "flex", gap: 10, alignItems: "center" };

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

const timelineRow: CSSProperties = { display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "#0f172a" };

function timelineDot(kind: "pending" | "running" | "success" | "failed" | "blocked"): CSSProperties {
  const base: CSSProperties = { width: 10, height: 10, borderRadius: 999, border: "1px solid #cbd5e1", background: "#fff" };
  if (kind === "success") return { ...base, borderColor: "#a7f3d0", background: "#22c55e" };
  if (kind === "running") return { ...base, borderColor: "#93c5fd", background: "#3b82f6" };
  if (kind === "failed") return { ...base, borderColor: "#fecaca", background: "#ef4444" };
  if (kind === "blocked") return { ...base, borderColor: "#fde68a", background: "#f59e0b" };
  return { ...base, borderColor: "#e2e8f0", background: "#cbd5e1" };
}
