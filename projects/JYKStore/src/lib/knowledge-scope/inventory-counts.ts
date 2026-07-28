import type { Prisma } from "@prisma/client";
import type { KnowledgeScopeInventoryCountsDto } from "@/lib/knowledge-scope/inventory-types";

type DbClient = Prisma.TransactionClient | Pick<typeof import("@/lib/prisma").prisma, "knowledgeScopeInventoryItem" | "knowledgeScopeInventory">;

export async function aggregateInventoryCounts(
  inventoryId: string,
  client: DbClient,
): Promise<KnowledgeScopeInventoryCountsDto> {
  const [decisionGroups, excludedSourceGroups, providerRequested] = await Promise.all([
    client.knowledgeScopeInventoryItem.groupBy({
      by: ["decision"],
      where: { inventoryId },
      _count: { _all: true },
    }),
    client.knowledgeScopeInventoryItem.groupBy({
      by: ["decisionSource"],
      where: { inventoryId, decision: "EXCLUDED" },
      _count: { _all: true },
    }),
    client.knowledgeScopeInventoryItem.count({
      where: { inventoryId, providerDecisionStatus: "REQUESTED" },
    }),
  ]);

  const byDecision = new Map(decisionGroups.map((g) => [g.decision, g._count._all]));
  const included = byDecision.get("INCLUDED") ?? 0;
  const pending = byDecision.get("PENDING") ?? 0;
  const reviewRequired = byDecision.get("REVIEW_REQUIRED") ?? 0;
  const excluded = byDecision.get("EXCLUDED") ?? 0;
  const total = included + pending + reviewRequired + excluded;

  const byExcludedSource = new Map(
    excludedSourceGroups.map((g) => [g.decisionSource, g._count._all]),
  );

  return {
    total,
    included,
    excluded,
    excludedBySystem: byExcludedSource.get("SYSTEM") ?? 0,
    excludedByAdmin: byExcludedSource.get("ADMIN") ?? 0,
    excludedByProvider: byExcludedSource.get("PROVIDER") ?? 0,
    pending,
    reviewRequired,
    providerRequested,
  };
}

export async function persistInventoryCounts(
  inventoryId: string,
  client: DbClient,
): Promise<KnowledgeScopeInventoryCountsDto> {
  const counts = await aggregateInventoryCounts(inventoryId, client);
  await client.knowledgeScopeInventory.update({
    where: { id: inventoryId },
    data: {
      itemCount: counts.total,
      includedCount: counts.included,
      excludedCount: counts.excluded,
      pendingCount: counts.pending,
      reviewRequiredCount: counts.reviewRequired,
      providerRequestedCount: counts.providerRequested,
    },
  });
  return counts;
}
