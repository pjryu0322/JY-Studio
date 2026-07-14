import {
  AuditAction,
  DoclingImportBundleStatus,
  KnowledgePackFileRole,
  PackStatus,
  type Prisma,
} from "@prisma/client";
import {
  acquireVersionUploadLock,
  findLatestStagingBundleForVersion,
} from "@/lib/docling-import/docling-import-lifecycle-service";
import {
  buildDoclingBundleReviewSubmitSnapshot,
  type ReviewSubmitSnapshot,
} from "@/lib/distribution/distribution-submit-snapshot";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { toPackLanguageCode } from "@/lib/pack-language";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { recordProviderAudit } from "@/lib/provider-audit";
import { prisma } from "@/lib/prisma";

export type {
  DistributionReviewSubmitSnapshot,
  DoclingBundleReviewSubmitSnapshot,
  ReviewSubmitSnapshot,
} from "@/lib/distribution/distribution-submit-snapshot";
export {
  buildDistributionReviewSubmitSnapshot,
  buildDoclingBundleReviewSubmitSnapshot,
  parseDistributionReviewSubmitSnapshot,
  parseDoclingBundleReviewSubmitSnapshot,
  parseReviewSubmitSnapshot,
} from "@/lib/distribution/distribution-submit-snapshot";

export type DistributionSubmitCommitResult =
  | { error: "PROFILE_REQUIRED" }
  | { error: "NOT_FOUND" }
  | { error: "NOT_DRAFT" }
  | { error: "INCOMPLETE"; message: string }
  | { ok: true; snapshot: ReviewSubmitSnapshot };

/**
 * Validate and commit a Docling distribution pack into REVIEWING + PackReview PENDING.
 */
export async function commitDistributionPackForReview(
  userId: string,
  clientId: string,
  packId: string,
): Promise<DistributionSubmitCommitResult> {
  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);
  if (!profile) {
    return { error: "PROFILE_REQUIRED" };
  }

  const pack = await prisma.knowledgePack.findFirst({
    where: { packId, providerProfileId: profile.id },
    include: {
      versions: {
        orderBy: latestKnowledgePackVersionOrderBy,
        take: 1,
        include: {
          distributionMetadata: true,
        },
      },
    },
  });

  if (!pack) {
    return { error: "NOT_FOUND" };
  }
  if (pack.status !== PackStatus.DRAFT) {
    return { error: "NOT_DRAFT" };
  }
  if (!pack.categoryId || !pack.shortDescription.trim() || !pack.description.trim()) {
    return { error: "INCOMPLETE", message: "카테고리와 설명을 확인해 주세요." };
  }

  const version = pack.versions[0];
  if (!version) {
    return { error: "INCOMPLETE", message: "버전이 최소 1개 필요합니다." };
  }

  const packLanguage = toPackLanguageCode(version.language);
  if (!packLanguage) {
    return {
      error: "INCOMPLETE",
      message: "문서 언어를 선택해 주세요.",
    };
  }

  const liveStaging = await findLatestStagingBundleForVersion(version.id);
  if (liveStaging) {
    return {
      error: "INCOMPLETE",
      message:
        "실패하거나 처리 중인 Staging Bundle이 있습니다. 재시도하거나 삭제한 후 검수 요청하세요.",
    };
  }

  const meta = version.distributionMetadata;

  const doclingBundle = await prisma.doclingImportBundle.findFirst({
    where: { versionId: version.id, isActive: true },
    include: {
      files: true,
      normalizedDocuments: { where: { isActive: true }, take: 1 },
    },
  });

  // Re-check live staging before Docling submit path.
  const stagingAfterLock = await findLatestStagingBundleForVersion(version.id);
  if (stagingAfterLock) {
    return {
      error: "INCOMPLETE",
      message:
        "실패하거나 처리 중인 Staging Bundle이 있습니다. 재시도하거나 삭제한 후 검수 요청하세요.",
    };
  }

  if (!doclingBundle || doclingBundle.status !== DoclingImportBundleStatus.REVIEW_READY) {
    return {
      error: "INCOMPLETE",
      message:
        "원본문서와 구조화 JSON이 정상 처리되어 REVIEW_READY 상태여야 검수 요청할 수 있습니다.",
    };
  }

  const byRole = new Map(doclingBundle.files.map((f) => [f.role, f]));
  const sourceFile = byRole.get(KnowledgePackFileRole.SOURCE_ORIGINAL);
  const jsonFile = byRole.get(KnowledgePackFileRole.DOCLING_JSON);
  const mdFile = byRole.get(KnowledgePackFileRole.DOCLING_MARKDOWN) ?? null;
  const nd = doclingBundle.normalizedDocuments[0];

  if (!sourceFile || !jsonFile || !nd) {
    return {
      error: "INCOMPLETE",
      message:
        "원본문서와 구조화 JSON이 정상 처리되어 REVIEW_READY 상태여야 검수 요청할 수 있습니다.",
    };
  }

  if (!meta) {
    return {
      error: "INCOMPLETE",
      message: "유통정보(출처·라이선스)를 입력해 주세요.",
    };
  }
  if (!meta.licenseName.trim()) {
    return { error: "INCOMPLETE", message: "라이선스명이 필요합니다." };
  }
  if (!meta.sourceTitle?.trim() && !meta.sourceUrl?.trim()) {
    return {
      error: "INCOMPLETE",
      message: "출처 제목 또는 출처 URL이 필요합니다.",
    };
  }

  const snapshot = buildDoclingBundleReviewSubmitSnapshot({
    submittedVersionId: version.id,
    doclingBundleId: doclingBundle.id,
    sourceFileId: sourceFile.id,
    jsonPayloadFileId: jsonFile.id,
    markdownPayloadFileId: mdFile?.id ?? null,
    checksums: {
      source: sourceFile.checksumSha256,
      json: jsonFile.checksumSha256,
      markdown: mdFile?.checksumSha256 ?? null,
    },
    doclingSchemaVersion: doclingBundle.doclingSchemaVersion,
    adapterVersion: nd.adapterVersion,
    normalizedDocumentId: nd.id,
    fingerprint: nd.fingerprint,
    warningCount: doclingBundle.warningCount,
    sourceTitle: meta.sourceTitle,
    licenseName: meta.licenseName,
    visibility: meta.visibility,
    allowDownload: meta.allowDownload,
    language: packLanguage,
  });

  try {
    await prisma.$transaction(async (tx) => {
      await acquireVersionUploadLock(tx, version.id, packId);

      const packLocked = await tx.knowledgePack.findFirst({
        where: { packId, providerProfileId: profile.id },
        select: { status: true },
      });
      if (!packLocked || packLocked.status !== PackStatus.DRAFT) {
        throw new Error("NOT_DRAFT");
      }

      const stagingInTx = await tx.doclingImportBundle.findFirst({
        where: {
          versionId: version.id,
          isActive: false,
          deletedAt: null,
          storageStatus: "ACTIVE",
        },
      });
      if (stagingInTx) {
        throw new Error("DOCLING_STAGING_BUNDLE_MUST_BE_RESOLVED");
      }

      const activeInTx = await tx.doclingImportBundle.findFirst({
        where: { id: doclingBundle.id, isActive: true },
      });
      if (!activeInTx || activeInTx.status !== DoclingImportBundleStatus.REVIEW_READY) {
        throw new Error("DOCLING_REVIEW_STATE_CONFLICT");
      }

      await tx.knowledgePack.update({
        where: { packId },
        data: { status: PackStatus.REVIEWING },
      });
      await tx.packReview.create({
        data: {
          packId,
          status: "PENDING",
          submitSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        },
      });
    });
  } catch (error) {
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

  await recordProviderAudit({
    action: AuditAction.DISTRIBUTION_SUBMITTED,
    entityType: "KnowledgePack",
    entityId: packId,
    actorUserId: userId,
    metadata: {
      packId,
      versionId: version.id,
      mode: "DOCLING_BUNDLE",
      doclingBundleId: doclingBundle.id,
      normalizedDocumentId: nd.id,
      submitSnapshot: snapshot,
    },
  });

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_SUBMIT,
    entityType: "KnowledgePack",
    entityId: packId,
    actorUserId: userId,
    metadata: { packId, mode: "DOCLING_BUNDLE", submitSnapshot: snapshot },
  });

  await recordProviderAudit({
    action: AuditAction.ADMIN_REVIEW_CREATE,
    entityType: "PackReview",
    entityId: packId,
    actorUserId: userId,
    metadata: { packId, status: "PENDING", mode: "DOCLING_BUNDLE", submitSnapshot: snapshot },
  });

  return { ok: true, snapshot };
}
