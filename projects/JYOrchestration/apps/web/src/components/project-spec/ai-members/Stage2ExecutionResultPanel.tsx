"use client";

import { useState } from "react";
import type { EnvironmentTestLastDto } from "@/components/project-spec/api";
import {
  mapEnvironmentTestLastToStage2Summary,
  stage2BottleneckLabel,
} from "@/lib/ai-member/aiMemberStage2Policies";

function outcomeColor(o: string): string {
  if (o === "COMPLETED") return "#15803d";
  if (o === "PARTIAL") return "#b45309";
  if (o === "FAILED") return "#b91c1c";
  return "#64748b";
}

function slotKo(s: "PENDING" | "RUNNING" | "DONE" | undefined): string {
  if (s === "DONE") return "완료";
  if (s === "RUNNING") return "진행";
  return "대기";
}

function cursorStatusSummary(
  cs: import("@/components/project-spec/api").EnvironmentTestLastDto["stage2CursorStatus"]
): string | null {
  if (!cs) return null;
  return `준비 ${slotKo(cs.prepare)} · 생성 ${slotKo(cs.generate)} · 커밋 ${slotKo(cs.commit)} · 푸시 ${slotKo(cs.push)}`;
}

function gitStatusSummary(
  g: import("@/components/project-spec/api").EnvironmentTestLastDto["stage2GitStatus"]
): string | null {
  if (!g) return null;
  if (!g.branchDetected) return "branch 감지 대기";
  if (!g.branchReflected) return "compare 반영 대기";
  return "원격 브랜치 반영됨";
}

function platformStatusSummary(
  p: import("@/components/project-spec/api").EnvironmentTestLastDto["stage2PlatformStatus"],
  prUrl: string | null | undefined
): string | null {
  if (!p) return null;
  if (prUrl?.trim()) return "PR 링크 확인됨";
  if (!p.prCreated) return "PR 생성 대기";
  return "PR 생성 처리됨";
}

function cursorSignalSummary(
  sig: import("@/components/project-spec/api").EnvironmentTestLastDto["stage2CursorSignal"]
): string | null {
  if (!sig) return null;
  const parts: string[] = [];
  if (sig.branchNameHint?.trim()) parts.push(`branch=${sig.branchNameHint.trim()}`);
  if (sig.headShaHint?.trim()) parts.push(`head=${sig.headShaHint.trim().slice(0, 10)}…`);
  if (sig.commitHashHint?.trim()) parts.push(`commit=${sig.commitHashHint.trim().slice(0, 10)}…`);
  if (typeof sig.changedFilesCountHint === "number") parts.push(`files=${sig.changedFilesCountHint}`);
  if (typeof sig.pushCompletedHintAtMs === "number") parts.push("push-hint=done");
  else if (typeof sig.pushStartedAtMs === "number") parts.push("push-hint=started");
  else if (typeof sig.agentLaunchedAtMs === "number") parts.push("agent=launched");
  return parts.length ? parts.join(" · ") : null;
}

export function Stage2ExecutionResultPanel(props: {
  last: EnvironmentTestLastDto | null;
  busyStage2?: boolean;
  stage2ElapsedMs?: number | null;
}) {
  const { last, busyStage2, stage2ElapsedMs } = props;
  const [copied, setCopied] = useState(false);
  const s = mapEnvironmentTestLastToStage2Summary(last);
  const elapsedCombinedMs =
    busyStage2 && (typeof stage2ElapsedMs === "number" || (s?.runElapsedMsFromServer ?? null) != null)
      ? Math.max(stage2ElapsedMs ?? 0, s?.runElapsedMsFromServer ?? 0)
      : null;
  if (!last) {
    if (busyStage2) {
      return (
        <div
          data-testid="stage2-execution-result-panel"
          style={{
            padding: 14,
            borderRadius: 12,
            border: "1px solid #bfdbfe",
            background: "#eff6ff",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", marginBottom: 8 }}>Stage 2 실행 결과</div>
          <strong style={{ fontSize: 12, color: "#1e3a8a" }}>실행 중</strong>
          {typeof stage2ElapsedMs === "number" ? (
            <span style={{ marginLeft: 8, fontSize: 12, color: "#1e3a8a" }}>
              경과 {(stage2ElapsedMs / 1000).toFixed(0)}s
            </span>
          ) : null}
          <p style={{ margin: "8px 0 0 0", fontSize: 12, color: "#334155", lineHeight: 1.5 }}>
            실행 중 (Cursor/Git 반영 대기). Task 생성 직후이면 잠시 후 여기에 진행 상태가 표시됩니다.
          </p>
        </div>
      );
    }
    return (
      <div
        data-testid="stage2-execution-result-panel"
        style={{
          padding: 14,
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", marginBottom: 6 }}>Stage 2 실행 결과</div>
        <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>아직 완료된 Stage 2 기록이 없습니다.</p>
      </div>
    );
  }

  return (
    <div
      data-testid="stage2-execution-result-panel"
      style={{
        padding: 14,
        borderRadius: 12,
        border: "1px solid #cbd5e1",
        background: "#fff",
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", marginBottom: 10 }}>Stage 2 실행 결과</div>
      {busyStage2 ? (
        <div
          style={{
            marginBottom: 10,
            padding: 10,
            borderRadius: 8,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            fontSize: 12,
            color: "#1e3a8a",
            lineHeight: 1.5,
          }}
        >
          <strong>실행 중</strong>
          {typeof elapsedCombinedMs === "number" ? (
            <span style={{ marginLeft: 8 }}>경과 {(elapsedCombinedMs / 1000).toFixed(0)}s</span>
          ) : null}
          {s?.currentPhaseKey || s?.currentStepKey ? (
            <div style={{ marginTop: 6, fontSize: 11, color: "#475569" }}>
              <span style={{ color: "#64748b" }}>현재 단계</span>{" "}
              <code style={{ fontSize: 11 }}>{s.currentPhaseKey ?? s.currentStepKey}</code>
            </div>
          ) : null}
          {last?.stage2CursorStatus ? (
            <div style={{ marginTop: 4, fontSize: 11, color: "#334155" }}>
              <span style={{ color: "#64748b" }}>Cursor</span> {cursorStatusSummary(last.stage2CursorStatus)}
            </div>
          ) : null}
          {last?.stage2GitStatus ? (
            <div style={{ marginTop: 2, fontSize: 11, color: "#334155" }}>
              <span style={{ color: "#64748b" }}>Git</span> {gitStatusSummary(last.stage2GitStatus)}
            </div>
          ) : null}
          {last?.stage2PlatformStatus ? (
            <div style={{ marginTop: 2, fontSize: 11, color: "#334155" }}>
              <span style={{ color: "#64748b" }}>Platform</span>{" "}
              {platformStatusSummary(last.stage2PlatformStatus, last?.prUrl ?? null)}
            </div>
          ) : null}
          {last?.stage2CursorSignal ? (
            <div style={{ marginTop: 2, fontSize: 11, color: "#334155" }}>
              <span style={{ color: "#64748b" }}>Cursor signal</span> {cursorSignalSummary(last.stage2CursorSignal)}
            </div>
          ) : null}
          <div style={{ marginTop: 4 }}>
            {last?.stage2LivePhaseLabel?.trim() ||
              last?.stage2UiHint?.trim() ||
              "Git 반영 대기 (Cursor 상태는 보조)"}
          </div>
          {s?.currentBottleneckHint ? (
            <div style={{ marginTop: 4 }}>
              <span style={{ color: "#64748b" }}>병목 힌트</span> <strong>{s.currentBottleneckHint}</strong>
            </div>
          ) : null}
          <div style={{ marginTop: 4, fontSize: 11, color: "#334155" }}>
            Reviewer·Security·SCM 로그는 브랜치가 GitHub에 반영된 뒤에만 이어집니다. 멈춘 것이 아니라 순서대로 대기 중일 수 있습니다.
          </div>
        </div>
      ) : null}
      {s ? (
        <>
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: "#64748b", fontSize: 12 }}>최종</span>{" "}
            <strong style={{ fontSize: 13, color: outcomeColor(s.finalOutcome) }}>{s.finalOutcome}</strong>
          </div>
          {(s.currentPhaseLabel || s.uiHintLine || s.currentPhaseKey || s.currentStepKey) && !busyStage2 ? (
            <div style={{ fontSize: 12, marginBottom: 8, color: "#334155", lineHeight: 1.45 }}>
              {s.currentPhaseKey || s.currentStepKey ? (
                <div style={{ marginBottom: 4 }}>
                  <span style={{ color: "#64748b" }}>현재 단계</span>{" "}
                  <code style={{ fontSize: 11 }}>{s.currentPhaseKey ?? s.currentStepKey}</code>
                </div>
              ) : null}
              {s.currentPhaseLabel ? (
                <div>
                  <span style={{ color: "#64748b" }}>현재 단계</span> <strong>{s.currentPhaseLabel}</strong>
                </div>
              ) : null}
              {s.uiHintLine ? <div style={{ marginTop: 2 }}>{s.uiHintLine}</div> : null}
              {s.currentBottleneckHint ? (
                <div style={{ marginTop: 4 }}>
                  <span style={{ color: "#64748b" }}>병목 힌트</span> <strong>{s.currentBottleneckHint}</strong>
                </div>
              ) : null}
            </div>
          ) : null}
          <div style={{ fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: "#64748b" }}>Executor</span> <strong>{s.executor}</strong>
          </div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: "#64748b" }}>Reviewer</span> <strong>{s.reviewer.value}</strong>
            {s.reviewer.reason ? (
              <span style={{ marginLeft: 6, color: "#64748b" }}>{s.reviewer.reason}</span>
            ) : null}
          </div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: "#64748b" }}>Security</span> <strong>{s.security.value}</strong>
            {s.security.reason ? (
              <span style={{ marginLeft: 6, color: "#64748b" }}>{s.security.reason}</span>
            ) : null}
          </div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: "#64748b" }}>SCM</span> <strong>{s.scm.value}</strong>
            {s.scm.platformFallback ? (
              <span style={{ marginLeft: 6, fontSize: 11, color: "#64748b" }}>(platform fallback)</span>
            ) : null}
            {s.scm.reason ? (
              <span style={{ marginLeft: 6, color: "#64748b" }}>{s.scm.reason}</span>
            ) : null}
          </div>
          <div style={{ fontSize: 12, marginTop: 8 }}>
            <span style={{ color: "#64748b" }}>총 시간</span>{" "}
            {busyStage2 && typeof elapsedCombinedMs === "number" ? (
              <strong>{`${(elapsedCombinedMs / 1000).toFixed(0)}s (진행 중)`}</strong>
            ) : s.totalTimeMs != null ? (
              <strong>{`${(s.totalTimeMs / 1000).toFixed(1)}s`}</strong>
            ) : (
              <span>—</span>
            )}
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            <span style={{ color: "#64748b" }}>현재 병목 추정</span>{" "}
            {s.bottleneckStage ? (
              <strong>
                {s.currentBottleneckHint ?? stage2BottleneckLabel(s.bottleneckStage)}
                {s.bottleneckMs != null ? ` (${s.bottleneckMs}ms)` : ""}
              </strong>
            ) : s.currentBottleneckHint ? (
              <strong>{s.currentBottleneckHint}</strong>
            ) : (
              <span>—</span>
            )}
          </div>
          {last?.stage2TimingBreakdown && !busyStage2 ? (
            <div style={{ marginTop: 8, fontSize: 10, color: "#64748b", lineHeight: 1.4 }}>
              구간 ms(telemetry):{" "}
              {Object.entries(last.stage2TimingBreakdown)
                .filter(([, v]) => typeof v === "number" && v > 0)
                .map(([k, v]) => `${k}:${v}`)
                .join(" · ") || "—"}
            </div>
          ) : null}
          {(last?.stage2CursorPromptRaw != null || last?.cursorPromptPreview != null) && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: "#334155", marginBottom: 6 }}>
                <span style={{ color: "#64748b" }}>Cursor Prompt 보기</span>
                {typeof last?.cursorPromptLength === "number" ? (
                  <span style={{ marginLeft: 8, color: "#475569" }}>len={last.cursorPromptLength}</span>
                ) : null}
              </div>
              {last?.stage2CursorPromptCanViewRaw && last?.stage2CursorPromptRaw ? (
                <>
                  <div style={{ marginBottom: 6 }}>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(last.stage2CursorPromptRaw ?? "");
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1200);
                        } catch {
                          setCopied(false);
                        }
                      }}
                      style={{
                        fontSize: 11,
                        border: "1px solid #cbd5e1",
                        background: "#f8fafc",
                        borderRadius: 6,
                        padding: "4px 8px",
                        cursor: "pointer",
                        color: "#334155",
                      }}
                    >
                      {copied ? "복사됨" : "복사"}
                    </button>
                  </div>
                  <pre
                    style={{
                      maxHeight: 220,
                      overflow: "auto",
                      margin: 0,
                      padding: 10,
                      borderRadius: 8,
                      background: "#0f172a",
                      color: "#e2e8f0",
                      fontSize: 11,
                      lineHeight: 1.45,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {last.stage2CursorPromptRaw}
                  </pre>
                </>
              ) : (
                <pre
                  style={{
                    maxHeight: 140,
                    overflow: "auto",
                    margin: 0,
                    padding: 10,
                    borderRadius: 8,
                    background: "#f8fafc",
                    color: "#334155",
                    fontSize: 11,
                    lineHeight: 1.45,
                    whiteSpace: "pre-wrap",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  {last?.cursorPromptPreview ?? "(preview unavailable)"}
                </pre>
              )}
            </div>
          )}
        </>
      ) : null}
      <div style={{ marginTop: 10, fontSize: 10, color: "#94a3b8", lineHeight: 1.5 }}>
        상세 로그: TaskProgress(execution)에서 카탈로그 phase(
        <code style={{ fontSize: 10 }}>stage2_started</code>, <code style={{ fontSize: 10 }}>review_passed</code>,{" "}
        <code style={{ fontSize: 10 }}>scm_platform_fallback</code> 등) 또는 기존{" "}
        <code style={{ fontSize: 10 }}>env_test_stage2_*</code> 검색 · executionId·elapsedMs는 detail에 포함됩니다.
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color: "#94a3b8" }}>
        추적 taskId:{" "}
        <span style={{ fontFamily: "monospace" }}>
          {last.taskId?.trim() ? `${last.taskId.slice(0, 10)}…` : "—"}
        </span>
      </div>
    </div>
  );
}
