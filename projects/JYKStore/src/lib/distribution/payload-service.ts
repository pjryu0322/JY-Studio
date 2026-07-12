import {
  AuditAction,
  PackStatus,
  PayloadGeneratorType as PrismaPayloadGeneratorType,
  PayloadValidationStatus,
  type KnowledgePayload,
  type Prisma,
} from "@prisma/client";
import { LocalPayloadStorage } from "@/lib/distribution/local-payload-storage";
import { buildDistributionManifest } from "@/lib/distribution/payload-manifest";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import type { PayloadStorage } from "@/lib/distribution/payload-storage";
import {
  PAYLOAD_ALLOWED_EXTENSIONS,
  PAYLOAD_ALLOWED_MIME_TYPES,
  PAYLOAD_MAX_ZIP_BYTES,
  generatorForProfile,
  isPayloadGeneratorType,
  isPayloadProfile,
  profileForGenerator,
  type PayloadGeneratorType,
  type PayloadProfile,
} from "@/lib/distribution/payload-types";
import { validatePayloadProfile } from "@/lib/distribution/payload-profile-validator";
import { validateZipBytes } from "@/lib/distribution/payload-zip-validator";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { recordProviderAudit } from "@/lib/provider-audit";
import { prisma } from "@/lib/prisma";

export type KnowledgePayloadPublicDto = {
  id: string;
  packId: string;
  versionId: string;
  profile: string;
  generatorType: PayloadGeneratorType;
  generatorVersion: string | null;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  checksumSha256: string;
  validationStatus: string;
  validationMessage: string | null;
  validationReport: unknown;
  manifest: unknown;
  isImmutable: boolean;
  uploadedAt: string;
};

function resolveMaxZipBytes(): number {
  const raw = process.env.JYKSTORE_PAYLOAD_MAX_BYTES?.trim();
  if (!raw) return PAYLOAD_MAX_ZIP_BYTES;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : PAYLOAD_MAX_ZIP_BYTES;
}

function getDefaultStorage(): PayloadStorage {
  return new LocalPayloadStorage();
}

function extensionOfFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? fileName;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot).toLowerCase();
}

function sanitizeOriginalFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop()?.trim() || "payload.zip";
  const cleaned = base.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 180);
  return cleaned || "payload.zip";
}

export function toKnowledgePayloadPublicDto(
  payload: KnowledgePayload,
): KnowledgePayloadPublicDto {
  return {
    id: payload.id,
    packId: payload.packId,
    versionId: payload.versionId,
    profile: payload.profile,
    generatorType: payload.generatorType as PayloadGeneratorType,
    generatorVersion: payload.generatorVersion,
    originalFileName: payload.originalFileName,
    mimeType: payload.mimeType,
    fileSize: Number(payload.fileSize),
    checksumSha256: payload.checksumSha256,
    validationStatus: payload.validationStatus,
    validationMessage: payload.validationMessage,
    validationReport: payload.validationReport,
    manifest: payload.manifestJson,
    isImmutable: payload.isImmutable,
    uploadedAt: payload.uploadedAt.toISOString(),
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
      "초안(DRAFT) 상태에서만 Payload를 관리할 수 있습니다.",
      409,
    );
  }

  const version = pack.versions[0];
  if (!version) {
    throw new PayloadServiceError("INCOMPLETE", "버전이 없습니다.", 400);
  }

  return { pack, version, profile };
}

function resolveProfileAndGenerator(input: {
  profile?: string | null;
  generatorType?: string | null;
}): { profile: PayloadProfile; generatorType: PayloadGeneratorType } {
  const rawProfile = input.profile?.trim() ?? "";
  const rawGenerator = input.generatorType?.trim() ?? "";

  if (rawProfile && !isPayloadProfile(rawProfile)) {
    throw new PayloadServiceError(
      "PAYLOAD_UNSUPPORTED_PROFILE",
      "지원하지 않는 Payload Profile입니다.",
      400,
    );
  }
  if (rawGenerator && !isPayloadGeneratorType(rawGenerator)) {
    throw new PayloadServiceError(
      "PAYLOAD_GENERATOR_MISMATCH",
      "지원하지 않는 생성기 유형입니다.",
      400,
    );
  }

  if (rawProfile && rawGenerator) {
    const expected = generatorForProfile(rawProfile as PayloadProfile);
    if (expected !== rawGenerator) {
      throw new PayloadServiceError(
        "PAYLOAD_GENERATOR_MISMATCH",
        "생성기 유형과 Payload Profile이 일치하지 않습니다.",
        400,
      );
    }
    return {
      profile: rawProfile as PayloadProfile,
      generatorType: rawGenerator as PayloadGeneratorType,
    };
  }

  if (rawGenerator) {
    const generatorType = rawGenerator as PayloadGeneratorType;
    return { profile: profileForGenerator(generatorType), generatorType };
  }

  if (rawProfile) {
    const profile = rawProfile as PayloadProfile;
    return { profile, generatorType: generatorForProfile(profile) };
  }

  throw new PayloadServiceError(
    "PAYLOAD_UNSUPPORTED_PROFILE",
    "profile 또는 generatorType이 필요합니다.",
    400,
  );
}

export async function uploadProviderPackPayload(input: {
  userId: string;
  clientId: string;
  packId: string;
  fileName: string;
  mimeType: string | null;
  bytes: Uint8Array;
  profile?: string | null;
  generatorType?: string | null;
  generatorVersion?: string | null;
  storage?: PayloadStorage;
}): Promise<{ payload: KnowledgePayloadPublicDto }> {
  const { pack, version, profile } = await requireOwnedDraftPack({
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });

  const existing = await prisma.knowledgePayload.findUnique({
    where: { versionId: version.id },
  });
  if (existing) {
    throw new PayloadServiceError(
      "PAYLOAD_ALREADY_REGISTERED",
      "이미 Payload가 등록되어 있습니다. 삭제 후 다시 등록하세요.",
      409,
    );
  }

  if (!input.bytes || input.bytes.byteLength === 0) {
    throw new PayloadServiceError("PAYLOAD_FILE_REQUIRED", "ZIP 파일이 필요합니다.", 400);
  }

  const maxBytes = resolveMaxZipBytes();
  if (input.bytes.byteLength > maxBytes) {
    throw new PayloadServiceError(
      "PAYLOAD_FILE_TOO_LARGE",
      `ZIP 파일이 최대 크기(${maxBytes} bytes)를 초과했습니다.`,
      400,
    );
  }

  const originalFileName = sanitizeOriginalFileName(input.fileName);
  const ext = extensionOfFileName(originalFileName);
  if (!(PAYLOAD_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new PayloadServiceError(
      "PAYLOAD_INVALID_ZIP",
      "ZIP 파일만 업로드할 수 있습니다.",
      400,
    );
  }

  const mimeType = (input.mimeType?.trim() || "application/zip").toLowerCase();
  if (
    mimeType &&
    !(PAYLOAD_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType) &&
    mimeType !== "application/octet-stream"
  ) {
    throw new PayloadServiceError(
      "PAYLOAD_INVALID_ZIP",
      "허용되지 않은 MIME 유형입니다.",
      400,
    );
  }

  const { profile: payloadProfile, generatorType } = resolveProfileAndGenerator({
    profile: input.profile,
    generatorType: input.generatorType,
  });

  const zipValidation = await validateZipBytes(input.bytes, { maxZipBytes: maxBytes });
  if (!zipValidation.ok) {
    const first = zipValidation.errors[0] ?? "ZIP 검증에 실패했습니다.";
    const code =
      /path|traversal|Absolute|Drive|UNC|NUL/i.test(first)
        ? "PAYLOAD_UNSAFE_PATH"
        : /too many entries/i.test(first)
          ? "PAYLOAD_TOO_MANY_ENTRIES"
          : "PAYLOAD_INVALID_ZIP";
    throw new PayloadServiceError(code, first, 400);
  }

  const profileValidation = await validatePayloadProfile(
    payloadProfile,
    { zipEntries: zipValidation.entries, zipBytes: input.bytes },
    { generatorType },
  );

  if (!profileValidation.ok) {
    const first = profileValidation.errors[0] ?? "Payload 내용 검증에 실패했습니다.";
    const code = /entrypoint/i.test(first)
      ? "PAYLOAD_ENTRYPOINT_MISSING"
      : /Generator type|does not match/i.test(first)
        ? "PAYLOAD_GENERATOR_MISMATCH"
        : /Unsupported payload profile/i.test(first)
          ? "PAYLOAD_UNSUPPORTED_PROFILE"
          : "PAYLOAD_INVALID_CONTENT";
    throw new PayloadServiceError(code, first, 400);
  }

  const storage = input.storage ?? getDefaultStorage();
  const saved = await storage.save({
    packId: pack.packId,
    versionId: version.id,
    originalFileName,
    bytes: input.bytes,
  });

  const validationReport = {
    profile: payloadProfile,
    entrypoint: profileValidation.entrypoint ?? null,
    recordCount: profileValidation.recordCount ?? null,
    warnings: profileValidation.warnings,
    errors: profileValidation.errors,
    validatedAt: new Date().toISOString(),
  };

  const distributionMeta = await prisma.packDistributionMetadata.findUnique({
    where: { versionId: version.id },
  });

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
      type: generatorType,
      version: input.generatorVersion?.trim() || null,
    },
    payload: {
      profile: payloadProfile,
      originalFileName,
      mimeType: "application/zip",
      fileSize: saved.fileSize,
      checksumSha256: saved.checksumSha256,
    },
    source: {
      title: distributionMeta?.sourceTitle ?? null,
      url: distributionMeta?.sourceUrl ?? null,
      licenseName: distributionMeta?.licenseName ?? "UNSPECIFIED",
    },
    distribution: {
      visibility: (distributionMeta?.visibility ?? "PRIVATE") as
        | "PRIVATE"
        | "PUBLIC"
        | "UNLISTED",
      allowDownload: distributionMeta?.allowDownload ?? true,
    },
  });

  let created: KnowledgePayload;
  try {
    created = await prisma.knowledgePayload.create({
      data: {
        packId: pack.packId,
        versionId: version.id,
        profile: payloadProfile,
        generatorType: generatorType as PrismaPayloadGeneratorType,
        generatorVersion: input.generatorVersion?.trim() || null,
        originalFileName,
        storagePath: saved.storagePath,
        mimeType: "application/zip",
        fileSize: BigInt(saved.fileSize),
        checksumSha256: saved.checksumSha256,
        validationStatus: PayloadValidationStatus.VALID,
        validationMessage: null,
        validationReport: validationReport as Prisma.InputJsonValue,
        manifestJson: manifest as unknown as Prisma.InputJsonValue,
        isImmutable: true,
      },
    });
  } catch (error) {
    await storage.delete(saved.storagePath).catch(() => undefined);
    throw error;
  }

  await recordProviderAudit({
    action: AuditAction.PAYLOAD_UPLOADED,
    entityType: "KnowledgePayload",
    entityId: created.id,
    actorUserId: input.userId,
    metadata: {
      packId: pack.packId,
      versionId: version.id,
      payloadId: created.id,
      checksumSha256: created.checksumSha256,
      profile: created.profile,
      generatorType: created.generatorType,
      result: "VALID",
    },
  });

  await recordProviderAudit({
    action: AuditAction.PAYLOAD_VALIDATED,
    entityType: "KnowledgePayload",
    entityId: created.id,
    actorUserId: input.userId,
    metadata: {
      packId: pack.packId,
      versionId: version.id,
      payloadId: created.id,
      validationStatus: "VALID",
      entrypoint: profileValidation.entrypoint ?? null,
      recordCount: profileValidation.recordCount ?? null,
    },
  });

  return { payload: toKnowledgePayloadPublicDto(created) };
}

export async function getProviderPackPayload(input: {
  userId: string;
  clientId: string;
  packId: string;
}): Promise<{ payload: KnowledgePayloadPublicDto | null }> {
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
    return { payload: null };
  }

  const payload = await prisma.knowledgePayload.findUnique({
    where: { versionId: version.id },
  });
  return { payload: payload ? toKnowledgePayloadPublicDto(payload) : null };
}

export async function deleteProviderPackPayload(input: {
  userId: string;
  clientId: string;
  packId: string;
  storage?: PayloadStorage;
}): Promise<{ deleted: true }> {
  const { pack, version } = await requireOwnedDraftPack({
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });

  const payload = await prisma.knowledgePayload.findUnique({
    where: { versionId: version.id },
  });
  if (!payload) {
    throw new PayloadServiceError("PAYLOAD_NOT_FOUND", "등록된 Payload가 없습니다.", 404);
  }

  const storage = input.storage ?? getDefaultStorage();
  await prisma.knowledgePayload.delete({ where: { id: payload.id } });
  await storage.delete(payload.storagePath).catch(() => undefined);

  await recordProviderAudit({
    action: AuditAction.PAYLOAD_DELETED,
    entityType: "KnowledgePayload",
    entityId: payload.id,
    actorUserId: input.userId,
    metadata: {
      packId: pack.packId,
      versionId: version.id,
      payloadId: payload.id,
      checksumSha256: payload.checksumSha256,
      profile: payload.profile,
      generatorType: payload.generatorType,
    },
  });

  return { deleted: true };
}

export async function readOwnedPayloadBytes(input: {
  userId: string;
  clientId: string;
  packId: string;
  storage?: PayloadStorage;
}): Promise<{
  bytes: Uint8Array;
  originalFileName: string;
  checksumSha256: string;
  payloadId: string;
  versionId: string;
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
    throw new PayloadServiceError("PAYLOAD_NOT_FOUND", "등록된 Payload가 없습니다.", 404);
  }

  const payload = await prisma.knowledgePayload.findUnique({
    where: { versionId: version.id },
  });
  if (!payload) {
    throw new PayloadServiceError("PAYLOAD_NOT_FOUND", "등록된 Payload가 없습니다.", 404);
  }

  const storage = input.storage ?? getDefaultStorage();
  const bytes = await storage.read(payload.storagePath);

  await recordProviderAudit({
    action: AuditAction.PAYLOAD_DOWNLOADED,
    entityType: "KnowledgePayload",
    entityId: payload.id,
    actorUserId: input.userId,
    metadata: {
      packId: pack.packId,
      versionId: version.id,
      payloadId: payload.id,
      checksumSha256: payload.checksumSha256,
      actor: "provider",
    },
  });

  return {
    bytes,
    originalFileName: payload.originalFileName,
    checksumSha256: payload.checksumSha256,
    payloadId: payload.id,
    versionId: version.id,
  };
}

export async function readAdminPayloadBytes(input: {
  packId: string;
  actorUserId?: string | null;
  storage?: PayloadStorage;
}): Promise<{
  bytes: Uint8Array;
  originalFileName: string;
  checksumSha256: string;
  payloadId: string;
  versionId: string;
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
    throw new PayloadServiceError("PAYLOAD_NOT_FOUND", "등록된 Payload가 없습니다.", 404);
  }

  const payload = await prisma.knowledgePayload.findUnique({
    where: { versionId: version.id },
  });
  if (!payload) {
    throw new PayloadServiceError("PAYLOAD_NOT_FOUND", "등록된 Payload가 없습니다.", 404);
  }

  const storage = input.storage ?? getDefaultStorage();
  const bytes = await storage.read(payload.storagePath);

  await recordProviderAudit({
    action: AuditAction.PAYLOAD_DOWNLOADED,
    entityType: "KnowledgePayload",
    entityId: payload.id,
    actorUserId: input.actorUserId ?? null,
    metadata: {
      packId: pack.packId,
      versionId: version.id,
      payloadId: payload.id,
      checksumSha256: payload.checksumSha256,
      actor: "admin",
    },
  });

  return {
    bytes,
    originalFileName: payload.originalFileName,
    checksumSha256: payload.checksumSha256,
    payloadId: payload.id,
    versionId: version.id,
  };
}

export async function readPublicCatalogPayloadBytes(input: {
  packId: string;
  storage?: PayloadStorage;
}): Promise<{
  bytes: Uint8Array;
  originalFileName: string;
  checksumSha256: string;
  payloadId: string;
}> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId: input.packId },
    include: { versions: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!pack || (pack.status !== PackStatus.PUBLISHED && pack.status !== PackStatus.VERIFIED)) {
    throw new PayloadServiceError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
  }

  const version = pack.versions[0];
  if (!version) {
    throw new PayloadServiceError("PAYLOAD_NOT_FOUND", "등록된 Payload가 없습니다.", 404);
  }

  const [payload, meta] = await Promise.all([
    prisma.knowledgePayload.findUnique({ where: { versionId: version.id } }),
    prisma.packDistributionMetadata.findUnique({ where: { versionId: version.id } }),
  ]);

  if (!payload || payload.validationStatus !== PayloadValidationStatus.VALID) {
    throw new PayloadServiceError("PAYLOAD_NOT_FOUND", "다운로드 가능한 Payload가 없습니다.", 404);
  }
  if (!meta || meta.visibility !== "PUBLIC" || !meta.allowDownload) {
    throw new PayloadServiceError("NOT_FOUND", "다운로드가 허용되지 않은 지식팩입니다.", 404);
  }

  const storage = input.storage ?? getDefaultStorage();
  const bytes = await storage.read(payload.storagePath);

  await recordProviderAudit({
    action: AuditAction.PAYLOAD_DOWNLOADED,
    entityType: "KnowledgePayload",
    entityId: payload.id,
    metadata: {
      packId: pack.packId,
      versionId: version.id,
      payloadId: payload.id,
      checksumSha256: payload.checksumSha256,
      actor: "catalog",
    },
  });

  return {
    bytes,
    originalFileName: payload.originalFileName,
    checksumSha256: payload.checksumSha256,
    payloadId: payload.id,
  };
}

export async function findLatestPayloadForPack(packId: string) {
  const version = await prisma.knowledgePackVersion.findFirst({
    where: { packId },
    orderBy: { createdAt: "desc" },
    include: { payload: true, distributionMetadata: true },
  });
  return version;
}
