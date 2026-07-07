import { mockPacks } from "@/data/mock-packs";
import type { KnowledgePack } from "@/types/pack";

export function getPublishedPacks(): KnowledgePack[] {
  return mockPacks.filter((pack) => pack.status === "PUBLISHED");
}

export function getPackById(packId: string): KnowledgePack | undefined {
  return mockPacks.find((pack) => pack.packId === packId);
}

export function getPacksByCategoryId(categoryId: string): KnowledgePack[] {
  return mockPacks.filter((pack) => pack.categoryId === categoryId);
}

export function searchPacks(query: string): KnowledgePack[] {
  const keyword = query.trim().toLowerCase();

  if (!keyword) {
    return mockPacks;
  }

  return mockPacks.filter((pack) => {
    const target = [
      pack.name,
      pack.description,
      pack.shortDescription,
      pack.category,
      pack.provider,
      ...pack.tags,
      ...pack.features,
      ...pack.includedKnowledge,
    ]
      .join(" ")
      .toLowerCase();

    return target.includes(keyword);
  });
}

export function getQuickConnectPacks(packs: readonly KnowledgePack[] = mockPacks): KnowledgePack[] {
  return packs.filter((p) => p.status === "PUBLISHED" && p.isVerified);
}

export function getPopularPacks(packs: readonly KnowledgePack[] = mockPacks): KnowledgePack[] {
  return [...packs].sort((a, b) => b.usageCount - a.usageCount).slice(0, 4);
}

export function getNewPacks(packs: readonly KnowledgePack[] = mockPacks): KnowledgePack[] {
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
      result = result.filter((p) => p.categoryId === "api" || p.category === "API" || p.tags.some((t) => t.includes("API")));
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
