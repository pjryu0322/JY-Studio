/**
 * Apply exception-only FILE / STRUCTURE / CHUNK corrections.
 */
import { AuditAction, type CorrectionRequestedAction, type Prisma } from "@prisma/client";
import {
  appendCorrectionAuditEvent,
  recordCorrectionProviderAudit,
} from "@/lib/correction/correction-audit";
import { toCorrectionCaseDto } from "@/lib/correction/correction-mapper";
import {
  CorrectionServiceError,
  type CorrectionCaseDto,
} from "@/lib/correction/correction-types";
import { updateInventoryItemDecision } from "@/lib/knowledge-scope/inventory-decision-service";
import { prisma } from "@/lib/prisma";

async function deactivateChunks(input: {
  packId: string;
  versionId: string;
  chunkIds: string[];
  client: typeof prisma;
}): Promise<number> {
  const unique = [...new Set(input.chunkIds.filter(Boolean))];
  if (unique.length === 0) return 0;
  const result = await input.client.knowledgeChunk.updateMany({
    where: {
      id: { in: unique },
      versionId: input.versionId,
      version: { packId: input.packId },
      isActive: true,
    },
    data: { isActive: false },
  });
  return result.count;
}

async function mergeChunks(input: {
  packId: string;
  versionId: string;
  keepChunkId: string;
  mergeChunkId: string;
  client: typeof prisma;
}): Promise<void> {
  const [keep, merge] = await Promise.all([
    input.client.knowledgeChunk.findFirst({
      where: {
        id: input.keepChunkId,
        versionId: input.versionId,
        version: { packId: input.packId },
      },
    }),
    input.client.knowledgeChunk.findFirst({
      where: {
        id: input.mergeChunkId,
        versionId: input.versionId,
        version: { packId: input.packId },
      },
    }),
  ]);
  if (!keep || !merge) {
    throw new CorrectionServiceError("CHUNK_NOT_FOUND", "병합할 Chunk를 찾을 수 없습니다.", 404);
  }
  if (keep.id === merge.id) {
    throw new CorrectionServiceError("INVALID_MERGE", "동일한 Chunk는 병합할 수 없습니다.", 400);
  }

  const separator = keep.content.trim().length > 0 && merge.content.trim().length > 0 ? "\n\n" : "";
  await input.client.$transaction(async (tx) => {
    await tx.knowledgeChunk.update({
      where: { id: keep.id },
      data: {
        content: `${keep.content}${separator}${merge.content}`,
        title: keep.title || merge.title,
        metadata: {
          ...((keep.metadata as Record<string, unknown> | null) ?? {}),
          correctionMergedFrom: [
            ...((((keep.metadata as Record<string, unknown> | null)?.correctionMergedFrom as
              | string[]
              | undefined) ?? []) as string[]),
            merge.id,
          ],
        } as Prisma.InputJsonValue,
      },
    });
    await tx.knowledgeChunk.update({
      where: { id: merge.id },
      data: { isActive: false },
    });
  });
}

async function structureDelete(input: {
  packId: string;
  versionId: string;
  sourceDocumentId: string;
  client: typeof prisma;
}): Promise<number> {
  const result = await input.client.knowledgeChunk.updateMany({
    where: {
      versionId: input.versionId,
      sourceDocumentId: input.sourceDocumentId,
      version: { packId: input.packId },
      isActive: true,
    },
    data: { isActive: false },
  });
  return result.count;
}

async function structureMerge(input: {
  packId: string;
  versionId: string;
  keepSourceDocumentId: string;
  mergeSourceDocumentId: string;
  client: typeof prisma;
}): Promise<number> {
  if (input.keepSourceDocumentId === input.mergeSourceDocumentId) {
    throw new CorrectionServiceError(
      "INVALID_MERGE",
      "동일한 구조(원천 문서)는 병합할 수 없습니다.",
      400,
    );
  }

  const mergeChunksRows = await input.client.knowledgeChunk.findMany({
    where: {
      versionId: input.versionId,
      sourceDocumentId: input.mergeSourceDocumentId,
      version: { packId: input.packId },
      isActive: true,
    },
    orderBy: { sortOrder: "asc" },
  });
  if (mergeChunksRows.length === 0) {
    throw new CorrectionServiceError(
      "STRUCTURE_EMPTY",
      "병합할 구조에 활성 Chunk가 없습니다.",
      404,
    );
  }

  let keepAnchor = await input.client.knowledgeChunk.findFirst({
    where: {
      versionId: input.versionId,
      sourceDocumentId: input.keepSourceDocumentId,
      version: { packId: input.packId },
      isActive: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  if (!keepAnchor) {
    const first = mergeChunksRows[0]!;
    keepAnchor = await input.client.knowledgeChunk.update({
      where: { id: first.id },
      data: { sourceDocumentId: input.keepSourceDocumentId },
    });
    mergeChunksRows.shift();
  }

  const keepId = keepAnchor.id;
  let keepContent: string = keepAnchor.content;
  let moved = 0;
  for (const row of mergeChunksRows) {
    const separator: string =
      keepContent.trim().length > 0 && row.content.trim().length > 0 ? "\n\n" : "";
    const nextContent = `${keepContent}${separator}${row.content}`;
    await input.client.knowledgeChunk.update({
      where: { id: keepId },
      data: { content: nextContent },
    });
    keepContent = nextContent;
    await input.client.knowledgeChunk.update({
      where: { id: row.id },
      data: { isActive: false },
    });
    moved += 1;
  }
  return moved;
}

async function applyFileAction(input: {
  packId: string;
  caseId: string;
  action: "FILE_EXCLUDE" | "FILE_REQUEST_PROVIDER";
  inventoryItemId: string | null;
  relativePath: string | null;
  actorUserId: string;
  reasonText?: string;
  providerRequestNote?: string;
  client: typeof prisma;
}) {
  let itemId = input.inventoryItemId?.trim() || "";
  const inventory = await input.client.knowledgeScopeInventory.findFirst({
    where: { packId: input.packId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!inventory) {
    throw new CorrectionServiceError(
      "INVENTORY_NOT_FOUND",
      "지식 범위 인벤토리가 없습니다. Inventory를 먼저 확정하세요.",
      404,
    );
  }

  if (!itemId && input.relativePath) {
    const item = await input.client.knowledgeScopeInventoryItem.findFirst({
      where: {
        inventoryId: inventory.id,
        OR: [
          { relativePath: input.relativePath },
          { relativePath: { endsWith: `/${input.relativePath}` } },
        ],
      },
      select: { id: true },
    });
    itemId = item?.id ?? "";
  }

  if (!itemId) {
    throw new CorrectionServiceError(
      "INVENTORY_ITEM_REQUIRED",
      "FILE 보정에는 inventoryItemId 또는 relativePath가 필요합니다.",
      400,
    );
  }

  await updateInventoryItemDecision(
    {
      inventoryId: inventory.id,
      itemId,
      action: input.action === "FILE_EXCLUDE" ? "EXCLUDE" : "REQUEST_PROVIDER",
      actorUserId: input.actorUserId,
      exclusionReasonCode: input.action === "FILE_EXCLUDE" ? "ADMIN_DECISION" : undefined,
      exclusionReasonText:
        input.action === "FILE_EXCLUDE"
          ? input.reasonText?.trim() || "Correction Workbench 예외 제외"
          : undefined,
      providerRequestNote:
        input.action === "FILE_REQUEST_PROVIDER"
          ? input.providerRequestNote?.trim() || "Correction Workbench 제공자 확인 요청"
          : undefined,
      allowFinalizedCorrectionOverride: true,
    },
    input.client,
  );

  return { inventoryItemId: itemId };
}

/**
 * Re-apply CHUNK/STRUCTURE overlays after full Worker regeneration
 * (FILE exclusions are already honored via Inventory).
 */
export async function reapplyCorrectionOverlays(input: {
  packId: string;
  versionId: string;
  prismaClient?: typeof prisma;
}): Promise<{ reapplied: number }> {
  const client = input.prismaClient ?? prisma;
  const cases = await client.correctionCase.findMany({
    where: {
      packId: input.packId,
      versionId: input.versionId,
      status: { in: ["APPLIED", "REGENERATED", "VERIFIED"] },
      targetType: { in: ["CHUNK", "STRUCTURE"] },
      recommendedAction: {
        in: ["CHUNK_DELETE", "CHUNK_MERGE", "STRUCTURE_DELETE", "STRUCTURE_MERGE"],
      },
    },
  });

  let reapplied = 0;
  for (const row of cases) {
    const action = row.recommendedAction;
    if (!action) continue;
    try {
      if (action === "CHUNK_DELETE") {
        await deactivateChunks({
          packId: input.packId,
          versionId: input.versionId,
          chunkIds: [row.targetId],
          client,
        });
      } else if (action === "CHUNK_MERGE" && row.secondaryTargetId) {
        // After regen IDs may change; skip hard-fail and count only when both exist.
        const keep = await client.knowledgeChunk.findFirst({
          where: { id: row.targetId, versionId: input.versionId },
          select: { id: true },
        });
        const merge = await client.knowledgeChunk.findFirst({
          where: { id: row.secondaryTargetId, versionId: input.versionId },
          select: { id: true },
        });
        if (keep && merge) {
          await mergeChunks({
            packId: input.packId,
            versionId: input.versionId,
            keepChunkId: keep.id,
            mergeChunkId: merge.id,
            client,
          });
        }
      } else if (action === "STRUCTURE_DELETE") {
        await structureDelete({
          packId: input.packId,
          versionId: input.versionId,
          sourceDocumentId: row.targetId,
          client,
        });
      } else if (action === "STRUCTURE_MERGE" && row.secondaryTargetId) {
        await structureMerge({
          packId: input.packId,
          versionId: input.versionId,
          keepSourceDocumentId: row.targetId,
          mergeSourceDocumentId: row.secondaryTargetId,
          client,
        });
      }
      reapplied += 1;
    } catch {
      // Overlay best-effort after regen; FILE path remains authoritative.
    }
  }
  return { reapplied };
}

export async function applyCorrectionCase(input: {
  packId: string;
  caseId: string;
  action: CorrectionRequestedAction;
  actorUserId: string;
  secondaryTargetId?: string;
  reasonText?: string;
  providerRequestNote?: string;
  prismaClient?: typeof prisma;
}): Promise<CorrectionCaseDto> {
  const client = input.prismaClient ?? prisma;
  const packId = input.packId.trim();
  const caseId = input.caseId.trim();

  const row = await client.correctionCase.findFirst({
    where: { id: caseId, packId },
  });
  if (!row) {
    throw new CorrectionServiceError("CASE_NOT_FOUND", "보정 케이스를 찾을 수 없습니다.", 404);
  }
  if (row.status !== "OPEN" && row.status !== "APPLIED") {
    throw new CorrectionServiceError(
      "INVALID_STATUS",
      `현재 상태(${row.status})에서는 보정을 적용할 수 없습니다.`,
      409,
    );
  }

  const action = input.action;
  const secondaryTargetId = input.secondaryTargetId?.trim() || row.secondaryTargetId || null;

  if (
    (action === "CHUNK_MERGE" || action === "STRUCTURE_MERGE") &&
    !secondaryTargetId
  ) {
    throw new CorrectionServiceError(
      "SECONDARY_TARGET_REQUIRED",
      "병합에는 secondaryTargetId가 필요합니다.",
      400,
    );
  }

  if (row.targetType === "FILE") {
    if (action !== "FILE_EXCLUDE" && action !== "FILE_REQUEST_PROVIDER") {
      throw new CorrectionServiceError(
        "ACTION_MISMATCH",
        "FILE 케이스에는 FILE_EXCLUDE / FILE_REQUEST_PROVIDER만 가능합니다.",
        400,
      );
    }
    const fileResult = await applyFileAction({
      packId,
      caseId,
      action,
      inventoryItemId: row.inventoryItemId,
      relativePath: row.relativePath,
      actorUserId: input.actorUserId,
      reasonText: input.reasonText,
      providerRequestNote: input.providerRequestNote,
      client,
    });
    const updated = await client.correctionCase.update({
      where: { id: caseId },
      data: {
        status: "APPLIED",
        recommendedAction: action,
        inventoryItemId: fileResult.inventoryItemId,
        appliedAt: new Date(),
        appliedByUserId: input.actorUserId,
        parameters: {
          ...((row.parameters as Record<string, unknown> | null) ?? {}),
          reasonText: input.reasonText ?? null,
          providerRequestNote: input.providerRequestNote ?? null,
        } as Prisma.InputJsonValue,
      },
    });
    await appendCorrectionAuditEvent({
      caseId,
      actorUserId: input.actorUserId,
      action: "APPLY",
      fromStatus: row.status,
      toStatus: "APPLIED",
      detail: { correctionAction: action, inventoryItemId: fileResult.inventoryItemId },
      client,
    });
    await recordCorrectionProviderAudit({
      action: AuditAction.ADMIN_CORRECTION_APPLY,
      caseId,
      packId,
      actorUserId: input.actorUserId,
      metadata: { correctionAction: action, targetType: row.targetType },
      client,
    });
    return toCorrectionCaseDto(updated);
  }

  if (row.targetType === "STRUCTURE") {
    if (action !== "STRUCTURE_DELETE" && action !== "STRUCTURE_MERGE") {
      throw new CorrectionServiceError(
        "ACTION_MISMATCH",
        "STRUCTURE 케이스에는 STRUCTURE_DELETE / STRUCTURE_MERGE만 가능합니다.",
        400,
      );
    }
    let affected = 0;
    if (action === "STRUCTURE_DELETE") {
      affected = await structureDelete({
        packId,
        versionId: row.versionId,
        sourceDocumentId: row.targetId,
        client,
      });
    } else {
      affected = await structureMerge({
        packId,
        versionId: row.versionId,
        keepSourceDocumentId: row.targetId,
        mergeSourceDocumentId: secondaryTargetId!,
        client,
      });
    }
    const updated = await client.correctionCase.update({
      where: { id: caseId },
      data: {
        status: "APPLIED",
        recommendedAction: action,
        secondaryTargetId,
        appliedAt: new Date(),
        appliedByUserId: input.actorUserId,
        parameters: {
          ...((row.parameters as Record<string, unknown> | null) ?? {}),
          affectedChunkOps: affected,
        } as Prisma.InputJsonValue,
      },
    });
    await appendCorrectionAuditEvent({
      caseId,
      actorUserId: input.actorUserId,
      action: "APPLY",
      fromStatus: row.status,
      toStatus: "APPLIED",
      detail: { correctionAction: action, affected, secondaryTargetId },
      client,
    });
    await recordCorrectionProviderAudit({
      action: AuditAction.ADMIN_CORRECTION_APPLY,
      caseId,
      packId,
      actorUserId: input.actorUserId,
      metadata: { correctionAction: action, targetType: row.targetType, affected },
      client,
    });
    return toCorrectionCaseDto(updated);
  }

  // CHUNK
  if (action !== "CHUNK_DELETE" && action !== "CHUNK_MERGE") {
    throw new CorrectionServiceError(
      "ACTION_MISMATCH",
      "CHUNK 케이스에는 CHUNK_DELETE / CHUNK_MERGE만 가능합니다.",
      400,
    );
  }
  if (action === "CHUNK_DELETE") {
    const count = await deactivateChunks({
      packId,
      versionId: row.versionId,
      chunkIds: [row.targetId],
      client,
    });
    if (count === 0) {
      throw new CorrectionServiceError("CHUNK_NOT_FOUND", "삭제할 Chunk를 찾을 수 없습니다.", 404);
    }
  } else {
    await mergeChunks({
      packId,
      versionId: row.versionId,
      keepChunkId: row.targetId,
      mergeChunkId: secondaryTargetId!,
      client,
    });
  }

  const updated = await client.correctionCase.update({
    where: { id: caseId },
    data: {
      status: "APPLIED",
      recommendedAction: action,
      secondaryTargetId,
      appliedAt: new Date(),
      appliedByUserId: input.actorUserId,
    },
  });
  await appendCorrectionAuditEvent({
    caseId,
    actorUserId: input.actorUserId,
    action: "APPLY",
    fromStatus: row.status,
    toStatus: "APPLIED",
    detail: { correctionAction: action, secondaryTargetId },
    client,
  });
  await recordCorrectionProviderAudit({
    action: AuditAction.ADMIN_CORRECTION_APPLY,
    caseId,
    packId,
    actorUserId: input.actorUserId,
    metadata: { correctionAction: action, targetType: row.targetType },
    client,
  });
  return toCorrectionCaseDto(updated);
}
