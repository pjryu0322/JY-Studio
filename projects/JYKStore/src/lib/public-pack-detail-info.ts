import type { LatestPackArtifactVersionRow } from "@/lib/artifact-state/latest-pack-artifact-query";
import { selectPublicArtifact } from "@/lib/artifact-state/select-public-artifact";
import {
  canPubliclyDownloadLatestDistributionPack,
  resolveLatestDistributionState,
} from "@/lib/distribution/latest-distribution-state";
import type {
  PublicPackDownloadArtifactKind,
  PublicPackDownloadInfo,
  PublicPackLicenseInfo,
  PublicPackSourceInfo,
} from "@/types/pack";

const AMBIGUOUS_LICENSE = new Set(["public", "open", "unspecified", "unknown", "n/a", "na", "-"]);

export function isAmbiguousPublicLicenseName(name: string | null | undefined): boolean {
  if (!name) return true;
  const normalized = name.trim().toLowerCase();
  if (!normalized) return true;
  return AMBIGUOUS_LICENSE.has(normalized);
}

export function formatPublicLicenseDisplayName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  if (isAmbiguousPublicLicenseName(name)) return "이용조건 확인 필요";
  return name.trim();
}

function toIsoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  const trimmed = value.trim();
  return trimmed || null;
}

/**
 * Source publisher must come from source metadata only.
 * Do not fall back to KnowledgePack provider identity.
 */
export function resolvePublicPackSourceInfo(
  version: LatestPackArtifactVersionRow | null | undefined,
): PublicPackSourceInfo | null {
  const meta = version?.distributionMetadata;
  const publisherName = meta?.sourcePublisherName?.trim() || null;
  const publisherUrl = meta?.sourcePublisherUrl?.trim() || null;
  const sourceTitle = meta?.sourceTitle?.trim() || null;
  const sourceUrl = meta?.sourceUrl?.trim() || null;
  const documentVersion = meta?.sourceDocumentVersion?.trim() || null;
  const publishedAt = toIsoDate(meta?.sourcePublishedAt);
  const retrievedAt = toIsoDate(meta?.sourceRetrievedAt);
  if (
    !publisherName &&
    !publisherUrl &&
    !sourceTitle &&
    !sourceUrl &&
    !documentVersion &&
    !publishedAt &&
    !retrievedAt
  ) {
    return null;
  }
  return {
    publisherName,
    publisherUrl,
    sourceTitle,
    sourceUrl,
    documentVersion,
    publishedAt,
    retrievedAt,
  };
}

export function resolvePublicPackLicenseInfo(
  version: LatestPackArtifactVersionRow | null | undefined,
): PublicPackLicenseInfo | null {
  const meta = version?.distributionMetadata;
  if (!meta) return null;

  const rawName = meta.licenseName?.trim() || null;
  const name = formatPublicLicenseDisplayName(rawName);
  const url = meta.licenseUrl?.trim() || null;
  const usageTerms = meta.usageTerms?.trim() || null;
  const allowDownload = meta.allowDownload;

  if (!name && !url && !usageTerms && allowDownload == null) return null;

  return {
    name,
    url,
    usageTerms,
    allowDownload: typeof allowDownload === "boolean" ? allowDownload : null,
    commercialUseAllowed: null,
    redistributionAllowed: null,
    attributionRequired: null,
  };
}

export function resolvePublicPackDownloadInfo(
  version: LatestPackArtifactVersionRow | null | undefined,
): PublicPackDownloadInfo | null {
  const state = resolveLatestDistributionState(version);
  const available = canPubliclyDownloadLatestDistributionPack(state);
  const selected = selectPublicArtifact(version);

  let artifactKind: PublicPackDownloadArtifactKind | undefined;
  let originalFileName: string | null = null;
  let mimeType: string | null = null;
  let fileSize: number | null = null;
  let checksumSha256: string | null = null;

  if (selected.kind === "SOURCE_ORIGINAL") {
    artifactKind = "SOURCE_ORIGINAL";
    originalFileName = selected.originalFileName;
    mimeType = selected.mimeType;
    fileSize = selected.fileSize;
    checksumSha256 = selected.checksumSha256 || null;
  }

  if (!available && !originalFileName && !mimeType && fileSize == null && !checksumSha256) {
    return null;
  }

  return {
    available,
    artifactKind,
    originalFileName,
    mimeType,
    fileSize,
    checksumSha256,
  };
}
