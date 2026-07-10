import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import { detectSubmitSnapshotDrift } from "@/lib/admin-review-decision";
import { ADMIN_REVIEW_SUBMIT_SNAPSHOT_TITLE } from "@/lib/role-based-ux-copy";

function truncateId(id: string, max = 28): string {
  if (id.length <= max) return id;
  return `${id.slice(0, 12)}…${id.slice(-8)}`;
}

export function AdminReviewPackageSnapshotTab({
  detail,
}: {
  readonly detail: AdminReviewDetailDto;
}) {
  const snapshot = detail.latestReview?.submitSnapshot ?? null;
  const drift = detectSubmitSnapshotDrift(detail);
  const submittedVersionLabel = snapshot?.submittedVersionId
    ? detail.versions.find((v) => v.id === snapshot.submittedVersionId)?.version ??
      snapshot.submittedVersionId
    : null;

  if (!snapshot) {
    return (
      <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">{ADMIN_REVIEW_SUBMIT_SNAPSHOT_TITLE}</h2>
        <p className="mt-2 text-xs text-store-muted">제출된 검수 패키지가 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h2 className="text-sm font-bold text-slate-900">{ADMIN_REVIEW_SUBMIT_SNAPSHOT_TITLE}</h2>
      <ul className="space-y-2 text-xs text-slate-700 sm:text-sm">
        <li>제출일시: {snapshot.submittedAt.replace("T", " ").slice(0, 16)}</li>
        {submittedVersionLabel ? <li>제출 버전: {submittedVersionLabel}</li> : null}
        <li>원천 문서: {snapshot.sourceDocumentCount}개</li>
        <li>검수용 Chunk: {snapshot.activeChunkCount}개</li>
        {snapshot.retrievalEvaluationRunId ? (
          <li className="break-all">
            검색 평가 Run:{" "}
            <span className="font-mono" title={snapshot.retrievalEvaluationRunId}>
              <span className="sm:hidden">{truncateId(snapshot.retrievalEvaluationRunId)}</span>
              <span className="hidden sm:inline">{snapshot.retrievalEvaluationRunId}</span>
            </span>
          </li>
        ) : null}
        <li>릴리스 게이트: {snapshot.releaseGateStatus}</li>
        {snapshot.warnings.length > 0 ? (
          <li>주의 항목: {snapshot.warnings.length}개</li>
        ) : null}
      </ul>
      {drift.changed ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          제출 후 변경 감지: {drift.reasons[0]}
        </p>
      ) : null}
    </section>
  );
}
