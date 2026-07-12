import { PackStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toKnowledgePackDto, type PrismaKnowledgePackWithVersion } from "@/lib/pack-dto";
import { rankPacks } from "@/lib/pack-search-service";
import { applySearchFilters } from "@/lib/pack-utils";
import { tokenizeSearchQuery } from "@/lib/search-utils";
import type { KnowledgePack, StoreCategory } from "@/types/pack";

export const packCatalogInclude = {
  category: true,
  versions: {
    orderBy: { createdAt: "desc" as const },
  },
} as const;

const publishedStatuses = [PackStatus.PUBLISHED, PackStatus.VERIFIED] as const;

/** Legacy packs (no distribution metadata) keep prior catalog rules. */
const catalogListVisibilityWhere: Prisma.KnowledgePackWhereInput = {
  OR: [
    { distributionMetadata: { none: {} } },
    { distributionMetadata: { some: { visibility: "PUBLIC" } } },
  ],
};

/** Direct pack URL: PUBLIC + UNLISTED; PRIVATE distribution packs stay hidden. */
const catalogDetailVisibilityWhere: Prisma.KnowledgePackWhereInput = {
  OR: [
    { distributionMetadata: { none: {} } },
    {
      distributionMetadata: {
        some: { visibility: { in: ["PUBLIC", "UNLISTED"] } },
      },
    },
  ],
};

const publishedPackWhere: Prisma.KnowledgePackWhereInput = {
  status: { in: [...publishedStatuses] },
};

const publishedCatalogListWhere: Prisma.KnowledgePackWhereInput = {
  ...publishedPackWhere,
  AND: [catalogListVisibilityWhere],
};

const publishedCatalogDetailWhere: Prisma.KnowledgePackWhereInput = {
  ...publishedPackWhere,
  AND: [catalogDetailVisibilityWhere],
};

const catalogOrderBy: Prisma.KnowledgePackOrderByWithRelationInput[] = [
  { isVerified: "desc" },
  { usageCount: "desc" },
  { rating: "desc" },
  { updatedAt: "desc" },
];

function mapRows(rows: PrismaKnowledgePackWithVersion[]): KnowledgePack[] {
  return rows.map(toKnowledgePackDto);
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
    where: publishedCatalogListWhere,
    include: packCatalogInclude,
    orderBy: catalogOrderBy,
  });
  return mapRows(rows);
}

export async function getPublishedPackById(packId: string): Promise<KnowledgePack | null> {
  const row = await prisma.knowledgePack.findFirst({
    where: {
      packId,
      ...publishedCatalogDetailWhere,
    },
    include: packCatalogInclude,
  });

  return row ? toKnowledgePackDto(row) : null;
}

export async function listPublishedPacksByCategory(categoryId: string): Promise<KnowledgePack[]> {
  const rows = await prisma.knowledgePack.findMany({
    where: {
      categoryId,
      ...publishedCatalogListWhere,
    },
    include: packCatalogInclude,
    orderBy: catalogOrderBy,
  });
  return mapRows(rows);
}

export type CategoryWithPublishedCount = StoreCategory & {
  publishedCount: number;
};

export async function listCategoriesWithPublishedCounts(): Promise<CategoryWithPublishedCount[]> {
  const [categories, counts] = await Promise.all([
    prisma.packCategory.findMany({ orderBy: { name: "asc" } }),
    prisma.knowledgePack.groupBy({
      by: ["categoryId"],
      where: publishedCatalogListWhere,
      _count: { _all: true },
    }),
  ]);

  const countByCategory = new Map(counts.map((row) => [row.categoryId, row._count._all]));

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
      ...publishedCatalogListWhere,
      OR: orConditions,
    },
    include: packCatalogInclude,
    orderBy: catalogOrderBy,
  });

  const packs = rankPacks(mapRows(rows), query);
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
