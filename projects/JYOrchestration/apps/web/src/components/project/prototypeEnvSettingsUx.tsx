"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import type { ExecutionSetupDto } from "@/components/project-spec/api";
import {
  buildPrototypeEnvReadinessRows,
  isGithubTokenCredentialsError,
  prototypeEnvReadinessToneColors,
} from "@/lib/project/prototypeEnvSettingsReadiness";

const stepCardStyle: CSSProperties = {
  marginBottom: 16,
  padding: 16,
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "#fff",
};

export function PrototypeEnvSettingsStepCard(input: {
  readonly step: number;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}) {
  return (
    <section style={stepCardStyle} data-testid={`prototype-env-step-${input.step}`}>
      <header style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#6366f1", letterSpacing: "0.04em" }}>
          {input.step}단계
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 800, margin: "4px 0 0 0", color: "#0f172a" }}>{input.title}</h2>
        {input.description ? (
          <p style={{ margin: "6px 0 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>{input.description}</p>
        ) : null}
      </header>
      {input.children}
    </section>
  );
}

export function PrototypeEnvSettingsReadinessSummary(input: {
  readonly executionSetup: ExecutionSetupDto | null;
  readonly connectionTestSatisfied: boolean;
}) {
  const rows = buildPrototypeEnvReadinessRows(input);
  return (
    <section
      data-testid="prototype-env-readiness-summary"
      style={{
        marginBottom: 16,
        padding: "14px 16px",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
      }}
    >
      <h2 style={{ margin: "0 0 10px 0", fontSize: 14, fontWeight: 900, color: "#0f172a" }}>
        자동 생성 준비 상태
      </h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
        {rows.map((row) => {
          const colors = prototypeEnvReadinessToneColors(row.tone);
          return (
            <li
              key={row.key}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 8,
                background: colors.bg,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>{row.label}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: colors.color }}>{row.value}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function PrototypeEnvSettingsGithubTokenErrorCard(input: {
  readonly executionSetup: ExecutionSetupDto | null;
  readonly canEdit: boolean;
  readonly onReplaceToken: () => void;
}) {
  const cap = input.executionSetup?.githubCapabilityValidation;
  if (!isGithubTokenCredentialsError(cap)) return null;

  const detail = String(cap?.lastErrorMessage ?? "").trim();
  const hint = String(cap?.tokenMismatchHintKr ?? "").trim();

  return (
    <div
      role="alert"
      data-testid="prototype-env-github-token-error-card"
      style={{
        marginTop: 12,
        padding: 14,
        borderRadius: 10,
        border: "1px solid #fecaca",
        background: "#fef2f2",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 900, color: "#991b1b", marginBottom: 6 }}>GitHub Token 오류</div>
      <p style={{ margin: "0 0 10px 0", fontSize: 13, color: "#7f1d1d", lineHeight: 1.55 }}>
        현재 저장된 토큰이 GitHub에서 거부되었습니다.
      </p>
      <p style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 700, color: "#991b1b" }}>가능한 원인</p>
      <ul style={{ margin: "0 0 12px 0", paddingLeft: 18, fontSize: 12, color: "#7f1d1d", lineHeight: 1.55 }}>
        <li>토큰 만료</li>
        <li>토큰 복사 오류</li>
        <li>다른 GitHub 계정의 토큰</li>
        <li>조직 SSO 미승인</li>
      </ul>
      <button
        type="button"
        disabled={!input.canEdit}
        onClick={input.onReplaceToken}
        style={{
          padding: "8px 14px",
          borderRadius: 10,
          border: "1px solid #b91c1c",
          background: "#fff",
          color: "#b91c1c",
          fontWeight: 800,
          fontSize: 13,
          cursor: input.canEdit ? "pointer" : "not-allowed",
        }}
      >
        새 토큰 교체
      </button>
      {detail ? (
        <details style={{ marginTop: 10 }}>
          <summary style={{ fontSize: 11, fontWeight: 700, color: "#991b1b", cursor: "pointer" }}>
            상세 오류 보기
          </summary>
          <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "#7f1d1d", lineHeight: 1.45, wordBreak: "break-word" }}>
            {detail}
            {hint ? ` ${hint}` : ""}
          </p>
        </details>
      ) : null}
    </div>
  );
}

export function PrototypeEnvSettingsIntegrationsSection(input: {
  readonly executionSetup: ExecutionSetupDto | null;
  readonly advancedPanel: ReactNode;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const cursorLabel = input.executionSetup && (input.executionSetup.cursorApiConnectionOk === true)
    ? "Cursor 연결 사용"
    : "설정 필요";
  const scmLabel =
    input.executionSetup?.repoConnectionOk === true
      ? "GitHub 저장소 사용"
      : input.executionSetup && (String(input.executionSetup.gitRepoUrl ?? "").trim())
        ? "검증 필요"
        : "미설정";

  return (
    <section
      data-testid="prototype-env-integrations-summary"
      style={{
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        background: "#fafafa",
      }}
    >
      <h2 style={{ margin: "0 0 8px 0", fontSize: 15, fontWeight: 900, color: "#0f172a" }}>AI/연동 설정</h2>
      <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>
        일반적인 자동 생성 작업에서는 아래 기본 설정만으로 충분합니다. 프로젝트별 Provider를 바꿀 때만 고급 설정을
        여세요.
      </p>
      <ul style={{ listStyle: "none", margin: "0 0 12px 0", padding: 0, display: "grid", gap: 6 }}>
        {[
          { label: "LLM", value: "기본 설정 사용" },
          { label: "Code Agent", value: cursorLabel },
          { label: "SCM", value: scmLabel },
        ].map((row) => (
          <li
            key={row.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              fontSize: 13,
              padding: "6px 10px",
              borderRadius: 8,
              background: "#fff",
              border: "1px solid #f1f5f9",
            }}
          >
            <span style={{ fontWeight: 700, color: "#475569" }}>{row.label}</span>
            <span style={{ fontWeight: 800, color: "#0f172a" }}>{row.value}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setAdvancedOpen((v) => !v)}
        aria-expanded={advancedOpen}
        style={{
          padding: "8px 14px",
          borderRadius: 10,
          border: "1px solid #cbd5e1",
          background: "#fff",
          fontWeight: 800,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        {advancedOpen ? "고급 연동 설정 숨기기" : "고급 연동 설정 보기"}
      </button>
      {advancedOpen ? <div style={{ marginTop: 14 }}>{input.advancedPanel}</div> : null}
    </section>
  );
}

export function PrototypeEnvSettingsPreviewCollapsible(input: { readonly children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section
      data-testid="prototype-env-preview-collapsible"
      style={{
        marginTop: 8,
        marginBottom: 16,
        padding: 14,
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: "#0f172a" }}>Preview 설정</h2>
          <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#64748b" }}>
            미리보기·검토 화면 레이아웃 (자동 생성 환경과 별도)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            background: "#f8fafc",
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {open ? "Preview 설정 숨기기" : "Preview 설정 보기"}
        </button>
      </div>
      {open ? <div style={{ marginTop: 14 }}>{input.children}</div> : null}
    </section>
  );
}
