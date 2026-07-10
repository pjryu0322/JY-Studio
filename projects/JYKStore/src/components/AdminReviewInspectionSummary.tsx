import { AdminReviewStatusBadge } from "@/components/AdminReviewStatusBadge";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import { ADMIN_REVIEW_INSPECTION_SUMMARY_TITLE } from "@/lib/role-based-ux-copy";

function statusLabel(status: string | null | undefined): string {
  if (!status) return "미실행";
  return status;
}

function Row({
  label,
  value,
  detail,
}: {
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
}) {
  return (
    <div className="rounded-xl border border-store-border bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-store-muted">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-slate-900">{value}</p>
      {detail ? <p className="mt-0.5 text-xs text-store-muted">{detail}</p> : null}
    </div>
  );
}

export function AdminReviewInspectionSummary({
  detail,
}: {
  readonly detail: AdminReviewDetailDto;
}) {
  const { pack, readiness } = detail;
  const sv = readiness.sourceValidation;
  const coverageScore = detail.structureQuality?.structureCoverage?.coverageScore;
  const knowledgeScore = detail.structureQuality?.knowledgeQuality?.totalScore;
  const chunk = detail.chunkQuality?.report;
  const retrievalCases = detail.retrievalEvaluation?.set?.activeCaseCount;
  const releaseLabel = readiness.releaseGateStatus
    ? readiness.releaseGateStatus
    : detail.releaseGate?.freshness.status === "STALE"
      ? "재점검 필요"
      : "미실행";

  const structureStatus =
    readiness.structureCoverageStatus ?? readiness.knowledgeQualityStatus ?? "미실행";
  const structureDetail = [
    coverageScore != null ? `구조 커버리지 ${coverageScore}` : null,
    knowledgeScore != null ? `지식 품질 ${knowledgeScore}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const chunkDetail = chunk
    ? `active chunk ${chunk.activeChunkCount} · 원천 커버 ${chunk.coveredSourceDocumentCount}/${chunk.sourceDocumentCount}`
    : undefined;

  return (
    <section className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900">{ADMIN_REVIEW_INSPECTION_SUMMARY_TITLE}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-800">{pack.name}</p>
          <p className="font-mono text-[11px] text-store-muted">{pack.packId}</p>
        </div>
        <AdminReviewStatusBadge status={pack.status} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Row
          label="원천 문서"
          value={`${readiness.sourceDocumentCount}개`}
          detail={`통과 ${sv.passCount} · 주의 ${sv.warningCount} · 실패 ${sv.failCount}`}
        />
        <Row
          label="구조/품질"
          value={statusLabel(structureStatus === "미실행" ? null : structureStatus)}
          detail={structureDetail || undefined}
        />
        <Row
          label="청킹 품질"
          value={statusLabel(readiness.chunkQualityStatus)}
          detail={chunkDetail}
        />
        <Row
          label="검색 품질"
          value={statusLabel(readiness.retrievalEvaluationStatus)}
          detail={retrievalCases != null ? `활성 케이스 ${retrievalCases}` : undefined}
        />
        <Row label="릴리스 게이트" value={releaseLabel} />
        <Row
          label="기본 정보"
          value={pack.providerName}
          detail={`${readiness.versionCount}개 버전 · ${pack.categoryId}`}
        />
      </div>
    </section>
  );
}
