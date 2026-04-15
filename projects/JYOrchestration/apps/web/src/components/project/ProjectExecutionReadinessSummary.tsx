"use client";

import type { ExecutionSetupDto } from "@/components/project-spec/api";
import { computeProjectExecutionReadiness } from "@/components/project/projectExecutionReadinessModel";

export type ProjectExecutionReadinessSummaryProps = Readonly<{
  setup: ExecutionSetupDto | null;
  loading: boolean;
  onExpandExecutionSettings: () => void;
}>;

export function ProjectExecutionReadinessSummary({
  setup,
  loading,
  onExpandExecutionSettings,
}: ProjectExecutionReadinessSummaryProps) {
  const r = loading ? null : computeProjectExecutionReadiness(setup);
  const execLabel = loading ? "확인 중…" : r?.runnable ? "가능" : "불가";

  return (
    <section
      data-testid="project-execution-readiness-summary"
      aria-label="실행 준비 요약"
      style={{
        marginBottom: 20,
        padding: "14px 16px",
        borderRadius: 10,
        border: "1px solid #cbd5e1",
        background: "#f8fafc",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>실행 준비 요약</h2>
        <button
          type="button"
          onClick={onExpandExecutionSettings}
          style={{
            marginLeft: "auto",
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid #2563eb",
            background: "#fff",
            color: "#1d4ed8",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          실행 환경 설정
        </button>
      </div>
      <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#475569", lineHeight: 1.55 }}>
        아래는 저장된 연결·검증 결과입니다. 상세 입력은 <strong>실행 환경 설정</strong>을 펼쳐 확인하세요.
      </p>
      <dl
        style={{
          margin: 0,
          display: "grid",
          gap: 8,
          fontSize: 13,
          color: "#334155",
          gridTemplateColumns: "minmax(140px,auto) 1fr",
        }}
      >
        <dt style={{ fontWeight: 700, color: "#64748b" }}>Git 연결</dt>
        <dd style={{ margin: 0 }}>{loading ? "불러오는 중…" : r?.gitLabel}</dd>
        <dt style={{ fontWeight: 700, color: "#64748b" }}>GitHub 인증</dt>
        <dd style={{ margin: 0 }}>{loading ? "불러오는 중…" : r?.githubLabel}</dd>
        <dt style={{ fontWeight: 700, color: "#64748b" }}>Cursor 연결</dt>
        <dd style={{ margin: 0 }}>{loading ? "불러오는 중…" : r?.cursorLabel}</dd>
        <dt style={{ fontWeight: 700, color: "#64748b" }}>실행 정책</dt>
        <dd style={{ margin: 0 }}>{loading ? "불러오는 중…" : r?.policyLabel}</dd>
        <dt style={{ fontWeight: 700, color: "#0f172a" }}>실행 가능 여부</dt>
        <dd style={{ margin: 0, fontWeight: 800, color: execLabel === "가능" ? "#15803d" : "#b45309" }}>
          {execLabel}
        </dd>
      </dl>
    </section>
  );
}
