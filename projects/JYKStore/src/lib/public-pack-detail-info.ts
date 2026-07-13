import type { LatestPackArtifactVersionRow } from "@/lib/artifact-state/latest-pack-artifact-query";
import {
  canPubliclyDownloadLatestDistributionPack,
  resolveLatestDistributionState,
} from "@/lib/distribution/latest-distribution-state";
import type {
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

export function resolvePublicPackSourceInfo(
  version: LatestPackArtifactVersionRow | null | undefined,
  fallbackPublisherName?: string | null,
): PublicPackSourceInfo | null {
  const meta = version?.distributionMetadata;
  const publisherName = fallbackPublisherName?.trim() || null;
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

  const originalFileName =
    sourceFile?.originalFileName ?? payload?.originalFileName ?? null;
  const mimeType = sourceFile?.mimeType ?? payload?.mimeType ?? null;
  const fileSize = sourceFile?.fileSize ?? toNumber(payload?.fileSize) ?? null;
  const checksumSha256 = sourceFile?.checksumSha256 ?? payload?.checksumSha256 ?? null;

  if (!available && !originalFileName && !mimeType && fileSize == null && !checksumSha256) {
    return null;
  }

  return {
    available,
    originalFileName,
    mimeType,
    fileSize,
    checksumSha256,
  };
}
