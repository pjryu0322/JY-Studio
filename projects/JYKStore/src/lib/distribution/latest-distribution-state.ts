import type { DistributionVisibility, Prisma } from "@prisma/client";

export const latestKnowledgePackVersionOrderBy: Prisma.KnowledgePackVersionOrderByWithRelationInput[] = [
  { createdAt: "desc" },
  { id: "desc" },
];

export type LatestDistributionState =
  | { kind: "LEGACY" }
  | { kind: "DISTRIBUTION"; visibility: DistributionVisibility };

export function resolveLatestDistributionState(
  version: { distributionMetadata?: { visibility: DistributionVisibility } | null } | null | undefined,
): LatestDistributionState {
  const metadata = version?.distributionMetadata;
  return metadata
    ? { kind: "DISTRIBUTION", visibility: metadata.visibility }
    : { kind: "LEGACY" };
}

export function isLatestVersionCatalogVisible(
  state: LatestDistributionState,
  purpose: "list" | "detail",
): boolean {
  if (state.kind === "LEGACY") return true;
  return purpose === "list"
    ? state.visibility === "PUBLIC"
    : state.visibility === "PUBLIC" || state.visibility === "UNLISTED";
}

/** My Packs install & list visibility for the latest version. */
export function canInstallLatestDistributionPack(state: LatestDistributionState): boolean {
  if (state.kind === "LEGACY") return true;
  return state.visibility === "PUBLIC" || state.visibility === "UNLISTED";
}

export function canShowInstalledPackInMyPacks(state: LatestDistributionState): boolean {
  return canInstallLatestDistributionPack(state);
}
