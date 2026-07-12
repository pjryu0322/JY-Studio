import type { DistributionVisibility, Prisma } from "@prisma/client";

export const latestKnowledgePackVersionOrderBy: Prisma.KnowledgePackVersionOrderByWithRelationInput[] = [
  { createdAt: "desc" },
  { id: "desc" },
];

/** Shared include for catalog / My Packs visibility resolution. */
export const distributionVersionAccessInclude = {
  payload: {
    select: {
      id: true,
      validationStatus: true,
    },
  },
  distributionMetadata: {
    select: {
      visibility: true,
      allowDownload: true,
    },
  },
} satisfies Prisma.KnowledgePackVersionInclude;

export type LatestDistributionState =
  | { kind: "LEGACY" }
  | {
      kind: "DISTRIBUTION";
      visibility: DistributionVisibility;
      allowDownload: boolean;
    }
  | {
      kind: "INVALID_DISTRIBUTION";
      reason: "PAYLOAD_WITHOUT_METADATA" | "METADATA_WITHOUT_PAYLOAD";
    };

export type LatestDistributionVersionInput = {
  payload?: { id: string; validationStatus?: string } | null;
  distributionMetadata?: {
    visibility: DistributionVisibility;
    allowDownload: boolean;
  } | null;
} | null | undefined;

export function resolveLatestDistributionState(
  version: LatestDistributionVersionInput,
): LatestDistributionState {
  const payload = version?.payload ?? null;
  const metadata = version?.distributionMetadata ?? null;

  if (!payload && !metadata) {
    return { kind: "LEGACY" };
  }

  if (payload && metadata) {
    return {
      kind: "DISTRIBUTION",
      visibility: metadata.visibility,
      allowDownload: metadata.allowDownload,
    };
  }

  return {
    kind: "INVALID_DISTRIBUTION",
    reason: payload ? "PAYLOAD_WITHOUT_METADATA" : "METADATA_WITHOUT_PAYLOAD",
  };
}

export function isLatestVersionCatalogVisible(
  state: LatestDistributionState,
  purpose: "list" | "detail",
): boolean {
  if (state.kind === "INVALID_DISTRIBUTION") return false;
  if (state.kind === "LEGACY") return true;
  return purpose === "list"
    ? state.visibility === "PUBLIC"
    : state.visibility === "PUBLIC" || state.visibility === "UNLISTED";
}

/** My Packs install & list visibility for the latest version. */
export function canInstallLatestDistributionPack(state: LatestDistributionState): boolean {
  if (state.kind === "INVALID_DISTRIBUTION") return false;
  if (state.kind === "LEGACY") return true;
  return state.visibility === "PUBLIC" || state.visibility === "UNLISTED";
}

export function canShowInstalledPackInMyPacks(state: LatestDistributionState): boolean {
  return canInstallLatestDistributionPack(state);
}

/** Public catalog payload download for the latest version. */
export function canPubliclyDownloadLatestDistributionPack(
  state: LatestDistributionState,
): boolean {
  if (state.kind !== "DISTRIBUTION") return false;
  if (!state.allowDownload) return false;
  return state.visibility === "PUBLIC" || state.visibility === "UNLISTED";
}
