import { PackStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  distributionVersionAccessInclude,
  isLatestVersionCatalogVisible,
  latestKnowledgePackVersionOrderBy,
  resolveLatestDistributionState,
} from "@/lib/distribution/latest-distribution-state";
import { toKnowledgePackDto, type PrismaKnowledgePackWithVersion } from "@/lib/pack-dto";
import { rankPacks } from "@/lib/pack-search-service";
import { applySearchFilters } from "@/lib/pack-utils";
import {
  buildPublicPackCapabilityInputFromVersion,
  resolvePublicPackCapabilities,
} from "@/lib/public-pack-capability";
import { tokenizeSearchQuery } from "@/lib/search-utils";
import type { KnowledgePack, StoreCategory } from "@/types/pack";

export const packCatalogInclude = {
  category: true,
  versions: {
    orderBy: latestKnowledgePackVersionOrderBy,
    include: distributionVersionAccessInclude,
  },
} as const;

const publishedStatuses = [PackStatus.PUBLISHED, PackStatus.VERIFIED] as const;

// Latest-version policy: list visibility: "PUBLIC"; detail visibility: { in: ["PUBLIC", "UNLISTED"] }.
// Legacy packs have no latest distribution metadata and retain published catalog visibility.
const publishedPackWhere: Prisma.KnowledgePackWhereInput = {
  status: { in: [...publishedStatuses] },
};

const catalogOrderBy: Prisma.KnowledgePackOrderByWithRelationInput[] = [
  { isVerified: "desc" },
  { usageCount: "desc" },
  { rating: "desc" },
  { updatedAt: "desc" },
];

type CatalogPackRow = Prisma.KnowledgePackGetPayload<{
  include: typeof packCatalogInclude;
}>;

function toDto(row: CatalogPackRow, purpose: "list" | "detail"): KnowledgePack {
  const capabilities = resolvePublicPackCapabilities(
    buildPublicPackCapabilityInputFromVersion({
      packStatus: row.status,
      version: row.versions[0],
      catalogPurpose: purpose,
    }),
  );
  return toKnowledgePackDto(row as unknown as PrismaKnowledgePackWithVersion, { capabilities });
}

function mapRows(rows: CatalogPackRow[], purpose: "list" | "detail"): KnowledgePack[] {
  return rows.map((row) => toDto(row, purpose));
}

function isCatalogVisible(row: CatalogPackRow, purpose: "list" | "detail"): boolean {
  return isLatestVersionCatalogVisible(
    resolveLatestDistributionState(row.versions[0]),
    purpose,
  );
}

function filterCatalogRows(rows: CatalogPackRow[], purpose: "list" | "detail"): CatalogPackRow[] {
  return rows.filter((row) => isCatalogVisible(row, purpose));
}

function toStoreCategory(row: {
  categoryId: string;
  name: string;
  description: string;
  icon: string;
}): StoreCategory {
  return {
    categoryId: row.categoryId,
    name: row.name,
    description: row.description,
    icon: row.icon,
  };
}

export async function listPublishedPacks(): Promise<KnowledgePack[]> {
  const rows = await prisma.knowledgePack.findMany({
    where: publishedPackWhere,
    include: packCatalogInclude,
    orderBy: catalogOrderBy,
  });
  return mapRows(filterCatalogRows(rows, "list"), "list");
}

export async function getPublishedPackById(packId: string): Promise<KnowledgePack | null> {
  const row = await prisma.knowledgePack.findFirst({
    where: {
      packId,
      ...publishedPackWhere,
    },
    include: packCatalogInclude,
  });

  return row && isCatalogVisible(row, "detail") ? toDto(row, "detail") : null;
}

export async function listPublishedPacksByCategory(categoryId: string): Promise<KnowledgePack[]> {
  const rows = await prisma.knowledgePack.findMany({
    where: {
      categoryId,
      ...publishedPackWhere,
    },
    include: packCatalogInclude,
    orderBy: catalogOrderBy,
  });
  return mapRows(filterCatalogRows(rows, "list"), "list");
}

export type CategoryWithPublishedCount = StoreCategory & {
  publishedCount: number;
};

export async function listCategoriesWithPublishedCounts(): Promise<CategoryWithPublishedCount[]> {
  const [categories, rows] = await Promise.all([
    prisma.packCategory.findMany({ orderBy: { name: "asc" } }),
    prisma.knowledgePack.findMany({
      where: publishedPackWhere,
      include: packCatalogInclude,
    }),
  ]);

  const countByCategory = new Map<string, number>();
  for (const row of filterCatalogRows(rows, "list")) {
    countByCategory.set(row.categoryId, (countByCategory.get(row.categoryId) ?? 0) + 1);
  }

  return categories.map((category) => ({
    ...toStoreCategory(category),
    publishedCount: countByCategory.get(category.categoryId) ?? 0,
  }));
}

export async function getCategoryById(categoryId: string): Promise<StoreCategory | null> {
  const category = await prisma.packCategory.findUnique({
    where: { categoryId },
  });
  return category ? toStoreCategory(category) : null;
}

export async function searchPublishedPacks(params: {
  query?: string;
  chip?: string;
}): Promise<KnowledgePack[]> {
  const query = params.query?.trim() ?? "";
  const chip = params.chip?.trim() ?? "";

  if (!query) {
    const packs = await listPublishedPacks();
    return applySearchFilters(packs, { chip });
  }

  const tokens = tokenizeSearchQuery(query);
  const orConditions: Prisma.KnowledgePackWhereInput[] =
    tokens.length > 0
      ? tokens.flatMap((token) => [
          { name: { contains: token, mode: "insensitive" as const } },
          { packId: { contains: token, mode: "insensitive" as const } },
          { description: { contains: token, mode: "insensitive" as const } },
          { shortDescription: { contains: token, mode: "insensitive" as const } },
          { providerName: { contains: token, mode: "insensitive" as const } },
          { tags: { has: token } },
          { category: { name: { contains: token, mode: "insensitive" as const } } },
        ])
      : [
          { name: { contains: query, mode: "insensitive" as const } },
          { description: { contains: query, mode: "insensitive" as const } },
          { shortDescription: { contains: query, mode: "insensitive" as const } },
          { providerName: { contains: query, mode: "insensitive" as const } },
          { tags: { has: query } },
          { category: { name: { contains: query, mode: "insensitive" as const } } },
        ];

  const rows = await prisma.knowledgePack.findMany({
    where: {
      ...publishedPackWhere,
      OR: orConditions,
    },
    include: packCatalogInclude,
    orderBy: catalogOrderBy,
  });

  const packs = rankPacks(mapRows(filterCatalogRows(rows, "list"), "list"), query);
  return applySearchFilters(packs, { chip });
}

export type TodayFeaturedPacks = {
  todayPick: KnowledgePack;
  quickConnect: KnowledgePack[];
  popular: KnowledgePack[];
  newest: KnowledgePack[];
  categoryFeatured: KnowledgePack[];
};

export async function listTodayFeaturedPacks(): Promise<TodayFeaturedPacks | null> {
  const published = await listPublishedPacks();
  if (!published.length) {
    return null;
  }

  const todayPick = published[0]!;

  const quickConnect = published.filter((p) => p.isVerified).slice(0, 4);
  const popular = [...published].sort((a, b) => b.usageCount - a.usageCount).slice(0, 4);
  const newest = [...published]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);
  const categoryFeatured = published.filter((p) => p.categoryId === "auth").slice(0, 2);

  return {
    todayPick,
    quickConnect,
    popular,
    newest,
    categoryFeatured,
  };
}
