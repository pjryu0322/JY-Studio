"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PrototypeMockFallbackPanel } from "@/components/preview/PrototypeMockFallbackPanel";
import type {
  PrototypeWorkspaceActor,
  PrototypeWorkspaceFlowStep,
  PrototypeWorkspaceIdeationAsset,
} from "@/components/preview/prototypeWorkspaceTypes";
import { buildCursorPrototypePromptPackage } from "@/lib/prototype/buildCursorPrototypePrompt";
import { analyzePrototypeContext } from "@/lib/prototype/prototypeContextAnalyzer";
import {
  loadPrototypeGenerationRecord,
  savePrototypeGenerationRecord,
  type PrototypeGenerationLocalRecord,
} from "@/lib/prototype/prototypeGenerationLocalStore";
import { PROTOTYPE_TEMPLATES } from "@/lib/templates/prototypeTemplates";

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
      analysis,
      projectName: projectName.trim() || "프로젝트",
      projectDescription: projectDescription.trim(),
      actors: actors.map((a) => ({ name: a.name, kind: a.kind, description: a.description })),
      flowSteps: stepsForPrompt,
      featureDraftTitles,
    });
  }, [analysis, projectName, projectDescription, actors, flowSteps, featureDraftTitles, actorName]);

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
    });
    refreshRecord();
    showToast("Cursor에서 붙여넣어 생성을 진행한 뒤, 미리보기 URL을 입력하세요.");
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

  const tpl = PROTOTYPE_TEMPLATES.find((t) => t.id === analysis.recommendedTemplate);

  const leftCol = (
    <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>프로토타입 생성 준비도 {prototypeReadinessPercent}%</div>
        <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
          <div style={{ width: `${prototypeReadinessPercent}%`, height: "100%", background: "#0f766e", borderRadius: 999 }} />
        </div>
        <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12.5, color: "#475569", lineHeight: 1.55 }}>
          <li>아이디어 요약: {projectDescription.trim().length > 24 || ideationAssets.length ? "있음" : "부족"}</li>
          <li>액터: {actors.length >= 2 ? "충족" : "부족"}</li>
          <li>서비스 흐름: {flowSteps.length >= 3 ? "충족" : "부족"}</li>
          <li>담당 지정:{" "}
            {flowSteps.length > 0 && flowSteps.every((s) => String(s.primaryActorId ?? "").trim()) ? "충족" : "미비"}
          </li>
          <li>미해결 체크리스트: {unresolvedChecklistCount}개</li>
          <li>기능 정리 초안: {featureDraftTitles?.length ? `${featureDraftTitles.length}건` : "(선택)"}</li>
        </ul>
        {checklistGapLabels.length ? (
          <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: "#b45309" }}>
            보완 권장: {checklistGapLabels.slice(0, 5).join(" · ")}
          </div>
        ) : null}
        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" onClick={() => onNavigateFix?.()} style={btnPrimary}>
            지금 보완
          </button>
          <button type="button" onClick={proceedWithGaps} style={btn}>
            미정의로 진행
          </button>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 12.5, fontWeight: 900, color: "#64748b" }}>문맥 분석</div>
        <div style={{ marginTop: 6, fontSize: 12.5, color: "#0f172a", lineHeight: 1.5 }}>
          유형: <strong>{analysis.projectType}</strong>
          <br />
          사용자: {analysis.userType} · 복잡도: {analysis.workflowComplexity} · 신뢰도: {analysis.confidence}%
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 12.5, fontWeight: 900, color: "#64748b" }}>추천 템플릿 (시드)</div>
        <div style={{ marginTop: 6, fontSize: 14, fontWeight: 900, color: "#0f172a" }}>
          {tpl?.nameKo} ({tpl?.nameEn})
        </div>
        {analysis.recommendedTemplateNotes.length ? (
          <div style={{ marginTop: 6, fontSize: 12, color: "#475569" }}>{analysis.recommendedTemplateNotes.join(" · ")}</div>
        ) : null}
      </div>

      <div style={card}>
        <div style={{ fontSize: 12.5, fontWeight: 900, color: "#64748b" }}>Cursor 실행 상태</div>
        <div style={{ marginTop: 8, fontSize: 14, fontWeight: 900, color: "#0f172a" }}>
          {statusLabel(record.runStatus, Boolean(record.previewUrl && isLikelyPreviewUrl(record.previewUrl)))}
        </div>
        {record.lastError ? <div style={{ marginTop: 6, fontSize: 12, color: "#b91c1c" }}>{record.lastError}</div> : null}
        <div style={{ marginTop: 10, fontSize: 11.5, color: "#64748b", lineHeight: 1.45 }}>
          서버 실행 엔진 없이 브라우저에만 상태를 저장합니다. Cursor에서 코드 생성 후 로컬/배포 URL을 붙여넣으면 iframe으로 열 수 있습니다.
        </div>
      </div>

      <div style={card}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <button type="button" onClick={() => setPromptOpen((v) => !v)} style={btn}>
            프롬프트 보기
          </button>
          <button type="button" onClick={() => void copyPrompt()} style={btn}>
            복사
          </button>
          <button type="button" onClick={() => void onCursorRequest()} style={btnPrimary}>
            Cursor 생성 요청
          </button>
        </div>
        {promptOpen ? (
          <textarea
            readOnly
            value={promptPackage}
            style={{
              marginTop: 10,
              width: "100%",
              minHeight: 220,
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
      </div>

      <div style={card}>
        <div style={{ fontSize: 12.5, fontWeight: 900, color: "#64748b" }}>생성 결과 URL</div>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={urlDraft || record.previewUrl || ""}
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder="https://… (로컬 dev 서버 또는 배포 URL)"
            style={{
              flex: "1 1 200px",
              minWidth: 0,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              fontSize: 12.5,
            }}
          />
          <button type="button" onClick={applyPreviewUrl} style={btnPrimary}>
            URL 적용
          </button>
          <button type="button" onClick={clearPreviewUrl} style={btn}>
            초기화
          </button>
        </div>
      </div>
    </div>
  );

  const previewUrl = record.previewUrl && isLikelyPreviewUrl(record.previewUrl) ? record.previewUrl.trim() : null;

  const rightCol = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 360, minWidth: 0 }}>
      {staleRegenerate ? (
        <div style={{ ...card, borderColor: "#fcd34d", background: "#fffbeb" }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#92400e" }}>설계 변경됨 — 다시 생성 필요</div>
          <div style={{ marginTop: 6, fontSize: 12.5, color: "#78350f", lineHeight: 1.45 }}>
            액터·서비스 흐름 등이 마지막 생성 요청 이후 바뀌었습니다. Cursor에 다시 프롬프트를 보내고 미리보기 URL을 갱신해 주세요.
          </div>
        </div>
      ) : null}

      <div style={{ ...card, flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 900, color: "#64748b", marginBottom: 8 }}>생성 미리보기</div>
        {previewUrl ? (
          <iframe
            title="프로토타입 미리보기"
            src={previewUrl}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            style={{ flex: 1, width: "100%", minHeight: 420, border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff" }}
          />
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            <PrototypeMockFallbackPanel
              projectName={projectName}
              projectDescription={projectDescription}
              ideationAssets={ideationAssets}
              flowSteps={flowSteps}
              actors={actors}
              recommendedTemplateOverride={analysis.recommendedTemplate}
            />
          </div>
        )}
      </div>
    </div>
  );

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

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "stretch" }}>
        <div style={{ flex: "1 1 300px", maxWidth: 440, minWidth: 0 }}>{leftCol}</div>
        <div style={{ flex: "3 1 420px", minWidth: 0 }}>{rightCol}</div>
      </div>
    </div>
  );
}

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
