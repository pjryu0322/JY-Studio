/**
 * The transaction + audit-recording tail of `commitDistributionPackForReview`:
 * re-validates evidence inside the transaction, flips DRAFT -> REVIEWING + creates
 * the PackReview row, then records the provider-audit trail once committed.
 */
import { AuditAction, PackStatus, DoclingImportBundleStatus, type Prisma } from "@prisma/client";
import { acquireVersionUploadLock } from "@/lib/docling-import/docling-import-lifecycle-service";
import { recordProviderAudit } from "@/lib/provider-audit";
import { prisma } from "@/lib/prisma";
import type { DoclingBundleReviewSubmitSnapshot } from "@/lib/distribution/distribution-submit-snapshot";
import type { DistributionSubmitCommitError } from "@/lib/distribution/distribution-submit-commit-steps";

export type ReviewSubmitCommitTxInput = {
  packId: string;
  providerProfileId: string;
  versionId: string;
  doclingBundleId: string;
  snapshot: DoclingBundleReviewSubmitSnapshot;
};

type TxClient = Prisma.TransactionClient;

async function assertNoConflictingStagingOrActiveBundleInTx(
  tx: TxClient,
  input: ReviewSubmitCommitTxInput,
): Promise<void> {
  const stagingInTx = await tx.doclingImportBundle.findFirst({
    where: {
      versionId: input.versionId,
      isActive: false,
      deletedAt: null,
      storageStatus: "ACTIVE",
    },
  });
  if (stagingInTx) {
    throw new Error("DOCLING_STAGING_BUNDLE_MUST_BE_RESOLVED");
  }

  const activeInTx = await tx.doclingImportBundle.findFirst({
    where: { id: input.doclingBundleId, isActive: true },
  });
  if (!activeInTx || activeInTx.status !== DoclingImportBundleStatus.REVIEW_READY) {
    throw new Error("DOCLING_REVIEW_STATE_CONFLICT");
  }
}

async function moveDraftPackToReviewingWithPendingReviewInTx(
  tx: TxClient,
  input: ReviewSubmitCommitTxInput,
): Promise<void> {
  const packLocked = await tx.knowledgePack.findFirst({
    where: { packId: input.packId, providerProfileId: input.providerProfileId },
    select: { status: true },
  });
  if (!packLocked || packLocked.status !== PackStatus.DRAFT) {
    throw new Error("NOT_DRAFT");
  }

  const updateResult = await tx.knowledgePack.updateMany({
    where: { packId: input.packId, status: PackStatus.DRAFT },
    data: { status: PackStatus.REVIEWING },
  });
  if (updateResult.count !== 1) throw new Error("NOT_DRAFT");

  await tx.packReview.create({
    data: {
      packId: input.packId,
      status: "PENDING",
      submitSnapshot: input.snapshot as unknown as Prisma.InputJsonValue,
    },
  });
}

async function runReviewSubmitCommitTxBody(tx: TxClient, input: ReviewSubmitCommitTxInput): Promise<void> {
  const { assertReviewSubmitEvidenceInTx } = await import("@/lib/distribution/review-submit-evidence");

  await acquireVersionUploadLock(tx, input.versionId, input.packId);
  await assertNoConflictingStagingOrActiveBundleInTx(tx, input);

  // §7 Re-validate the full evidence binding inside the transaction against the snapshot.
  await assertReviewSubmitEvidenceInTx(tx, {
    packId: input.packId,
    versionId: input.versionId,
    providerProfileId: input.providerProfileId,
    snapshot: input.snapshot,
  });

  await moveDraftPackToReviewingWithPendingReviewInTx(tx, input);
}

/** Pure: map a thrown transaction error to the caller's discriminated result shape. */
async function mapReviewSubmitCommitTxError(error: unknown): Promise<DistributionSubmitCommitError> {
  const { ReviewSubmitEvidenceError } = await import("@/lib/distribution/review-submit-evidence");
  if (error instanceof ReviewSubmitEvidenceError) {
    if (error.code === "NOT_DRAFT") return { error: "NOT_DRAFT" };
    if (error.code === "NOT_FOUND") return { error: "NOT_FOUND" };
    return { error: "INCOMPLETE", message: error.message, missingRequirements: [error.code] };
  }
  const code = error instanceof Error ? error.message : "";
  if (code === "NOT_DRAFT") return { error: "NOT_DRAFT" };
  if (code === "DOCLING_STAGING_BUNDLE_MUST_BE_RESOLVED") {
    return {
      error: "INCOMPLETE",
      message:
        "실패하거나 처리 중인 Staging Bundle이 있습니다. 재시도하거나 삭제한 후 검수 요청하세요.",
    };
  }
  if (code === "DOCLING_REVIEW_STATE_CONFLICT") {
    return {
      error: "INCOMPLETE",
      message: "검수 제출 중 Bundle 상태가 변경되었습니다. 다시 시도하세요.",
    };
  }
  throw error;
}

/** Runs the review-submit commit transaction, mapping any thrown error to a result. */
export async function runReviewSubmitCommitTransactionOrError(
  input: ReviewSubmitCommitTxInput,
): Promise<DistributionSubmitCommitError | null> {
  try {
    await prisma.$transaction((tx) => runReviewSubmitCommitTxBody(tx, input));
    return null;
  } catch (error) {
    return mapReviewSubmitCommitTxError(error);
  }
}

export async function recordReviewSubmitCommitAudits(input: {
  userId: string;
  packId: string;
  versionId: string;
  doclingBundleId: string;
  normalizedDocumentId: string;
  snapshot: DoclingBundleReviewSubmitSnapshot;
}): Promise<void> {
  await recordProviderAudit({
    action: AuditAction.DISTRIBUTION_SUBMITTED,
    entityType: "KnowledgePack",
    entityId: input.packId,
    actorUserId: input.userId,
    metadata: {
      packId: input.packId,
      versionId: input.versionId,
      mode: "DOCLING_BUNDLE",
      doclingBundleId: input.doclingBundleId,
      normalizedDocumentId: input.normalizedDocumentId,
      submitSnapshot: input.snapshot,
    },
  });

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_SUBMIT,
    entityType: "KnowledgePack",
    entityId: input.packId,
    actorUserId: input.userId,
    metadata: { packId: input.packId, mode: "DOCLING_BUNDLE", submitSnapshot: input.snapshot },
  });

  await recordProviderAudit({
    action: AuditAction.ADMIN_REVIEW_CREATE,
    entityType: "PackReview",
    entityId: input.packId,
    actorUserId: input.userId,
    metadata: {
      packId: input.packId,
      status: "PENDING",
      mode: "DOCLING_BUNDLE",
      submitSnapshot: input.snapshot,
    },
  });
}
