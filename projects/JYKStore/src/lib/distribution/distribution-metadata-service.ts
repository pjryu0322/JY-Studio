import {
  AuditAction,
  DistributionVisibility as PrismaDistributionVisibility,
  PackContentType as PrismaPackContentType,
  PackStatus,
  type PackDistributionMetadata,
  type Prisma,
} from "@prisma/client";
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
  /** @deprecated Always null — ZIP primary selection removed. */
  primaryArtifactType: null;
  contentType: PublicPackContentType | null;
  updatedAt: string;
};

export type DistributionArtifactOptionsDto = {
  zipReady: boolean;
  externalImportReady: boolean;
  selectedPrimaryArtifactType: "SOURCE_ORIGINAL" | null;
  multipleReady: boolean;
};

/** Provider PUT: full replace semantics. */
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

/**
 * Admin PATCH: undefined = leave unchanged; null = clear; value = set.
 */
export type PatchDistributionMetadataInput = {
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  sourcePublisherName?: string | null;
  sourcePublisherUrl?: string | null;
  sourceDocumentVersion?: string | null;
  sourcePublishedAt?: string | null;
  sourceRetrievedAt?: string | null;
  licenseName?: string | null;
  licenseUrl?: string | null;
  usageTerms?: string | null;
  readmeText?: string | null;
  visibility?: string | null;
  allowDownload?: boolean | null;
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
    primaryArtifactType: null,
    contentType: row.contentType as PublicPackContentType | null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAdminDistributionDto(row: PackDistributionMetadata): {
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
  visibility: string;
  allowDownload: boolean;
  primaryArtifactType: null;
  contentType: PublicPackContentType | null;
} {
  const dto = toPackDistributionMetadataDto(row);
  return {
    sourceTitle: dto.sourceTitle,
    sourceUrl: dto.sourceUrl,
    sourcePublisherName: dto.sourcePublisherName,
    sourcePublisherUrl: dto.sourcePublisherUrl,
    sourceDocumentVersion: dto.sourceDocumentVersion,
    sourcePublishedAt: dto.sourcePublishedAt,
    sourceRetrievedAt: dto.sourceRetrievedAt,
    licenseName: dto.licenseName,
    licenseUrl: dto.licenseUrl,
    usageTerms: dto.usageTerms,
    readmeText: dto.readmeText,
    visibility: dto.visibility,
    allowDownload: dto.allowDownload,
    primaryArtifactType: null,
    contentType: dto.contentType,
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

function parsePrimaryArtifactType(
  value: string | null | undefined,
): null {
  void value;
  return null;
}

function parseContentType(value: string | null | undefined): PrismaPackContentType | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (!(PACK_CONTENT_TYPES as readonly string[]).includes(upper)) {
    throw new PayloadServiceError("INCOMPLETE", "콘텐츠 유형이 올바르지 않습니다.", 400);
  }
  return upper as PrismaPackContentType;
}

export function validatePrimaryArtifactSelection(
  primaryArtifactType: "SOURCE_ORIGINAL" | null,
  options: Pick<DistributionArtifactOptionsDto, "zipReady" | "externalImportReady">,
): void {
  void primaryArtifactType;
  void options;
  // ZIP primary selection removed — no-op for API compat.
}

export function isZipPayloadReady(payload: unknown): boolean {
  void payload;
  return false;
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
  primaryArtifactType: null;
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

  // Ignore legacy primaryArtifactType input (ZIP removed).
  void parsePrimaryArtifactType(input.primaryArtifactType);

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
    primaryArtifactType: null,
    contentType: parseContentType(input.contentType),
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

export async function resolveArtifactOptions(
  versionId: string,
  primaryArtifactType?: "SOURCE_ORIGINAL" | null,
): Promise<DistributionArtifactOptionsDto> {
  void primaryArtifactType;
  const readyBundle = await prisma.doclingImportBundle.findFirst({
    where: {
      versionId,
      deletedAt: null,
      isActive: true,
      status: "REVIEW_READY",
      storageStatus: "ACTIVE",
      normalizedDocuments: { some: { isActive: true } },
      files: {
        some: {
          role: "SOURCE_ORIGINAL",
          storageKey: { not: "" },
          checksumSha256: { not: "" },
          fileSize: { gt: 0 },
        },
      },
    },
    select: { id: true },
  });
  const externalImportReady = Boolean(readyBundle);
  return {
    zipReady: false,
    externalImportReady,
    selectedPrimaryArtifactType: externalImportReady ? "SOURCE_ORIGINAL" : null,
    multipleReady: false,
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
      artifactOptions: {
        zipReady: false,
        externalImportReady: false,
        selectedPrimaryArtifactType: null,
        multipleReady: false,
      },
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
  const artifactOptions = await resolveArtifactOptions(version.id);

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
      contentType: row.contentType,
    },
  });

  return {
    distribution: toPackDistributionMetadataDto(row),
    artifactOptions,
  };
}

export function buildDistributionPatchUpdateData(
  patch: PatchDistributionMetadataInput,
  existing: PackDistributionMetadata,
): Prisma.PackDistributionMetadataUpdateInput {
  return buildPatchUpdateData(patch, existing);
}

function buildPatchUpdateData(
  patch: PatchDistributionMetadataInput,
  existing: PackDistributionMetadata,
): Prisma.PackDistributionMetadataUpdateInput {
  const updateData: Prisma.PackDistributionMetadataUpdateInput = {};

  if (patch.sourceTitle !== undefined) {
    updateData.sourceTitle = trimOrNull(patch.sourceTitle, MAX_TITLE);
  }
  if (patch.sourceUrl !== undefined) {
    const sourceUrl = trimOrNull(patch.sourceUrl, MAX_URL);
    assertOptionalUrl("출처", sourceUrl);
    updateData.sourceUrl = sourceUrl;
  }
  if (patch.sourcePublisherName !== undefined) {
    updateData.sourcePublisherName = trimOrNull(patch.sourcePublisherName, MAX_TITLE);
  }
  if (patch.sourcePublisherUrl !== undefined) {
    const sourcePublisherUrl = trimOrNull(patch.sourcePublisherUrl, MAX_URL);
    assertOptionalUrl("발행기관", sourcePublisherUrl);
    updateData.sourcePublisherUrl = sourcePublisherUrl;
  }
  if (patch.sourceDocumentVersion !== undefined) {
    updateData.sourceDocumentVersion = trimOrNull(patch.sourceDocumentVersion, MAX_TITLE);
  }
  if (patch.sourcePublishedAt !== undefined) {
    updateData.sourcePublishedAt = parseOptionalDate("게시일", patch.sourcePublishedAt);
  }
  if (patch.sourceRetrievedAt !== undefined) {
    updateData.sourceRetrievedAt = parseOptionalDate("수집일", patch.sourceRetrievedAt);
  }
  if (patch.licenseName !== undefined) {
    const licenseName = patch.licenseName?.trim() ?? "";
    if (!licenseName) {
      throw new PayloadServiceError("LICENSE_REQUIRED", "라이선스명이 필요합니다.", 400);
    }
    updateData.licenseName = licenseName.slice(0, MAX_TITLE);
  }
  if (patch.licenseUrl !== undefined) {
    const licenseUrl = trimOrNull(patch.licenseUrl, MAX_URL);
    assertOptionalUrl("라이선스", licenseUrl);
    updateData.licenseUrl = licenseUrl;
  }
  if (patch.usageTerms !== undefined) {
    updateData.usageTerms = trimOrNull(patch.usageTerms, MAX_TEXT);
  }
  if (patch.readmeText !== undefined) {
    updateData.readmeText = trimOrNull(patch.readmeText, MAX_TEXT);
  }
  if (patch.visibility !== undefined) {
    if (patch.visibility == null || !String(patch.visibility).trim()) {
      throw new PayloadServiceError("INCOMPLETE", "공개범위 값이 올바르지 않습니다.", 400);
    }
    const visibilityRaw = String(patch.visibility).trim().toUpperCase();
    if (!(DISTRIBUTION_VISIBILITIES as readonly string[]).includes(visibilityRaw)) {
      throw new PayloadServiceError("INCOMPLETE", "공개범위 값이 올바르지 않습니다.", 400);
    }
    updateData.visibility = visibilityRaw as PrismaDistributionVisibility;
  }
  if (patch.allowDownload !== undefined) {
    if (patch.allowDownload == null) {
      throw new PayloadServiceError("INCOMPLETE", "다운로드 허용 값이 올바르지 않습니다.", 400);
    }
    updateData.allowDownload = Boolean(patch.allowDownload);
  }
  // primaryArtifactType ignored (ZIP removed)
  if (patch.contentType !== undefined) {
    updateData.contentType = parseContentType(patch.contentType);
  }

  // After applying source fields, ensure source title/url remain valid as a set.
  const nextTitle =
    patch.sourceTitle !== undefined
      ? trimOrNull(patch.sourceTitle, MAX_TITLE)
      : existing.sourceTitle;
  const nextUrl =
    patch.sourceUrl !== undefined ? trimOrNull(patch.sourceUrl, MAX_URL) : existing.sourceUrl;
  if (!nextTitle?.trim() && !nextUrl?.trim()) {
    throw new PayloadServiceError(
      "SOURCE_REQUIRED",
      "출처 제목 또는 출처 URL 중 하나 이상이 필요합니다.",
      400,
    );
  }

  return updateData;
}

/**
 * Admin PATCH: only fields present in `body` are updated.
 * Undefined = preserve; null = clear (except licenseName).
 */
export async function patchAdminPackDistribution(input: {
  packId: string;
  actorUserId: string;
  body: PatchDistributionMetadataInput;
}): Promise<{
  distribution: PackDistributionMetadataDto;
  artifactOptions: DistributionArtifactOptionsDto;
}> {
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

  const existing = await prisma.packDistributionMetadata.findUnique({
    where: { versionId: version.id },
  });
  if (!existing) {
    throw new PayloadServiceError(
      "INCOMPLETE",
      "유통정보가 없습니다. Provider가 먼저 유통정보를 등록해야 합니다.",
      400,
    );
  }

  const updateData = buildPatchUpdateData(input.body, existing);
  if (Object.keys(updateData).length === 0) {
    const artifactOptions = await resolveArtifactOptions(version.id);
    return {
      distribution: toPackDistributionMetadataDto(existing),
      artifactOptions,
    };
  }

  const artifactOptions = await resolveArtifactOptions(version.id);

  const row = await prisma.packDistributionMetadata.update({
    where: { versionId: version.id },
    data: updateData,
  });

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
      contentType: row.contentType,
      actor: "admin",
      patch: true,
    },
  });

  return {
    distribution: toPackDistributionMetadataDto(row),
    artifactOptions,
  };
}

/** @deprecated Prefer patchAdminPackDistribution for true partial updates. */
export async function upsertAdminPackDistribution(input: {
  packId: string;
  actorUserId: string;
  body: UpsertDistributionMetadataInput;
}): Promise<{ distribution: PackDistributionMetadataDto }> {
  const result = await patchAdminPackDistribution({
    packId: input.packId,
    actorUserId: input.actorUserId,
    body: input.body,
  });
  return { distribution: result.distribution };
}

/**
 * Re-validate primary artifact readiness for the latest version (approval gate).
 */
export async function assertPrimaryArtifactReadyForVersion(
  versionId: string,
  primaryArtifactType?: "SOURCE_ORIGINAL" | null,
): Promise<DistributionArtifactOptionsDto> {
  void primaryArtifactType;
  const options = await resolveArtifactOptions(versionId);
  if (!options.externalImportReady) {
    throw new PayloadServiceError(
      "PACK_PRIMARY_ARTIFACT_NOT_READY",
      "공개 다운로드 Artifact(원본문서)가 준비되지 않았습니다.",
      409,
    );
  }
  return options;
}
