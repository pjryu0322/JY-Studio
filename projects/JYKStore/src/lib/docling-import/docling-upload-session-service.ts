import {
  DoclingBundleStorageStatus,
  DoclingImportBundleStatus,
  DoclingProcessingJobStatus,
  DoclingProcessingStage,
  DoclingProcessingStatus,
  DoclingUploadFileStatus,
  DoclingUploadSessionStatus,
  KnowledgePackFileRole,
  PackStatus,
  type DoclingUploadFile,
  type DoclingUploadSession,
  type Prisma,
} from "@prisma/client";
import {
  DOCLING_ADAPTER_TYPE,
  DOCLING_ADAPTER_VERSION,
} from "@/lib/adapters/docling/docling-types";
import { createPayloadId } from "@/lib/distribution/distribution-manifest-service";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { sha256HexFromStream } from "@/lib/object-storage/checksum";
import type { ObjectStorageBackend } from "@/lib/object-storage/object-storage";
import { buildPackFileObjectKey } from "@/lib/object-storage/object-storage-config";
import { getConfiguredObjectStorage } from "@/lib/object-storage/object-storage-factory";
import { DoclingImportError, isDoclingImportError } from "@/lib/docling-import/docling-import-errors";
import { assertRoleFileMetaAcceptable } from "@/lib/docling-import/docling-import-file-guards";
import { findLatestStagingBundleForVersion } from "@/lib/docling-import/docling-import-lifecycle-service";
import { bundleHasSubmissionHistory } from "@/lib/docling-import/docling-import-submission";
import {
  assertBundleWithinPolicy,
  assertPartNumberValid,
  computePartCount,
  getDoclingUploadPolicy,
  type DoclingUploadPolicy,
} from "@/lib/docling-import/docling-upload-policy";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { prisma } from "@/lib/prisma";

const META_PACK_ID = "jyk-pack-id";
const META_VERSION_ID = "jyk-version-id";
const META_SESSION_ID = "jyk-upload-session-id";
const META_FILE_ROLE = "jyk-file-role";

type SessionWithFiles = DoclingUploadSession & { files: DoclingUploadFile[] };

export type UploadSessionFileInput = {
  role: KnowledgePackFileRole;
  fileName: string;
  mimeType?: string | null;
  declaredFileSize: number;
};

export type UploadSessionPublicDto = {
  id: string;
  packId: string;
  versionId: string;
  status: DoclingUploadSessionStatus;
  expiresAt: string;
  completedAt: string | null;
  abortedAt: string | null;
  bundleId: string | null;
  processingJobId: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  files: UploadSessionFilePublicDto[];
};

export type UploadSessionUploadedPartDto = {
  partNumber: number;
  etag: string;
  size: number;
};

export type UploadSessionFilePublicDto = {
  id: string;
  role: KnowledgePackFileRole;
  status: DoclingUploadFileStatus;
  originalFileName: string;
  mimeType: string;
  fileExtension: string;
  declaredFileSize: number;
  objectKey: string;
  partSizeBytes: number;
  partCount: number;
  checksumSha256: string | null;
  /** Never include multipartUploadId or presigned URLs in logs. */
  hasMultipartUpload: boolean;
  /** Completed parts from Object Storage (for resume). Omitted when not listed. */
  uploadedParts?: UploadSessionUploadedPartDto[];
};

export type PartPresignRequest = {
  role: KnowledgePackFileRole;
  partNumbers: number[];
};

export type PartPresignDto = {
  role: KnowledgePackFileRole;
  fileId: string;
  parts: Array<{
    partNumber: number;
    url: string;
    expiresAt: string;
  }>;
};

function storagePrefix(storage: ObjectStorageBackend): string {
  const withPrefix = storage as ObjectStorageBackend & { prefix?: string };
  return typeof withPrefix.prefix === "string" && withPrefix.prefix.trim()
    ? withPrefix.prefix.trim()
    : "payloads";
}

function toFileDto(file: DoclingUploadFile): UploadSessionFilePublicDto {
  return {
    id: file.id,
    role: file.role,
    status: file.status,
    originalFileName: file.originalFileName,
    mimeType: file.mimeType,
    fileExtension: file.fileExtension,
    declaredFileSize: Number(file.declaredFileSize),
    objectKey: file.objectKey,
    partSizeBytes: file.partSizeBytes,
    partCount: file.partCount,
    checksumSha256: file.checksumSha256,
    hasMultipartUpload: Boolean(file.multipartUploadId),
  };
}

export function toUploadSessionPublicDto(session: SessionWithFiles): UploadSessionPublicDto {
  return {
    id: session.id,
    packId: session.packId,
    versionId: session.versionId,
    status: session.status,
    expiresAt: session.expiresAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    abortedAt: session.abortedAt?.toISOString() ?? null,
    bundleId: session.bundleId,
    processingJobId: session.processingJobId,
    lastErrorCode: session.lastErrorCode,
    lastErrorMessage: session.lastErrorMessage,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    files: session.files
      .slice()
      .sort((a, b) => a.role.localeCompare(b.role))
      .map(toFileDto),
  };
}

async function requireOwnedDraftPack(input: {
  userId: string;
  clientId: string;
  packId: string;
}) {
  const profile = await findOrEnsureProviderProfileForUser(input.userId, input.clientId);
  if (!profile) {
    throw new DoclingImportError("PROFILE_REQUIRED", "제공자 프로필이 필요합니다.", 403);
  }

  const pack = await prisma.knowledgePack.findFirst({
    where: { packId: input.packId, providerProfileId: profile.id },
    include: {
      versions: { orderBy: latestKnowledgePackVersionOrderBy, take: 1 },
      providerProfile: true,
    },
  });

  if (!pack) {
    throw new DoclingImportError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
  }

  if (pack.status !== PackStatus.DRAFT) {
    throw new DoclingImportError(
      "PACK_NOT_EDITABLE",
      "초안(DRAFT) 상태에서만 Docling import를 관리할 수 있습니다.",
      409,
    );
  }

  const version = pack.versions[0];
  if (!version) {
    throw new DoclingImportError("INCOMPLETE", "버전이 없습니다.", 400);
  }

  return { pack, version, profile };
}

async function loadSession(sessionId: string): Promise<SessionWithFiles | null> {
  return prisma.doclingUploadSession.findUnique({
    where: { id: sessionId },
    include: { files: true },
  });
}

function assertSessionEditable(session: SessionWithFiles): void {
  if (session.expiresAt.getTime() < Date.now()) {
    throw new DoclingImportError(
      "DOCLING_UPLOAD_SESSION_EXPIRED",
      "업로드 세션이 만료되었습니다.",
      410,
    );
  }
  if (
    session.status === DoclingUploadSessionStatus.COMPLETED ||
    session.status === DoclingUploadSessionStatus.ABORTED ||
    session.status === DoclingUploadSessionStatus.EXPIRED
  ) {
    throw new DoclingImportError(
      "DOCLING_UPLOAD_SESSION_CLOSED",
      "이미 종료된 업로드 세션입니다.",
      409,
    );
  }
}

function normalizeFileInputs(files: UploadSessionFileInput[]): UploadSessionFileInput[] {
  const byRole = new Map<KnowledgePackFileRole, UploadSessionFileInput>();
  for (const file of files) {
    byRole.set(file.role, file);
  }
  const required: KnowledgePackFileRole[] = [
    KnowledgePackFileRole.SOURCE_ORIGINAL,
    KnowledgePackFileRole.DOCLING_JSON,
    KnowledgePackFileRole.DOCLING_MARKDOWN,
  ];
  for (const role of required) {
    if (!byRole.has(role)) {
      throw new DoclingImportError(
        "DOCLING_FILE_REQUIRED",
        `${role} 파일이 필요합니다.`,
        400,
      );
    }
  }
  return required.map((role) => byRole.get(role)!);
}

export async function createDoclingUploadSession(input: {
  userId: string;
  clientId: string;
  packId: string;
  files: UploadSessionFileInput[];
  storage?: ObjectStorageBackend;
  policy?: DoclingUploadPolicy;
}): Promise<{ session: UploadSessionPublicDto }> {
  const policy = input.policy ?? getDoclingUploadPolicy();
  const storage = input.storage ?? getConfiguredObjectStorage();
  const { pack, version } = await requireOwnedDraftPack({
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });

  const existingActive = await prisma.doclingImportBundle.findFirst({
    where: { versionId: version.id, isActive: true },
    select: { id: true },
  });
  if (existingActive) {
    const hasHistory = await bundleHasSubmissionHistory(
      pack.packId,
      existingActive.id,
      version.id,
    );
    if (hasHistory) {
      throw new DoclingImportError(
        "DOCLING_IMMUTABLE_AFTER_SUBMISSION",
        "이미 검수 제출된 Docling import는 교체할 수 없습니다. 새 버전을 생성하세요.",
        409,
      );
    }
  }

  const existingStaging = await findLatestStagingBundleForVersion(version.id);
  if (existingStaging) {
    throw new DoclingImportError(
      "DOCLING_STAGING_BUNDLE_EXISTS",
      "처리되지 않은 Staging Bundle이 있습니다. 재시도하거나 삭제한 후 새 파일을 등록하세요.",
      409,
    );
  }

  const openSession = await prisma.doclingUploadSession.findFirst({
    where: {
      packId: pack.packId,
      versionId: version.id,
      status: {
        in: [
          DoclingUploadSessionStatus.CREATED,
          DoclingUploadSessionStatus.UPLOADING,
          DoclingUploadSessionStatus.COMPLETING,
        ],
      },
      expiresAt: { gt: new Date() },
    },
  });
  if (openSession) {
    throw new DoclingImportError(
      "DOCLING_UPLOAD_SESSION_EXISTS",
      "이미 진행 중인 업로드 세션이 있습니다.",
      409,
    );
  }

  const normalized = normalizeFileInputs(input.files);
  let totalBytes = 0;
  const prepared = normalized.map((file) => {
    const meta = assertRoleFileMetaAcceptable(
      file.role,
      file.fileName,
      file.mimeType,
      file.declaredFileSize,
    );
    totalBytes += file.declaredFileSize;
    const partCount = computePartCount(file.declaredFileSize, policy.multipartPartBytes);
    return { ...file, meta, partCount };
  });
  assertBundleWithinPolicy(totalBytes, policy);

  const sessionId = createPayloadId();
  const bundleId = createPayloadId();
  const prefix = storagePrefix(storage);
  const expiresAt = new Date(Date.now() + policy.uploadSessionTtlSeconds * 1000);

  const fileCreates: Prisma.DoclingUploadFileCreateWithoutSessionInput[] = [];
  const createdMultipart: Array<{ objectKey: string; uploadId: string }> = [];

  try {
    for (const file of prepared) {
      const fileId = createPayloadId();
      const objectKey = buildPackFileObjectKey({
        prefix,
        packId: pack.packId,
        versionId: version.id,
        bundleId,
        fileId,
        role: file.role,
        extension: file.meta.extension,
      });
      const { uploadId } = await storage.createMultipartUpload({
        objectKey,
        mimeType: file.meta.mimeType,
        metadata: {
          [META_PACK_ID]: pack.packId,
          [META_VERSION_ID]: version.id,
          [META_SESSION_ID]: sessionId,
          [META_FILE_ROLE]: file.role,
        },
      });
      createdMultipart.push({ objectKey, uploadId });
      fileCreates.push({
        id: fileId,
        role: file.role,
        status: DoclingUploadFileStatus.PENDING,
        originalFileName: file.meta.fileName,
        mimeType: file.meta.mimeType,
        fileExtension: file.meta.extension,
        declaredFileSize: BigInt(file.declaredFileSize),
        objectKey,
        multipartUploadId: uploadId,
        partSizeBytes: policy.multipartPartBytes,
        partCount: file.partCount,
      });
    }
  } catch (error) {
    for (const mp of createdMultipart) {
      try {
        await storage.abortMultipartUpload({
          objectKey: mp.objectKey,
          uploadId: mp.uploadId,
        });
      } catch {
        // best-effort
      }
    }
    if (isDoclingImportError(error)) throw error;
    throw new DoclingImportError(
      "DOCLING_STORAGE_UNAVAILABLE",
      "Object Storage multipart 초기화에 실패했습니다.",
      503,
    );
  }

  const session = await prisma.doclingUploadSession.create({
    data: {
      id: sessionId,
      packId: pack.packId,
      versionId: version.id,
      status: DoclingUploadSessionStatus.CREATED,
      uploadedByUserId: input.userId,
      expiresAt,
      // Reserve staging bundle id so object keys remain stable through complete.
      bundleId,
      files: { create: fileCreates },
    },
    include: { files: true },
  });

  return { session: toUploadSessionPublicDto(session) };
}

export async function getDoclingUploadSession(input: {
  userId: string;
  clientId: string;
  packId: string;
  sessionId: string;
  storage?: ObjectStorageBackend;
  includeUploadedParts?: boolean;
}): Promise<{ session: UploadSessionPublicDto }> {
  const storage = input.storage ?? getConfiguredObjectStorage();
  const { pack } = await requireOwnedDraftPack({
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });
  const session = await loadSession(input.sessionId);
  if (!session || session.packId !== pack.packId) {
    throw new DoclingImportError("NOT_FOUND", "업로드 세션을 찾을 수 없습니다.", 404);
  }
  const dto = toUploadSessionPublicDto(session);
  const shouldListParts =
    input.includeUploadedParts !== false &&
    (session.status === DoclingUploadSessionStatus.CREATED ||
      session.status === DoclingUploadSessionStatus.UPLOADING);

  if (!shouldListParts) {
    return { session: dto };
  }

  const filesWithParts = await Promise.all(
    dto.files.map(async (file) => {
      const row = session.files.find((f) => f.id === file.id);
      if (!row?.multipartUploadId) return file;
      try {
        const listed = await storage.listUploadedParts({
          objectKey: row.objectKey,
          uploadId: row.multipartUploadId,
        });
        return {
          ...file,
          uploadedParts: listed.parts.map((p) => ({
            partNumber: p.partNumber,
            etag: p.etag,
            size: p.size ?? 0,
          })),
        };
      } catch {
        return file;
      }
    }),
  );

  return { session: { ...dto, files: filesWithParts } };
}

export async function createDoclingUploadPartPresigns(input: {
  userId: string;
  clientId: string;
  packId: string;
  sessionId: string;
  requests: PartPresignRequest[];
  storage?: ObjectStorageBackend;
  policy?: DoclingUploadPolicy;
}): Promise<{ sessionId: string; presigns: PartPresignDto[] }> {
  const policy = input.policy ?? getDoclingUploadPolicy();
  const storage = input.storage ?? getConfiguredObjectStorage();
  const { pack } = await requireOwnedDraftPack({
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });
  const session = await loadSession(input.sessionId);
  if (!session || session.packId !== pack.packId) {
    throw new DoclingImportError("NOT_FOUND", "업로드 세션을 찾을 수 없습니다.", 404);
  }
  assertSessionEditable(session);

  if (session.status === DoclingUploadSessionStatus.CREATED) {
    await prisma.doclingUploadSession.update({
      where: { id: session.id },
      data: { status: DoclingUploadSessionStatus.UPLOADING },
    });
  }

  const byRole = new Map(session.files.map((f) => [f.role, f]));
  const presigns: PartPresignDto[] = [];

  for (const req of input.requests) {
    const file = byRole.get(req.role);
    if (!file || !file.multipartUploadId) {
      throw new DoclingImportError(
        "DOCLING_FILE_REQUIRED",
        `${req.role} 파일 업로드가 준비되지 않았습니다.`,
        400,
      );
    }
    const uniqueParts = [...new Set(req.partNumbers)].sort((a, b) => a - b);
    if (uniqueParts.length === 0) {
      throw new DoclingImportError(
        "DOCLING_INVALID_PART_NUMBER",
        "파트 번호가 필요합니다.",
        400,
      );
    }
    const parts: PartPresignDto["parts"] = [];
    for (const partNumber of uniqueParts) {
      assertPartNumberValid(partNumber);
      if (partNumber > file.partCount) {
        throw new DoclingImportError(
          "DOCLING_INVALID_PART_NUMBER",
          `파트 번호 ${partNumber}가 예상 파트 수(${file.partCount})를 초과합니다.`,
          400,
        );
      }
      const signed = await storage.presignUploadPart({
        objectKey: file.objectKey,
        uploadId: file.multipartUploadId,
        partNumber,
        expiresInSeconds: policy.presignedUrlTtlSeconds,
      });
      // Never log signed.url
      parts.push({
        partNumber,
        url: signed.url,
        expiresAt: signed.expiresAt.toISOString(),
      });
    }
    await prisma.doclingUploadFile.update({
      where: { id: file.id },
      data: { status: DoclingUploadFileStatus.UPLOADING },
    });
    presigns.push({ role: file.role, fileId: file.id, parts });
  }

  return { sessionId: session.id, presigns };
}

export async function completeDoclingUploadSession(input: {
  userId: string;
  clientId: string;
  packId: string;
  sessionId: string;
  /**
   * Optional client-reported parts. When omitted, parts are listed from Object Storage.
   */
  partsByRole?: Partial<
    Record<KnowledgePackFileRole, Array<{ partNumber: number; etag: string }>>
  >;
  storage?: ObjectStorageBackend;
}): Promise<{
  session: UploadSessionPublicDto;
  bundleId: string;
  processingJobId: string;
  accepted: true;
}> {
  const storage = input.storage ?? getConfiguredObjectStorage();
  const { pack, version } = await requireOwnedDraftPack({
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });
  const session = await loadSession(input.sessionId);
  if (!session || session.packId !== pack.packId) {
    throw new DoclingImportError("NOT_FOUND", "업로드 세션을 찾을 수 없습니다.", 404);
  }
  assertSessionEditable(session);

  const stagingExists = await findLatestStagingBundleForVersion(version.id);
  if (stagingExists) {
    throw new DoclingImportError(
      "DOCLING_STAGING_BUNDLE_EXISTS",
      "처리되지 않은 Staging Bundle이 있습니다.",
      409,
    );
  }

  await prisma.doclingUploadSession.update({
    where: { id: session.id },
    data: { status: DoclingUploadSessionStatus.COMPLETING },
  });

  const bundleId = session.bundleId ?? createPayloadId();
  const completedFiles: Array<{
    file: DoclingUploadFile;
    checksumSha256: string;
    etag: string | null;
    knowledgePackFileId: string;
  }> = [];

  try {
    for (const file of session.files) {
      if (!file.multipartUploadId) {
        throw new DoclingImportError(
          "DOCLING_UPLOAD_INCOMPLETE",
          "multipart upload가 없습니다.",
          400,
        );
      }

      const parts =
        input.partsByRole?.[file.role] ??
        (
          await storage.listUploadedParts({
            objectKey: file.objectKey,
            uploadId: file.multipartUploadId,
          })
        ).parts.map((p) => ({ partNumber: p.partNumber, etag: p.etag }));

      if (parts.length === 0) {
        throw new DoclingImportError(
          "DOCLING_UPLOAD_INCOMPLETE",
          `${file.role} 파트가 업로드되지 않았습니다.`,
          400,
        );
      }

      const completed = await storage.completeMultipartUpload({
        objectKey: file.objectKey,
        uploadId: file.multipartUploadId,
        parts,
      });

      const head = await storage.headObject({ objectKey: file.objectKey });
      if (!head.exists || head.contentLength == null) {
        throw new DoclingImportError(
          "DOCLING_OBJECT_MISSING",
          "업로드된 객체를 찾을 수 없습니다.",
          502,
        );
      }
      const declared = Number(file.declaredFileSize);
      if (head.contentLength !== declared) {
        throw new DoclingImportError(
          "DOCLING_OBJECT_SIZE_MISMATCH",
          `객체 크기(${head.contentLength})가 선언 크기(${declared})와 일치하지 않습니다.`,
          400,
        );
      }

      const stream = await storage.getObjectStream({ objectKey: file.objectKey });
      const checksumSha256 = await sha256HexFromStream(stream.body);

      const knowledgePackFileId = createPayloadId();
      completedFiles.push({
        file,
        checksumSha256,
        etag: completed.etag ?? head.etag ?? null,
        knowledgePackFileId,
      });

      await prisma.doclingUploadFile.update({
        where: { id: file.id },
        data: {
          status: DoclingUploadFileStatus.COMPLETED,
          checksumSha256,
          etag: completed.etag ?? head.etag ?? null,
          knowledgePackFileId,
          multipartUploadId: null,
        },
      });
    }
  } catch (error) {
    await prisma.doclingUploadSession.update({
      where: { id: session.id },
      data: {
        status: DoclingUploadSessionStatus.FAILED,
        lastErrorCode: isDoclingImportError(error) ? error.code : "DOCLING_COMPLETE_FAILED",
        lastErrorMessage: error instanceof Error ? error.message.slice(0, 500) : "complete failed",
      },
    });
    if (isDoclingImportError(error)) throw error;
    throw new DoclingImportError(
      "DOCLING_COMPLETE_FAILED",
      "업로드 완료 처리에 실패했습니다.",
      502,
    );
  }

  const jobId = createPayloadId();

  await prisma.$transaction(async (tx) => {
    await tx.doclingImportBundle.create({
      data: {
        id: bundleId,
        packId: pack.packId,
        versionId: version.id,
        status: DoclingImportBundleStatus.UPLOADED,
        isActive: false,
        adapterType: DOCLING_ADAPTER_TYPE,
        adapterVersion: DOCLING_ADAPTER_VERSION,
        storageStatus: DoclingBundleStorageStatus.ACTIVE,
        stagingReason: "multipart_upload_staging",
        uploadedByUserId: input.userId,
        files: {
          create: completedFiles.map((c) => ({
            id: c.knowledgePackFileId,
            packId: pack.packId,
            versionId: version.id,
            role: c.file.role,
            storageKey: c.file.objectKey,
            originalFileName: c.file.originalFileName,
            mimeType: c.file.mimeType,
            fileExtension: c.file.fileExtension,
            fileSize: c.file.declaredFileSize,
            checksumSha256: c.checksumSha256,
            isImmutable: true,
            uploadedByUserId: input.userId,
          })),
        },
        processingLogs: {
          create: {
            stage: DoclingProcessingStage.UPLOAD,
            status: DoclingProcessingStatus.SUCCEEDED,
            attempt: 1,
            adapterVersion: DOCLING_ADAPTER_VERSION,
            message: "Multipart Docling upload completed; processing queued",
            completedAt: new Date(),
          },
        },
      },
    });

    await tx.doclingProcessingJob.create({
      data: {
        id: jobId,
        bundleId,
        packId: pack.packId,
        versionId: version.id,
        sessionId: session.id,
        status: DoclingProcessingJobStatus.PENDING,
      },
    });

    await tx.doclingUploadSession.update({
      where: { id: session.id },
      data: {
        status: DoclingUploadSessionStatus.COMPLETED,
        completedAt: new Date(),
        bundleId,
        processingJobId: jobId,
      },
    });
  });

  const refreshed = await loadSession(session.id);
  if (!refreshed) {
    throw new DoclingImportError("NOT_FOUND", "업로드 세션을 찾을 수 없습니다.", 404);
  }

  return {
    session: toUploadSessionPublicDto(refreshed),
    bundleId,
    processingJobId: jobId,
    accepted: true,
  };
}

export async function abortDoclingUploadSession(input: {
  userId: string;
  clientId: string;
  packId: string;
  sessionId: string;
  storage?: ObjectStorageBackend;
}): Promise<{ session: UploadSessionPublicDto }> {
  const storage = input.storage ?? getConfiguredObjectStorage();
  const { pack } = await requireOwnedDraftPack({
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });
  const session = await loadSession(input.sessionId);
  if (!session || session.packId !== pack.packId) {
    throw new DoclingImportError("NOT_FOUND", "업로드 세션을 찾을 수 없습니다.", 404);
  }

  if (
    session.status === DoclingUploadSessionStatus.COMPLETED ||
    session.status === DoclingUploadSessionStatus.ABORTED
  ) {
    return { session: toUploadSessionPublicDto(session) };
  }

  for (const file of session.files) {
    if (file.multipartUploadId) {
      try {
        await storage.abortMultipartUpload({
          objectKey: file.objectKey,
          uploadId: file.multipartUploadId,
        });
      } catch {
        // best-effort
      }
    }
    try {
      await storage.deleteObject({ objectKey: file.objectKey });
    } catch {
      // may not exist yet
    }
    await prisma.doclingUploadFile.update({
      where: { id: file.id },
      data: {
        status: DoclingUploadFileStatus.ABORTED,
        multipartUploadId: null,
      },
    });
  }

  const updated = await prisma.doclingUploadSession.update({
    where: { id: session.id },
    data: {
      status: DoclingUploadSessionStatus.ABORTED,
      abortedAt: new Date(),
    },
    include: { files: true },
  });

  return { session: toUploadSessionPublicDto(updated) };
}
