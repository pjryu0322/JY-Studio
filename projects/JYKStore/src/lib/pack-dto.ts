import type {
  KnowledgePack as DbKnowledgePack,
  KnowledgePackVersion,
  PackCategory,
  PackStatus,
  ProviderType,
} from "@prisma/client";
import type { LatestPackArtifactVersionRow } from "@/lib/artifact-state/latest-pack-artifact-query";
import {
  isPackApiIntegrationReady,
  type PublicPackCapabilities,
} from "@/lib/public-pack-capability";
import { resolvePublicPackContentType } from "@/lib/public-pack-content-type";
import {
  resolvePublicPackDownloadInfo,
  resolvePublicPackLicenseInfo,
  resolvePublicPackSourceInfo,
} from "@/lib/public-pack-detail-info";
import { resolvePublicPackDisplayName } from "@/lib/public-pack-display-name";
import type {
  KnowledgePack,
  KnowledgePackProviderInfo,
  KnowledgePackStatus,
  KnowledgePackVersionEntry,
  PublicPackDownloadInfo,
  PublicPackLicenseInfo,
  PublicPackSourceInfo,
} from "@/types/pack";

export type PrismaKnowledgePackWithVersion = DbKnowledgePack & {
  category: PackCategory;
  versions: KnowledgePackVersion[];
  providerProfile?: { displayName: string; description: string } | null;
};

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toUiPackStatus(status: PackStatus): KnowledgePackStatus {
  if (status === "VERIFIED") {
    return "PUBLISHED";
  }
  return status as KnowledgePackStatus;
}

function looksLikeInternalProviderId(value: string): boolean {
  return (
    /^(jyk|prov|provider|usr|user|client)[-_]?\d+$/i.test(value.trim()) ||
    /^[A-Z]{2,5}\d{2,}$/.test(value.trim())
  );
}

function toProviderInfo(pack: PrismaKnowledgePackWithVersion): KnowledgePackProviderInfo {
  const type = pack.providerType as KnowledgePackProviderInfo["type"];
  const profileName = pack.providerProfile?.displayName?.trim() || null;
  const profileDescription = pack.providerProfile?.description?.trim() || null;
  const rawName = pack.providerName?.trim() || "";

  const name =
    profileName ??
    (rawName && !looksLikeInternalProviderId(rawName) ? rawName : null) ??
    "제공자";

  let description = profileDescription || "지식팩 제공자 정보";
  if (!profileDescription) {
    switch (pack.providerType as ProviderType) {
      case "JYK_VERIFIED":
        description = "JYKStore에서 검토한 검증 지식팩입니다.";
        break;
      case "OFFICIAL":
        description = "공식 제공 지식팩입니다.";
        break;
      case "COMMUNITY":
        description = "커뮤니티 제공 지식팩입니다.";
        break;
    }
  }

  return { name, type, description };
}

function pickLatestVersion(versions: KnowledgePackVersion[]): KnowledgePackVersion | undefined {
  if (!versions.length) return undefined;
  return [...versions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

function toVersionHistory(versions: KnowledgePackVersion[]): KnowledgePackVersionEntry[] {
  return [...versions]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((v) => ({
      version: v.version,
      date: formatDate(v.createdAt),
      summary: v.versionSummary,
    }));
}

export function toKnowledgePackDto(
  pack: PrismaKnowledgePackWithVersion,
  options?: {
    capabilities?: PublicPackCapabilities;
    sourceInfo?: PublicPackSourceInfo | null;
    licenseInfo?: PublicPackLicenseInfo | null;
    downloadInfo?: PublicPackDownloadInfo | null;
    preferredDisplayName?: string | null;
    detailVersion?: LatestPackArtifactVersionRow | null;
  },
): KnowledgePack {
  const latest = pickLatestVersion(pack.versions);
  const versionRow =
    options?.detailVersion ??
    ((latest as unknown as LatestPackArtifactVersionRow | undefined) ?? null);

  const providerInfo = toProviderInfo(pack);
  const capabilities = options?.capabilities;
  const downloadReady = capabilities?.download.status === "READY";
  const apiReady = capabilities ? isPackApiIntegrationReady(capabilities) : false;

  const features = latest ? [...latest.features] : [];
  const includedKnowledge = latest ? [...latest.includedKnowledge] : [];
  const supportedEnvironments = latest ? [...latest.supportedEnvironments] : [];
  const targetUsers = latest ? [...latest.targetUsers] : [];
  const useCases = latest ? [...latest.useCases] : [];

  const sourceInfo =
    options?.sourceInfo !== undefined
      ? options.sourceInfo
      : resolvePublicPackSourceInfo(versionRow);
  const licenseInfo =
    options?.licenseInfo !== undefined
      ? options.licenseInfo
      : resolvePublicPackLicenseInfo(versionRow);
  const downloadInfo =
    options?.downloadInfo !== undefined
      ? options.downloadInfo
      : resolvePublicPackDownloadInfo(versionRow);

  const hasDocumentSource = Boolean(
    downloadInfo?.originalFileName ||
      sourceInfo?.sourceTitle ||
      sourceInfo?.sourceUrl ||
      versionRow?.doclingImportBundles?.some((b) =>
        b.normalizedDocuments?.some((d) => d.isActive),
      ),
  );

  const contentType = resolvePublicPackContentType({
    explicitContentType: versionRow?.distributionMetadata?.contentType ?? null,
    categoryName: pack.category.name,
    categoryId: pack.categoryId,
    tags: [...pack.tags],
    features,
    supportedEnvironments,
    useCases,
    downloadReady,
    apiReady,
    hasDocumentSource,
  });

  const displayName = resolvePublicPackDisplayName({
    preferredDisplayName: options?.preferredDisplayName,
    name: pack.name,
  });

  return {
    packId: pack.packId,
    name: pack.name,
    displayName,
    category: pack.category.name,
    categoryId: pack.categoryId,
    provider: providerInfo.name,
    status: toUiPackStatus(pack.status),
    version: latest?.version ?? "0.0.0",
    description: pack.description,
    shortDescription: pack.shortDescription,
    tags: [...pack.tags],
    icon: pack.icon,
    rating: pack.rating,
    usageCount: pack.usageCount,
    isVerified: pack.isVerified,
    updatedAt: formatDate(pack.updatedAt),
    pricing: pack.pricing,
    overview: latest?.overview ?? pack.shortDescription,
    features,
    includedKnowledge,
    supportedEnvironments,
    targetUsers,
    useCases,
    versionHistory: toVersionHistory(pack.versions),
    providerInfo,
    contentType,
    sourceInfo,
    licenseInfo,
    downloadInfo,
    ...(capabilities ? { capabilities } : {}),
  };
}
