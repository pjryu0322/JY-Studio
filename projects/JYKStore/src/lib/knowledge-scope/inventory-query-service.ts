import type { Prisma } from "@prisma/client";
import { aggregateInventoryCounts } from "@/lib/knowledge-scope/inventory-counts";
import { toInventoryItemDto, toInventorySummaryDto } from "@/lib/knowledge-scope/inventory-mapper";
import type {
  KnowledgeScopeInventoryItemDto,
  KnowledgeScopeInventoryListFilters,
  KnowledgeScopeInventoryListResult,
  KnowledgeScopeInventorySummaryDto,
} from "@/lib/knowledge-scope/inventory-types";
import { prisma } from "@/lib/prisma";

export async function getKnowledgeScopeInventorySummary(
  packId: string,
  prismaClient?: typeof prisma,
): Promise<KnowledgeScopeInventorySummaryDto | null> {
  const client = prismaClient ?? prisma;
  const draft = await client.knowledgeScopeInventory.findFirst({
    where: { packId, status: "DRAFT" },
    orderBy: { updatedAt: "desc" },
  });
  const row =
    draft ??
    (await client.knowledgeScopeInventory.findFirst({
      where: { packId, status: "FINALIZED" },
      orderBy: { updatedAt: "desc" },
    }));

  if (!row) return null;

  const counts = await aggregateInventoryCounts(row.id, client);
  return toInventorySummaryDto(row, counts);
}

export async function getKnowledgeScopeInventoryBySourceRevision(input: {
  versionId: string;
  sourceRevisionId: string;
  prismaClient?: typeof prisma;
}): Promise<KnowledgeScopeInventorySummaryDto | null> {
  const client = input.prismaClient ?? prisma;
  const row = await client.knowledgeScopeInventory.findUnique({
    where: {
      versionId_sourceRevisionId: {
        versionId: input.versionId,
        sourceRevisionId: input.sourceRevisionId,
      },
    },
  });
  if (!row) return null;
  const counts = await aggregateInventoryCounts(row.id, client);
  return toInventorySummaryDto(row, counts);
}

export async function listKnowledgeScopeInventoryItems(
  filters: KnowledgeScopeInventoryListFilters,
  prismaClient?: typeof prisma,
): Promise<KnowledgeScopeInventoryListResult> {
  const client = prismaClient ?? prisma;
  const page = Math.max(1, filters.page);
  const pageSize = Math.min(200, Math.max(1, filters.pageSize));
  const skip = (page - 1) * pageSize;

  const where: Prisma.KnowledgeScopeInventoryItemWhereInput = {
    inventoryId: filters.inventoryId,
  };

  if (filters.decision) where.decision = filters.decision;
  if (filters.extension) where.extension = filters.extension;
  if (filters.exclusionReasonCode) where.exclusionReasonCode = filters.exclusionReasonCode;
  if (filters.decisionSource) where.decisionSource = filters.decisionSource;
  if (filters.providerDecisionStatus) {
    where.providerDecisionStatus = filters.providerDecisionStatus;
  }

  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { fileName: { contains: q, mode: "insensitive" } },
      { relativePath: { contains: q, mode: "insensitive" } },
    ];
  }

  const pathPrefix = filters.pathPrefix?.trim().replace(/\\/g, "/");
  if (pathPrefix) {
    where.relativePath = { startsWith: pathPrefix.replace(/\/+$/, "") };
  }

  const [total, rows] = await Promise.all([
    client.knowledgeScopeInventoryItem.count({ where }),
    client.knowledgeScopeInventoryItem.findMany({
      where,
      orderBy: [{ relativePath: "asc" }],
      skip,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map(toInventoryItemDto),
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

export async function listInventoryItemsForWorkerManifest(
  inventoryId: string,
  prismaClient?: typeof prisma,
): Promise<
  {
    id: string;
    relativePath: string;
    decision: import("@prisma/client").KnowledgeScopeItemDecision;
    fileName: string;
    extension: string;
    fileCategory: string | null;
  }[]
> {
  const client = prismaClient ?? prisma;
  return client.knowledgeScopeInventoryItem.findMany({
    where: { inventoryId },
    select: {
      id: true,
      relativePath: true,
      decision: true,
      fileName: true,
      extension: true,
      fileCategory: true,
    },
  });
}

/** Provider-facing: items waiting on this pack's provider decision. */
export async function listProviderRequestedInventoryItems(
  packId: string,
  prismaClient?: typeof prisma,
): Promise<KnowledgeScopeInventoryItemDto[]> {
  const client = prismaClient ?? prisma;
  const inventory = await client.knowledgeScopeInventory.findFirst({
    where: { packId, status: "DRAFT" },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!inventory) return [];

  const rows = await client.knowledgeScopeInventoryItem.findMany({
    where: {
      inventoryId: inventory.id,
      providerDecisionStatus: "REQUESTED",
    },
    orderBy: { relativePath: "asc" },
    take: 500,
  });
  return rows.map(toInventoryItemDto);
}
