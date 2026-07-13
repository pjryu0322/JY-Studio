import {
  AuditAction,
  DoclingImportBundleStatus,
  DoclingProcessingStage,
  DoclingProcessingStatus,
  KnowledgePackFileRole,
  PackStatus,
  type DoclingImportBundle,
  type DoclingProcessingLog,
  type KnowledgePackFile,
  type NormalizedDocument,
  type Prisma,
} from "@prisma/client";
import { doclingAdapter } from "@/lib/adapters/docling/docling-adapter";
import { DOCLING_ADAPTER_TYPE } from "@/lib/adapters/docling/docling-types";
import { createPayloadId } from "@/lib/distribution/distribution-manifest-service";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { sha256Hex } from "@/lib/distribution/payload-checksum";
import { enqueuePayloadCleanupJob } from "@/lib/distribution/payload-cleanup-service";
import type { PayloadStorage } from "@/lib/distribution/payload-storage";
import { buildPackFileObjectKey } from "@/lib/distribution/payload-storage-config";
import { getConfiguredPayloadStorage } from "@/lib/distribution/payload-storage-factory";
import {
  buildPackCapabilitiesDto,
  type DoclingImportBundlePublicDto,
  type DoclingProcessingLogPublicDto,
  type KnowledgePackFilePublicDto,
  type NormalizedDocumentSummaryDto,
  type PackCapabilitiesDto,
} from "@/lib/docling-import/docling-import-dto";
import { DoclingImportError } from "@/lib/docling-import/docling-import-errors";
import { assertRoleFileAcceptable } from "@/lib/docling-import/docling-import-file-guards";
import {
  assertTransition,
  canRetry,
} from "@/lib/docling-import/docling-import-state";
import {
  parseReviewSubmitSnapshot,
} from "@/lib/distribution/distribution-submit-snapshot";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { recordProviderAudit } from "@/lib/provider-audit";
import { prisma } from "@/lib/prisma";

type UploadFileInput = {
  fileName: string;
  mimeType: string | null;
  bytes: Uint8Array;
};

type BundleWithRelations = DoclingImportBundle & {
  files: KnowledgePackFile[];
  normalizedDocuments: NormalizedDocument[];
  processingLogs: DoclingProcessingLog[];
};

function getDefaultStorage(): PayloadStorage {
  return getConfiguredPayloadStorage();
}

function storagePrefix(storage: PayloadStorage): string {
  const withPrefix = storage as PayloadStorage & { prefix?: string };
  return typeof withPrefix.prefix === "string" && withPrefix.prefix.trim()
    ? withPrefix.prefix.trim()
    : "payloads";
}

function toFileDto(file: KnowledgePackFile): KnowledgePackFilePublicDto {
  return {
    id: file.id,
    bundleId: file.bundleId,
    packId: file.packId,
    versionId: file.versionId,
    role: file.role,
    originalFileName: file.originalFileName,
    mimeType: file.mimeType,
    fileExtension: file.fileExtension,
    fileSize: Number(file.fileSize),
    checksumSha256: file.checksumSha256,
    uploadedAt: file.uploadedAt.toISOString(),
  };
}

function toNormalizedSummaryDto(
  doc: NormalizedDocument,
): NormalizedDocumentSummaryDto {
  const warnings = Array.isArray(doc.warningsJson) ? doc.warningsJson : [];
  return {
    id: doc.id,
    bundleId: doc.bundleId,
    packId: doc.packId,
    versionId: doc.versionId,
    isActive: doc.isActive,
    adapterType: doc.adapterType,
    adapterVersion: doc.adapterVersion,
    sourceSchemaName: doc.sourceSchemaName,
    sourceSchemaVersion: doc.sourceSchemaVersion,
    title: doc.title,
    language: doc.language,
    fingerprint: doc.fingerprint,
    warningCount: warnings.length,
    sourceFileId: doc.sourceFileId,
    jsonPayloadFileId: doc.jsonPayloadFileId,
    markdownPayloadFileId: doc.markdownPayloadFileId,
    sourcePayloadChecksum: doc.sourcePayloadChecksum,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function toProcessingLogDto(log: DoclingProcessingLog): DoclingProcessingLogPublicDto {
  return {
    id: log.id,
    stage: log.stage,
    status: log.status,
    attempt: log.attempt,
    adapterVersion: log.adapterVersion,
    message: log.message,
    errorCode: log.errorCode,
    startedAt: log.startedAt.toISOString(),
    completedAt: log.completedAt?.toISOString() ?? null,
    createdAt: log.createdAt.toISOString(),
  };
}

export function toDoclingImportBundlePublicDto(
  bundle: BundleWithRelations,
  options?: { canDelete?: boolean },
): DoclingImportBundlePublicDto {
  const activeNd =
    bundle.normalizedDocuments.find((d) => d.isActive) ??
    bundle.normalizedDocuments[0] ??
    null;
  return {
    id: bundle.id,
    packId: bundle.packId,
    versionId: bundle.versionId,
    status: bundle.status,
    isActive: bundle.isActive,
    adapterType: bundle.adapterType,
    adapterVersion: bundle.adapterVersion,
    doclingSchemaName: bundle.doclingSchemaName,
    doclingSchemaVersion: bundle.doclingSchemaVersion,
    validationReport: bundle.validationReport,
    normalizationReport: bundle.normalizationReport,
    warningCount: bundle.warningCount,
    errorCount: bundle.errorCount,
    lastErrorCode: bundle.lastErrorCode,
    lastErrorMessage: bundle.lastErrorMessage,
    validatedAt: bundle.validatedAt?.toISOString() ?? null,
    normalizedAt: bundle.normalizedAt?.toISOString() ?? null,
    reviewReadyAt: bundle.reviewReadyAt?.toISOString() ?? null,
    createdAt: bundle.createdAt.toISOString(),
    updatedAt: bundle.updatedAt.toISOString(),
    canDelete: options?.canDelete ?? false,
    canRetry: canRetry(bundle.status),
    files: bundle.files.map(toFileDto),
    processingLogs: (bundle.processingLogs ?? []).map(toProcessingLogDto),
    normalizedDocument: activeNd ? toNormalizedSummaryDto(activeNd) : null,
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

export async function bundleHasSubmissionHistory(
  packId: string,
  bundleId: string,
  versionId: string,
): Promise<boolean> {
  const reviews = await prisma.packReview.findMany({
    where: { packId },
    select: { submitSnapshot: true },
  });
  for (const review of reviews) {
    const snap = parseReviewSubmitSnapshot(review.submitSnapshot);
    if (!snap) continue;
    if (snap.mode === "DOCLING_BUNDLE") {
      if (snap.doclingBundleId === bundleId) return true;
      if (snap.submittedVersionId === versionId && snap.doclingBundleId) return true;
    }
  }
  return false;
}

const bundleInclude = {
  files: { orderBy: { role: "asc" as const } },
  normalizedDocuments: { orderBy: { createdAt: "desc" as const } },
  processingLogs: { orderBy: { createdAt: "asc" as const } },
};

async function loadBundleWithRelations(bundleId: string): Promise<BundleWithRelations | null> {
  return prisma.doclingImportBundle.findUnique({
    where: { id: bundleId },
    include: bundleInclude,
  });
}

async function findActiveBundleForVersion(versionId: string): Promise<BundleWithRelations | null> {
  return prisma.doclingImportBundle.findFirst({
    where: { versionId, isActive: true },
    include: bundleInclude,
  });
}

async function cleanupUploadedKeys(
  keys: string[],
  reason: string,
  storage: PayloadStorage,
): Promise<void> {
  for (const objectKey of keys) {
    try {
      await storage.delete({ objectKey });
    } catch {
      await enqueuePayloadCleanupJob({
        objectKey,
        reason,
        lastError: "immediate delete failed",
      });
    }
  }
}

function computeFingerprint(parts: string[]): string {
  return sha256Hex(new TextEncoder().encode(parts.join("|")));
}

async function softLockBundleStatus(input: {
  bundleId: string;
  from: DoclingImportBundleStatus[];
  to: DoclingImportBundleStatus;
}): Promise<void> {
  for (const from of input.from) {
    assertTransition(from, input.to);
  }
  const updated = await prisma.doclingImportBundle.updateMany({
    where: { id: input.bundleId, status: { in: input.from } },
    data: { status: input.to },
  });
  if (updated.count === 0) {
    throw new DoclingImportError(
      "DOCLING_CONFLICT",
      "다른 처리가 진행 중이거나 상태 전환이 충돌했습니다.",
      409,
    );
  }
}

export async function uploadDoclingImportBundle(input: {
  userId: string;
  clientId: string;
  packId: string;
  source: UploadFileInput;
  json: UploadFileInput;
  markdown: UploadFileInput;
  adapterVersion?: string | null;
  storage?: PayloadStorage;
}): Promise<{ bundle: DoclingImportBundlePublicDto }> {
  const { pack, version } = await requireOwnedDraftPack({
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });

  const existingActive = await findActiveBundleForVersion(version.id);
  if (existingActive) {
    const hasHistory = await bundleHasSubmissionHistory(
      pack.packId,
      existingActive.id,
      version.id,
    );
    if (hasHistory) {
      throw new DoclingImportError(
        "DOCLING_IMMUTABLE_AFTER_SUBMISSION",
        "이미 검수 제출된 Docling import는 교체할 수 없습니다.",
        409,
      );
    }
  }

  const sourceMeta = assertRoleFileAcceptable(
    KnowledgePackFileRole.SOURCE_ORIGINAL,
    input.source.fileName,
    input.source.mimeType,
    input.source.bytes,
  );
  const jsonMeta = assertRoleFileAcceptable(
    KnowledgePackFileRole.DOCLING_JSON,
    input.json.fileName,
    input.json.mimeType,
    input.json.bytes,
  );
  const mdMeta = assertRoleFileAcceptable(
    KnowledgePackFileRole.DOCLING_MARKDOWN,
    input.markdown.fileName,
    input.markdown.mimeType,
    input.markdown.bytes,
  );

  const storage = input.storage ?? getDefaultStorage();
  const prefix = storagePrefix(storage);
  const bundleId = createPayloadId();
  const sourceFileId = createPayloadId();
  const jsonFileId = createPayloadId();
  const markdownFileId = createPayloadId();
  const adapterVersion = input.adapterVersion?.trim() || doclingAdapter.version;

  const sourceChecksum = sha256Hex(input.source.bytes);
  const jsonChecksum = sha256Hex(input.json.bytes);
  const mdChecksum = sha256Hex(input.markdown.bytes);

  const fileSpecs = [
    {
      id: sourceFileId,
      role: KnowledgePackFileRole.SOURCE_ORIGINAL,
      meta: sourceMeta,
      bytes: input.source.bytes,
      checksum: sourceChecksum,
    },
    {
      id: jsonFileId,
      role: KnowledgePackFileRole.DOCLING_JSON,
      meta: jsonMeta,
      bytes: input.json.bytes,
      checksum: jsonChecksum,
    },
    {
      id: markdownFileId,
      role: KnowledgePackFileRole.DOCLING_MARKDOWN,
      meta: mdMeta,
      bytes: input.markdown.bytes,
      checksum: mdChecksum,
    },
  ] as const;

  const uploadedKeys: string[] = [];
  const stored: { id: string; role: KnowledgePackFileRole; objectKey: string; checksum: string; meta: typeof sourceMeta; size: number }[] = [];

  try {
    for (const spec of fileSpecs) {
      const objectKey = buildPackFileObjectKey({
        prefix,
        packId: pack.packId,
        versionId: version.id,
        bundleId,
        fileId: spec.id,
        role: spec.role,
        extension: spec.meta.extension,
      });
      await storage.put({
        packId: pack.packId,
        versionId: version.id,
        payloadId: spec.id,
        originalFileName: spec.meta.fileName,
        mimeType: spec.meta.mimeType,
        bytes: spec.bytes,
        checksumSha256: spec.checksum,
        objectKey,
      });
      uploadedKeys.push(objectKey);
      stored.push({
        id: spec.id,
        role: spec.role,
        objectKey,
        checksum: spec.checksum,
        meta: spec.meta,
        size: spec.bytes.byteLength,
      });
    }
  } catch {
    await cleanupUploadedKeys(uploadedKeys, "docling_upload_partial_failure", storage);
    throw new DoclingImportError(
      "DOCLING_STORAGE_UNAVAILABLE",
      "Object Storage 업로드에 실패했습니다.",
      503,
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.doclingImportBundle.updateMany({
        where: { versionId: version.id, isActive: true },
        data: { isActive: false },
      });

      await tx.doclingImportBundle.create({
        data: {
          id: bundleId,
          packId: pack.packId,
          versionId: version.id,
          status: DoclingImportBundleStatus.UPLOADED,
          isActive: true,
          adapterType: DOCLING_ADAPTER_TYPE,
          adapterVersion,
          uploadedByUserId: input.userId,
          files: {
            create: stored.map((s) => ({
              id: s.id,
              packId: pack.packId,
              versionId: version.id,
              role: s.role,
              storageKey: s.objectKey,
              originalFileName: s.meta.fileName,
              mimeType: s.meta.mimeType,
              fileExtension: s.meta.extension,
              fileSize: BigInt(s.size),
              checksumSha256: s.checksum,
              isImmutable: true,
              uploadedByUserId: input.userId,
            })),
          },
          processingLogs: {
            create: {
              stage: DoclingProcessingStage.UPLOAD,
              status: DoclingProcessingStatus.SUCCEEDED,
              attempt: 1,
              adapterVersion,
              message: "Three-file Docling import uploaded",
              completedAt: new Date(),
            },
          },
        },
      });
    });
  } catch (error) {
    await cleanupUploadedKeys(uploadedKeys, "docling_upload_db_failure", storage);
    throw error;
  }

  await recordProviderAudit({
    action: AuditAction.DOCLING_IMPORT_UPLOADED,
    entityType: "DoclingImportBundle",
    entityId: bundleId,
    actorUserId: input.userId,
    metadata: {
      packId: pack.packId,
      versionId: version.id,
      bundleId,
      adapterVersion,
      sourceFileId,
      jsonFileId,
      markdownFileId,
    },
  });

  await validateAndNormalizeBundle(bundleId, { storage });

  const refreshed = await loadBundleWithRelations(bundleId);
  if (!refreshed) {
    throw new DoclingImportError("NOT_FOUND", "업로드된 Docling import를 찾을 수 없습니다.", 404);
  }

  const hasHistory = await bundleHasSubmissionHistory(pack.packId, refreshed.id, version.id);
  return {
    bundle: toDoclingImportBundlePublicDto(refreshed, {
      canDelete: pack.status === PackStatus.DRAFT && !hasHistory,
    }),
  };
}

export async function validateAndNormalizeBundle(
  bundleId: string,
  options?: { attempt?: number; storage?: PayloadStorage },
): Promise<DoclingImportBundlePublicDto> {
  const storage = options?.storage ?? getDefaultStorage();
  const attempt = options?.attempt ?? 1;

  const bundle = await loadBundleWithRelations(bundleId);
  if (!bundle) {
    throw new DoclingImportError("NOT_FOUND", "Docling import를 찾을 수 없습니다.", 404);
  }

  await softLockBundleStatus({
    bundleId,
    from: [
      DoclingImportBundleStatus.UPLOADED,
      DoclingImportBundleStatus.VALIDATION_FAILED,
      DoclingImportBundleStatus.NORMALIZATION_FAILED,
      DoclingImportBundleStatus.NORMALIZED,
    ],
    to: DoclingImportBundleStatus.VALIDATING,
  });

  await prisma.doclingProcessingLog.create({
    data: {
      bundleId,
      stage: DoclingProcessingStage.VALIDATION,
      status: DoclingProcessingStatus.STARTED,
      attempt,
      adapterVersion: bundle.adapterVersion,
      message: "Validation started",
    },
  });

  const byRole = new Map(bundle.files.map((f) => [f.role, f]));
  const sourceFile = byRole.get(KnowledgePackFileRole.SOURCE_ORIGINAL);
  const jsonFile = byRole.get(KnowledgePackFileRole.DOCLING_JSON);
  const mdFile = byRole.get(KnowledgePackFileRole.DOCLING_MARKDOWN);
  if (!sourceFile || !jsonFile || !mdFile) {
    throw new DoclingImportError(
      "DOCLING_INCOMPLETE_FILES",
      "Docling import에 필요한 3개 파일이 없습니다.",
      400,
    );
  }

  const readVerified = async (file: KnowledgePackFile) => {
    const got = await storage.get({ objectKey: file.storageKey });
    const actual = sha256Hex(got.bytes);
    if (actual !== file.checksumSha256) {
      throw new DoclingImportError(
        "DOCLING_OBJECT_INTEGRITY_FAILED",
        "파일 무결성 검증에 실패했습니다.",
        503,
      );
    }
    return got.bytes;
  };

  let jsonBytes: Uint8Array;
  let mdBytes: Uint8Array;
  try {
    await readVerified(sourceFile);
    jsonBytes = await readVerified(jsonFile);
    mdBytes = await readVerified(mdFile);
  } catch (error) {
    if (isSoftLockConflict(error)) throw error;
    const message = error instanceof Error ? error.message : "storage read failed";
    await markValidationFailed(bundleId, attempt, {
      code: "DOCLING_STORAGE_UNAVAILABLE",
      message: "저장소에서 파일을 읽지 못했습니다.",
      details: { message },
    });
    throw error instanceof DoclingImportError
      ? error
      : new DoclingImportError("DOCLING_STORAGE_UNAVAILABLE", "저장소에서 파일을 읽지 못했습니다.", 503);
  }

  const validation = await doclingAdapter.validate({
    json: jsonBytes,
    markdown: mdBytes,
    source: {
      filename: sourceFile.originalFileName,
      mimetype: sourceFile.mimeType,
      fileId: sourceFile.id,
    },
    files: {
      packId: bundle.packId,
      packVersionId: bundle.versionId,
      sourceFileId: sourceFile.id,
      jsonPayloadFileId: jsonFile.id,
      markdownPayloadFileId: mdFile.id,
    },
  });

  const errorIssues = validation.issues.filter((i) => i.severity === "ERROR");
  const warningIssues = validation.issues.filter((i) => i.severity === "WARNING");
  const validationReport = {
    ok: validation.ok,
    issues: validation.issues,
    originMatch: validation.originMatch ?? null,
    validatedAt: new Date().toISOString(),
  };

  if (!validation.ok) {
    await softLockBundleStatus({
      bundleId,
      from: [DoclingImportBundleStatus.VALIDATING],
      to: DoclingImportBundleStatus.VALIDATION_FAILED,
    });
    await prisma.doclingImportBundle.update({
      where: { id: bundleId },
      data: {
        validationReport: validationReport as Prisma.InputJsonValue,
        warningCount: warningIssues.length,
        errorCount: errorIssues.length,
        lastErrorCode: errorIssues[0]?.code ?? "DOCLING_VALIDATION_FAILED",
        lastErrorMessage: errorIssues[0]?.message ?? "Docling 검증에 실패했습니다.",
        doclingSchemaName: validation.document?.schema_name ?? null,
        doclingSchemaVersion:
          typeof validation.document?.version === "string"
            ? validation.document.version
            : null,
      },
    });
    await prisma.doclingProcessingLog.create({
      data: {
        bundleId,
        stage: DoclingProcessingStage.VALIDATION,
        status: DoclingProcessingStatus.FAILED,
        attempt,
        adapterVersion: bundle.adapterVersion,
        message: "Validation failed",
        errorCode: errorIssues[0]?.code ?? "DOCLING_VALIDATION_FAILED",
        detailsJson: validationReport as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    const failed = await loadBundleWithRelations(bundleId);
    return toDoclingImportBundlePublicDto(failed!);
  }

  await softLockBundleStatus({
    bundleId,
    from: [DoclingImportBundleStatus.VALIDATING],
    to: DoclingImportBundleStatus.VALID,
  });
  await prisma.doclingImportBundle.update({
    where: { id: bundleId },
    data: {
      validationReport: validationReport as Prisma.InputJsonValue,
      warningCount: warningIssues.length,
      errorCount: 0,
      lastErrorCode: null,
      lastErrorMessage: null,
      validatedAt: new Date(),
      doclingSchemaName: validation.document?.schema_name ?? "DoclingDocument",
      doclingSchemaVersion:
        typeof validation.document?.version === "string"
          ? validation.document.version
          : null,
    },
  });
  await prisma.doclingProcessingLog.create({
    data: {
      bundleId,
      stage: DoclingProcessingStage.VALIDATION,
      status: DoclingProcessingStatus.SUCCEEDED,
      attempt,
      adapterVersion: bundle.adapterVersion,
      message: "Validation succeeded",
      detailsJson: validationReport as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });

  await recordProviderAudit({
    action: AuditAction.DOCLING_IMPORT_VALIDATED,
    entityType: "DoclingImportBundle",
    entityId: bundleId,
    actorUserId: bundle.uploadedByUserId,
    metadata: { bundleId, packId: bundle.packId, warningCount: warningIssues.length },
  });

  await softLockBundleStatus({
    bundleId,
    from: [DoclingImportBundleStatus.VALID],
    to: DoclingImportBundleStatus.NORMALIZING,
  });
  await prisma.doclingProcessingLog.create({
    data: {
      bundleId,
      stage: DoclingProcessingStage.NORMALIZATION,
      status: DoclingProcessingStatus.STARTED,
      attempt,
      adapterVersion: bundle.adapterVersion,
      message: "Normalization started",
    },
  });

  try {
    const draft = await doclingAdapter.normalize({
      json: jsonBytes,
      markdown: mdBytes,
      source: {
        filename: sourceFile.originalFileName,
        mimetype: sourceFile.mimeType,
        fileId: sourceFile.id,
      },
      files: {
        packId: bundle.packId,
        packVersionId: bundle.versionId,
        sourceFileId: sourceFile.id,
        jsonPayloadFileId: jsonFile.id,
        markdownPayloadFileId: mdFile.id,
      },
    });

    const fingerprint = computeFingerprint([
      sourceFile.checksumSha256,
      jsonFile.checksumSha256,
      mdFile.checksumSha256,
      draft.adapter.version,
      draft.adapter.sourceSchemaVersion,
      draft.title ?? "",
    ]);

    const ndId = createPayloadId();
    await prisma.$transaction(async (tx) => {
      await tx.normalizedDocument.updateMany({
        where: { bundleId, isActive: true },
        data: { isActive: false },
      });
      await tx.normalizedDocument.create({
        data: {
          id: ndId,
          bundleId,
          packId: bundle.packId,
          versionId: bundle.versionId,
          isActive: true,
          adapterType: draft.adapter.type,
          adapterVersion: draft.adapter.version,
          sourceSchemaName: draft.adapter.sourceSchema,
          sourceSchemaVersion: draft.adapter.sourceSchemaVersion,
          title: draft.title,
          language: draft.language,
          structureJson: {
            sections: draft.sections,
            tables: draft.tables,
            figures: draft.figures,
            readingOrder: draft.readingOrder,
          } as Prisma.InputJsonValue,
          sectionsJson: draft.sections as unknown as Prisma.InputJsonValue,
          tablesJson: draft.tables as unknown as Prisma.InputJsonValue,
          figuresJson: draft.figures as unknown as Prisma.InputJsonValue,
          readingOrderJson: draft.readingOrder as unknown as Prisma.InputJsonValue,
          warningsJson: draft.warnings as unknown as Prisma.InputJsonValue,
          sourceFileId: sourceFile.id,
          jsonPayloadFileId: jsonFile.id,
          markdownPayloadFileId: mdFile.id,
          sourcePayloadChecksum: sourceFile.checksumSha256,
          fingerprint,
        },
      });

      await softLockViaTx(tx, {
        bundleId,
        from: [DoclingImportBundleStatus.NORMALIZING],
        to: DoclingImportBundleStatus.NORMALIZED,
      });
      await softLockViaTx(tx, {
        bundleId,
        from: [DoclingImportBundleStatus.NORMALIZED],
        to: DoclingImportBundleStatus.REVIEW_READY,
      });

      await tx.doclingImportBundle.update({
        where: { id: bundleId },
        data: {
          normalizationReport: {
            ok: true,
            normalizedDocumentId: ndId,
            fingerprint,
            warningCount: draft.warnings.length,
            normalizedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
          warningCount: draft.warnings.length,
          errorCount: 0,
          lastErrorCode: null,
          lastErrorMessage: null,
          normalizedAt: new Date(),
          reviewReadyAt: new Date(),
        },
      });
    });

    await prisma.doclingProcessingLog.create({
      data: {
        bundleId,
        stage: DoclingProcessingStage.NORMALIZATION,
        status: DoclingProcessingStatus.SUCCEEDED,
        attempt,
        adapterVersion: bundle.adapterVersion,
        message: "Normalization succeeded",
        detailsJson: { normalizedDocumentId: ndId, fingerprint } as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });

    await recordProviderAudit({
      action: AuditAction.DOCLING_IMPORT_NORMALIZED,
      entityType: "DoclingImportBundle",
      entityId: bundleId,
      actorUserId: bundle.uploadedByUserId,
      metadata: {
        bundleId,
        packId: bundle.packId,
        normalizedDocumentId: ndId,
        fingerprint,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Normalization failed";
    await softLockBundleStatus({
      bundleId,
      from: [DoclingImportBundleStatus.NORMALIZING],
      to: DoclingImportBundleStatus.NORMALIZATION_FAILED,
    });
    await prisma.doclingImportBundle.update({
      where: { id: bundleId },
      data: {
        lastErrorCode: "DOCLING_NORMALIZATION_FAILED",
        lastErrorMessage: message.slice(0, 1000),
        errorCount: { increment: 1 },
        normalizationReport: {
          ok: false,
          message,
          failedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
    await prisma.doclingProcessingLog.create({
      data: {
        bundleId,
        stage: DoclingProcessingStage.NORMALIZATION,
        status: DoclingProcessingStatus.FAILED,
        attempt,
        adapterVersion: bundle.adapterVersion,
        message: "Normalization failed",
        errorCode: "DOCLING_NORMALIZATION_FAILED",
        detailsJson: { message } as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
  }

  const refreshed = await loadBundleWithRelations(bundleId);
  return toDoclingImportBundlePublicDto(refreshed!);
}

async function softLockViaTx(
  tx: Prisma.TransactionClient,
  input: {
    bundleId: string;
    from: DoclingImportBundleStatus[];
    to: DoclingImportBundleStatus;
  },
): Promise<void> {
  for (const from of input.from) {
    assertTransition(from, input.to);
  }
  const updated = await tx.doclingImportBundle.updateMany({
    where: { id: input.bundleId, status: { in: input.from } },
    data: { status: input.to },
  });
  if (updated.count === 0) {
    throw new DoclingImportError(
      "DOCLING_CONFLICT",
      "다른 처리가 진행 중이거나 상태 전환이 충돌했습니다.",
      409,
    );
  }
}

function isSoftLockConflict(error: unknown): boolean {
  return error instanceof DoclingImportError && error.code === "DOCLING_CONFLICT";
}

async function markValidationFailed(
  bundleId: string,
  attempt: number,
  info: { code: string; message: string; details?: unknown },
): Promise<void> {
  try {
    await softLockBundleStatus({
      bundleId,
      from: [DoclingImportBundleStatus.VALIDATING],
      to: DoclingImportBundleStatus.VALIDATION_FAILED,
    });
  } catch {
    // already transitioned
  }
  await prisma.doclingImportBundle.update({
    where: { id: bundleId },
    data: {
      lastErrorCode: info.code,
      lastErrorMessage: info.message,
      errorCount: { increment: 1 },
      validationReport: {
        ok: false,
        code: info.code,
        message: info.message,
        details: info.details ?? null,
      } as Prisma.InputJsonValue,
    },
  });
  await prisma.doclingProcessingLog.create({
    data: {
      bundleId,
      stage: DoclingProcessingStage.VALIDATION,
      status: DoclingProcessingStatus.FAILED,
      attempt,
      message: info.message,
      errorCode: info.code,
      detailsJson: (info.details ?? null) as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });
}

export async function getActiveDoclingImport(input: {
  userId: string;
  clientId: string;
  packId: string;
}): Promise<{ bundle: DoclingImportBundlePublicDto | null }> {
  const profile = await findOrEnsureProviderProfileForUser(input.userId, input.clientId);
  if (!profile) {
    throw new DoclingImportError("PROFILE_REQUIRED", "제공자 프로필이 필요합니다.", 403);
  }

  const pack = await prisma.knowledgePack.findFirst({
    where: { packId: input.packId, providerProfileId: profile.id },
    include: { versions: { orderBy: latestKnowledgePackVersionOrderBy, take: 1 } },
  });
  if (!pack) {
    throw new DoclingImportError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
  }
  const version = pack.versions[0];
  if (!version) return { bundle: null };

  const bundle = await findActiveBundleForVersion(version.id);
  if (!bundle) return { bundle: null };

  const hasHistory = await bundleHasSubmissionHistory(pack.packId, bundle.id, version.id);
  return {
    bundle: toDoclingImportBundlePublicDto(bundle, {
      canDelete: pack.status === PackStatus.DRAFT && !hasHistory,
    }),
  };
}

export async function getAdminDoclingImport(input: {
  packId: string;
}): Promise<{ bundle: DoclingImportBundlePublicDto | null }> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId: input.packId },
    include: { versions: { orderBy: latestKnowledgePackVersionOrderBy, take: 1 } },
  });
  if (!pack) {
    throw new DoclingImportError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
  }
  const version = pack.versions[0];
  if (!version) return { bundle: null };

  const bundle = await findActiveBundleForVersion(version.id);
  if (!bundle) return { bundle: null };
  return { bundle: toDoclingImportBundlePublicDto(bundle, { canDelete: false }) };
}

export async function deleteActiveDoclingImport(input: {
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

  const bundle = await findActiveBundleForVersion(version.id);
  if (!bundle) {
    throw new DoclingImportError("NOT_FOUND", "삭제할 Docling import가 없습니다.", 404);
  }

  const hasHistory = await bundleHasSubmissionHistory(pack.packId, bundle.id, version.id);
  if (hasHistory) {
    throw new DoclingImportError(
      "DOCLING_IMMUTABLE_AFTER_SUBMISSION",
      "검수 제출 이력이 있는 Docling import는 삭제할 수 없습니다.",
      409,
    );
  }

  const storage = input.storage ?? getDefaultStorage();
  const keys = bundle.files.map((f) => f.storageKey);

  await prisma.$transaction(async (tx) => {
    await tx.normalizedDocument.updateMany({
      where: { bundleId: bundle.id },
      data: { isActive: false },
    });
    await tx.doclingImportBundle.update({
      where: { id: bundle.id },
      data: { isActive: false },
    });
  });

  await cleanupUploadedKeys(keys, "docling_import_deleted", storage);

  await recordProviderAudit({
    action: AuditAction.DOCLING_IMPORT_DELETED,
    entityType: "DoclingImportBundle",
    entityId: bundle.id,
    actorUserId: input.userId,
    metadata: { packId: pack.packId, versionId: version.id, bundleId: bundle.id },
  });

  return { deleted: true };
}

export async function retryDoclingImport(input: {
  userId: string;
  clientId: string;
  packId: string;
  storage?: PayloadStorage;
}): Promise<{ bundle: DoclingImportBundlePublicDto }> {
  const { pack, version } = await requireOwnedDraftPack({
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });

  const bundle = await findActiveBundleForVersion(version.id);
  if (!bundle) {
    throw new DoclingImportError("NOT_FOUND", "재시도할 Docling import가 없습니다.", 404);
  }
  if (!canRetry(bundle.status)) {
    throw new DoclingImportError(
      "DOCLING_RETRY_NOT_ALLOWED",
      "현재 상태에서는 재시도할 수 없습니다.",
      409,
    );
  }

  const lastLog = await prisma.doclingProcessingLog.findFirst({
    where: { bundleId: bundle.id },
    orderBy: { createdAt: "desc" },
  });
  const attempt = (lastLog?.attempt ?? 1) + 1;

  await prisma.doclingProcessingLog.create({
    data: {
      bundleId: bundle.id,
      stage: DoclingProcessingStage.RETRY,
      status: DoclingProcessingStatus.STARTED,
      attempt,
      adapterVersion: bundle.adapterVersion,
      message: `Retry from ${bundle.status}`,
    },
  });

  await recordProviderAudit({
    action: AuditAction.DOCLING_IMPORT_RETRIED,
    entityType: "DoclingImportBundle",
    entityId: bundle.id,
    actorUserId: input.userId,
    metadata: {
      packId: pack.packId,
      versionId: version.id,
      bundleId: bundle.id,
      fromStatus: bundle.status,
      attempt,
    },
  });

  const result = await validateAndNormalizeBundle(bundle.id, {
    attempt,
    storage: input.storage,
  });
  return { bundle: result };
}

export async function downloadDoclingImportFile(input: {
  packId: string;
  fileId: string;
  userId?: string;
  clientId?: string;
  asAdmin?: boolean;
  storage?: PayloadStorage;
}): Promise<{
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
  checksumSha256: string;
}> {
  if (!input.asAdmin) {
    if (!input.userId || !input.clientId) {
      throw new DoclingImportError("PROVIDER_AUTH_REQUIRED", "인증이 필요합니다.", 401);
    }
    const profile = await findOrEnsureProviderProfileForUser(input.userId, input.clientId);
    if (!profile) {
      throw new DoclingImportError("PROFILE_REQUIRED", "제공자 프로필이 필요합니다.", 403);
    }
    const pack = await prisma.knowledgePack.findFirst({
      where: { packId: input.packId, providerProfileId: profile.id },
    });
    if (!pack) {
      throw new DoclingImportError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
    }
  } else {
    const pack = await prisma.knowledgePack.findUnique({ where: { packId: input.packId } });
    if (!pack) {
      throw new DoclingImportError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
    }
  }

  const file = await prisma.knowledgePackFile.findFirst({
    where: { id: input.fileId, packId: input.packId },
  });
  if (!file) {
    throw new DoclingImportError("NOT_FOUND", "파일을 찾을 수 없습니다.", 404);
  }

  const storage = input.storage ?? getDefaultStorage();
  const got = await storage.get({ objectKey: file.storageKey });
  const actual = sha256Hex(got.bytes);
  if (actual !== file.checksumSha256) {
    throw new DoclingImportError(
      "DOCLING_OBJECT_INTEGRITY_FAILED",
      "파일 무결성 검증에 실패했습니다.",
      503,
    );
  }

  return {
    bytes: got.bytes,
    mimeType: file.mimeType,
    fileName: file.originalFileName,
    checksumSha256: actual,
  };
}

export async function getNormalizedDocumentForPack(input: {
  packId: string;
  userId?: string;
  clientId?: string;
  asAdmin?: boolean;
}): Promise<{
  document: NormalizedDocumentSummaryDto | null;
  structure?: unknown;
  capabilities: PackCapabilitiesDto;
}> {
  const emptyCapabilities = buildPackCapabilitiesDto({ hasNormalizedDocument: false });

  if (!input.asAdmin) {
    if (!input.userId || !input.clientId) {
      throw new DoclingImportError("PROVIDER_AUTH_REQUIRED", "인증이 필요합니다.", 401);
    }
    const profile = await findOrEnsureProviderProfileForUser(input.userId, input.clientId);
    if (!profile) {
      throw new DoclingImportError("PROFILE_REQUIRED", "제공자 프로필이 필요합니다.", 403);
    }
    const pack = await prisma.knowledgePack.findFirst({
      where: { packId: input.packId, providerProfileId: profile.id },
    });
    if (!pack) {
      throw new DoclingImportError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
    }
  } else {
    const pack = await prisma.knowledgePack.findUnique({ where: { packId: input.packId } });
    if (!pack) {
      throw new DoclingImportError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
    }
  }

  const packVersions = await prisma.knowledgePackVersion.findMany({
    where: { packId: input.packId },
    orderBy: latestKnowledgePackVersionOrderBy,
    take: 1,
  });
  const version = packVersions[0];
  if (!version) return { document: null, capabilities: emptyCapabilities };

  const bundle = await findActiveBundleForVersion(version.id);
  if (!bundle) return { document: null, capabilities: emptyCapabilities };

  const activeNd =
    bundle.normalizedDocuments.find((d) => d.isActive) ?? null;
  if (!activeNd) {
    return { document: null, capabilities: emptyCapabilities };
  }

  return {
    document: toNormalizedSummaryDto(activeNd),
    structure: {
      sections: activeNd.sectionsJson,
      tables: activeNd.tablesJson,
      figures: activeNd.figuresJson,
      readingOrder: activeNd.readingOrderJson,
      warnings: activeNd.warningsJson,
    },
    capabilities: buildPackCapabilitiesDto({ hasNormalizedDocument: true }),
  };
}
