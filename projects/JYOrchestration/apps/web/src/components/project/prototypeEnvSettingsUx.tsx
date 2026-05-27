"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { ExecutionSetupDto } from "@/components/project-spec/api";
import {
  buildPrototypeEnvCodeAgentStatusRow,
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

const modalScrimStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 55,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalPanelStyle: CSSProperties = {
  width: "min(520px, 100%)",
  maxWidth: "100%",
  background: "#fff",
  borderRadius: 16,
  border: "1px solid #e2e8f0",
  boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.28)",
  overflow: "hidden",
};

function GithubTokenErrorAlertIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="9" stroke="#b91c1c" strokeWidth="1.5" />
      <path d="M10 6v5" stroke="#b91c1c" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="14" r="0.75" fill="#b91c1c" />
    </svg>
  );
}

export function PrototypeEnvSettingsStepCard(input: {
  readonly step: number;
  readonly title?: string;
  readonly description?: string;
  readonly titleAction?: ReactNode;
  readonly children: ReactNode;
}) {
  const title = String(input.title ?? "").trim();
  const showHeader = Boolean(title || input.description || input.titleAction);

  return (
    <section style={stepCardStyle} data-testid={`prototype-env-step-${input.step}`}>
      {showHeader ? (
        <header style={{ marginBottom: 12 }}>
          {title || input.titleAction ? (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              {title ? (
                <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: "#0f172a" }}>{title}</h2>
              ) : null}
              {input.titleAction ?? null}
            </div>
          ) : null}
          {input.description ? (
            <p style={{ margin: "6px 0 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>{input.description}</p>
          ) : null}
        </header>
      ) : null}
      {input.children}
    </section>
  );
}

export function PrototypeEnvSettingsCodeAgentStatus(input: {
  readonly executionSetup: ExecutionSetupDto | null;
}) {
  const row = buildPrototypeEnvCodeAgentStatusRow(input.executionSetup);
  const colors = prototypeEnvReadinessToneColors(row.tone);
  return (
    <div
      data-testid="prototype-env-code-agent-status"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        marginBottom: 14,
        padding: "8px 12px",
        borderRadius: 8,
        background: colors.bg,
        border: "1px solid #e2e8f0",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>{row.label}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color: colors.color }}>{row.value}</span>
    </div>
  );
}

export function PrototypeEnvSettingsGithubTokenErrorContent(input: {
  readonly executionSetup: ExecutionSetupDto | null;
}) {
  const cap = input.executionSetup?.githubCapabilityValidation;
  if (!isGithubTokenCredentialsError(cap)) return null;

  const detail = String(cap?.lastErrorMessage ?? "").trim();
  const hint = String(cap?.tokenMismatchHintKr ?? "").trim();
  const detailText = [detail, hint].filter(Boolean).join(" ");

  return (
    <div data-testid="prototype-env-github-token-error-content">
      <p style={{ margin: "0 0 10px 0", fontSize: 13, color: "#7f1d1d", lineHeight: 1.55 }}>
        현재 저장된 토큰이 GitHub에서 거부되었습니다.
      </p>
      <p style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 700, color: "#991b1b" }}>가능한 원인</p>
      <ul style={{ margin: "0 0 14px 0", paddingLeft: 18, fontSize: 12, color: "#7f1d1d", lineHeight: 1.55 }}>
        <li>토큰 만료</li>
        <li>토큰 복사 오류</li>
        <li>다른 GitHub 계정의 토큰</li>
        <li>조직 SSO 미승인</li>
      </ul>
      {detailText ? (
        <p
          style={{
            margin: 0,
            padding: "10px 12px",
            borderRadius: 8,
            background: "#fff",
            border: "1px solid #fecaca",
            fontSize: 11,
            color: "#7f1d1d",
            lineHeight: 1.5,
            wordBreak: "break-word",
          }}
        >
          {detailText}
        </p>
      ) : null}
    </div>
  );
}

export function PrototypeEnvSettingsGithubTokenErrorModal(input: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly executionSetup: ExecutionSetupDto | null;
}) {
  useEffect(() => {
    if (!input.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") input.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [input.open, input.onClose]);

  if (!input.open) return null;
  if (!isGithubTokenCredentialsError(input.executionSetup?.githubCapabilityValidation)) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prototype-env-github-token-error-modal-title"
      data-testid="prototype-env-github-token-error-modal"
      style={modalScrimStyle}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) input.onClose();
      }}
    >
      <div style={modalPanelStyle} onPointerDown={(e) => e.stopPropagation()}>
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid #e2e8f0",
            background: "linear-gradient(180deg, #fff 0%, #fef2f2 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <h2
            id="prototype-env-github-token-error-modal-title"
            style={{ margin: 0, fontSize: 15, fontWeight: 900, color: "#991b1b" }}
          >
            GitHub Token 오류
          </h2>
          <button
            type="button"
            onClick={input.onClose}
            aria-label="닫기"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: "#fff",
              fontSize: 20,
              lineHeight: 1,
              cursor: "pointer",
              color: "#64748b",
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: 16, background: "#fef2f2" }}>
          <PrototypeEnvSettingsGithubTokenErrorContent executionSetup={input.executionSetup} />
        </div>
      </div>
    </div>
  );
}

/** GitHub Token 단계 — Bad credentials 시 제목 옆 경고 아이콘으로 오류 모달을 연다. */
export function PrototypeEnvSettingsGithubTokenStepCard(input: {
  readonly executionSetup: ExecutionSetupDto | null;
  readonly children: ReactNode;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const hasCredError = isGithubTokenCredentialsError(input.executionSetup?.githubCapabilityValidation);

  return (
    <>
      <PrototypeEnvSettingsStepCard
        step={2}
        title="GitHub Token 설정"
        titleAction={
          hasCredError ? (
            <button
              type="button"
              aria-label="GitHub Token 오류 보기"
              data-testid="prototype-env-github-token-error-trigger"
              onClick={() => setModalOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                padding: 0,
                borderRadius: 8,
                border: "1px solid #fecaca",
                background: "#fef2f2",
                cursor: "pointer",
              }}
            >
              <GithubTokenErrorAlertIcon />
            </button>
          ) : null
        }
      >
        {input.children}
      </PrototypeEnvSettingsStepCard>
      {hasCredError ? (
        <PrototypeEnvSettingsGithubTokenErrorModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          executionSetup={input.executionSetup}
        />
      ) : null}
    </>
  );
}
