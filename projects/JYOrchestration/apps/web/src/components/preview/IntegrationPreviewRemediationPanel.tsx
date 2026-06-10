"use client";

import type { CSSProperties } from "react";
import { getIntegrationPreviewRemediationGuide } from "@/lib/prototype/integrationPreviewRemediationGuide";

export function IntegrationPreviewRemediationPanel(input: {
  readonly pipelineStatus?: string | null;
  readonly gitRepoUrl?: string | null;
  readonly onOpenEnvironmentSettings?: () => void;
  readonly onRetryIntegration?: () => void;
}) {
  const guide = getIntegrationPreviewRemediationGuide(input.pipelineStatus);
  if (!guide) return null;

  const boxStyle: CSSProperties = {
    marginTop: 12,
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #fcd34d",
    background: "#fffbeb",
    fontSize: 12,
    color: "#334155",
    lineHeight: 1.55,
  };

  const btnStyle: CSSProperties = {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#fff",
    fontSize: 12,
    fontWeight: 800,
    color: "#334155",
    cursor: "pointer",
  };

  const repoUrl = String(input.gitRepoUrl ?? "").trim();

  return (
    <div data-testid="integration-preview-remediation-panel" style={boxStyle}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>{guide.title}</div>
      <p style={{ margin: "0 0 8px" }}>{guide.introLine}</p>
      <div style={{ marginBottom: 10 }}>
        <strong>필요한 조치</strong>
        <ol style={{ margin: "6px 0 0", paddingLeft: 18 }}>
          {guide.actionLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {guide.showOpenSettings ? (
          <button type="button" style={btnStyle} onClick={() => input.onOpenEnvironmentSettings?.()}>
            환경설정 열기
          </button>
        ) : null}
        {guide.showPermissionGuide ? (
          <button
            type="button"
            style={btnStyle}
            data-testid="integration-preview-permission-guide-button"
            onClick={() => {
              window.open(
                "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token",
                "_blank",
                "noopener,noreferrer",
              );
            }}
          >
            권한 설정 가이드 보기
          </button>
        ) : null}
        {guide.showOpenRepository && repoUrl ? (
          <button
            type="button"
            style={btnStyle}
            onClick={() => window.open(repoUrl, "_blank", "noopener,noreferrer")}
          >
            GitHub 저장소 열기
          </button>
        ) : null}
        {guide.showPagesSetupGuide ? (
          <button
            type="button"
            style={btnStyle}
            data-testid="integration-preview-pages-guide-button"
            onClick={() => {
              window.open(
                "https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site",
                "_blank",
                "noopener,noreferrer",
              );
            }}
          >
            설정 가이드 보기
          </button>
        ) : null}
        {guide.showRetry ? (
          <button type="button" style={btnStyle} onClick={() => input.onRetryIntegration?.()}>
            다시 확인하고 Preview 준비
          </button>
        ) : null}
      </div>
    </div>
  );
}
