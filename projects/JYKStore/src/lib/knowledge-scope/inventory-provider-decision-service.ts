import { AuditAction } from "@prisma/client";
import { persistInventoryCounts } from "@/lib/knowledge-scope/inventory-counts";
import { toInventoryItemDto } from "@/lib/knowledge-scope/inventory-mapper";
import {
  KnowledgeScopeInventoryError,
  type KnowledgeScopeInventoryItemDto,
  type RespondProviderInventoryDecisionInput,
} from "@/lib/knowledge-scope/inventory-types";
import { prisma } from "@/lib/prisma";
import { recordProviderAudit } from "@/lib/provider-audit";

export async function respondProviderInventoryDecision(
  input: RespondProviderInventoryDecisionInput,
  prismaClient?: typeof prisma,
): Promise<KnowledgeScopeInventoryItemDto[]> {
  const client = prismaClient ?? prisma;
  const uniqueIds = [...new Set(input.itemIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    throw new KnowledgeScopeInventoryError("ITEM_IDS_REQUIRED", "대상 항목을 선택하세요.", 400);
  }

  const items = await client.knowledgeScopeInventoryItem.findMany({
    where: { id: { in: uniqueIds } },
    include: {
      inventory: { select: { id: true, packId: true, status: true } },
    },
  });

  if (items.length !== uniqueIds.length) {
    throw new KnowledgeScopeInventoryError("ITEM_NOT_FOUND", "일부 항목을 찾을 수 없습니다.", 404);
  }

  for (const item of items) {
    if (item.inventory.packId !== input.packId) {
      throw new KnowledgeScopeInventoryError("PACK_MISMATCH", "해당 팩의 항목이 아닙니다.", 403);
    }
    if (item.inventory.status === "FINALIZED") {
      throw new KnowledgeScopeInventoryError(
        "INVENTORY_FINALIZED",
        "확정된 지식 범위는 변경할 수 없습니다.",
        409,
      );
    }
    if (item.providerDecisionStatus !== "REQUESTED") {
      throw new KnowledgeScopeInventoryError(
        "PROVIDER_DECISION_NOT_REQUESTED",
        "제공자 결정이 요청된 항목만 응답할 수 있습니다.",
        409,
      );
    }
  }

  const inventoryId = items[0]!.inventoryId;
  const toDecision = input.decision === "INCLUDED" ? "INCLUDED" : "EXCLUDED";
  const toProviderStatus = input.decision === "INCLUDED" ? "INCLUDED" : "EXCLUDED";
  const now = new Date();

  await client.$transaction(async (tx) => {
    for (const item of items) {
      await tx.knowledgeScopeInventoryItem.update({
        where: { id: item.id },
        data: {
          decision: toDecision,
          decisionSource: "PROVIDER",
          exclusionReasonCode: toDecision === "EXCLUDED" ? "PROVIDER_DECISION" : null,
          exclusionReasonText:
            toDecision === "EXCLUDED" ? "제공자가 지식화 대상에서 제외했습니다." : null,
          providerDecisionStatus: toProviderStatus,
          decidedAt: now,
          decidedByUserId: input.providerUserId,
        },
      });

      await tx.knowledgeScopeDecisionEvent.create({
        data: {
          inventoryId,
          itemId: item.id,
          actorUserId: input.providerUserId,
          actorRole: "PROVIDER",
          fromDecision: item.decision,
          toDecision,
          fromSource: item.decisionSource,
          toSource: "PROVIDER",
          fromProviderStatus: item.providerDecisionStatus,
          toProviderStatus,
          reasonCode: toDecision === "EXCLUDED" ? "PROVIDER_DECISION" : null,
          reasonText:
            toDecision === "EXCLUDED" ? "제공자가 지식화 대상에서 제외했습니다." : null,
        },
      });
    }

    await persistInventoryCounts(inventoryId, tx);

    await recordProviderAudit({
      action: AuditAction.PROVIDER_INVENTORY_DECISION,
      entityType: "KnowledgeScopeInventory",
      entityId: inventoryId,
      actorUserId: input.providerUserId,
      metadata: {
        packId: input.packId,
        decision: input.decision,
        itemCount: items.length,
        itemIds: uniqueIds,
      },
      client: tx,
    });
  });

  const updated = await client.knowledgeScopeInventoryItem.findMany({
    where: { id: { in: uniqueIds } },
    orderBy: { relativePath: "asc" },
  });
  return updated.map(toInventoryItemDto);
}
