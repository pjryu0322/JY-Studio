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
import { buildInventorySourceFingerprint } from "@/lib/knowledge-scope/inventory-source-fingerprint";
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
  /** Required — Inventory is always scanned from Working Copy. */
  workingCopyId: string;
  /** Working Copy ZIP bytes (not Original). */
  zipBytes: Uint8Array;
  clientId: string;
  actorUserId: string;
  prismaClient?: typeof prisma;
};

/**
 * Create Inventory from Working Copy file scan.
 * Idempotent when the same WC + fingerprint already exists.
 * Legacy Original-only inventories (null WC / fingerprint) are rebuilt when DRAFT,
 * or rejected when FINALIZED (caller must supersede via explicit rebuild).
 */
export async function ensureKnowledgeScopeInventoryForPack(
  input: EnsureKnowledgeScopeInventoryInput,
): Promise<KnowledgeScopeInventorySummaryDto> {
  const client = input.prismaClient ?? prisma;
  const workingCopyId = input.workingCopyId?.trim();
  if (!workingCopyId) {
    throw new KnowledgeScopeInventoryError(
      "WORKING_COPY_REQUIRED",
      "Inventory는 Working Copy 기준으로만 생성할 수 있습니다.",
      400,
    );
  }
  if (input.zipBytes.byteLength === 0) {
    throw new KnowledgeScopeInventoryError("ZIP_EMPTY", "Working Copy ZIP 바이트가 비어 있습니다.", 400);
  }

  const scan = await buildZipPreflightInventory(input.zipBytes);
  const fileEntries = scan.entries.filter((e) => e.kind === "file");
  const fingerprint = buildInventorySourceFingerprint(
    fileEntries.map((e) => ({
      relativePath: e.path,
      sizeBytes: e.sizeBytes ?? 0,
      contentHash: null,
    })),
  );

  const existing = await client.knowledgeScopeInventory.findUnique({
    where: {
      versionId_sourceRevisionId: {
        versionId: input.versionId,
        sourceRevisionId: input.sourceRevisionId,
      },
    },
  });

  if (existing) {
    if (
      existing.status === "FINALIZED" &&
      existing.workingCopyId === workingCopyId &&
      existing.inventorySourceFingerprint === fingerprint
    ) {
      const counts = await aggregateInventoryCounts(existing.id, client);
      return toInventorySummaryDto(existing, counts);
    }

    if (existing.status === "FINALIZED") {
      throw new KnowledgeScopeInventoryError(
        "SCOPE_REBUILD_REQUIRED",
        "확정된 Inventory와 Working Copy가 일치하지 않습니다. 범위를 다시 확인하세요.",
        409,
      );
    }

    // DRAFT: rebuild items from current WC scan (idempotent refresh).
    const rebuilt = await client.$transaction(async (tx) => {
      await tx.knowledgeScopeDecisionEvent.deleteMany({ where: { inventoryId: existing.id } });
      await tx.knowledgeScopeInventoryItem.deleteMany({ where: { inventoryId: existing.id } });
      await insertInventoryItemsFromScan({
        tx,
        inventoryId: existing.id,
        fileEntries,
        actorUserId: input.actorUserId,
      });
      const row = await tx.knowledgeScopeInventory.update({
        where: { id: existing.id },
        data: {
          workingCopyId,
          inventorySourceFingerprint: fingerprint,
          status: "DRAFT",
          finalizedAt: null,
          finalizedByUserId: null,
        },
      });
      await persistInventoryCounts(existing.id, tx);
      return row;
    });
    return toInventorySummaryDto(rebuilt, await aggregateInventoryCounts(rebuilt.id, client));
  }

  const inventory = await client.$transaction(async (tx) => {
    const created = await tx.knowledgeScopeInventory.create({
      data: {
        packId: input.packId,
        versionId: input.versionId,
        sourceRevisionId: input.sourceRevisionId,
        workingCopyId,
        inventorySourceFingerprint: fingerprint,
        status: "DRAFT",
      },
    });

    await insertInventoryItemsFromScan({
      tx,
      inventoryId: created.id,
      fileEntries,
      actorUserId: input.actorUserId,
    });
    await persistInventoryCounts(created.id, tx);
    return tx.knowledgeScopeInventory.findUniqueOrThrow({ where: { id: created.id } });
  });

  return toInventorySummaryDto(inventory, await aggregateInventoryCounts(inventory.id, client));
}

async function insertInventoryItemsFromScan(input: {
  tx: Prisma.TransactionClient;
  inventoryId: string;
  fileEntries: { path: string; extension: string; sizeBytes: number | null }[];
  actorUserId: string;
}): Promise<void> {
  const now = new Date();
  const itemRows: Prisma.KnowledgeScopeInventoryItemCreateManyInput[] = [];
  const autoExcludeEvents: {
    relativePath: string;
    toDecision: KnowledgeScopeItemDecision;
    reasonCode: KnowledgeScopeExclusionReason | null;
    reasonText: string | null;
  }[] = [];

  for (const entry of input.fileEntries) {
    const fileName = fileNameFromPath(entry.path);
    const sizeBytes = entry.sizeBytes ?? 0;
    const auto = classifyInventoryAutoDecision({
      relativePath: entry.path,
      fileName,
      extension: entry.extension,
      sizeBytes,
    });

      itemRows.push({
        inventoryId: input.inventoryId,
        relativePath: entry.path,
        fileName,
        extension: entry.extension,
        sizeBytes,
        previewKind: previewKindForExtension(entry.extension),
        fileCategory: auto.fileCategory ?? auto.capability ?? null,
        decision: auto.decision,
        decisionSource: auto.decisionSource,
        exclusionReasonCode: mapReasonCode(auto.exclusionReasonCode),
        exclusionReasonText: auto.exclusionReasonText,
        providerDecisionStatus: "NONE",
        decidedAt: auto.decision !== "PENDING" && auto.decision !== "REVIEW_REQUIRED" ? now : null,
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
    await input.tx.knowledgeScopeInventoryItem.createMany({ data: itemRows });
  }

  if (autoExcludeEvents.length > 0) {
    const createdItems = await input.tx.knowledgeScopeInventoryItem.findMany({
      where: { inventoryId: input.inventoryId },
      select: { id: true, relativePath: true },
    });
    const idByPath = new Map(createdItems.map((i) => [i.relativePath, i.id]));

    await input.tx.knowledgeScopeDecisionEvent.createMany({
      data: autoExcludeEvents.map((ev) => ({
        inventoryId: input.inventoryId,
        itemId: idByPath.get(ev.relativePath) ?? null,
        actorUserId: input.actorUserId,
        actorRole: "SYSTEM",
        fromDecision: null,
        toDecision: ev.toDecision,
        fromSource: "SYSTEM" as const,
        toSource: "SYSTEM" as const,
        reasonCode: ev.reasonCode,
        reasonText: ev.reasonText,
        note: "Working Copy scan auto-exclusion",
      })),
    });
  }
}

/** @deprecated Prefer ensureKnowledgeScopeInventoryForPack with Working Copy bytes. */
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
 * Canonical post-accept bootstrap:
 * Original already stored → create Working Copy → scan WC → Inventory.
 */
export async function ensureInventoryAfterAccept(
  input: EnsureInventoryAfterAcceptInput,
): Promise<KnowledgeScopeInventorySummaryDto | null> {
  const client = input.prismaClient ?? prisma;
  const {
    getWorkerZipRequestMetadata,
  } = await import("@/lib/python-worker/worker-zip-request-storage");
  const {
    getWorkerZipSourceRevisionById,
    lazyBackfillWorkerZipSourceRevisionFromLegacy,
  } = await import("@/lib/python-worker/worker-zip-source-revision-service");
  const {
    createWorkerZipWorkingCopyFromRevision,
    buildWorkerWorkingCopyDirectiveSnapshot,
    buildWorkerWorkingCopyIdempotencyKey,
    getWorkerZipWorkingCopyBytes,
  } = await import("@/lib/python-worker/worker-zip-working-copy-service");

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

  if (!revision || !sourceRevisionId) {
    return null;
  }

  const liveExcludePaths = requestMeta?.adminPreflightExclusions?.paths ?? [];
  const liveReasons = requestMeta?.adminPreflightExclusions?.reasons ?? {};
  const { checksumSha256: directiveChecksum } = buildWorkerWorkingCopyDirectiveSnapshot({
    sourceRevisionId: revision.id,
    sourceArchiveChecksumSha256: revision.checksumSha256,
    adminExcludePaths: liveExcludePaths,
    adminExclusionReasons: liveReasons,
    createdByUserId: input.adminUserId,
  });

  const acceptMarker = await client.pipelineRun.findFirst({
    where: {
      packId: input.packId,
      triggerType: "WORKER_ZIP_REQUEST",
      status: { in: ["PENDING", "RUNNING"] },
    },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });

  const idempotencyKey = buildWorkerWorkingCopyIdempotencyKey({
    requestMarkerId: acceptMarker?.id ?? `accept_${input.versionId}`,
    sourceRevisionId: revision.id,
    directiveChecksumSha256: directiveChecksum,
    attemptKey: "knowledge_scope_v1",
  });

  const workingCopy = await createWorkerZipWorkingCopyFromRevision({
    clientId: input.clientId,
    packId: input.packId,
    versionId: input.versionId,
    sourceRevision: revision,
    purpose: "INITIAL_GENERATION",
    idempotencyKey,
    adminExcludePaths: liveExcludePaths,
    adminExclusionReasons: liveReasons,
    createdById: input.adminUserId,
    env: input.env,
    prismaClient: client,
  });

  const zipBytes = await getWorkerZipWorkingCopyBytes({
    workingCopy,
    env: input.env,
  });
  if (!zipBytes?.byteLength) {
    return null;
  }

  return ensureKnowledgeScopeInventoryForPack({
    packId: input.packId,
    versionId: input.versionId,
    sourceRevisionId,
    workingCopyId: workingCopy.id,
    zipBytes,
    clientId: input.clientId,
    actorUserId: input.adminUserId,
    prismaClient: client,
  });
}
