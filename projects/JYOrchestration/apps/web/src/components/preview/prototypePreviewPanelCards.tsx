"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import type { PrototypeRun, PrototypeWorkUnit } from "@/lib/prototype/prototypeRunTypes";
import {
  buildFiveStepPipelineRows,
  mapWorkUnitPlanStatusKo,
  resolveActiveWorkUnitForPanel,
  workUnitProgressAllMerged,
} from "@/components/preview/prototypePreviewPanelHelpers";
import type { StepTone } from "@/components/preview/prototypePreviewPanelHelpers";

const subCard: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 12,
  background: "#fff",
};

const subTitle: CSSProperties = { fontSize: 12, fontWeight: 950, color: "#64748b", marginBottom: 8 };

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

const btnMuted: CSSProperties = { ...btn, border: "1px solid #e2e8f0", background: "#f8fafc" };

const btnPrimary: CSSProperties = { ...btn, border: "1px solid #0f766e", background: "#0f766e", color: "#fff" };

function toneColor(tone: StepTone): string {
  if (tone === "done") return "#16a34a";
  if (tone === "running") return "#2563eb";
  if (tone === "failed") return "#dc2626";
  if (tone === "warn") return "#ea580c";
  return "#94a3b8";
}

function planStatusColor(label: string): string {
  if (label === "완료") return "#16a34a";
  if (label === "진행중") return "#2563eb";
  if (label === "대기") return "#64748b";
  if (label === "실패") return "#dc2626";
  if (label === "보완필요") return "#ea580c";
  return "#64748b";
}

function hhmm(iso: string | null | undefined): string {
  const s = String(iso ?? "").trim();
  if (!s) return "--:--";
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return "--:--";
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** latestRun 기반 의미 있는 로그(최신 max줄까지 생성 후 슬라이스). */
export function deriveActivityLogLines(run: PrototypeRun | null, max = 40): string[] {
  if (!run) return [];
  const lines: string[] = [];
  if (run.createdAt) lines.push(`${hhmm(run.createdAt)} 실행 생성`);
  if (run.plannerStatus === "DONE") lines.push(`${hhmm(run.updatedAt)} AI 작업계획 생성`);
  const wu = [...(run.workUnits ?? [])].sort((a, b) => a.order - b.order);
  for (const u of wu) {
    if (u.status === "MERGED") {
      lines.push(`${hhmm(u.executionCompletedAt ?? u.finishedAt ?? run.updatedAt)} WorkUnit ${u.order} 완료`);
    }
  }
  const active = resolveActiveWorkUnitForPanel(run);
  if (active && active.status !== "MERGED" && active.status !== "SKIPPED") {
    lines.push(`${hhmm(run.updatedAt)} WorkUnit ${active.order} 진행중`);
  }
  if (run.prUrl) lines.push(`${hhmm(run.updatedAt)} PR 생성`);
  if (run.mergeSha) lines.push(`${hhmm(run.updatedAt)} Merge 완료`);
  if (run.status === "DEPLOYING") lines.push(`${hhmm(run.deploymentStartedAt ?? run.updatedAt)} 배포중`);
  if (run.status === "PREVIEW_READY") lines.push(`${hhmm(run.updatedAt)} 결과 URL 준비 완료`);
  if (run.status === "DEPLOY_FAILED") lines.push(`${hhmm(run.updatedAt)} 배포 실패`);
  return lines.slice(-max);
}

export type WorkUnitPlanStats = Readonly<{
  total: number;
  /** 진행률 막대: MERGED 개수만 */
  mergedForBar: number;
  progressPercent: number;
  summaryMerged: number;
  summaryRunning: number;
  summaryPending: number;
  summaryFailed: number;
}>;

export type WorkUnitPlanCardProps = Readonly<{
  latestRun: PrototypeRun | null;
  stats: WorkUnitPlanStats;
  protoBusy: boolean;
  plannerFeedback: string;
  onPlannerFeedbackChange: (v: string) => void;
  onApplyPlannerFeedbackRegenerate: () => void;
  onRetryWorkUnit: (runId: string, order: number, mode: "same_prompt" | "regenerate_prompt") => void;
  /** 채팅 메시지 안에 넣을 때 헤더(“AI 작업계획”)를 숨깁니다. */
  hideHeader?: boolean;
  /** 채팅 입력으로 대체할 때 textarea/버튼을 숨깁니다. */
  hidePlannerFeedback?: boolean;
}>;

export function WorkUnitPlanCard(p: WorkUnitPlanCardProps) {
  const run = p.latestRun;
  const [promptModal, setPromptModal] = useState<PrototypeWorkUnit | null>(null);
  const units = useMemo(() => [...(run?.workUnits ?? [])].sort((a, b) => a.order - b.order), [run?.workUnits]);

  if (!run?.id) return null;

  const showPlannerFeedback = run.status === "WORK_UNITS_READY";
  const rid = run.id;

  const descPreview = (d: string) => {
    const t = String(d ?? "").trim().replace(/\s+/g, " ");
    return t.length > 120 ? `${t.slice(0, 120)}…` : t;
  };

  return (
    <div style={subCard}>
      {p.hideHeader ? null : <div style={{ ...subTitle, marginBottom: 10 }}>AI 작업계획</div>}
      {units.length === 0 ? null : (
        <>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "#334155", marginBottom: 10, lineHeight: 1.45 }}>
            총 {p.stats.total}개 / 완료 {p.stats.summaryMerged} / 진행중 {p.stats.summaryRunning} / 대기 {p.stats.summaryPending} / 실패{" "}
            {p.stats.summaryFailed}
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>
              {p.stats.mergedForBar} / {p.stats.total} 완료 ({p.stats.progressPercent}%)
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 999,
                background: "#e2e8f0",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${p.stats.progressPercent}%`,
                  background: "#16a34a",
                  transition: "width 0.2s ease",
                }}
              />
            </div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {units.map((u) => {
              const stLabel = mapWorkUnitPlanStatusKo(u.status);
              const stColor = planStatusColor(stLabel);
              const canRetry = u.status === "FAILED" || u.status === "REVIEW_REWORK";
              return (
                <div
                  key={u.id}
                  style={{
                    border: "1px solid #e8eef4",
                    borderRadius: 10,
                    padding: "10px 10px",
                    background: "#fafbfc",
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "baseline", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 950, color: "#0f172a" }}>
                      {u.order}. {u.title}
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 900, color: stColor }}>{stLabel}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: 4 }}>
                    위험 {u.riskLevel} · 복잡도 {u.estimatedComplexity}
                    {u.targetArea ? ` · ${u.targetArea}` : ""}
                  </div>
                  {u.description ? (
                    <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.45, marginBottom: 8 }}>{descPreview(u.description)}</div>
                  ) : null}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {u.cursorPrompt?.trim() ? (
                      <button type="button" onClick={() => setPromptModal(u)} style={btnMuted}>
                        Cursor 프롬프트 보기
                      </button>
                    ) : null}
                    {u.prUrl ? (
                      <button type="button" onClick={() => window.open(u.prUrl ?? "", "_blank", "noopener,noreferrer")} style={btn}>
                        PR 보기
                      </button>
                    ) : null}
                    {canRetry ? (
                      <button
                        type="button"
                        title="WorkUnit 단위 재실행"
                        disabled={p.protoBusy}
                        onClick={() => p.onRetryWorkUnit(rid, u.order, "same_prompt")}
                        style={btn}
                      >
                        재실행
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          {showPlannerFeedback && !p.hidePlannerFeedback ? (
            <div style={{ marginTop: 14, borderTop: "1px solid #e8eef4", paddingTop: 12 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b", marginBottom: 6 }}>작업계획 피드백</div>
              <textarea
                value={p.plannerFeedback}
                onChange={(e) => p.onPlannerFeedbackChange(e.target.value)}
                placeholder="작업계획에 반영할 의견을 입력하세요. 예: 관리자 화면은 제외하고, 회의록 요약 패널을 먼저 만들어줘."
                rows={3}
                style={{
                  width: "100%",
                  resize: "vertical",
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  padding: 8,
                  fontSize: 12.5,
                  lineHeight: 1.45,
                  marginBottom: 8,
                }}
              />
              <button
                type="button"
                onClick={() => p.onApplyPlannerFeedbackRegenerate()}
                disabled={p.protoBusy}
                style={btnPrimary}
              >
                의견 반영하여 재생성
              </button>
            </div>
          ) : null}
          {run.plannerError ? (
            <details style={{ fontSize: 12, color: "#64748b", marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontWeight: 800 }}>플래너 메모</summary>
              <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{run.plannerError}</div>
            </details>
          ) : null}
        </>
      )}

      {promptModal ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 9998,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
          }}
          onClick={() => setPromptModal(null)}
        >
          <div
            style={{
              width: "min(720px, 100%)",
              maxHeight: "min(80vh, 640px)",
              overflow: "auto",
              background: "#fff",
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              padding: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 14, fontWeight: 1000, color: "#0f172a", marginBottom: 8 }}>
              WorkUnit {promptModal.order} Cursor 프롬프트
            </div>
            <pre
              style={{
                margin: "0 0 12px",
                padding: 10,
                background: "#f8fafc",
                borderRadius: 10,
                fontSize: 11.5,
                lineHeight: 1.45,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {String(promptModal.cursorPrompt ?? "").trim() || "(없음)"}
            </pre>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" onClick={() => setPromptModal(null)} style={btnMuted}>
                닫기
              </button>
              <button
                type="button"
                onClick={() => {
                  const text = String(promptModal.cursorPrompt ?? "").trim();
                  if (text) void navigator.clipboard?.writeText(text).catch(() => {});
                }}
                style={btnPrimary}
              >
                이 WorkUnit 프롬프트 복사
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type CurrentWorkUnitPanelProps = Readonly<{
  latestRun: PrototypeRun | null;
  /** 채팅 안에서 “현재 작업” 헤더를 숨깁니다. */
  hideHeader?: boolean;
}>;

export function CurrentWorkUnitPanel(p: CurrentWorkUnitPanelProps) {
  const run = p.latestRun;
  const units = run?.workUnits ?? [];
  const active = resolveActiveWorkUnitForPanel(run);
  const total = units.length;

  if (!run?.id || !total) return null;

  const rows = active ? buildFiveStepPipelineRows(active) : [];

  return (
    <div style={subCard}>
      {p.hideHeader ? null : <div style={{ ...subTitle, marginBottom: 8 }}>현재 작업</div>}
      {!active ? (
        <div style={{ fontSize: 12.5, color: "#64748b" }}>표시할 활성 WorkUnit이 없습니다.</div>
      ) : (
        <>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "#475569", marginBottom: 6 }}>
            WorkUnit {active.order} / {total}
          </div>
          <div style={{ fontSize: 14, fontWeight: 950, color: "#0f172a", marginBottom: 6 }}>{active.title}</div>
          {active.description ? (
            <div style={{ fontSize: 12.5, color: "#334155", lineHeight: 1.5, marginBottom: 12 }}>{active.description}</div>
          ) : null}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gridTemplateRows: "auto auto",
              gap: 6,
              marginBottom: 4,
            }}
          >
            {rows.map((r) => (
              <div key={`h-${r.key}`} style={{ fontSize: 10.5, fontWeight: 900, color: "#64748b", textAlign: "center" }}>
                {r.label}
              </div>
            ))}
            {rows.map((r) => (
              <div
                key={`c-${r.key}`}
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: toneColor(r.tone),
                  textAlign: "center",
                  padding: "6px 4px",
                  borderRadius: 8,
                  background: "#f1f5f9",
                }}
              >
                {r.stateKo}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export type DeploymentStatusPanelProps = Readonly<{
  latestRun: PrototypeRun | null;
  previewUrl: string | null;
  pagesSettingsHref: string | null;
  onOpenPreview: () => void;
  onCopyPreviewUrl: () => void;
  /** 채팅 안에서 “배포 상태” 헤더를 숨깁니다. */
  hideHeader?: boolean;
}>;

export function DeploymentStatusPanel(p: DeploymentStatusPanelProps) {
  const run = p.latestRun;
  if (!run?.id) return null;

  const allMerged = workUnitProgressAllMerged(run);
  const s = run.status;
  const url = (p.previewUrl ?? run.previewUrl ?? run.suggestedPreviewUrl ?? "").trim();
  const actionsUrl = run.pagesDeployWorkflowRunUrl?.trim();

  let headline = "";
  if (!allMerged) {
    headline = "모든 WorkUnit이 완료되면 플랫폼이 GitHub Pages 배포를 시작합니다.";
  } else if (s === "MERGED") {
    headline = "배포 준비중";
  } else if (s === "DEPLOY_CONFIGURING") {
    headline = "GitHub Pages 설정중";
  } else if (s === "DEPLOYING") {
    headline = "GitHub Actions 배포중";
  } else if (s === "DEPLOY_FAILED") {
    headline = "배포 실패";
  } else if (s === "PREVIEW_READY" && url) {
    headline = "배포 완료 · 미리보기 준비됨";
  } else if (allMerged) {
    headline = "배포 단계를 준비 중입니다.";
  }

  const isDeployFail = s === "DEPLOY_FAILED";
  const isPreview = s === "PREVIEW_READY";

  return (
    <div
      style={{
        ...subCard,
        border: isDeployFail ? "1px solid #fecaca" : "1px solid #e2e8f0",
        background: isDeployFail ? "#fef2f2" : "#fff",
      }}
    >
      {p.hideHeader ? null : <div style={{ ...subTitle, color: isDeployFail ? "#b91c1c" : "#64748b" }}>배포 상태</div>}
      <div style={{ fontSize: 12.5, color: isDeployFail ? "#7f1d1d" : "#334155", lineHeight: 1.55, marginBottom: 10 }}>{headline}</div>
      {isDeployFail && run.deployFailureDetail ? (
        <div style={{ fontSize: 12, color: "#7f1d1d", marginBottom: 10, whiteSpace: "pre-wrap" }}>{run.deployFailureDetail}</div>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {s === "DEPLOYING" && actionsUrl ? (
          <button type="button" onClick={() => window.open(actionsUrl, "_blank", "noopener,noreferrer")} style={btn}>
            Actions 보기
          </button>
        ) : null}
        {isDeployFail && p.pagesSettingsHref ? (
          <a href={p.pagesSettingsHref} target="_blank" rel="noopener noreferrer" style={{ ...btnMuted, textDecoration: "none", display: "inline-block" }}>
            GitHub Pages 설정 열기
          </a>
        ) : null}
        {isDeployFail && actionsUrl ? (
          <button type="button" onClick={() => window.open(actionsUrl, "_blank", "noopener,noreferrer")} style={btn}>
            Actions 보기
          </button>
        ) : null}
        {isPreview && url ? (
          <>
            <button type="button" onClick={p.onOpenPreview} style={btnPrimary}>
              결과 보기
            </button>
            <button type="button" onClick={p.onCopyPreviewUrl} style={btnMuted}>
              URL 복사
            </button>
            <div style={{ width: "100%", fontSize: 12, wordBreak: "break-all", fontWeight: 800, color: "#0f766e" }}>{url}</div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export type FailureStateCardProps = Readonly<{
  summary: string;
  protoBusy: boolean;
  onResume: () => void;
  onRestart: () => void;
}>;

export function FailureStateCard(p: FailureStateCardProps) {
  return (
    <div style={{ ...subCard, border: "1px solid #fecaca", background: "#fef2f2" }}>
      <div style={{ ...subTitle, color: "#b91c1c" }}>실행 실패</div>
      <div style={{ fontSize: 12.5, color: "#7f1d1d", lineHeight: 1.55, marginBottom: 10 }}>{p.summary}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" disabled={p.protoBusy} onClick={p.onResume} style={btnPrimary}>
          이어 진행
        </button>
        <button type="button" disabled={p.protoBusy} onClick={p.onRestart} style={btn}>
          처음부터 다시 생성
        </button>
      </div>
    </div>
  );
}

export type ActivityLogCardProps = Readonly<{
  lines: readonly string[];
}>;

export function ActivityLogCard(p: ActivityLogCardProps) {
  const [open, setOpen] = useState(false);
  const shown = open ? p.lines : p.lines.slice(-5);
  return (
    <div style={subCard}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={subTitle}>시스템 로그</div>
        <button type="button" onClick={() => setOpen(!open)} style={{ ...btnMuted, padding: "4px 8px", fontSize: 11 }}>
          {open ? "접기" : "전체"}
        </button>
      </div>
      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11.5, color: "#475569", lineHeight: 1.55 }}>
        {shown.length ? (
          shown.map((ln, i) => (
            <div key={`${i}-${ln.slice(0, 24)}`}>{ln}</div>
          ))
        ) : (
          <div style={{ color: "#94a3b8" }}>로그가 없습니다.</div>
        )}
      </div>
    </div>
  );
}
