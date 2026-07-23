import {
  AuditAction,
  DistributionRightsBasis as PrismaDistributionRightsBasis,
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
import {
  isDistributionRightsBasis,
  licenseNameForRightsBasis,
  selectedServiceChannels,
  type DistributionRightsBasisCode,
} from "@/lib/distribution/service-channel-policy";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { recordProviderAudit } from "@/lib/provider-audit";
import { prisma } from "@/lib/prisma";
import { resolveProviderAdminGenerationHold } from "@/lib/python-worker/worker-zip-import-provider-service";
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
  allowApi: boolean;
  allowMcp: boolean;
  rightsBasis: DistributionRightsBasisCode | null;
  rightsBasisDetail: string | null;
  rightsConfirmed: boolean;
  rightsConfirmedAt: string | null;
  serviceEndsAt: string | null;
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
  /** Ignored on provider upsert — system auto-fills. */
  sourceRetrievedAt?: string | null;
  licenseName?: string | null;
  licenseUrl?: string | null;
  usageTerms?: string | null;
  /** Ignored on provider upsert — existing value preserved. */
  readmeText?: string | null;
  visibility?: string;
  allowDownload?: boolean;
  allowApi?: boolean;
  allowMcp?: boolean;
  rightsBasis?: string | null;
  rightsBasisDetail?: string | null;
  rightsConfirmed?: boolean;
  serviceEndsAt?: string | null;
  primaryArtifactType?: string | null;
  /** Ignored on provider upsert — existing value preserved. */
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
  allowApi?: boolean | null;
  allowMcp?: boolean | null;
  rightsBasis?: string | null;
  rightsBasisDetail?: string | null;
  rightsConfirmed?: boolean | null;
  serviceEndsAt?: string | null;
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
    allowApi: row.allowApi,
    allowMcp: row.allowMcp,
    rightsBasis: (row.rightsBasis as DistributionRightsBasisCode | null) ?? null,
    rightsBasisDetail: row.rightsBasisDetail,
    rightsConfirmed: Boolean(row.rightsConfirmedAt),
    rightsConfirmedAt: row.rightsConfirmedAt?.toISOString() ?? null,
    serviceEndsAt: row.serviceEndsAt?.toISOString() ?? null,
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
  allowApi: boolean;
  allowMcp: boolean;
  rightsBasis: DistributionRightsBasisCode | null;
  rightsBasisDetail: string | null;
  rightsConfirmed: boolean;
  rightsConfirmedAt: string | null;
  serviceEndsAt: string | null;
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
    allowApi: dto.allowApi,
    allowMcp: dto.allowMcp,
    rightsBasis: dto.rightsBasis,
    rightsBasisDetail: dto.rightsBasisDetail,
    rightsConfirmed: dto.rightsConfirmed,
    rightsConfirmedAt: dto.rightsConfirmedAt,
    serviceEndsAt: dto.serviceEndsAt,
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
  readmeText: string | null | undefined;
  visibility: DistributionVisibility;
  allowDownload: boolean;
  allowApi: boolean;
  allowMcp: boolean;
  rightsBasis: DistributionRightsBasisCode;
  rightsBasisDetail: string | null;
  rightsConfirmed: boolean;
  serviceEndsAt: Date | null;
  primaryArtifactType: null;
  contentType: PrismaPackContentType | null | undefined;
} {
  const sourceTitle = trimOrNull(input.sourceTitle, MAX_TITLE);
  const sourceUrl = trimOrNull(input.sourceUrl, MAX_URL);
  if (!sourceTitle && !sourceUrl) {
    throw new PayloadServiceError(
      "SOURCE_REQUIRED",
      "출처 제목 또는 출처 URL 중 하나 이상이 필요합니다.",
      400,
    );
  }

  const allowApi = Boolean(input.allowApi);
  const allowMcp = Boolean(input.allowMcp);
  const allowDownload = Boolean(input.allowDownload);
  if (selectedServiceChannels({ allowApi, allowMcp, allowDownload }).length === 0) {
    throw new PayloadServiceError(
      "SERVICE_CHANNEL_REQUIRED",
      "제공 방식을 한 개 이상 선택해 주세요.",
      400,
    );
  }

  const rightsBasisRaw = (input.rightsBasis ?? "").trim().toUpperCase();
  if (!isDistributionRightsBasis(rightsBasisRaw)) {
    throw new PayloadServiceError(
      "DISTRIBUTION_RIGHTS_REQUIRED",
      "유통 권한 근거를 선택해 주세요.",
      400,
    );
  }
  const rightsBasis = rightsBasisRaw;
  const rightsBasisDetail = trimOrNull(input.rightsBasisDetail, MAX_TEXT);
  const licenseUrl = trimOrNull(input.licenseUrl, MAX_URL);

  let licenseName = "";
  if (rightsBasis === "PUBLIC_LICENSE") {
    licenseName = (input.licenseName ?? "").trim();
    if (!licenseName) {
      throw new PayloadServiceError(
        "LICENSE_REQUIRED",
        "공개 라이선스 선택 시 라이선스명이 필요합니다.",
        400,
      );
    }
  } else {
    if (!rightsBasisDetail) {
      throw new PayloadServiceError(
        "DISTRIBUTION_RIGHTS_REQUIRED",
        "권한 근거 설명을 입력해 주세요.",
        400,
      );
    }
    licenseName = licenseNameForRightsBasis(rightsBasis, input.licenseName);
  }

  if (!input.rightsConfirmed) {
    throw new PayloadServiceError(
      "DISTRIBUTION_RIGHTS_CONFIRMATION_REQUIRED",
      "유통 권한 확인에 동의해 주세요.",
      400,
    );
  }

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

  void parsePrimaryArtifactType(input.primaryArtifactType);

  // Provider UI no longer sends these; preserve undefined for upsert merge.
  const ignoreContentType = input.contentType === undefined;
  const ignoreReadme = input.readmeText === undefined;

  return {
    sourceTitle,
    sourceUrl,
    sourcePublisherName,
    sourcePublisherUrl,
    sourceDocumentVersion,
    sourcePublishedAt: parseOptionalDate("원문 게시일", input.sourcePublishedAt),
    sourceRetrievedAt: null,
    licenseName: licenseName.slice(0, MAX_TITLE),
    licenseUrl,
    usageTerms: trimOrNull(input.usageTerms, MAX_TEXT),
    readmeText: ignoreReadme ? undefined : trimOrNull(input.readmeText, MAX_TEXT),
    visibility: visibilityRaw as DistributionVisibility,
    allowDownload,
    allowApi,
    allowMcp,
    rightsBasis,
    rightsBasisDetail,
    rightsConfirmed: true,
    serviceEndsAt: parseOptionalDate("서비스 종료일", input.serviceEndsAt),
    primaryArtifactType: null,
    contentType: ignoreContentType ? undefined : parseContentType(input.contentType),
  };
}

export async function resolveAutoSourceRetrievedAt(versionId: string): Promise<Date> {
  const bundle = await prisma.doclingImportBundle.findFirst({
    where: {
      versionId,
      deletedAt: null,
      isActive: true,
      status: "REVIEW_READY",
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  if (bundle?.createdAt) return bundle.createdAt;

  const sourceFile = await prisma.knowledgePackFile.findFirst({
    where: { versionId, role: "SOURCE_ORIGINAL" },
    orderBy: { uploadedAt: "asc" },
    select: { uploadedAt: true, createdAt: true },
  });
  if (sourceFile?.uploadedAt) return sourceFile.uploadedAt;
  if (sourceFile?.createdAt) return sourceFile.createdAt;

  return new Date();
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
  const adminHold = await resolveProviderAdminGenerationHold(pack.packId);
  if (adminHold) {
    throw new PayloadServiceError(
      "PACK_NOT_EDITABLE",
      "관리자가 생성 요청을 접수한 뒤에는 유통정보를 수정할 수 없습니다.",
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

function metadataWriteFields(
  validated: ReturnType<typeof validateDistributionMetadataInput>,
  options?: {
    sourceRetrievedAt: Date;
    rightsConfirmedAt: Date;
    rightsConfirmedByUserId: string;
    existing?: PackDistributionMetadata | null;
  },
) {
  const fields: Record<string, unknown> = {
    sourceTitle: validated.sourceTitle,
    sourceUrl: validated.sourceUrl,
    sourcePublisherName: validated.sourcePublisherName,
    sourcePublisherUrl: validated.sourcePublisherUrl,
    sourceDocumentVersion: validated.sourceDocumentVersion,
    sourcePublishedAt: validated.sourcePublishedAt,
    sourceRetrievedAt: options?.sourceRetrievedAt ?? validated.sourceRetrievedAt,
    licenseName: validated.licenseName,
    licenseUrl: validated.licenseUrl,
    usageTerms: validated.usageTerms,
    visibility: validated.visibility as PrismaDistributionVisibility,
    allowDownload: validated.allowDownload,
    allowApi: validated.allowApi,
    allowMcp: validated.allowMcp,
    rightsBasis: validated.rightsBasis as PrismaDistributionRightsBasis,
    rightsBasisDetail: validated.rightsBasisDetail,
    rightsConfirmedAt: options?.rightsConfirmedAt ?? null,
    rightsConfirmedByUserId: options?.rightsConfirmedByUserId ?? null,
    serviceEndsAt: validated.serviceEndsAt,
  };
  // Preserve legacy fields when provider omits them.
  if (validated.readmeText !== undefined) {
    fields.readmeText = validated.readmeText;
  } else if (options?.existing) {
    fields.readmeText = options.existing.readmeText;
  }
  if (validated.contentType !== undefined) {
    fields.contentType = validated.contentType;
  } else if (options?.existing) {
    fields.contentType = options.existing.contentType;
  }
  return fields as {
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
    visibility: PrismaDistributionVisibility;
    allowDownload: boolean;
    allowApi: boolean;
    allowMcp: boolean;
    rightsBasis: PrismaDistributionRightsBasis;
    rightsBasisDetail: string | null;
    rightsConfirmedAt: Date | null;
    rightsConfirmedByUserId: string | null;
    serviceEndsAt: Date | null;
    contentType: PrismaPackContentType | null;
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

  const { isDoclingKnowledgePipelinePassed } = await import(
    "@/lib/docling-knowledge/docling-knowledge-pipeline-service"
  );
  const knowledgePassed = await isDoclingKnowledgePipelinePassed(pack.packId);
  if (!knowledgePassed) {
    throw new PayloadServiceError(
      "INCOMPLETE",
      "지식 데이터 생성이 완료되어야 유통정보를 저장할 수 있습니다.",
      400,
    );
  }

  const validated = validateDistributionMetadataInput(input.body);
  const artifactOptions = await resolveArtifactOptions(version.id);
  const existing = await prisma.packDistributionMetadata.findUnique({
    where: { versionId: version.id },
  });
  const sourceRetrievedAt =
    existing?.sourceRetrievedAt ?? (await resolveAutoSourceRetrievedAt(version.id));
  const now = new Date();
  const fields = metadataWriteFields(validated, {
    sourceRetrievedAt,
    rightsConfirmedAt: now,
    rightsConfirmedByUserId: input.userId,
    existing,
  });

  const row = await prisma.packDistributionMetadata.upsert({
    where: { versionId: version.id },
    create: {
      packId: pack.packId,
      versionId: version.id,
      ...fields,
    },
    update: fields,
  });

  // Channel / policy changes invalidate prior service validations.
  const channelsChanged =
    !existing ||
    existing.allowApi !== row.allowApi ||
    existing.allowMcp !== row.allowMcp ||
    existing.allowDownload !== row.allowDownload ||
    (existing.serviceEndsAt?.toISOString() ?? null) !==
      (row.serviceEndsAt?.toISOString() ?? null) ||
    existing.visibility !== row.visibility;
  if (channelsChanged) {
    const { markServiceValidationsStaleForVersion } = await import(
      "@/lib/distribution/mark-service-validations-stale"
    );
    await markServiceValidationsStaleForVersion(version.id);
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
      allowApi: row.allowApi,
      allowMcp: row.allowMcp,
      rightsBasis: row.rightsBasis,
      licenseName: row.licenseName,
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

type PatchUpdateData = Prisma.PackDistributionMetadataUpdateInput;

/** Simple `undefined` = preserve / trim-and-clamp string fields with no extra validation. */
function applyTrimmedTextPatches(
  patch: PatchDistributionMetadataInput,
  updateData: PatchUpdateData,
): void {
  if (patch.sourceTitle !== undefined) {
    updateData.sourceTitle = trimOrNull(patch.sourceTitle, MAX_TITLE);
  }
  if (patch.sourcePublisherName !== undefined) {
    updateData.sourcePublisherName = trimOrNull(patch.sourcePublisherName, MAX_TITLE);
  }
  if (patch.sourceDocumentVersion !== undefined) {
    updateData.sourceDocumentVersion = trimOrNull(patch.sourceDocumentVersion, MAX_TITLE);
  }
  if (patch.usageTerms !== undefined) {
    updateData.usageTerms = trimOrNull(patch.usageTerms, MAX_TEXT);
  }
  if (patch.readmeText !== undefined) {
    updateData.readmeText = trimOrNull(patch.readmeText, MAX_TEXT);
  }
  if (patch.rightsBasisDetail !== undefined) {
    updateData.rightsBasisDetail = trimOrNull(patch.rightsBasisDetail, MAX_TEXT);
  }
}

/** Trim-and-clamp URL fields, each validated as an optional http(s) URL. */
function applyUrlPatches(patch: PatchDistributionMetadataInput, updateData: PatchUpdateData): void {
  if (patch.sourceUrl !== undefined) {
    const sourceUrl = trimOrNull(patch.sourceUrl, MAX_URL);
    assertOptionalUrl("출처", sourceUrl);
    updateData.sourceUrl = sourceUrl;
  }
  if (patch.sourcePublisherUrl !== undefined) {
    const sourcePublisherUrl = trimOrNull(patch.sourcePublisherUrl, MAX_URL);
    assertOptionalUrl("발행기관", sourcePublisherUrl);
    updateData.sourcePublisherUrl = sourcePublisherUrl;
  }
  if (patch.licenseUrl !== undefined) {
    const licenseUrl = trimOrNull(patch.licenseUrl, MAX_URL);
    assertOptionalUrl("라이선스", licenseUrl);
    updateData.licenseUrl = licenseUrl;
  }
}

function applyOptionalDatePatches(
  patch: PatchDistributionMetadataInput,
  updateData: PatchUpdateData,
): void {
  if (patch.sourcePublishedAt !== undefined) {
    updateData.sourcePublishedAt = parseOptionalDate("게시일", patch.sourcePublishedAt);
  }
  if (patch.sourceRetrievedAt !== undefined) {
    updateData.sourceRetrievedAt = parseOptionalDate("수집일", patch.sourceRetrievedAt);
  }
  if (patch.serviceEndsAt !== undefined) {
    updateData.serviceEndsAt = parseOptionalDate("서비스 종료일", patch.serviceEndsAt);
  }
}

/** License name is required (non-empty) whenever present in the patch. */
function applyLicenseNamePatch(
  patch: PatchDistributionMetadataInput,
  updateData: PatchUpdateData,
): void {
  if (patch.licenseName === undefined) return;
  const licenseName = patch.licenseName?.trim() ?? "";
  if (!licenseName) {
    throw new PayloadServiceError("LICENSE_REQUIRED", "라이선스명이 필요합니다.", 400);
  }
  updateData.licenseName = licenseName.slice(0, MAX_TITLE);
}

function applyVisibilityPatch(
  patch: PatchDistributionMetadataInput,
  updateData: PatchUpdateData,
): void {
  if (patch.visibility === undefined) return;
  const visibilityRaw = patch.visibility == null ? "" : String(patch.visibility).trim().toUpperCase();
  if (!visibilityRaw || !(DISTRIBUTION_VISIBILITIES as readonly string[]).includes(visibilityRaw)) {
    throw new PayloadServiceError("INCOMPLETE", "공개범위 값이 올바르지 않습니다.", 400);
  }
  updateData.visibility = visibilityRaw as PrismaDistributionVisibility;
}

/** Required (non-null) boolean channel/download flags, each validated independently. */
function applyRequiredBooleanFlagPatches(
  patch: PatchDistributionMetadataInput,
  updateData: PatchUpdateData,
): void {
  const flags: {
    key: "allowDownload" | "allowApi" | "allowMcp";
    label: string;
  }[] = [
    { key: "allowDownload", label: "다운로드 허용" },
    { key: "allowApi", label: "API 제공" },
    { key: "allowMcp", label: "MCP 제공" },
  ];
  for (const { key, label } of flags) {
    const value = patch[key];
    if (value === undefined) continue;
    if (value == null) {
      throw new PayloadServiceError("INCOMPLETE", `${label} 값이 올바르지 않습니다.`, 400);
    }
    updateData[key] = Boolean(value);
  }
}

function applyRightsBasisPatch(
  patch: PatchDistributionMetadataInput,
  updateData: PatchUpdateData,
): void {
  if (patch.rightsBasis === undefined) return;
  const rightsBasisRaw = patch.rightsBasis == null ? "" : String(patch.rightsBasis).trim();
  if (!rightsBasisRaw) {
    updateData.rightsBasis = null;
    return;
  }
  if (!isDistributionRightsBasis(rightsBasisRaw)) {
    throw new PayloadServiceError("INCOMPLETE", "유통 권한 근거 값이 올바르지 않습니다.", 400);
  }
  updateData.rightsBasis = rightsBasisRaw as DistributionRightsBasisCode;
}

function applyRightsConfirmedPatch(
  patch: PatchDistributionMetadataInput,
  updateData: PatchUpdateData,
): void {
  if (patch.rightsConfirmed === undefined) return;
  if (patch.rightsConfirmed) {
    updateData.rightsConfirmedAt = new Date();
    return;
  }
  updateData.rightsConfirmedAt = null;
  updateData.rightsConfirmedByUserId = null;
}

function applyContentTypePatch(
  patch: PatchDistributionMetadataInput,
  updateData: PatchUpdateData,
): void {
  // primaryArtifactType ignored (ZIP removed)
  if (patch.contentType !== undefined) {
    updateData.contentType = parseContentType(patch.contentType);
  }
}

/** After applying source fields, the pack must still have a title or a URL. */
function assertSourceFieldsPresentAfterPatch(
  patch: PatchDistributionMetadataInput,
  existing: PackDistributionMetadata,
): void {
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
}

function buildPatchUpdateData(
  patch: PatchDistributionMetadataInput,
  existing: PackDistributionMetadata,
): Prisma.PackDistributionMetadataUpdateInput {
  const updateData: PatchUpdateData = {};

  applyTrimmedTextPatches(patch, updateData);
  applyUrlPatches(patch, updateData);
  applyOptionalDatePatches(patch, updateData);
  applyLicenseNamePatch(patch, updateData);
  applyVisibilityPatch(patch, updateData);
  applyRequiredBooleanFlagPatches(patch, updateData);
  applyRightsBasisPatch(patch, updateData);
  applyRightsConfirmedPatch(patch, updateData);
  applyContentTypePatch(patch, updateData);

  assertSourceFieldsPresentAfterPatch(patch, existing);

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

  const channelOrPolicyChanged =
    (updateData.allowApi !== undefined && existing.allowApi !== row.allowApi) ||
    (updateData.allowMcp !== undefined && existing.allowMcp !== row.allowMcp) ||
    (updateData.allowDownload !== undefined && existing.allowDownload !== row.allowDownload) ||
    (updateData.visibility !== undefined && existing.visibility !== row.visibility) ||
    (updateData.serviceEndsAt !== undefined &&
      (existing.serviceEndsAt?.toISOString() ?? null) !==
        (row.serviceEndsAt?.toISOString() ?? null));
  if (channelOrPolicyChanged) {
    const { markServiceValidationsStaleForVersion } = await import(
      "@/lib/distribution/mark-service-validations-stale"
    );
    await markServiceValidationsStaleForVersion(version.id);
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
      allowApi: row.allowApi,
      allowMcp: row.allowMcp,
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
