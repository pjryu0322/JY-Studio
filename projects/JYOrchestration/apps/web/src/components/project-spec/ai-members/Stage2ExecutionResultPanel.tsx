"use client";

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

export function Stage2ExecutionResultPanel(props: { last: EnvironmentTestLastDto | null }) {
  const { last } = props;
  const s = mapEnvironmentTestLastToStage2Summary(last);
  if (!last) {
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
      {s ? (
        <>
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: "#64748b", fontSize: 12 }}>최종</span>{" "}
            <strong style={{ fontSize: 13, color: outcomeColor(s.finalOutcome) }}>{s.finalOutcome}</strong>
          </div>
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
            {s.totalTimeMs != null ? <strong>{`${(s.totalTimeMs / 1000).toFixed(1)}s`}</strong> : <span>—</span>}
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            <span style={{ color: "#64748b" }}>병목 Top1</span>{" "}
            {s.bottleneckStage ? (
              <strong>
                {stage2BottleneckLabel(s.bottleneckStage)}
                {s.bottleneckMs != null ? ` (${s.bottleneckMs}ms)` : ""}
              </strong>
            ) : (
              <span>—</span>
            )}
          </div>
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
