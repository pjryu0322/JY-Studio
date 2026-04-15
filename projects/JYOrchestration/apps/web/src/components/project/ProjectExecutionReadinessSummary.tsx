"use client";

import Link from "next/link";
import type { ExecutionSetupDto } from "@/components/project-spec/api";
import { computeProjectExecutionReadiness } from "@/components/project/projectExecutionReadinessModel";

export type ProjectExecutionReadinessSummaryProps = Readonly<{
  setup: ExecutionSetupDto | null;
  loading: boolean;
  /** 예: `/project-admin/settings?projectId=…&from=planning` */
  settingsHref: string;
}>;

export function ProjectExecutionReadinessSummary({
  setup,
  loading,
  settingsHref,
}: ProjectExecutionReadinessSummaryProps) {
  const r = loading ? null : computeProjectExecutionReadiness(setup);
  const execLabel = loading ? "확인 중…" : r?.runnable ? "가능" : "불가";

  return (
    <section
      data-testid="project-execution-readiness-summary"
      aria-label="실행 준비 상태"
      style={{
        marginBottom: 20,
        padding: "14px 16px",
        borderRadius: 10,
        border: "1px solid #cbd5e1",
        background: "#f8fafc",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>실행 준비 상태</h2>
        <Link
          href={settingsHref}
          data-testid="project-execution-readiness-settings-link"
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
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          설정으로 이동
        </Link>
      </div>
      <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#475569", lineHeight: 1.55 }}>
        저장된 연결·검증 결과입니다. 상세 입력·검증은 <strong>프로젝트 관리 → 설정</strong>에서 진행합니다.
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
        <dt style={{ fontWeight: 700, color: "#0f172a" }}>실행 가능 여부</dt>
        <dd style={{ margin: 0, fontWeight: 800, color: execLabel === "가능" ? "#15803d" : "#b45309" }}>
          {execLabel}
        </dd>
      </dl>
    </section>
  );
}
