import { NotFoundState } from "@/components/NotFoundState";
import { PackDetailHero } from "@/components/PackDetailHero";
import { PackDetailSection } from "@/components/PackDetailSection";
import { PackDownloadInfoSection } from "@/components/PackDownloadInfoSection";
import { PackEmptyDetailNotice } from "@/components/PackEmptyDetailNotice";
import { PackFeatureList } from "@/components/PackFeatureList";
import { PackSourceLicenseSection } from "@/components/PackSourceLicenseSection";
import { getPublishedPackById } from "@/lib/pack-catalog-service";
import { ROUTES } from "@/lib/routes";
import type { KnowledgePack, PublicPackContentType } from "@/types/pack";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ packId: string }>;
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function shouldShowOverview(pack: KnowledgePack): boolean {
  const overview = pack.overview?.trim() ?? "";
  if (!overview) return false;
  const short = pack.shortDescription?.trim() ?? "";
  if (!short) return true;
  return normalizeText(overview) !== normalizeText(short);
}

function providerTypeLabel(type: KnowledgePack["providerInfo"]["type"]): string {
  switch (type) {
    case "JYK_VERIFIED":
      return "검증 제공자";
    case "OFFICIAL":
      return "공식 제공";
    case "COMMUNITY":
      return "커뮤니티";
  }
}

function hasOptionalDetailContent(pack: KnowledgePack): boolean {
  return (
    pack.features.length > 0 ||
    pack.includedKnowledge.length > 0 ||
    pack.supportedEnvironments.length > 0 ||
    pack.targetUsers.length > 0 ||
    pack.useCases.length > 0 ||
    shouldShowOverview(pack)
  );
}

function sectionTitleFor(contentType: PublicPackContentType | null | undefined, key: string): string {
  const documentMode = contentType === "DOCUMENT" || contentType === "MIXED" || !contentType;
  switch (key) {
    case "overview":
      return documentMode ? "문서 개요" : "개요";
    case "included":
      return documentMode ? "포함 범위" : "포함 지식";
    case "targets":
      return documentMode ? "적용 대상" : "사용 대상";
    default:
      return key;
  }
}

export default async function PackDetailPage({ params }: PageProps) {
  const { packId } = await params;
  const pack = await getPublishedPackById(packId);

  if (!pack) {
    return (
      <NotFoundState
        title="지식팩을 찾을 수 없습니다."
        description="다른 지식팩을 둘러보세요."
        ctaLabel="지식팩 둘러보기"
        ctaHref={ROUTES.packs}
      />
    );
  }

  const contentType = pack.contentType ?? null;
  const showProductSections = contentType === "PRODUCT" || contentType === "FRAMEWORK" || contentType === "API" || contentType === "MIXED";
  const showDocumentSections = contentType === "DOCUMENT" || contentType === "MIXED" || contentType == null;
  const downloadAvailable = Boolean(
    pack.downloadInfo?.available || pack.capabilities?.download.status === "READY",
  );
  const showEmptyNotice = !hasOptionalDetailContent(pack) && downloadAvailable;

  return (
    <div className="space-y-4 pb-4">
      <PackDetailHero pack={pack} />

      {shouldShowOverview(pack) ? (
        <PackDetailSection title={sectionTitleFor(contentType, "overview")}>
          <p className="text-sm leading-relaxed text-slate-700">{pack.overview}</p>
        </PackDetailSection>
      ) : null}

      {showEmptyNotice ? <PackEmptyDetailNotice downloadAvailable={downloadAvailable} /> : null}

      {showProductSections && pack.features.length > 0 ? (
        <PackDetailSection title="주요 기능">
          <PackFeatureList items={pack.features} />
        </PackDetailSection>
      ) : null}

      {(showDocumentSections || showProductSections) && pack.includedKnowledge.length > 0 ? (
        <PackDetailSection title={sectionTitleFor(contentType, "included")}>
          <PackFeatureList items={pack.includedKnowledge} />
        </PackDetailSection>
      ) : null}

      {showProductSections && pack.supportedEnvironments.length > 0 ? (
        <PackDetailSection title="지원 환경">
          <PackFeatureList items={pack.supportedEnvironments} />
        </PackDetailSection>
      ) : null}

      {pack.targetUsers.length > 0 ? (
        <PackDetailSection title={sectionTitleFor(contentType, "targets")}>
          <PackFeatureList items={pack.targetUsers} />
        </PackDetailSection>
      ) : null}

      {showProductSections && pack.useCases.length > 0 ? (
        <PackDetailSection title="활용 예시">
          <PackFeatureList items={pack.useCases} />
        </PackDetailSection>
      ) : null}

      {/* Document-only packs: show features only if present (as 주요 목차-like content). */}
      {showDocumentSections && !showProductSections && pack.features.length > 0 ? (
        <PackDetailSection title="주요 목차">
          <PackFeatureList items={pack.features} />
        </PackDetailSection>
      ) : null}

      <PackSourceLicenseSection pack={pack} />
      <PackDownloadInfoSection pack={pack} />

      {pack.versionHistory.length > 0 ? (
        <PackDetailSection title="버전 이력">
          <ul className="space-y-3">
            {pack.versionHistory.map((entry) => (
              <li key={`${entry.version}-${entry.date}`} className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-sm font-semibold text-slate-900">
                  v{entry.version}{" "}
                  <span className="font-normal text-store-muted">· {entry.date}</span>
                </p>
                {entry.summary?.trim() ? (
                  <p className="mt-1 text-xs text-slate-600">{entry.summary}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </PackDetailSection>
      ) : null}

      <PackDetailSection title="제공자 정보">
        <p className="text-sm font-semibold text-slate-900">
          제공자: {pack.providerInfo.name}
        </p>
        <p className="mt-1 text-xs font-semibold text-store-muted">
          제공 유형: {providerTypeLabel(pack.providerInfo.type)}
        </p>
        {pack.providerInfo.description ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{pack.providerInfo.description}</p>
        ) : null}
      </PackDetailSection>
    </div>
  );
}
