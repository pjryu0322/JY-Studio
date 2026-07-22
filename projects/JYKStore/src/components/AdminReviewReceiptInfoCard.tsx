import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  isDistributionReviewSnapshot,
  isDoclingBundleReviewSnapshot,
} from "@/lib/provider-review-submit-snapshot";
import {
  ADMIN_REVIEW_RECEIPT_INFO_TITLE,
  ADMIN_REVIEWS_STATUS_IN_REVIEW,
} from "@/lib/role-based-ux-copy";

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

export function AdminReviewReceiptInfoCard({
  detail,
}: {
  readonly detail: AdminReviewDetailDto;
}) {
  const review = detail.latestReview;
  const snapshot = review?.submitSnapshot ?? null;
  const submittedVersionLabel = snapshot?.submittedVersionId
    ? detail.versions.find((v) => v.id === snapshot.submittedVersionId)?.version ??
      snapshot.submittedVersionId
    : null;
  const acceptedAt = review?.updatedAt ?? review?.createdAt ?? null;
  const reviewerLabel = review?.reviewerUserId
    ? `관리자 (${review.reviewerUserId.slice(0, 8)}…)`
    : "관리자";

  return (
    <section className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h2 className="text-sm font-bold text-slate-900">{ADMIN_REVIEW_RECEIPT_INFO_TITLE}</h2>
      <ul className="space-y-1 text-xs text-slate-700 sm:text-sm">
        <li>접수 상태: {ADMIN_REVIEWS_STATUS_IN_REVIEW}</li>
        <li>접수일시: {formatDateTime(acceptedAt)}</li>
        <li>접수자: {reviewerLabel}</li>
        {snapshot ? (
          isDistributionReviewSnapshot(snapshot) ? (
            <>
              <li>제출일시: {formatDateTime(snapshot.submittedAt)}</li>
              {submittedVersionLabel ? <li>제출 버전: {submittedVersionLabel}</li> : null}
              <li>모드: Distribution Payload</li>
              <li>Profile: {snapshot.payloadProfile}</li>
              <li>검증: {snapshot.validationStatus}</li>
            </>
          ) : isDoclingBundleReviewSnapshot(snapshot) ? (
            <>
              <li>제출일시: {formatDateTime(snapshot.submittedAt)}</li>
              {submittedVersionLabel ? <li>제출 버전: {submittedVersionLabel}</li> : null}
              <li>모드: Docling 3파일 Bundle</li>
              <li>Schema: {snapshot.doclingSchemaVersion ?? "—"}</li>
              <li>Adapter: {snapshot.adapterVersion}</li>
              <li>경고 수: {snapshot.warningCount}</li>
            </>
          ) : (
            <>
              <li>제출일시: {formatDateTime(snapshot.submittedAt)}</li>
              {submittedVersionLabel ? <li>제출 버전: {submittedVersionLabel}</li> : null}
              <li>제출 당시 릴리스 게이트: {snapshot.releaseGateStatus}</li>
              <li>제출 당시 원천 문서: {snapshot.sourceDocumentCount}개</li>
              <li>제출 당시 Chunk: {snapshot.activeChunkCount}개</li>
            </>
          )
        ) : (
          <li>제출 패키지: 없음</li>
        )}
      </ul>
    </section>
  );
}
