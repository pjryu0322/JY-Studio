import {
  AuditAction,
  DistributionVisibility as PrismaDistributionVisibility,
  PackStatus,
  type PackDistributionMetadata,
  type Prisma,
} from "@prisma/client";
import { buildDistributionManifest } from "@/lib/distribution/payload-manifest";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import {
  DISTRIBUTION_VISIBILITIES,
  type DistributionVisibility,
} from "@/lib/distribution/payload-types";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { recordProviderAudit } from "@/lib/provider-audit";
import { prisma } from "@/lib/prisma";

const MAX_TEXT = 8_000;
const MAX_TITLE = 300;
const MAX_URL = 2_000;

export type PackDistributionMetadataDto = {
  id: string;
  packId: string;
  versionId: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  licenseName: string;
  licenseUrl: string | null;
  usageTerms: string | null;
  readmeText: string | null;
  visibility: DistributionVisibility;
  allowDownload: boolean;
  updatedAt: string;
};

export type UpsertDistributionMetadataInput = {
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  licenseName: string;
  licenseUrl?: string | null;
  usageTerms?: string | null;
  readmeText?: string | null;
  visibility?: string;
  allowDownload?: boolean;
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
    licenseName: row.licenseName,
    licenseUrl: row.licenseUrl,
    usageTerms: row.usageTerms,
    readmeText: row.readmeText,
    visibility: row.visibility as DistributionVisibility,
    allowDownload: row.allowDownload,
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

export function validateDistributionMetadataInput(
  input: UpsertDistributionMetadataInput,
): {
  sourceTitle: string | null;
  sourceUrl: string | null;
  licenseName: string;
  licenseUrl: string | null;
  usageTerms: string | null;
  readmeText: string | null;
  visibility: DistributionVisibility;
  allowDownload: boolean;
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
  assertOptionalUrl("출처", sourceUrl);
  assertOptionalUrl("라이선스", licenseUrl);

  const visibilityRaw = (input.visibility ?? "PRIVATE").trim().toUpperCase();
  if (!(DISTRIBUTION_VISIBILITIES as readonly string[]).includes(visibilityRaw)) {
    throw new PayloadServiceError("INCOMPLETE", "공개범위 값이 올바르지 않습니다.", 400);
  }

  return {
    sourceTitle,
    sourceUrl,
    licenseName: licenseName.slice(0, MAX_TITLE),
    licenseUrl,
    usageTerms: trimOrNull(input.usageTerms, MAX_TEXT),
    readmeText: trimOrNull(input.readmeText, MAX_TEXT),
    visibility: visibilityRaw as DistributionVisibility,
    allowDownload: input.allowDownload !== false,
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

export async function getProviderPackDistribution(input: {
  userId: string;
  clientId: string;
  packId: string;
}): Promise<{ distribution: PackDistributionMetadataDto | null }> {
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
    return { distribution: null };
  }

  const row = await prisma.packDistributionMetadata.findUnique({
    where: { versionId: version.id },
  });
  return { distribution: row ? toPackDistributionMetadataDto(row) : null };
}

export async function upsertProviderPackDistribution(input: {
  userId: string;
  clientId: string;
  packId: string;
  body: UpsertDistributionMetadataInput;
}): Promise<{ distribution: PackDistributionMetadataDto }> {
  const { pack, version, profile } = await requireOwnedDraftPack({
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });

  const validated = validateDistributionMetadataInput(input.body);

  const row = await prisma.packDistributionMetadata.upsert({
    where: { versionId: version.id },
    create: {
      packId: pack.packId,
      versionId: version.id,
      sourceTitle: validated.sourceTitle,
      sourceUrl: validated.sourceUrl,
      licenseName: validated.licenseName,
      licenseUrl: validated.licenseUrl,
      usageTerms: validated.usageTerms,
      readmeText: validated.readmeText,
      visibility: validated.visibility as PrismaDistributionVisibility,
      allowDownload: validated.allowDownload,
    },
    update: {
      sourceTitle: validated.sourceTitle,
      sourceUrl: validated.sourceUrl,
      licenseName: validated.licenseName,
      licenseUrl: validated.licenseUrl,
      usageTerms: validated.usageTerms,
      readmeText: validated.readmeText,
      visibility: validated.visibility as PrismaDistributionVisibility,
      allowDownload: validated.allowDownload,
    },
  });

  const payload = await prisma.knowledgePayload.findUnique({
    where: { versionId: version.id },
  });

  if (payload) {
    const manifest = buildDistributionManifest({
      pack: {
        packId: pack.packId,
        name: pack.name,
        version: version.version,
      },
      provider: {
        providerId: profile.id,
        displayName: pack.providerName || profile.displayName,
      },
      generator: {
        type: payload.generatorType as "DOCLING" | "UNSTRUCTURED",
        version: payload.generatorVersion,
      },
      payload: {
        profile: payload.profile as "docling-chunks-v1" | "unstructured-elements-v1",
        originalFileName: payload.originalFileName,
        mimeType: payload.mimeType,
        fileSize: Number(payload.fileSize),
        checksumSha256: payload.checksumSha256,
      },
      source: {
        title: row.sourceTitle,
        url: row.sourceUrl,
        licenseName: row.licenseName,
      },
      distribution: {
        visibility: row.visibility as DistributionVisibility,
        allowDownload: row.allowDownload,
      },
    });

    await prisma.knowledgePayload.update({
      where: { id: payload.id },
      data: { manifestJson: manifest as unknown as Prisma.InputJsonValue },
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
    },
  });

  return { distribution: toPackDistributionMetadataDto(row) };
}
