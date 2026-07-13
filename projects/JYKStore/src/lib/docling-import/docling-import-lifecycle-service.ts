import {
  DoclingBundleStorageStatus,
  DoclingImportBundleStatus,
  PackStatus,
  type DoclingImportBundle,
  type KnowledgePackFile,
  type NormalizedDocument,
  type Prisma,
} from "@prisma/client";
import { enqueuePayloadCleanupJob } from "@/lib/distribution/payload-cleanup-service";
import type { PayloadStorage } from "@/lib/distribution/payload-storage";
import { DoclingImportError } from "@/lib/docling-import/docling-import-errors";
import { bundleHasSubmissionHistory } from "@/lib/docling-import/docling-import-submission";
import { prisma } from "@/lib/prisma";

export type BundleWithRelations = DoclingImportBundle & {
  files: KnowledgePackFile[];
  normalizedDocuments: NormalizedDocument[];
};

export async function cleanupUploadedKeys(
  keys: string[],
  reason: string,
  storage: PayloadStorage,
  options?: { doclingBundleId?: string | null },
): Promise<void> {
  for (const objectKey of keys) {
    try {
      await storage.delete({ objectKey });
    } catch {
      await enqueuePayloadCleanupJob({
        objectKey,
        reason,
        lastError: "immediate delete failed",
        doclingBundleId: options?.doclingBundleId ?? null,
      });
    }
  }
}

export async function deactivateNormalizedDocumentsForBundle(
  tx: Prisma.TransactionClient,
  bundleId: string,
): Promise<void> {
  await tx.normalizedDocument.updateMany({
    where: { bundleId, isActive: true },
    data: { isActive: false },
  });
}

/**
 * Mark bundle DELETE_PENDING, deactivate ND in the same transaction, then delete objects
 * (enqueue cleanup jobs with bundle/file ids on failure).
 */
export async function markBundleDeletePendingAndCleanup(
  bundleId: string,
  keys: string[],
  storage: PayloadStorage,
  reason: string,
  fileIdsByKey?: Map<string, string>,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await deactivateNormalizedDocumentsForBundle(tx, bundleId);
    await tx.doclingImportBundle.update({
      where: { id: bundleId },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivationReason: reason,
        storageStatus: DoclingBundleStorageStatus.DELETE_PENDING,
      },
    });
  });

  let failed = false;
  let lastError: string | null = null;
  for (const objectKey of keys) {
    try {
      await storage.delete({ objectKey });
    } catch (error) {
      failed = true;
      lastError = error instanceof Error ? error.message : "delete failed";
      await enqueuePayloadCleanupJob({
        objectKey,
        reason,
        lastError,
        doclingBundleId: bundleId,
        knowledgePackFileId: fileIdsByKey?.get(objectKey) ?? null,
      });
    }
  }
  await prisma.doclingImportBundle.update({
    where: { id: bundleId },
    data: failed
      ? {
          storageStatus: DoclingBundleStorageStatus.DELETE_FAILED,
          storageDeleteAttempts: { increment: 1 },
          storageLastError: (lastError ?? "delete failed").slice(0, 1000),
        }
      : {
          storageStatus: DoclingBundleStorageStatus.DELETED,
          deletedAt: new Date(),
          storageLastError: null,
        },
  });
}

export async function finalizePreviousBundleStorage(
  previous: BundleWithRelations,
  storage: PayloadStorage,
): Promise<void> {
  const keys = previous.files.map((f) => f.storageKey);
  let failed = false;
  let lastError: string | null = null;
  for (const file of previous.files) {
    try {
      await storage.delete({ objectKey: file.storageKey });
    } catch (error) {
      failed = true;
      lastError = error instanceof Error ? error.message : "delete failed";
      await enqueuePayloadCleanupJob({
        objectKey: file.storageKey,
        reason: "docling_bundle_replaced",
        lastError,
        doclingBundleId: previous.id,
        knowledgePackFileId: file.id,
      });
    }
  }

  if (failed) {
    await prisma.doclingImportBundle.update({
      where: { id: previous.id },
      data: {
        storageStatus: DoclingBundleStorageStatus.DELETE_FAILED,
        storageDeleteAttempts: { increment: 1 },
        storageLastError: (lastError ?? "delete failed").slice(0, 1000),
      },
    });
  } else {
    await prisma.doclingImportBundle.update({
      where: { id: previous.id },
      data: {
        storageStatus: DoclingBundleStorageStatus.DELETED,
        deletedAt: new Date(),
        storageLastError: null,
      },
    });
  }
  void keys;
}

/**
 * After object cleanup jobs succeed, sync DoclingImportBundle.storageStatus.
 * Idempotent when already DELETED.
 */
export async function syncDoclingBundleStorageAfterCleanup(
  bundleId: string,
): Promise<void> {
  const bundle = await prisma.doclingImportBundle.findUnique({
    where: { id: bundleId },
  });
  if (!bundle) return;
  if (bundle.storageStatus === DoclingBundleStorageStatus.DELETED) {
    return;
  }

  const jobs = await prisma.payloadStorageCleanupJob.findMany({
    where: { doclingBundleId: bundleId },
    select: { status: true },
  });

  const hasFailed = jobs.some((j) => j.status === "FAILED");
  const hasPending = jobs.some((j) => j.status === "PENDING");
  // Job count must be >= 1 — empty job list must NOT flip to DELETED.
  const allSucceeded =
    jobs.length >= 1 && jobs.every((j) => j.status === "SUCCEEDED");

  if (jobs.length === 0) {
    return;
  }

  if (hasFailed) {
    await prisma.doclingImportBundle.update({
      where: { id: bundleId },
      data: {
        storageStatus: DoclingBundleStorageStatus.DELETE_FAILED,
        storageDeleteAttempts: { increment: 1 },
      },
    });
    return;
  }

  if (hasPending) {
    return;
  }

  if (allSucceeded) {
    await prisma.doclingImportBundle.update({
      where: { id: bundleId },
      data: {
        storageStatus: DoclingBundleStorageStatus.DELETED,
        deletedAt: bundle.deletedAt ?? new Date(),
        storageLastError: null,
      },
    });
  }
}

export async function acquireVersionUploadLock(
  tx: Prisma.TransactionClient,
  versionId: string,
  packId?: string,
): Promise<void> {
  if (packId) {
    await tx.$executeRaw`SELECT id FROM "KnowledgePack" WHERE "packId" = ${packId} FOR UPDATE`;
  }
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${versionId}))`;
  await tx.$executeRaw`SELECT id FROM "KnowledgePackVersion" WHERE id = ${versionId} FOR UPDATE`;
}

/**
 * Promote REVIEW_READY staging bundle to active.
 * Returns replacedBundleId from the locked previous active row (never use pre-TX previous).
 */
export async function promoteDoclingStagingBundle(input: {
  packId: string;
  versionId: string;
  stagingBundleId: string;
}): Promise<{ replacedBundleId: string | null }> {
  let replacedBundleId: string | null = null;

  await prisma.$transaction(async (tx) => {
    await acquireVersionUploadLock(tx, input.versionId, input.packId);

    const packRow = await tx.knowledgePack.findFirst({
      where: { packId: input.packId },
      select: { status: true },
    });
    if (!packRow || packRow.status !== PackStatus.DRAFT) {
      throw new DoclingImportError(
        "DOCLING_REVIEW_STATE_CONFLICT",
        "초안 상태가 아니거나 검수 중이라 Bundle을 교체할 수 없습니다.",
        409,
      );
    }

    const openReview = await tx.packReview.findFirst({
      where: { packId: input.packId, status: { in: ["PENDING", "IN_REVIEW"] } },
      select: { id: true },
    });
    if (openReview) {
      throw new DoclingImportError(
        "DOCLING_REVIEW_STATE_CONFLICT",
        "열린 검수 요청이 있어 Bundle을 교체할 수 없습니다.",
        409,
      );
    }

    const liveStaging = await tx.doclingImportBundle.findFirst({
      where: {
        versionId: input.versionId,
        isActive: false,
        deletedAt: null,
        storageStatus: DoclingBundleStorageStatus.ACTIVE,
      },
    });
    if (liveStaging && liveStaging.id !== input.stagingBundleId) {
      throw new DoclingImportError(
        "DOCLING_STAGING_BUNDLE_EXISTS",
        "처리되지 않은 Staging Bundle이 있습니다. 재시도하거나 삭제한 후 새 파일을 등록하세요.",
        409,
      );
    }

    const lockedPrevious = await tx.doclingImportBundle.findFirst({
      where: { versionId: input.versionId, isActive: true },
    });

    if (lockedPrevious) {
      const hasHistory = await bundleHasSubmissionHistory(
        input.packId,
        lockedPrevious.id,
        input.versionId,
        tx,
      );
      if (hasHistory) {
        throw new DoclingImportError(
          "DOCLING_IMMUTABLE_AFTER_SUBMISSION",
          "이미 검수 제출된 Docling import는 교체할 수 없습니다. 새 버전을 생성하세요.",
          409,
        );
      }

      replacedBundleId = lockedPrevious.id;
      await tx.doclingImportBundle.update({
        where: { id: lockedPrevious.id },
        data: {
          isActive: false,
          deactivatedAt: new Date(),
          deactivationReason: "replaced",
          replacedByBundleId: input.stagingBundleId,
          storageStatus: DoclingBundleStorageStatus.DELETE_PENDING,
        },
      });
      await deactivateNormalizedDocumentsForBundle(tx, lockedPrevious.id);
    }

    const promoted = await tx.doclingImportBundle.updateMany({
      where: {
        id: input.stagingBundleId,
        isActive: false,
        status: DoclingImportBundleStatus.REVIEW_READY,
      },
      data: {
        isActive: true,
        storageStatus: DoclingBundleStorageStatus.ACTIVE,
        stagingReason: null,
      },
    });
    if (promoted.count === 0) {
      throw new DoclingImportError(
        "DOCLING_ACTIVE_BUNDLE_CONFLICT",
        "Active Bundle 활성화에 충돌이 발생했습니다.",
        409,
      );
    }
  });

  return { replacedBundleId };
}

const STAGING_VISIBLE_STATUSES: DoclingImportBundleStatus[] = [
  DoclingImportBundleStatus.UPLOADED,
  DoclingImportBundleStatus.VALIDATING,
  DoclingImportBundleStatus.VALIDATION_FAILED,
  DoclingImportBundleStatus.VALID,
  DoclingImportBundleStatus.NORMALIZING,
  DoclingImportBundleStatus.NORMALIZED,
  DoclingImportBundleStatus.NORMALIZATION_FAILED,
  DoclingImportBundleStatus.REVIEW_READY,
];

/** Latest inactive staging row that still has ACTIVE storage (failed or in-progress). */
export async function findLatestStagingBundleForVersion(
  versionId: string,
): Promise<DoclingImportBundle | null> {
  return prisma.doclingImportBundle.findFirst({
    where: {
      versionId,
      isActive: false,
      deletedAt: null,
      storageStatus: DoclingBundleStorageStatus.ACTIVE,
      status: { in: STAGING_VISIBLE_STATUSES },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function preserveFailedStagingBundle(
  bundleId: string,
  stagingReason: string,
): Promise<void> {
  await prisma.doclingImportBundle.update({
    where: { id: bundleId },
    data: {
      isActive: false,
      storageStatus: DoclingBundleStorageStatus.ACTIVE,
      stagingReason: stagingReason.slice(0, 500),
    },
  });
}
