import {
  AuditAction,
  PackStatus,
  PayloadValidationStatus,
  type Prisma,
} from "@prisma/client";
import { DISTRIBUTION_MANIFEST_SCHEMA_VERSION } from "@/lib/distribution/payload-types";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { recordProviderAudit } from "@/lib/provider-audit";
import { prisma } from "@/lib/prisma";

export type DistributionReviewSubmitSnapshot = {
  mode: "DISTRIBUTION";
  submittedAt: string;
  submittedVersionId: string;
  payloadId: string;
  payloadProfile: string;
  checksumSha256: string;
  validationStatus: "VALID";
  manifestSchemaVersion: string;
  sourceTitle: string | null;
  licenseName: string;
  visibility: string;
  allowDownload: boolean;
};

export function buildDistributionReviewSubmitSnapshot(input: {
  submittedVersionId: string;
  payloadId: string;
  payloadProfile: string;
  checksumSha256: string;
  sourceTitle: string | null;
  licenseName: string;
  visibility: string;
  allowDownload: boolean;
}): DistributionReviewSubmitSnapshot {
  return {
    mode: "DISTRIBUTION",
    submittedAt: new Date().toISOString(),
    submittedVersionId: input.submittedVersionId,
    payloadId: input.payloadId,
    payloadProfile: input.payloadProfile,
    checksumSha256: input.checksumSha256,
    validationStatus: "VALID",
    manifestSchemaVersion: DISTRIBUTION_MANIFEST_SCHEMA_VERSION,
    sourceTitle: input.sourceTitle,
    licenseName: input.licenseName,
    visibility: input.visibility,
    allowDownload: input.allowDownload,
  };
}

export function parseDistributionReviewSubmitSnapshot(
  value: unknown,
): DistributionReviewSubmitSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.mode !== "DISTRIBUTION") return null;
  if (typeof raw.submittedAt !== "string") return null;
  if (typeof raw.submittedVersionId !== "string") return null;
  if (typeof raw.payloadId !== "string") return null;
  if (typeof raw.payloadProfile !== "string") return null;
  if (typeof raw.checksumSha256 !== "string") return null;
  if (raw.validationStatus !== "VALID") return null;
  if (typeof raw.manifestSchemaVersion !== "string") return null;
  if (typeof raw.licenseName !== "string") return null;

  return {
    mode: "DISTRIBUTION",
    submittedAt: raw.submittedAt,
    submittedVersionId: raw.submittedVersionId,
    payloadId: raw.payloadId,
    payloadProfile: raw.payloadProfile,
    checksumSha256: raw.checksumSha256,
    validationStatus: "VALID",
    manifestSchemaVersion: raw.manifestSchemaVersion,
    sourceTitle: typeof raw.sourceTitle === "string" ? raw.sourceTitle : null,
    licenseName: raw.licenseName,
    visibility: typeof raw.visibility === "string" ? raw.visibility : "PRIVATE",
    allowDownload: raw.allowDownload !== false,
  };
}

export type DistributionSubmitCommitResult =
  | { error: "PROFILE_REQUIRED" }
  | { error: "NOT_FOUND" }
  | { error: "NOT_DRAFT" }
  | { error: "INCOMPLETE"; message: string }
  | { ok: true; snapshot: DistributionReviewSubmitSnapshot };

/**
 * Validate and commit a distribution pack into REVIEWING + PackReview PENDING.
 * Caller records pipeline status and returns the provider pack DTO.
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
        orderBy: { createdAt: "desc" },
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

  const meta = version.distributionMetadata;
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

  const snapshot = buildDistributionReviewSubmitSnapshot({
    submittedVersionId: version.id,
    payloadId: payload.id,
    payloadProfile: payload.profile,
    checksumSha256: payload.checksumSha256,
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
