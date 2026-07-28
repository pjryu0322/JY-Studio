import type {
  KnowledgeScopeExclusionReason,
  KnowledgeScopeItemDecision,
  Prisma,
} from "@prisma/client";
import {
  classifyInventoryAutoDecision,
  previewKindForExtension,
  type InventoryExclusionReasonCode,
} from "@/lib/knowledge-scope/inventory-auto-exclude";
import { persistInventoryCounts, aggregateInventoryCounts } from "@/lib/knowledge-scope/inventory-counts";
import {
  KnowledgeScopeInventoryError,
  type KnowledgeScopeInventorySummaryDto,
} from "@/lib/knowledge-scope/inventory-types";
import { toInventorySummaryDto } from "@/lib/knowledge-scope/inventory-mapper";
import { prisma } from "@/lib/prisma";
import { buildZipPreflightInventory } from "@/lib/python-worker/zip-preflight-inventory";

function mapReasonCode(code: InventoryExclusionReasonCode | null): KnowledgeScopeExclusionReason | null {
  if (!code) return null;
  return code as KnowledgeScopeExclusionReason;
}

function fileNameFromPath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? normalized;
}

export type EnsureKnowledgeScopeInventoryInput = {
  packId: string;
  versionId: string;
  sourceRevisionId: string;
  workingCopyId?: string | null;
  zipBytes: Uint8Array;
  clientId: string;
  actorUserId: string;
  prismaClient?: typeof prisma;
};

export async function ensureKnowledgeScopeInventoryForPack(
  input: EnsureKnowledgeScopeInventoryInput,
): Promise<KnowledgeScopeInventorySummaryDto> {
  const client = input.prismaClient ?? prisma;

  const existing = await client.knowledgeScopeInventory.findUnique({
    where: {
      versionId_sourceRevisionId: {
        versionId: input.versionId,
        sourceRevisionId: input.sourceRevisionId,
      },
    },
  });

  if (existing) {
    let row = existing;
    if (input.workingCopyId && existing.workingCopyId !== input.workingCopyId) {
      row = await client.knowledgeScopeInventory.update({
        where: { id: existing.id },
        data: { workingCopyId: input.workingCopyId },
      });
    }
    const counts = await aggregateInventoryCounts(row.id, client);
    return toInventorySummaryDto(row, counts);
  }

  if (input.zipBytes.byteLength === 0) {
    throw new KnowledgeScopeInventoryError("ZIP_EMPTY", "ZIP 바이트가 비어 있습니다.", 400);
  }

  const scan = await buildZipPreflightInventory(input.zipBytes);
  const fileEntries = scan.entries.filter((e) => e.kind === "file");

  const inventory = await client.$transaction(async (tx) => {
    const created = await tx.knowledgeScopeInventory.create({
      data: {
        packId: input.packId,
        versionId: input.versionId,
        sourceRevisionId: input.sourceRevisionId,
        workingCopyId: input.workingCopyId ?? null,
        status: "DRAFT",
      },
    });

    const now = new Date();
    const itemRows: Prisma.KnowledgeScopeInventoryItemCreateManyInput[] = [];
    const autoExcludeEvents: {
      relativePath: string;
      toDecision: KnowledgeScopeItemDecision;
      reasonCode: KnowledgeScopeExclusionReason | null;
      reasonText: string | null;
    }[] = [];

    for (const entry of fileEntries) {
      const fileName = fileNameFromPath(entry.path);
      const sizeBytes = entry.sizeBytes ?? 0;
      const auto = classifyInventoryAutoDecision({
        relativePath: entry.path,
        fileName,
        extension: entry.extension,
        sizeBytes,
      });

      itemRows.push({
        inventoryId: created.id,
        relativePath: entry.path,
        fileName,
        extension: entry.extension,
        sizeBytes,
        previewKind: previewKindForExtension(entry.extension),
        decision: auto.decision,
        decisionSource: auto.decisionSource,
        exclusionReasonCode: mapReasonCode(auto.exclusionReasonCode),
        exclusionReasonText: auto.exclusionReasonText,
        providerDecisionStatus: "NONE",
        decidedAt: auto.decision !== "PENDING" ? now : null,
      });

      if (auto.decision === "EXCLUDED") {
        autoExcludeEvents.push({
          relativePath: entry.path,
          toDecision: "EXCLUDED",
          reasonCode: mapReasonCode(auto.exclusionReasonCode),
          reasonText: auto.exclusionReasonText,
        });
      }
    }

    if (itemRows.length > 0) {
      await tx.knowledgeScopeInventoryItem.createMany({ data: itemRows });
    }

    if (autoExcludeEvents.length > 0) {
      const createdItems = await tx.knowledgeScopeInventoryItem.findMany({
        where: { inventoryId: created.id },
        select: { id: true, relativePath: true },
      });
      const idByPath = new Map(createdItems.map((i) => [i.relativePath, i.id]));

      await tx.knowledgeScopeDecisionEvent.createMany({
        data: autoExcludeEvents.map((ev) => ({
          inventoryId: created.id,
          itemId: idByPath.get(ev.relativePath) ?? null,
          actorUserId: input.actorUserId,
          actorRole: "SYSTEM",
          fromDecision: null,
          toDecision: ev.toDecision,
          fromSource: "SYSTEM" as const,
          toSource: "SYSTEM" as const,
          reasonCode: ev.reasonCode,
          reasonText: ev.reasonText,
          note: "ZIP scan auto-exclusion",
        })),
      });
    }

    await persistInventoryCounts(created.id, tx);

    return tx.knowledgeScopeInventory.findUniqueOrThrow({ where: { id: created.id } });
  });

  return toInventorySummaryDto(inventory, await aggregateInventoryCounts(inventory.id, client));
}

/** Alias for API routes that already have ZIP bytes after accept. */
export async function createOrRefreshInventoryFromZipBytes(
  input: EnsureKnowledgeScopeInventoryInput,
): Promise<KnowledgeScopeInventorySummaryDto> {
  return ensureKnowledgeScopeInventoryForPack(input);
}

export type EnsureInventoryAfterAcceptInput = {
  packId: string;
  versionId: string;
  clientId: string;
  adminUserId: string;
  env?: NodeJS.ProcessEnv;
  prismaClient?: typeof prisma;
};

/**
 * Best-effort inventory bootstrap after admin ZIP accept.
 * Swallows recoverable failures — callers may invoke from accept flow.
 */
export async function ensureInventoryAfterAccept(
  input: EnsureInventoryAfterAcceptInput,
): Promise<KnowledgeScopeInventorySummaryDto | null> {
  const client = input.prismaClient ?? prisma;
  const {
    getWorkerZipRequestMetadata,
    getWorkerZipRequestBytes,
  } = await import("@/lib/python-worker/worker-zip-request-storage");
  const {
    getWorkerZipSourceRevisionById,
    getWorkerZipSourceRevisionBytes,
    lazyBackfillWorkerZipSourceRevisionFromLegacy,
  } = await import("@/lib/python-worker/worker-zip-source-revision-service");

  const requestMeta = await getWorkerZipRequestMetadata({
    packId: input.packId,
    packVersionId: input.versionId,
    env: input.env,
  });

  let sourceRevisionId = requestMeta?.sourceRevisionId ?? null;
  let revision = sourceRevisionId
    ? await getWorkerZipSourceRevisionById({
        revisionId: sourceRevisionId,
        clientId: input.clientId,
        packId: input.packId,
        versionId: input.versionId,
        prismaClient: client,
        requireSafeStorageKey: false,
      })
    : null;

  if (!revision) {
    revision = await lazyBackfillWorkerZipSourceRevisionFromLegacy({
      packId: input.packId,
      versionId: input.versionId,
      clientId: input.clientId,
      env: input.env,
      prismaClient: client,
    });
    sourceRevisionId = revision?.id ?? null;
  }

  let zipBytes: Uint8Array | null = null;
  if (revision) {
    try {
      zipBytes = await getWorkerZipSourceRevisionBytes({
        revision,
        packId: input.packId,
        versionId: input.versionId,
        env: input.env,
      });
    } catch {
      zipBytes = null;
    }
  }

  if (!zipBytes?.byteLength) {
    zipBytes =
      (await getWorkerZipRequestBytes({
        packId: input.packId,
        packVersionId: input.versionId,
        env: input.env,
      })) ?? null;
  }

  if (!zipBytes?.byteLength || !sourceRevisionId) {
    return null;
  }

  return ensureKnowledgeScopeInventoryForPack({
    packId: input.packId,
    versionId: input.versionId,
    sourceRevisionId,
    zipBytes,
    clientId: input.clientId,
    actorUserId: input.adminUserId,
    prismaClient: client,
  });
}
