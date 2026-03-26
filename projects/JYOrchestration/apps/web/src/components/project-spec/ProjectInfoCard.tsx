"use client";

import { useState } from "react";
import { PROJECT_LIFECYCLE_ACTIVE, PROJECT_LIFECYCLE_DELETED } from "@/lib/project/projectLifecycle";
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
  /** 소유자만 삭제 버튼 */
  showOwnerDelete?: boolean;
  onRequestDelete?: () => void;
  /** Overview 탭: 유형·Git 행 숨김(별도 탭에서 표시) */
  compactOverview?: boolean;
  /** 생명주기 상태 행 숨김 (Spec 워크스페이스와 중복 방지 등) */
  hideLifecycleStatus?: boolean;
};

function formatProjectTypeLabel(type: string | null | undefined): string {
  if (!type) return "-";
  if (type === "web-service") return "웹 서비스";
  return type;
}

function formatLifecycleStatus(status: string | null | undefined): string {
  if (!status) return "-";
  if (status === PROJECT_LIFECYCLE_DELETED) return "삭제됨 (데이터 보관)";
  if (status === PROJECT_LIFECYCLE_ACTIVE) return "활성";
  return status;
}

export function ProjectInfoCard({
  project,
  currentUserRoleLabel,
  aiActionReviewSummary = null,
  showOwnerDelete = false,
  onRequestDelete,
  compactOverview = false,
  hideLifecycleStatus = false,
}: ProjectInfoCardProps) {
  const [gitConnectNote, setGitConnectNote] = useState<string | null>(null);
  const isDeleted = project?.status === PROJECT_LIFECYCLE_DELETED;

  return (
    <section
      data-ui-label="[P-4-2] Overview — Project Info Card"
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        background: isDeleted ? "#fff7f7" : undefined,
      }}
    >
      {isDeleted ? (
        <div
          role="status"
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <strong>삭제된 프로젝트입니다.</strong> 목록에서는 기본적으로 숨겨지며, Task·AI 액션 등 연결 데이터는
          보관됩니다.
        </div>
      ) : null}
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
        {!compactOverview ? (
          <div>
            <strong>유형:</strong> {formatProjectTypeLabel(project?.projectType)}
          </div>
        ) : null}
        {!hideLifecycleStatus ? (
          <div>
            <strong>상태:</strong> {formatLifecycleStatus(project?.status)}
          </div>
        ) : null}

        {!compactOverview ? (
          <>
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
                    setGitConnectNote(
                      "Git 연결 기능은 준비 중입니다. 준비되면 이 화면에서 바로 연결할 수 있습니다."
                    )
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
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
            Git·유형·브랜치는 상단의 <strong>Git 연동</strong> / <strong>고급 설정</strong> 탭에서 확인할 수 있습니다.
          </p>
        )}

        {aiActionReviewSummary &&
        (aiActionReviewSummary.pendingReview > 0 ||
          aiActionReviewSummary.approvedPendingApply > 0 ||
          aiActionReviewSummary.rejected > 0) ? (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #eee", fontSize: 13 }}>
            <strong>AI 액션 검토 현황:</strong> 검토 대기 {aiActionReviewSummary.pendingReview}건 · 승인 후
            적용 대기 {aiActionReviewSummary.approvedPendingApply}건 · 반려 {aiActionReviewSummary.rejected}건
          </div>
        ) : null}

        {showOwnerDelete && onRequestDelete && !isDeleted ? (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" }}>
            <button
              type="button"
              data-testid="project-detail-delete-open"
              onClick={onRequestDelete}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #fecaca",
                background: "#fff",
                color: "#b91c1c",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              삭제
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
