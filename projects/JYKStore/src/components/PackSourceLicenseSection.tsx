import type { ReactNode } from "react";
import type { KnowledgePack } from "@/types/pack";

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all text-sm font-semibold text-store-accent underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[7.5rem_1fr] sm:gap-3">
      <dt className="text-xs font-semibold text-store-muted">{label}</dt>
      <dd className="text-sm text-slate-800">{children}</dd>
    </div>
  );
}

export function PackSourceLicenseSection({ pack }: { readonly pack: KnowledgePack }) {
  const source = pack.sourceInfo;
  const license = pack.licenseInfo;
  const downloadReady = pack.capabilities?.download.status === "READY" || pack.downloadInfo?.available;

  const hasSource = Boolean(
    source?.publisherName ||
      source?.publisherUrl ||
      source?.sourceTitle ||
      source?.sourceUrl ||
      source?.documentVersion,
  );
  const hasLicense = Boolean(license?.name || license?.url || license?.usageTerms);
  if (!hasSource && !hasLicense && !downloadReady) return null;

  return (
    <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h2 className="text-sm font-bold text-slate-900">출처 및 이용조건</h2>
      <dl className="mt-3 space-y-3">
        {source?.publisherName ? <Row label="발행기관">{source.publisherName}</Row> : null}
        {source?.publisherUrl ? (
          <Row label="발행기관 URL">
            <ExternalLink href={source.publisherUrl}>{source.publisherUrl}</ExternalLink>
          </Row>
        ) : null}
        {source?.sourceTitle ? <Row label="원천 문서">{source.sourceTitle}</Row> : null}
        {source?.sourceUrl ? (
          <Row label="원문 페이지">
            <ExternalLink href={source.sourceUrl}>{source.sourceUrl}</ExternalLink>
          </Row>
        ) : null}
        {source?.documentVersion ? <Row label="문서 버전">{source.documentVersion}</Row> : null}
        {source?.publishedAt ? <Row label="게시일">{source.publishedAt}</Row> : null}
        {license?.name ? <Row label="라이선스">{license.name}</Row> : null}
        {license?.url ? (
          <Row label="라이선스 URL">
            <ExternalLink href={license.url}>{license.url}</ExternalLink>
          </Row>
        ) : null}
        {license?.usageTerms ? (
          <Row label="이용조건">
            <p className="whitespace-pre-wrap leading-relaxed">{license.usageTerms}</p>
          </Row>
        ) : null}
        {license?.allowDownload != null ? (
          <Row label="다운로드 허용">{license.allowDownload ? "허용" : "비허용"}</Row>
        ) : downloadReady ? (
          <Row label="다운로드 허용">허용</Row>
        ) : null}
        {license?.commercialUseAllowed != null ? (
          <Row label="상업적 이용">{license.commercialUseAllowed ? "가능" : "불가 / 확인 필요"}</Row>
        ) : null}
        {license?.redistributionAllowed != null ? (
          <Row label="재배포">{license.redistributionAllowed ? "가능" : "불가 / 확인 필요"}</Row>
        ) : null}
        {license?.attributionRequired != null ? (
          <Row label="출처 표시">{license.attributionRequired ? "필요" : "불필요"}</Row>
        ) : null}
      </dl>
      {!hasSource && !hasLicense ? (
        <p className="mt-3 text-xs leading-relaxed text-store-muted">
          출처·라이선스 상세는 운영자 보정 대상일 수 있습니다. 다운로드 전 원문을 함께 확인해 주세요.
        </p>
      ) : null}
    </section>
  );
}
