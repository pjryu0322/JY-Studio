import type { LatestPackArtifactVersionRow } from "@/lib/artifact-state/latest-pack-artifact-query";
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

function toNumber(value: bigint | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : null;
  }
  return Number.isFinite(value) ? value : null;
}

function pickSourceOriginalFile(
  version: LatestPackArtifactVersionRow | null | undefined,
): {
  originalFileName: string;
  mimeType: string;
  fileSize: number | null;
  checksumSha256: string;
} | null {
  const bundles = version?.doclingImportBundles ?? [];
  for (const bundle of bundles) {
    if (!bundle.isActive) continue;
    const file = bundle.files?.find((f) => f.role === "SOURCE_ORIGINAL");
    if (file) {
      return {
        originalFileName: file.originalFileName,
        mimeType: file.mimeType,
        fileSize: toNumber(file.fileSize),
        checksumSha256: file.checksumSha256,
      };
    }
  }
  return null;
}

/**
 * Source publisher must come from source metadata only.
 * Do not fall back to KnowledgePack provider identity.
 */
export function resolvePublicPackSourceInfo(
  version: LatestPackArtifactVersionRow | null | undefined,
): PublicPackSourceInfo | null {
  const meta = version?.distributionMetadata;
  const publisherName = null;
  const sourceTitle = meta?.sourceTitle?.trim() || null;
  const sourceUrl = meta?.sourceUrl?.trim() || null;
  if (!publisherName && !sourceTitle && !sourceUrl) return null;
  return { publisherName, sourceTitle, sourceUrl };
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
  const sourceFile = pickSourceOriginalFile(version);
  const payload = version?.payload;

  let artifactKind: PublicPackDownloadArtifactKind | undefined;
  let originalFileName: string | null = null;
  let mimeType: string | null = null;
  let fileSize: number | null = null;
  let checksumSha256: string | null = null;

  if (sourceFile) {
    artifactKind = "SOURCE_ORIGINAL";
    originalFileName = sourceFile.originalFileName;
    mimeType = sourceFile.mimeType;
    fileSize = sourceFile.fileSize;
    checksumSha256 = sourceFile.checksumSha256;
  } else if (payload?.originalFileName || payload?.id) {
    artifactKind = "KNOWLEDGE_PACKAGE";
    originalFileName = payload.originalFileName ?? null;
    mimeType = payload.mimeType ?? "application/zip";
    fileSize = toNumber(payload.fileSize);
    checksumSha256 = payload.checksumSha256 ?? null;
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
