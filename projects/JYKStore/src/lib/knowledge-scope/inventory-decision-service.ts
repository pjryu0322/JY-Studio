import { AuditAction } from "@prisma/client";
import type {
  KnowledgeScopeDecisionSource,
  KnowledgeScopeExclusionReason,
  KnowledgeScopeItemDecision,
  KnowledgeScopeProviderDecision,
} from "@prisma/client";
import { isSafetyBlockedOverride } from "@/lib/knowledge-scope/inventory-auto-exclude";
import { persistInventoryCounts } from "@/lib/knowledge-scope/inventory-counts";
import { toInventoryItemDto, toInventorySummaryDto } from "@/lib/knowledge-scope/inventory-mapper";
import {
  KnowledgeScopeInventoryError,
  type BulkUpdateInventoryItemDecisionsInput,
  type InventoryAdminDecisionAction,
  type KnowledgeScopeInventoryItemDto,
  type KnowledgeScopeInventorySummaryDto,
  type UpdateInventoryItemDecisionInput,
} from "@/lib/knowledge-scope/inventory-types";
import { prisma } from "@/lib/prisma";
import { recordProviderAudit } from "@/lib/provider-audit";

type ResolvedDecision = {
  decision: KnowledgeScopeItemDecision;
  decisionSource: KnowledgeScopeDecisionSource;
  exclusionReasonCode: KnowledgeScopeExclusionReason | null;
  exclusionReasonText: string | null;
  providerDecisionStatus: KnowledgeScopeProviderDecision;
  providerRequestNote: string | null;
};

function resolveAdminAction(
  action: InventoryAdminDecisionAction,
  input: {
    exclusionReasonCode?: KnowledgeScopeExclusionReason;
    exclusionReasonText?: string;
    providerRequestNote?: string;
  },
): ResolvedDecision {
  switch (action) {
    case "INCLUDE":
      return {
        decision: "INCLUDED",
        decisionSource: "ADMIN",
        exclusionReasonCode: null,
        exclusionReasonText: null,
        providerDecisionStatus: "NONE",
        providerRequestNote: null,
      };
    case "EXCLUDE":
      return {
        decision: "EXCLUDED",
        decisionSource: "ADMIN",
        exclusionReasonCode: input.exclusionReasonCode ?? "ADMIN_DECISION",
        exclusionReasonText: input.exclusionReasonText?.trim() || "관리자 제외",
        providerDecisionStatus: "NONE",
        providerRequestNote: null,
      };
    case "REQUEST_PROVIDER":
      return {
        decision: "REVIEW_REQUIRED",
        decisionSource: "ADMIN",
        exclusionReasonCode: null,
        exclusionReasonText: null,
        providerDecisionStatus: "REQUESTED",
        providerRequestNote: input.providerRequestNote?.trim() || null,
      };
    case "CLEAR_TO_REVIEW":
      return {
        decision: "REVIEW_REQUIRED",
        decisionSource: "ADMIN",
        exclusionReasonCode: null,
        exclusionReasonText: null,
        providerDecisionStatus: "NONE",
        providerRequestNote: null,
      };
    default: {
      throw new KnowledgeScopeInventoryError("INVALID_ACTION", "지원하지 않는 결정 액션입니다.", 400);
    }
  }
}

async function applyDecisionToItems(input: {
  inventoryId: string;
  itemIds: string[];
  action: InventoryAdminDecisionAction;
  actorUserId: string;
  exclusionReasonCode?: KnowledgeScopeExclusionReason;
  exclusionReasonText?: string;
  providerRequestNote?: string;
  prismaClient?: typeof prisma;
}): Promise<KnowledgeScopeInventoryItemDto[]> {
  const client = input.prismaClient ?? prisma;
  const uniqueIds = [...new Set(input.itemIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    throw new KnowledgeScopeInventoryError("ITEM_IDS_REQUIRED", "대상 항목을 선택하세요.", 400);
  }

  const inventory = await client.knowledgeScopeInventory.findUnique({
    where: { id: input.inventoryId },
    select: { id: true, status: true, packId: true },
  });
  if (!inventory) {
    throw new KnowledgeScopeInventoryError("NOT_FOUND", "인벤토리를 찾을 수 없습니다.", 404);
  }
  if (inventory.status === "FINALIZED") {
    throw new KnowledgeScopeInventoryError(
      "INVENTORY_FINALIZED",
      "확정된 지식 범위는 변경할 수 없습니다.",
      409,
    );
  }

  const items = await client.knowledgeScopeInventoryItem.findMany({
    where: { inventoryId: input.inventoryId, id: { in: uniqueIds } },
  });
  if (items.length !== uniqueIds.length) {
    throw new KnowledgeScopeInventoryError("ITEM_NOT_FOUND", "일부 항목을 찾을 수 없습니다.", 404);
  }

  const resolved = resolveAdminAction(input.action, input);

  if (input.action === "INCLUDE") {
    for (const item of items) {
      if (
        item.decision === "EXCLUDED" &&
        isSafetyBlockedOverride(item.exclusionReasonCode)
      ) {
        throw new KnowledgeScopeInventoryError(
          "SAFETY_OVERRIDE_BLOCKED",
          "안전 정책으로 제외된 파일은 포함으로 변경할 수 없습니다.",
          409,
        );
      }
    }
  }

  const now = new Date();

  await client.$transaction(async (tx) => {
    for (const item of items) {
      await tx.knowledgeScopeInventoryItem.update({
        where: { id: item.id },
        data: {
          decision: resolved.decision,
          decisionSource: resolved.decisionSource,
          exclusionReasonCode: resolved.exclusionReasonCode,
          exclusionReasonText: resolved.exclusionReasonText,
          providerDecisionStatus: resolved.providerDecisionStatus,
          providerRequestNote: resolved.providerRequestNote,
          decidedAt: now,
          decidedByUserId: input.actorUserId,
        },
      });

      await tx.knowledgeScopeDecisionEvent.create({
        data: {
          inventoryId: input.inventoryId,
          itemId: item.id,
          actorUserId: input.actorUserId,
          actorRole: "ADMIN",
          fromDecision: item.decision,
          toDecision: resolved.decision,
          fromSource: item.decisionSource,
          toSource: resolved.decisionSource,
          fromProviderStatus: item.providerDecisionStatus,
          toProviderStatus: resolved.providerDecisionStatus,
          reasonCode: resolved.exclusionReasonCode,
          reasonText: resolved.exclusionReasonText,
          note: input.action,
        },
      });
    }

    await persistInventoryCounts(input.inventoryId, tx);

    await recordProviderAudit({
      action: AuditAction.ADMIN_INVENTORY_DECISION,
      entityType: "KnowledgeScopeInventory",
      entityId: input.inventoryId,
      actorUserId: input.actorUserId,
      metadata: {
        packId: inventory.packId,
        action: input.action,
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

export async function updateInventoryItemDecision(
  input: UpdateInventoryItemDecisionInput,
  prismaClient?: typeof prisma,
): Promise<KnowledgeScopeInventoryItemDto> {
  const { itemId, ...rest } = input;
  const rows = await applyDecisionToItems({
    ...rest,
    itemIds: [itemId],
    prismaClient,
  });
  return rows[0]!;
}

export async function bulkUpdateInventoryItemDecisions(
  input: BulkUpdateInventoryItemDecisionsInput,
  prismaClient?: typeof prisma,
): Promise<KnowledgeScopeInventoryItemDto[]> {
  return applyDecisionToItems({ ...input, prismaClient });
}

export async function finalizeKnowledgeScopeInventory(input: {
  inventoryId: string;
  actorUserId: string;
  prismaClient?: typeof prisma;
}): Promise<KnowledgeScopeInventorySummaryDto> {
  const client = input.prismaClient ?? prisma;
  const inventory = await client.knowledgeScopeInventory.findUnique({
    where: { id: input.inventoryId },
  });
  if (!inventory) {
    throw new KnowledgeScopeInventoryError("NOT_FOUND", "인벤토리를 찾을 수 없습니다.", 404);
  }
  if (inventory.status === "FINALIZED") {
    const counts = await persistInventoryCounts(inventory.id, client);
    return toInventorySummaryDto(inventory, counts);
  }
  if (inventory.status !== "DRAFT") {
    throw new KnowledgeScopeInventoryError(
      "INVENTORY_NOT_DRAFT",
      "초안 상태의 인벤토리만 확정할 수 있습니다.",
      409,
    );
  }

  const counts = await persistInventoryCounts(inventory.id, client);
  if (
    counts.pending > 0 ||
    counts.reviewRequired > 0 ||
    counts.providerRequested > 0 ||
    counts.included < 1
  ) {
    throw new KnowledgeScopeInventoryError(
      "SCOPE_NOT_READY",
      "미결정·제공자 확인 요청 항목이 있거나 포함 파일이 없어 확정할 수 없습니다.",
      409,
    );
  }

  const now = new Date();
  const updated = await client.$transaction(async (tx) => {
    const row = await tx.knowledgeScopeInventory.update({
      where: { id: inventory.id },
      data: {
        status: "FINALIZED",
        finalizedAt: now,
        finalizedByUserId: input.actorUserId,
        pendingCount: counts.pending,
        includedCount: counts.included,
        excludedCount: counts.excluded,
        reviewRequiredCount: counts.reviewRequired,
        providerRequestedCount: counts.providerRequested,
        itemCount: counts.total,
      },
    });

    await tx.knowledgeScopeDecisionEvent.create({
      data: {
        inventoryId: inventory.id,
        actorUserId: input.actorUserId,
        actorRole: "ADMIN",
        note: "SCOPE_FINALIZE",
        toDecision: "INCLUDED",
        toSource: "ADMIN",
      },
    });

    await recordProviderAudit({
      action: AuditAction.ADMIN_INVENTORY_SCOPE_FINALIZE,
      entityType: "KnowledgeScopeInventory",
      entityId: inventory.id,
      actorUserId: input.actorUserId,
      metadata: {
        packId: inventory.packId,
        includedCount: counts.included,
        excludedCount: counts.excluded,
      },
      client: tx,
    });

    return row;
  });

  return toInventorySummaryDto(updated, counts);
}
