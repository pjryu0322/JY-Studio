import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import { detectSubmitSnapshotDrift } from "@/lib/admin-review-decision";
import {
  isDistributionReviewSnapshot,
  isDoclingBundleReviewSnapshot,
} from "@/lib/provider-review-submit-snapshot";
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

  if (isDistributionReviewSnapshot(snapshot)) {
    const report =
      detail.payload?.validationReport &&
      typeof detail.payload.validationReport === "object"
        ? (detail.payload.validationReport as Record<string, unknown>)
        : null;
    return (
      <section className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">{ADMIN_REVIEW_SUBMIT_SNAPSHOT_TITLE}</h2>
        <p className="text-xs font-semibold text-store-accent">Distribution Payload</p>
        <ul className="space-y-2 text-xs text-slate-700 sm:text-sm">
          <li>제출일시: {snapshot.submittedAt.replace("T", " ").slice(0, 16)}</li>
          {submittedVersionLabel ? <li>제출 버전: {submittedVersionLabel}</li> : null}
          <li>Profile: {snapshot.payloadProfile}</li>
          <li className="break-all">SHA-256: {snapshot.checksumSha256}</li>
          <li>검증: {snapshot.validationStatus}</li>
          {detail.payload ? (
            <>
              <li>생성기: {detail.payload.generatorType}</li>
              <li>원본 파일: {detail.payload.originalFileName}</li>
              <li>파일 크기: {detail.payload.fileSize.toLocaleString()} bytes</li>
              {typeof report?.entrypoint === "string" ? (
                <li>entrypoint: {report.entrypoint}</li>
              ) : null}
              {typeof report?.recordCount === "number" ? (
                <li>recordCount: {report.recordCount}</li>
              ) : null}
            </>
          ) : null}
          {detail.distribution ? (
            <>
              <li>출처: {detail.distribution.sourceTitle ?? detail.distribution.sourceUrl ?? "—"}</li>
              <li>라이선스: {detail.distribution.licenseName}</li>
              <li>공개범위: {detail.distribution.visibility}</li>
              <li>다운로드 허용: {detail.distribution.allowDownload ? "예" : "아니오"}</li>
              <li className="text-store-muted">
                승인해도 공개범위·다운로드 허용 값은 임의로 변경되지 않습니다.
              </li>
            </>
          ) : null}
        </ul>
        {detail.payload ? (
          <a
            href={`/api/v1/admin/packs/${encodeURIComponent(detail.pack.packId)}/payload/download`}
            className="inline-flex min-h-[44px] items-center rounded-xl border border-store-border px-4 text-sm font-semibold text-store-accent"
          >
            원본 Payload 다운로드
          </a>
        ) : null}
        {drift.changed ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            제출 후 변경 감지: {drift.reasons[0]}
            {drift.reasons.length > 1 ? (
              <span className="mt-1 block text-amber-800/90">
                {drift.reasons.slice(1).join(" · ")}
              </span>
            ) : null}
          </p>
        ) : null}
      </section>
    );
  }

  if (isDoclingBundleReviewSnapshot(snapshot)) {
    return (
      <section className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">{ADMIN_REVIEW_SUBMIT_SNAPSHOT_TITLE}</h2>
        <p className="text-xs font-semibold text-store-accent">Docling 3파일 Bundle</p>
        <ul className="space-y-2 text-xs text-slate-700 sm:text-sm">
          <li>제출일시: {snapshot.submittedAt.replace("T", " ").slice(0, 16)}</li>
          {submittedVersionLabel ? <li>제출 버전: {submittedVersionLabel}</li> : null}
          <li>Bundle ID: {snapshot.doclingBundleId}</li>
          <li>Schema: {snapshot.doclingSchemaVersion ?? "—"}</li>
          <li>Adapter: {snapshot.adapterVersion}</li>
          <li>NormalizedDocument: {snapshot.normalizedDocumentId}</li>
          <li className="break-all">Fingerprint: {snapshot.fingerprint ?? "—"}</li>
          <li>경고 수: {snapshot.warningCount}</li>
          <li>출처: {snapshot.sourceTitle ?? "—"}</li>
          <li>라이선스: {snapshot.licenseName}</li>
          <li>공개범위: {snapshot.visibility}</li>
          <li>
            제공 방식:{" "}
            {[
              snapshot.allowApi !== false ? "API" : null,
              snapshot.allowMcp !== false ? "MCP" : null,
              snapshot.allowDownload ? "다운로드" : null,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </li>
          {snapshot.serviceEndsAt ? (
            <li>서비스 종료일: {snapshot.serviceEndsAt.slice(0, 10)}</li>
          ) : null}
          {snapshot.rightsBasis ? <li>유통 권한 근거: {snapshot.rightsBasis}</li> : null}
          {snapshot.serviceValidation ? (
            <li>
              서비스 검증:{" "}
              {[
                snapshot.serviceValidation.API
                  ? `API=${snapshot.serviceValidation.API.status} (${snapshot.serviceValidation.API.runId ?? "—"})`
                  : null,
                snapshot.serviceValidation.MCP
                  ? `MCP=${snapshot.serviceValidation.MCP.status} (${snapshot.serviceValidation.MCP.runId ?? "—"})`
                  : null,
                snapshot.serviceValidation.DOWNLOAD
                  ? `다운로드=${snapshot.serviceValidation.DOWNLOAD.status} (${snapshot.serviceValidation.DOWNLOAD.runId ?? "—"})`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ") || "—"}
            </li>
          ) : null}
        </ul>
        <p className="text-xs text-store-muted">
          상세 파일·미리보기는 Docling 근거 탭에서 확인하세요.
        </p>
        {drift.changed ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            제출 후 변경 감지: {drift.reasons[0]}
          </p>
        ) : null}
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
