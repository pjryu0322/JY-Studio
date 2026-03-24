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

export function ProjectInfoCard({
  project,
  currentUserRoleLabel,
  aiActionReviewSummary = null,
}: ProjectInfoCardProps) {
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
          <strong>Project Type:</strong> {project?.projectType || "-"}
        </div>
        <div>
          <strong>Status:</strong> {project?.status || "-"}
        </div>
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
