import {
  AuditAction,
  DoclingImportBundleStatus,
  KnowledgePackFileRole,
  PackStatus,
  PayloadValidationStatus,
  type Prisma,
} from "@prisma/client";
import {
  assertManifestIntegrity,
  refreshDistributionManifest,
  stableManifestFingerprint,
} from "@/lib/distribution/distribution-manifest-service";
import {
  buildDistributionReviewSubmitSnapshot,
  buildDoclingBundleReviewSubmitSnapshot,
  type ReviewSubmitSnapshot,
} from "@/lib/distribution/distribution-submit-snapshot";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
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
 * Validate and commit a distribution pack into REVIEWING + PackReview PENDING.
 * Prefer REVIEW_READY Docling three-file import when present; otherwise legacy ZIP payload.
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
          payload: true,
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

  const meta = version.distributionMetadata;

  const doclingBundle = await prisma.doclingImportBundle.findFirst({
    where: { versionId: version.id, isActive: true },
    include: {
      files: true,
      normalizedDocuments: { where: { isActive: true }, take: 1 },
    },
  });

  if (
    doclingBundle &&
    doclingBundle.status === DoclingImportBundleStatus.REVIEW_READY &&
    doclingBundle.files.length >= 3 &&
    doclingBundle.normalizedDocuments[0]
  ) {
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

    const byRole = new Map(doclingBundle.files.map((f) => [f.role, f]));
    const sourceFile = byRole.get(KnowledgePackFileRole.SOURCE_ORIGINAL);
    const jsonFile = byRole.get(KnowledgePackFileRole.DOCLING_JSON);
    const mdFile = byRole.get(KnowledgePackFileRole.DOCLING_MARKDOWN);
    const nd = doclingBundle.normalizedDocuments[0];
    if (!sourceFile || !jsonFile || !mdFile || !nd) {
      return {
        error: "INCOMPLETE",
        message: "Docling import 파일 또는 정규화 문서가 완전하지 않습니다.",
      };
    }

    const snapshot = buildDoclingBundleReviewSubmitSnapshot({
      submittedVersionId: version.id,
      doclingBundleId: doclingBundle.id,
      sourceFileId: sourceFile.id,
      jsonPayloadFileId: jsonFile.id,
      markdownPayloadFileId: mdFile.id,
      checksums: {
        source: sourceFile.checksumSha256,
        json: jsonFile.checksumSha256,
        markdown: mdFile.checksumSha256,
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
    });

    await prisma.$transaction([
      prisma.knowledgePack.update({
        where: { packId },
        data: { status: PackStatus.REVIEWING },
      }),
      prisma.packReview.create({
        data: {
          packId,
          status: "PENDING",
          submitSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);

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

  const payload = version.payload;
  if (!payload) {
    return {
      error: "INCOMPLETE",
      message: "Payload ZIP을 등록한 뒤 검수 요청할 수 있습니다.",
    };
  }
  if (payload.validationStatus !== PayloadValidationStatus.VALID) {
    return {
      error: "INCOMPLETE",
      message: "Payload 검증이 VALID 상태여야 검수 요청할 수 있습니다.",
    };
  }
  if (!payload.checksumSha256?.trim()) {
    return { error: "INCOMPLETE", message: "Payload Checksum이 없습니다." };
  }
  if (!payload.manifestJson) {
    return {
      error: "INCOMPLETE",
      message: "Manifest가 준비되지 않았습니다. 유통정보를 저장한 뒤 다시 시도하세요.",
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

  const refreshedManifest = await refreshDistributionManifest({
    packId,
    versionId: version.id,
    reason: "pre_submit",
  });
  if (!refreshedManifest) {
    return {
      error: "INCOMPLETE",
      message: "Manifest를 갱신하지 못했습니다.",
    };
  }

  const integrity = assertManifestIntegrity({
    manifest: refreshedManifest,
    payloadId: payload.id,
    packId,
    versionId: version.id,
    checksumSha256: payload.checksumSha256,
    fileSize: Number(payload.fileSize),
    profile: payload.profile,
  });
  if (!integrity.ok) {
    return { error: "INCOMPLETE", message: integrity.message };
  }

  const snapshot = buildDistributionReviewSubmitSnapshot({
    submittedVersionId: version.id,
    payloadId: payload.id,
    payloadProfile: payload.profile,
    checksumSha256: payload.checksumSha256,
    manifestFingerprint: stableManifestFingerprint(refreshedManifest),
    sourceTitle: meta.sourceTitle,
    licenseName: meta.licenseName,
    visibility: meta.visibility,
    allowDownload: meta.allowDownload,
  });

  await prisma.$transaction([
    prisma.knowledgePack.update({
      where: { packId },
      data: { status: PackStatus.REVIEWING },
    }),
    prisma.packReview.create({
      data: {
        packId,
        status: "PENDING",
        submitSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    }),
  ]);

  await recordProviderAudit({
    action: AuditAction.DISTRIBUTION_SUBMITTED,
    entityType: "KnowledgePack",
    entityId: packId,
    actorUserId: userId,
    metadata: {
      packId,
      versionId: version.id,
      payloadId: payload.id,
      checksumSha256: payload.checksumSha256,
      profile: payload.profile,
      generatorType: payload.generatorType,
      submitSnapshot: snapshot,
    },
  });

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_SUBMIT,
    entityType: "KnowledgePack",
    entityId: packId,
    actorUserId: userId,
    metadata: { packId, mode: "DISTRIBUTION", submitSnapshot: snapshot },
  });

  await recordProviderAudit({
    action: AuditAction.ADMIN_REVIEW_CREATE,
    entityType: "PackReview",
    entityId: packId,
    actorUserId: userId,
    metadata: { packId, status: "PENDING", mode: "DISTRIBUTION", submitSnapshot: snapshot },
  });

  return { ok: true, snapshot };
}
