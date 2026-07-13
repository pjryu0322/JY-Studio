import {
  AuditAction,
  DistributionVisibility as PrismaDistributionVisibility,
  PackContentType as PrismaPackContentType,
  PackStatus,
  PublicArtifactType as PrismaPublicArtifactType,
  type PackDistributionMetadata,
} from "@prisma/client";
import { refreshDistributionManifest } from "@/lib/distribution/distribution-manifest-service";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import {
  DISTRIBUTION_VISIBILITIES,
  type DistributionVisibility,
} from "@/lib/distribution/payload-types";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { recordProviderAudit } from "@/lib/provider-audit";
import { prisma } from "@/lib/prisma";
import type { PublicPackContentType } from "@/lib/public-pack-content-type";

const MAX_TEXT = 8_000;
const MAX_TITLE = 300;
const MAX_URL = 2_000;

const PUBLIC_ARTIFACT_TYPES = ["SOURCE_ORIGINAL", "KNOWLEDGE_PACKAGE"] as const;
const PACK_CONTENT_TYPES = [
  "DOCUMENT",
  "PRODUCT",
  "API",
  "FRAMEWORK",
  "DATA",
  "MIXED",
] as const;

export type PackDistributionMetadataDto = {
  id: string;
  packId: string;
  versionId: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourcePublisherName: string | null;
  sourcePublisherUrl: string | null;
  sourceDocumentVersion: string | null;
  sourcePublishedAt: string | null;
  sourceRetrievedAt: string | null;
  licenseName: string;
  licenseUrl: string | null;
  usageTerms: string | null;
  readmeText: string | null;
  visibility: DistributionVisibility;
  allowDownload: boolean;
  primaryArtifactType: "SOURCE_ORIGINAL" | "KNOWLEDGE_PACKAGE" | null;
  contentType: PublicPackContentType | null;
  updatedAt: string;
};

export type DistributionArtifactOptionsDto = {
  zipReady: boolean;
  externalImportReady: boolean;
};

export type UpsertDistributionMetadataInput = {
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  sourcePublisherName?: string | null;
  sourcePublisherUrl?: string | null;
  sourceDocumentVersion?: string | null;
  sourcePublishedAt?: string | null;
  sourceRetrievedAt?: string | null;
  licenseName: string;
  licenseUrl?: string | null;
  usageTerms?: string | null;
  readmeText?: string | null;
  visibility?: string;
  allowDownload?: boolean;
  primaryArtifactType?: string | null;
  contentType?: string | null;
};

export function toPackDistributionMetadataDto(
  row: PackDistributionMetadata,
): PackDistributionMetadataDto {
  return {
    id: row.id,
    packId: row.packId,
    versionId: row.versionId,
    sourceTitle: row.sourceTitle,
    sourceUrl: row.sourceUrl,
    sourcePublisherName: row.sourcePublisherName,
    sourcePublisherUrl: row.sourcePublisherUrl,
    sourceDocumentVersion: row.sourceDocumentVersion,
    sourcePublishedAt: row.sourcePublishedAt?.toISOString() ?? null,
    sourceRetrievedAt: row.sourceRetrievedAt?.toISOString() ?? null,
    licenseName: row.licenseName,
    licenseUrl: row.licenseUrl,
    usageTerms: row.usageTerms,
    readmeText: row.readmeText,
    visibility: row.visibility as DistributionVisibility,
    allowDownload: row.allowDownload,
    primaryArtifactType: row.primaryArtifactType,
    contentType: row.contentType,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function trimOrNull(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function assertOptionalUrl(label: string, value: string | null): void {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("bad protocol");
    }
  } catch {
    throw new PayloadServiceError(
      "INCOMPLETE",
      `${label} URL 형식이 올바르지 않습니다.`,
      400,
    );
  }
}

function parseOptionalDate(label: string, value: string | null | undefined): Date | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new PayloadServiceError("INCOMPLETE", `${label} 날짜 형식이 올바르지 않습니다.`, 400);
  }
  return date;
}

export function validateDistributionMetadataInput(
  input: UpsertDistributionMetadataInput,
): {
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourcePublisherName: string | null;
  sourcePublisherUrl: string | null;
  sourceDocumentVersion: string | null;
  sourcePublishedAt: Date | null;
  sourceRetrievedAt: Date | null;
  licenseName: string;
  licenseUrl: string | null;
  usageTerms: string | null;
  readmeText: string | null;
  visibility: DistributionVisibility;
  allowDownload: boolean;
  primaryArtifactType: PrismaPublicArtifactType | null;
  contentType: PrismaPackContentType | null;
} {
  const licenseName = input.licenseName?.trim() ?? "";
  if (!licenseName) {
    throw new PayloadServiceError("LICENSE_REQUIRED", "라이선스명이 필요합니다.", 400);
  }

  const sourceTitle = trimOrNull(input.sourceTitle, MAX_TITLE);
  const sourceUrl = trimOrNull(input.sourceUrl, MAX_URL);
  if (!sourceTitle && !sourceUrl) {
    throw new PayloadServiceError(
      "SOURCE_REQUIRED",
      "출처 제목 또는 출처 URL 중 하나 이상이 필요합니다.",
      400,
    );
  }

  const licenseUrl = trimOrNull(input.licenseUrl, MAX_URL);
  const sourcePublisherName = trimOrNull(input.sourcePublisherName, MAX_TITLE);
  const sourcePublisherUrl = trimOrNull(input.sourcePublisherUrl, MAX_URL);
  const sourceDocumentVersion = trimOrNull(input.sourceDocumentVersion, MAX_TITLE);
  assertOptionalUrl("출처", sourceUrl);
  assertOptionalUrl("라이선스", licenseUrl);
  assertOptionalUrl("발행기관", sourcePublisherUrl);

  const visibilityRaw = (input.visibility ?? "PRIVATE").trim().toUpperCase();
  if (!(DISTRIBUTION_VISIBILITIES as readonly string[]).includes(visibilityRaw)) {
    throw new PayloadServiceError("INCOMPLETE", "공개범위 값이 올바르지 않습니다.", 400);
  }

  let primaryArtifactType: PrismaPublicArtifactType | null = null;
  if (input.primaryArtifactType != null && String(input.primaryArtifactType).trim()) {
    const raw = String(input.primaryArtifactType).trim().toUpperCase();
    if (!(PUBLIC_ARTIFACT_TYPES as readonly string[]).includes(raw)) {
      throw new PayloadServiceError("INCOMPLETE", "공개 다운로드 유형이 올바르지 않습니다.", 400);
    }
    primaryArtifactType = raw as PrismaPublicArtifactType;
  }

  let contentType: PrismaPackContentType | null = null;
  if (input.contentType != null && String(input.contentType).trim()) {
    const raw = String(input.contentType).trim().toUpperCase();
    if (!(PACK_CONTENT_TYPES as readonly string[]).includes(raw)) {
      throw new PayloadServiceError("INCOMPLETE", "콘텐츠 유형이 올바르지 않습니다.", 400);
    }
    contentType = raw as PrismaPackContentType;
  }

  return {
    sourceTitle,
    sourceUrl,
    sourcePublisherName,
    sourcePublisherUrl,
    sourceDocumentVersion,
    sourcePublishedAt: parseOptionalDate("게시일", input.sourcePublishedAt),
    sourceRetrievedAt: parseOptionalDate("수집일", input.sourceRetrievedAt),
    licenseName: licenseName.slice(0, MAX_TITLE),
    licenseUrl,
    usageTerms: trimOrNull(input.usageTerms, MAX_TEXT),
    readmeText: trimOrNull(input.readmeText, MAX_TEXT),
    visibility: visibilityRaw as DistributionVisibility,
    allowDownload: input.allowDownload !== false,
    primaryArtifactType,
    contentType,
  };
}

async function requireOwnedDraftPack(input: {
  userId: string;
  clientId: string;
  packId: string;
}) {
  const profile = await findOrEnsureProviderProfileForUser(input.userId, input.clientId);
  if (!profile) {
    throw new PayloadServiceError("PROFILE_REQUIRED", "제공자 프로필이 필요합니다.", 403);
  }

  const pack = await prisma.knowledgePack.findFirst({
    where: { packId: input.packId, providerProfileId: profile.id },
    include: {
      versions: { orderBy: { createdAt: "desc" }, take: 1 },
      providerProfile: true,
    },
  });

  if (!pack) {
    throw new PayloadServiceError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
  }
  if (pack.status !== PackStatus.DRAFT) {
    throw new PayloadServiceError(
      "PACK_NOT_EDITABLE",
      "초안(DRAFT) 상태에서만 유통정보를 수정할 수 있습니다.",
      409,
    );
  }
  const version = pack.versions[0];
  if (!version) {
    throw new PayloadServiceError("INCOMPLETE", "버전이 없습니다.", 400);
  }
  return { pack, version, profile };
}

async function resolveArtifactOptions(versionId: string): Promise<DistributionArtifactOptionsDto> {
  const [payload, readyBundle] = await Promise.all([
    prisma.knowledgePayload.findUnique({
      where: { versionId },
      select: { id: true },
    }),
    prisma.doclingImportBundle.findFirst({
      where: {
        versionId,
        deletedAt: null,
        isActive: true,
        status: "REVIEW_READY",
        storageStatus: "ACTIVE",
        normalizedDocuments: { some: { isActive: true } },
        files: { some: { role: "SOURCE_ORIGINAL" } },
      },
      select: { id: true },
    }),
  ]);
  return {
    zipReady: Boolean(payload),
    externalImportReady: Boolean(readyBundle),
  };
}

export async function getProviderPackDistribution(input: {
  userId: string;
  clientId: string;
  packId: string;
}): Promise<{
  distribution: PackDistributionMetadataDto | null;
  artifactOptions: DistributionArtifactOptionsDto;
}> {
  const profile = await findOrEnsureProviderProfileForUser(input.userId, input.clientId);
  if (!profile) {
    throw new PayloadServiceError("PROFILE_REQUIRED", "제공자 프로필이 필요합니다.", 403);
  }

  const pack = await prisma.knowledgePack.findFirst({
    where: { packId: input.packId, providerProfileId: profile.id },
    include: { versions: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!pack) {
    throw new PayloadServiceError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
  }

  const version = pack.versions[0];
  if (!version) {
    return {
      distribution: null,
      artifactOptions: { zipReady: false, externalImportReady: false },
    };
  }

  const [row, artifactOptions] = await Promise.all([
    prisma.packDistributionMetadata.findUnique({ where: { versionId: version.id } }),
    resolveArtifactOptions(version.id),
  ]);
  return {
    distribution: row ? toPackDistributionMetadataDto(row) : null,
    artifactOptions,
  };
}

function metadataWriteFields(validated: ReturnType<typeof validateDistributionMetadataInput>) {
  return {
    sourceTitle: validated.sourceTitle,
    sourceUrl: validated.sourceUrl,
    sourcePublisherName: validated.sourcePublisherName,
    sourcePublisherUrl: validated.sourcePublisherUrl,
    sourceDocumentVersion: validated.sourceDocumentVersion,
    sourcePublishedAt: validated.sourcePublishedAt,
    sourceRetrievedAt: validated.sourceRetrievedAt,
    licenseName: validated.licenseName,
    licenseUrl: validated.licenseUrl,
    usageTerms: validated.usageTerms,
    readmeText: validated.readmeText,
    visibility: validated.visibility as PrismaDistributionVisibility,
    allowDownload: validated.allowDownload,
    primaryArtifactType: validated.primaryArtifactType,
    contentType: validated.contentType,
  };
}

export async function upsertProviderPackDistribution(input: {
  userId: string;
  clientId: string;
  packId: string;
  body: UpsertDistributionMetadataInput;
}): Promise<{
  distribution: PackDistributionMetadataDto;
  artifactOptions: DistributionArtifactOptionsDto;
}> {
  const { pack, version } = await requireOwnedDraftPack({
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });

  const validated = validateDistributionMetadataInput(input.body);
  const fields = metadataWriteFields(validated);

  const row = await prisma.packDistributionMetadata.upsert({
    where: { versionId: version.id },
    create: {
      packId: pack.packId,
      versionId: version.id,
      ...fields,
    },
    update: fields,
  });

  const payload = await prisma.knowledgePayload.findUnique({
    where: { versionId: version.id },
  });

  if (payload) {
    await refreshDistributionManifest({
      packId: pack.packId,
      versionId: version.id,
      reason: "distribution_metadata_updated",
    });
  }

  await recordProviderAudit({
    action: AuditAction.DISTRIBUTION_METADATA_UPDATED,
    entityType: "PackDistributionMetadata",
    entityId: row.id,
    actorUserId: input.userId,
    metadata: {
      packId: pack.packId,
      versionId: version.id,
      visibility: row.visibility,
      allowDownload: row.allowDownload,
      licenseName: row.licenseName,
      primaryArtifactType: row.primaryArtifactType,
      contentType: row.contentType,
    },
  });

  return {
    distribution: toPackDistributionMetadataDto(row),
    artifactOptions: await resolveArtifactOptions(version.id),
  };
}

export async function upsertAdminPackDistribution(input: {
  packId: string;
  actorUserId: string;
  body: UpsertDistributionMetadataInput;
}): Promise<{ distribution: PackDistributionMetadataDto }> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId: input.packId },
    include: { versions: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!pack) {
    throw new PayloadServiceError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
  }
  const version = pack.versions[0];
  if (!version) {
    throw new PayloadServiceError("INCOMPLETE", "버전이 없습니다.", 400);
  }

  const validated = validateDistributionMetadataInput(input.body);
  const fields = metadataWriteFields(validated);

  const row = await prisma.packDistributionMetadata.upsert({
    where: { versionId: version.id },
    create: {
      packId: pack.packId,
      versionId: version.id,
      ...fields,
    },
    update: fields,
  });

  const payload = await prisma.knowledgePayload.findUnique({
    where: { versionId: version.id },
  });
  if (payload) {
    await refreshDistributionManifest({
      packId: pack.packId,
      versionId: version.id,
      reason: "distribution_metadata_updated_admin",
    });
  }

  await recordProviderAudit({
    action: AuditAction.DISTRIBUTION_METADATA_UPDATED,
    entityType: "PackDistributionMetadata",
    entityId: row.id,
    actorUserId: input.actorUserId,
    metadata: {
      packId: pack.packId,
      versionId: version.id,
      visibility: row.visibility,
      allowDownload: row.allowDownload,
      licenseName: row.licenseName,
      primaryArtifactType: row.primaryArtifactType,
      contentType: row.contentType,
      actor: "admin",
    },
  });

  return { distribution: toPackDistributionMetadataDto(row) };
}
