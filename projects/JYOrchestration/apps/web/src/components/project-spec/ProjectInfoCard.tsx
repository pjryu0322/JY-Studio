"use client";

import { useState } from "react";
import { Project } from "./types";

type ProjectInfoCardProps = {
  project: Project | null;
  currentUserRoleLabel: string | null;
  /** AI 멤버 액션 검토·적용 요약(선택) */
  aiActionReviewSummary?: {
    pendingReview: number;
    approvedPendingApply: number;
    rejected: number;
  } | null;
};

function formatProjectTypeLabel(type: string | null | undefined): string {
  if (!type) return "-";
  if (type === "web-service") return "웹 서비스";
  return type;
}

export function ProjectInfoCard({
  project,
  currentUserRoleLabel,
  aiActionReviewSummary = null,
}: ProjectInfoCardProps) {
  const [gitConnectNote, setGitConnectNote] = useState<string | null>(null);

  return (
    <section
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>프로젝트 기본 정보</h2>
      <div style={{ display: "grid", gap: 8 }}>
        {currentUserRoleLabel ? (
          <div>
            <strong>현재 역할:</strong> {currentUserRoleLabel}
          </div>
        ) : null}
        <div>
          <strong>프로젝트명:</strong> {project?.name || "정보 없음"}
        </div>
        <div>
          <strong>설명:</strong> {project?.description || "설명 없음"}
        </div>
        <div>
          <strong>유형:</strong> {formatProjectTypeLabel(project?.projectType)}
        </div>
        <div>
          <strong>상태:</strong> {project?.status || "-"}
        </div>

        <div
          style={{
            marginTop: 4,
            paddingTop: 10,
            borderTop: "1px solid #eee",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ flex: "1 1 200px", minWidth: 0 }}>
            <strong>Git 저장소:</strong>{" "}
            {project?.repoUrl ? (
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ wordBreak: "break-all", color: "#2563eb" }}
              >
                {project.repoUrl}
              </a>
            ) : (
              <span style={{ color: "#64748b" }}>연결 안됨</span>
            )}
          </div>
          {!project?.repoUrl ? (
            <button
              type="button"
              data-testid="project-git-connect"
              onClick={() =>
                setGitConnectNote("Git 연결 기능은 준비 중입니다. 준비되면 이 화면에서 바로 연결할 수 있습니다.")
              }
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #ccc",
                background: "#fff",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              Git 연결하기
            </button>
          ) : null}
        </div>
        {gitConnectNote ? (
          <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>{gitConnectNote}</p>
        ) : null}

        {aiActionReviewSummary &&
        (aiActionReviewSummary.pendingReview > 0 ||
          aiActionReviewSummary.approvedPendingApply > 0 ||
          aiActionReviewSummary.rejected > 0) ? (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #eee", fontSize: 13 }}>
            <strong>AI 액션 검토 현황:</strong> 검토 대기 {aiActionReviewSummary.pendingReview}건 · 승인 후
            적용 대기 {aiActionReviewSummary.approvedPendingApply}건 · 반려 {aiActionReviewSummary.rejected}건
          </div>
        ) : null}
      </div>
    </section>
  );
}
