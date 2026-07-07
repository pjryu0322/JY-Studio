import type { KnowledgePack } from "@/types/pack";

export function getQuickConnectPacks(packs: readonly KnowledgePack[]): KnowledgePack[] {
  return packs.filter((p) => p.isVerified);
}

export function getPopularPacks(packs: readonly KnowledgePack[]): KnowledgePack[] {
  return [...packs].sort((a, b) => b.usageCount - a.usageCount).slice(0, 4);
}

export function getNewPacks(packs: readonly KnowledgePack[]): KnowledgePack[] {
  return [...packs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3);
}

const STATUS_SORT: Record<KnowledgePack["status"], number> = {
  PUBLISHED: 0,
  REVIEWING: 1,
  DRAFT: 2,
  DEPRECATED: 3,
  SUSPENDED: 4,
};

export function sortPacksForBrowse(packs: readonly KnowledgePack[]): KnowledgePack[] {
  return [...packs].sort((a, b) => {
    const statusDiff = STATUS_SORT[a.status] - STATUS_SORT[b.status];
    if (statusDiff !== 0) return statusDiff;
    return b.usageCount - a.usageCount;
  });
}

export function filterPacks(
  packs: readonly KnowledgePack[],
  filter: "all" | "verified" | "free" | "popular",
): KnowledgePack[] {
  switch (filter) {
    case "verified":
      return packs.filter((p) => p.isVerified);
    case "free":
      return packs.filter((p) => p.pricing === "FREE");
    case "popular":
      return [...packs].sort((a, b) => b.usageCount - a.usageCount);
    default:
      return [...packs];
  }
}

export function applySearchFilters(
  packs: readonly KnowledgePack[],
  options: { filter?: string; chip?: string },
): KnowledgePack[] {
  let result = [...packs];
  const chip = options.chip?.trim();
  if (chip) {
    if (chip === "검증됨") {
      result = result.filter((p) => p.isVerified);
    } else if (chip === "무료") {
      result = result.filter((p) => p.pricing === "FREE");
    } else if (chip === "인증") {
      result = result.filter((p) => p.categoryId === "auth" || p.category.includes("인증"));
    } else if (chip === "API") {
      result = result.filter(
        (p) =>
          p.categoryId === "api" ||
          p.category === "API" ||
          p.tags.some((t) => t.includes("API")),
      );
    } else {
      const lower = chip.toLowerCase();
      result = result.filter(
        (p) =>
          p.tags.some((t) => t.toLowerCase().includes(lower)) ||
          p.supportedEnvironments.some((e) => e.toLowerCase().includes(lower)),
      );
    }
  }
  if (options.filter && options.filter !== "all") {
    result = filterPacks(result, options.filter as "verified" | "free" | "popular");
  }
  return result;
}
