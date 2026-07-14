import {
  AuditAction,
  DoclingBundleStorageStatus,
  DoclingImportBundleStatus,
  DoclingProcessingStage,
  DoclingProcessingStatus,
  KnowledgePackFileRole,
  PackStatus,
  type DoclingProcessingLog,
  type KnowledgePackFile,
  type NormalizedDocument,
  type Prisma,
} from "@prisma/client";
import {
  DOCLING_ADAPTER_TYPE,
  DOCLING_ADAPTER_VERSION,
  type AdapterValidationResult,
} from "@/lib/adapters/docling/docling-types";
import { normalizeDoclingDocument } from "@/lib/adapters/docling/docling-normalizer";
import { createPayloadId } from "@/lib/distribution/distribution-manifest-service";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { sha256Hex } from "@/lib/distribution/payload-checksum";
import type { PayloadStorage } from "@/lib/distribution/payload-storage";
import { buildPackFileObjectKey } from "@/lib/distribution/payload-storage-config";
import { getConfiguredPayloadStorage } from "@/lib/distribution/payload-storage-factory";
import {
  DOCLING_MARKDOWN_PREVIEW_MAX_BYTES,
  loadAndValidateDoclingBundlePayloads,
} from "@/lib/docling-import/docling-bundle-stream-loader";
import type { ObjectStorageBackend } from "@/lib/object-storage/object-storage";
import {
  buildPackCapabilitiesDto,
  type DoclingImportBundlePublicDto,
  type DoclingProcessingLogPublicDto,
  type KnowledgePackFilePublicDto,
  type NormalizedDocumentSummaryDto,
  type PackCapabilitiesDto,
} from "@/lib/docling-import/docling-import-dto";
import { DoclingImportError, isDoclingImportError } from "@/lib/docling-import/docling-import-errors";
import { assertRoleFileAcceptable } from "@/lib/docling-import/docling-import-file-guards";
import {
  cleanupUploadedKeys,
  finalizePreviousBundleStorage,
  findLatestStagingBundleForVersion,
  markBundleDeletePendingAndCleanup,
  preserveFailedStagingBundle,
  promoteDoclingStagingBundle,
  type BundleWithRelations as LifecycleBundle,
} from "@/lib/docling-import/docling-import-lifecycle-service";
import { bundleHasSubmissionHistory } from "@/lib/docling-import/docling-import-submission";
import {
  computeNormalizedDocumentFingerprint,
  NORMALIZED_DOCUMENT_FINGERPRINT_VERSION,
} from "@/lib/docling-import/normalized-document-fingerprint";
import {
  assertTransition,
  resolveDoclingRetryMode,
} from "@/lib/docling-import/docling-import-state";
import { DOCLING_MARKDOWN_VALIDATOR_VERSION } from "@/lib/adapters/docling/docling-markdown-validator";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { recordProviderAudit } from "@/lib/provider-audit";
import { prisma } from "@/lib/prisma";

export { bundleHasSubmissionHistory } from "@/lib/docling-import/docling-import-submission";
export {
  markBundleDeletePendingAndCleanup,
  syncDoclingBundleStorageAfterCleanup,
  finalizePreviousBundleStorage,
  promoteDoclingStagingBundle,
  preserveFailedStagingBundle,
} from "@/lib/docling-import/docling-import-lifecycle-service";

type UploadFileInput = {
  fileName: string;
  mimeType: string | null;
  bytes: Uint8Array;
};

type BundleWithRelations = LifecycleBundle & {
  processingLogs: DoclingProcessingLog[];
};

function getDefaultStorage(): PayloadStorage {
  return getConfiguredPayloadStorage();
}

function asObjectStorage(storage: PayloadStorage): ObjectStorageBackend | null {
  const candidate = storage as PayloadStorage & Partial<ObjectStorageBackend>;
  if (typeof candidate.getObjectStream === "function") {
    return candidate as ObjectStorageBackend;
  }
  return null;
}

export { DOCLING_MARKDOWN_PREVIEW_MAX_BYTES };

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
    languageSource: doc.languageSource,
    languageConfidence: doc.languageConfidence,
    fingerprint: doc.fingerprint,
    fingerprintVersion: doc.fingerprintVersion,
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
  options?: { canDelete?: boolean; immutableAfterSubmission?: boolean },
): DoclingImportBundlePublicDto {
  const activeNd =
    bundle.normalizedDocuments.find((d) => d.isActive) ??
    bundle.normalizedDocuments[0] ??
    null;
  const immutableAfterSubmission = options?.immutableAfterSubmission ?? false;
  const retryMode = resolveDoclingRetryMode(bundle.status, bundle.lastErrorCode, {
    immutable: immutableAfterSubmission,
    deleted: bundle.deletedAt != null,
    storageActive: bundle.storageStatus === "ACTIVE",
  });
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
    deactivatedAt: bundle.deactivatedAt?.toISOString() ?? null,
    storageStatus: bundle.storageStatus,
    stagingReason: bundle.stagingReason ?? null,
    expiresAt: bundle.expiresAt?.toISOString() ?? null,
    createdAt: bundle.createdAt.toISOString(),
    updatedAt: bundle.updatedAt.toISOString(),
    canDelete: (options?.canDelete ?? false) && !immutableAfterSubmission,
    canRetry: retryMode !== "NOT_ALLOWED",
    retryMode,
    immutableAfterSubmission,
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

  const sourceMeta = await assertRoleFileAcceptable(
    KnowledgePackFileRole.SOURCE_ORIGINAL,
    input.source.fileName,
    input.source.mimeType,
    input.source.bytes,
  );
  const jsonMeta = await assertRoleFileAcceptable(
    KnowledgePackFileRole.DOCLING_JSON,
    input.json.fileName,
    input.json.mimeType,
    input.json.bytes,
  );
  const mdMeta = await assertRoleFileAcceptable(
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
  const adapterVersion = DOCLING_ADAPTER_VERSION;

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
  const stored: {
    id: string;
    role: KnowledgePackFileRole;
    objectKey: string;
    checksum: string;
    meta: typeof sourceMeta;
    size: number;
  }[] = [];

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
      "Object Storage(MinIO) 업로드에 실패했습니다. 로컬 MinIO(127.0.0.1:9000)가 실행 중인지 확인하세요.",
      503,
    );
  }

  // Create inactive staging bundle first — never deactivate previous until REVIEW_READY.
  try {
    await prisma.doclingImportBundle.create({
      data: {
        id: bundleId,
        packId: pack.packId,
        versionId: version.id,
        status: DoclingImportBundleStatus.UPLOADED,
        isActive: false,
        adapterType: DOCLING_ADAPTER_TYPE,
        adapterVersion,
        storageStatus: DoclingBundleStorageStatus.ACTIVE,
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

  const processed = await validateAndNormalizeBundle(bundleId, { storage });

  if (processed.status !== DoclingImportBundleStatus.REVIEW_READY) {
    // Preserve failed staging objects for retry/download — do not cleanup.
    await preserveFailedStagingBundle(bundleId, "validation_or_normalization_failed");
    throw new DoclingImportError(
      processed.lastErrorCode ?? "DOCLING_VALIDATION_FAILED",
      processed.lastErrorMessage ??
        "Docling import 검증·정규화에 실패했습니다. 기존 Active Bundle은 유지됩니다.",
      400,
    );
  }

  try {
    const { replacedBundleId } = await promoteDoclingStagingBundle({
      packId: pack.packId,
      versionId: version.id,
      stagingBundleId: bundleId,
    });

    if (replacedBundleId) {
      const refreshedPrevious = await loadBundleWithRelations(replacedBundleId);
      if (refreshedPrevious) {
        await finalizePreviousBundleStorage(refreshedPrevious, storage);
      }
    }
  } catch (error) {
    await markBundleDeletePendingAndCleanup(
      bundleId,
      uploadedKeys,
      storage,
      "activate_failed",
      new Map(stored.map((s) => [s.objectKey, s.id])),
    );
    if (isDoclingImportError(error)) throw error;
    throw new DoclingImportError(
      "DOCLING_ACTIVE_BUNDLE_CONFLICT",
      "Active Bundle 활성화에 충돌이 발생했습니다.",
      409,
    );
  }

  const refreshed = await loadBundleWithRelations(bundleId);
  if (!refreshed) {
    throw new DoclingImportError("NOT_FOUND", "업로드된 Docling import를 찾을 수 없습니다.", 404);
  }

  const hasHistory = await bundleHasSubmissionHistory(pack.packId, refreshed.id, version.id);
  return {
    bundle: toDoclingImportBundlePublicDto(refreshed, {
      canDelete: pack.status === PackStatus.DRAFT && !hasHistory,
      immutableAfterSubmission: hasHistory,
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
      adapterVersion: DOCLING_ADAPTER_VERSION,
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

  const filesMeta = {
    packId: bundle.packId,
    packVersionId: bundle.versionId,
    sourceFileId: sourceFile.id,
    jsonPayloadFileId: jsonFile.id,
    markdownPayloadFileId: mdFile.id,
  };

  let loaded;
  try {
    loaded = await loadAndValidateDoclingBundlePayloads({
      storage,
      sourceFile,
      jsonFile,
      mdFile,
    });
  } catch (error) {
    if (isSoftLockConflict(error)) throw error;
    if (isDoclingImportError(error) && error.code === "DOCLING_OBJECT_INTEGRITY_FAILED") {
      await markValidationFailed(bundleId, attempt, {
        code: "DOCLING_OBJECT_INTEGRITY_FAILED",
        message: "파일 무결성 검증에 실패했습니다.",
      });
      throw error;
    }
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

  const validation: AdapterValidationResult = {
    ok:
      Boolean(loaded.document) &&
      loaded.markdown.ok &&
      ![...loaded.jsonIssues, ...loaded.markdown.issues].some((i) => i.severity === "ERROR"),
    issues: [...loaded.jsonIssues, ...loaded.markdown.issues],
    document: loaded.document,
    markdownText: loaded.markdown.text ?? loaded.markdownPreviewText,
    originMatch: loaded.originMatch,
  };
  const markdownPreviewText = validation.markdownText ?? loaded.markdownPreviewText;

  const errorIssues = validation.issues.filter((i) => i.severity === "ERROR");
  const warningIssues = validation.issues.filter((i) => i.severity === "WARNING");
  const previousValidatorVersion =
    bundle.validationReport &&
    typeof bundle.validationReport === "object" &&
    typeof (bundle.validationReport as Record<string, unknown>).validatorVersion ===
      "string"
      ? ((bundle.validationReport as Record<string, unknown>).validatorVersion as string)
      : null;
  const metrics = loaded.markdown.metrics;
  const validationReport = {
    ok: validation.ok,
    issues: validation.issues,
    originMatch: validation.originMatch ?? null,
    validatedAt: new Date().toISOString(),
    validatorVersion:
      loaded.markdown.validatorVersion ?? DOCLING_MARKDOWN_VALIDATOR_VERSION,
    previousValidatorVersion,
    metrics: metrics ?? null,
    samples: loaded.markdown.samples
      ? loaded.markdown.samples.map((s) => ({
          label: s.label,
          passed: s.passed,
          markdownCoverage: s.markdownCoverage,
        }))
      : null,
    markdownCoverage: metrics?.markdownCoverage ?? null,
    jaccard: metrics?.jaccard ?? loaded.markdown.similarity ?? null,
    samplePassCount: metrics?.passedSampleCount ?? null,
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
        adapterVersion: DOCLING_ADAPTER_VERSION,
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
      adapterVersion: DOCLING_ADAPTER_VERSION,
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
      adapterVersion: DOCLING_ADAPTER_VERSION,
      message: "Normalization started",
    },
  });

  try {
    // Normalize from the compact in-memory projection — never re-parse the raw JSON object.
    const draft = normalizeDoclingDocument(validation.document!, {
      files: filesMeta,
      warnings: validation.issues.filter((i) => i.severity === "WARNING"),
    });

    const { resolveDocumentLanguage } = await import("@/lib/docling-import/document-language");
    const { buildStructureSummary } = await import("@/lib/docling-import/structure-summary");
    const { evaluateDocumentTitleMatch } = await import("@/lib/docling-import/title-match");
    const mdText = validation.markdownText ?? markdownPreviewText;
    const packRow = await prisma.knowledgePack.findUnique({
      where: { packId: bundle.packId },
      select: { name: true },
    });
    const languageResolved = resolveDocumentLanguage({
      textSample: `${draft.title ?? ""}\n${mdText.slice(0, 12_000)}`,
    });
    draft.language = languageResolved.language;
    const structureSummary = buildStructureSummary({
      sections: draft.sections,
      tables: draft.tables,
      figures: draft.figures,
      readingOrder: draft.readingOrder,
    });
    for (const warning of structureSummary.warnings) {
      draft.warnings.push({
        code: "DOCUMENT_STRUCTURE_WARNING",
        severity: "WARNING",
        message: warning,
      });
    }
    const titleMatch = evaluateDocumentTitleMatch({
      packName: packRow?.name,
      documentTitle: draft.title,
      sourceFileName: sourceFile.originalFileName,
      originFileName:
        typeof validation.document?.origin?.filename === "string"
          ? validation.document.origin.filename
          : null,
    });
    for (const warning of titleMatch.warnings) {
      draft.warnings.push({
        code: warning.startsWith("DOCUMENT_TITLE_MISMATCH")
          ? "DOCUMENT_TITLE_MISMATCH"
          : "DOCUMENT_TITLE_WARNING",
        severity: "WARNING",
        message: warning,
      });
    }

    const fingerprint = computeNormalizedDocumentFingerprint({
      adapterType: draft.adapter.type,
      adapterVersion: draft.adapter.version,
      sourceSchemaName: draft.adapter.sourceSchema,
      sourceSchemaVersion: draft.adapter.sourceSchemaVersion,
      title: draft.title,
      language: draft.language,
      sections: draft.sections,
      tables: draft.tables,
      figures: draft.figures,
      readingOrder: draft.readingOrder,
      warnings: draft.warnings,
      sourceFileId: sourceFile.id,
      jsonPayloadFileId: jsonFile.id,
      markdownPayloadFileId: mdFile.id,
      sourceChecksum: sourceFile.checksumSha256,
      jsonChecksum: jsonFile.checksumSha256,
      markdownChecksum: mdFile.checksumSha256,
    });

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
          languageSource: languageResolved.languageSource,
          languageConfidence: languageResolved.languageConfidence,
          structureSummaryJson: structureSummary as unknown as Prisma.InputJsonValue,
          structureJson: {
            sections: draft.sections,
            tables: draft.tables,
            figures: draft.figures,
            readingOrder: draft.readingOrder,
            summary: structureSummary,
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
          fingerprintVersion: NORMALIZED_DOCUMENT_FINGERPRINT_VERSION,
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
        adapterVersion: DOCLING_ADAPTER_VERSION,
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
        adapterVersion: DOCLING_ADAPTER_VERSION,
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
}): Promise<{
  bundle: DoclingImportBundlePublicDto | null;
  stagingBundle: DoclingImportBundlePublicDto | null;
}> {
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
  if (!version) return { bundle: null, stagingBundle: null };

  const active = await findActiveBundleForVersion(version.id);
  const stagingRow = await findLatestStagingBundleForVersion(version.id);
  // Prefer a distinct staging row (not the same as active).
  const stagingId =
    stagingRow && (!active || stagingRow.id !== active.id) ? stagingRow.id : null;
  const staging = stagingId ? await loadBundleWithRelations(stagingId) : null;

  const toDto = async (b: BundleWithRelations | null) => {
    if (!b) return null;
    const hasHistory = await bundleHasSubmissionHistory(pack.packId, b.id, version.id);
    return toDoclingImportBundlePublicDto(b, {
      canDelete: pack.status === PackStatus.DRAFT && !hasHistory,
      immutableAfterSubmission: hasHistory,
    });
  };

  return {
    bundle: await toDto(active),
    stagingBundle: await toDto(staging),
  };
}

export async function getAdminDoclingImport(input: {
  packId: string;
}): Promise<{
  bundle: DoclingImportBundlePublicDto | null;
  stagingBundle: DoclingImportBundlePublicDto | null;
}> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId: input.packId },
    include: { versions: { orderBy: latestKnowledgePackVersionOrderBy, take: 1 } },
  });
  if (!pack) {
    throw new DoclingImportError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
  }
  const version = pack.versions[0];
  if (!version) return { bundle: null, stagingBundle: null };

  const active = await findActiveBundleForVersion(version.id);
  const stagingRow = await findLatestStagingBundleForVersion(version.id);
  const stagingId =
    stagingRow && (!active || stagingRow.id !== active.id) ? stagingRow.id : null;
  const staging = stagingId ? await loadBundleWithRelations(stagingId) : null;

  return {
    bundle: active
      ? toDoclingImportBundlePublicDto(active, { canDelete: false })
      : null,
    stagingBundle: staging
      ? toDoclingImportBundlePublicDto(staging, { canDelete: false })
      : null,
  };
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

  return deleteDoclingImportByBundleId({
    userId: input.userId,
    clientId: input.clientId,
    packId: pack.packId,
    bundleId: bundle.id,
    storage: input.storage,
  });
}

export async function deleteDoclingImportByBundleId(input: {
  userId: string;
  clientId: string;
  packId: string;
  bundleId: string;
  storage?: PayloadStorage;
}): Promise<{ deleted: true }> {
  const { pack, version } = await requireOwnedDraftPack({
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });

  const bundle = await loadBundleWithRelations(input.bundleId);
  if (!bundle || bundle.packId !== pack.packId || bundle.versionId !== version.id) {
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
  const fileIdsByKey = new Map(bundle.files.map((f) => [f.storageKey, f.id]));

  await markBundleDeletePendingAndCleanup(
    bundle.id,
    keys,
    storage,
    "deleted",
    fileIdsByKey,
  );

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

  const staging = await findLatestStagingBundleForVersion(version.id);
  const active = await findActiveBundleForVersion(version.id);
  const pickRevalidate = (
    b: NonNullable<typeof staging>,
  ): boolean =>
    resolveDoclingRetryMode(b.status, b.lastErrorCode, {
      deleted: b.deletedAt != null,
      storageActive: b.storageStatus === "ACTIVE",
    }) === "REVALIDATE_STORED_OBJECTS";
  const candidate =
    staging && pickRevalidate(staging)
      ? staging
      : active && pickRevalidate(active)
        ? active
        : null;

  if (!candidate) {
    throw new DoclingImportError("NOT_FOUND", "재시도할 Docling import가 없습니다.", 404);
  }

  return retryDoclingImportByBundleId({
    userId: input.userId,
    clientId: input.clientId,
    packId: pack.packId,
    bundleId: candidate.id,
    storage: input.storage,
  });
}

export async function retryDoclingImportByBundleId(input: {
  userId: string;
  clientId: string;
  packId: string;
  bundleId: string;
  storage?: PayloadStorage;
}): Promise<{ bundle: DoclingImportBundlePublicDto }> {
  const { pack, version } = await requireOwnedDraftPack({
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });

  const bundle = await loadBundleWithRelations(input.bundleId);
  if (!bundle || bundle.packId !== pack.packId || bundle.versionId !== version.id) {
    throw new DoclingImportError("NOT_FOUND", "재시도할 Docling import가 없습니다.", 404);
  }
  if (bundle.deletedAt != null || bundle.storageStatus !== "ACTIVE") {
    throw new DoclingImportError(
      "DOCLING_BUNDLE_STORAGE_NOT_ACTIVE",
      "삭제되었거나 저장소가 비활성인 Bundle은 재시도할 수 없습니다.",
      409,
    );
  }

  const hasHistory = await bundleHasSubmissionHistory(
    pack.packId,
    bundle.id,
    version.id,
  );
  const retryMode = resolveDoclingRetryMode(bundle.status, bundle.lastErrorCode, {
    immutable: hasHistory,
    deleted: bundle.deletedAt != null,
    storageActive: bundle.storageStatus === "ACTIVE",
  });
  if (retryMode === "NOT_ALLOWED") {
    throw new DoclingImportError(
      "DOCLING_RETRY_NOT_ALLOWED",
      "현재 상태에서는 재시도할 수 없습니다.",
      409,
    );
  }
  if (retryMode === "REUPLOAD_REQUIRED") {
    throw new DoclingImportError(
      "DOCLING_RETRY_NOT_ALLOWED",
      "파일 내용/형식이 맞지 않습니다. Staging을 삭제한 후 올바른 파일을 다시 등록하세요.",
      409,
    );
  }

  return runValidateNormalizeAfterRetry({
    userId: input.userId,
    pack,
    version,
    bundle,
    storage: input.storage,
    auditLabel: "Retry",
  });
}

/**
 * Re-run validation/normalization on already-stored objects (no re-upload).
 * Allowed for VALIDATION_FAILED / NORMALIZATION_FAILED with REVALIDATE_STORED_OBJECTS.
 */
export async function revalidateDoclingImportBundle(input: {
  userId: string;
  clientId: string;
  packId: string;
  bundleId: string;
  storage?: PayloadStorage;
}): Promise<{ bundle: DoclingImportBundlePublicDto }> {
  const { pack, version } = await requireOwnedDraftPack({
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });

  const bundle = await loadBundleWithRelations(input.bundleId);
  if (!bundle || bundle.packId !== pack.packId || bundle.versionId !== version.id) {
    throw new DoclingImportError("NOT_FOUND", "재검증할 Docling import가 없습니다.", 404);
  }
  if (bundle.deletedAt != null || bundle.storageStatus !== "ACTIVE") {
    throw new DoclingImportError(
      "DOCLING_BUNDLE_STORAGE_NOT_ACTIVE",
      "삭제되었거나 저장소가 비활성인 Bundle은 재검증할 수 없습니다.",
      409,
    );
  }

  if (
    bundle.status === DoclingImportBundleStatus.VALIDATING ||
    bundle.status === DoclingImportBundleStatus.NORMALIZING
  ) {
    throw new DoclingImportError(
      "DOCLING_REVALIDATION_NOT_ALLOWED",
      "검증/정규화가 이미 진행 중입니다.",
      409,
    );
  }

  if (
    bundle.status !== DoclingImportBundleStatus.VALIDATION_FAILED &&
    bundle.status !== DoclingImportBundleStatus.NORMALIZATION_FAILED
  ) {
    throw new DoclingImportError(
      "DOCLING_REVALIDATION_NOT_ALLOWED",
      "재검증은 검증 실패 또는 정규화 실패 상태에서만 가능합니다.",
      409,
    );
  }

  const hasHistory = await bundleHasSubmissionHistory(
    pack.packId,
    bundle.id,
    version.id,
  );
  const retryMode = resolveDoclingRetryMode(bundle.status, bundle.lastErrorCode, {
    immutable: hasHistory,
    deleted: false,
    storageActive: true,
  });
  if (retryMode !== "REVALIDATE_STORED_OBJECTS") {
    throw new DoclingImportError(
      "DOCLING_REVALIDATION_NOT_ALLOWED",
      retryMode === "REUPLOAD_REQUIRED"
        ? "이 오류는 저장된 파일 재검증으로 해결할 수 없습니다. Staging을 삭제한 후 올바른 파일을 다시 등록하세요."
        : "현재 상태에서는 재검증할 수 없습니다.",
      409,
    );
  }

  return runValidateNormalizeAfterRetry({
    userId: input.userId,
    pack,
    version,
    bundle,
    storage: input.storage,
    auditLabel: "Revalidate",
  });
}

async function runValidateNormalizeAfterRetry(input: {
  userId: string;
  pack: { packId: string; status: PackStatus };
  version: { id: string };
  bundle: BundleWithRelations;
  storage?: PayloadStorage;
  auditLabel: "Retry" | "Revalidate";
}): Promise<{ bundle: DoclingImportBundlePublicDto }> {
  const { pack, version, bundle } = input;

  const lastLog = await prisma.doclingProcessingLog.findFirst({
    where: { bundleId: bundle.id },
    orderBy: { createdAt: "desc" },
  });
  const attempt = (lastLog?.attempt ?? 1) + 1;

  const previousValidatorVersion =
    bundle.validationReport &&
    typeof bundle.validationReport === "object" &&
    typeof (bundle.validationReport as Record<string, unknown>).validatorVersion ===
      "string"
      ? ((bundle.validationReport as Record<string, unknown>).validatorVersion as string)
      : null;

  const retryLog = await prisma.doclingProcessingLog.create({
    data: {
      bundleId: bundle.id,
      stage: DoclingProcessingStage.RETRY,
      status: DoclingProcessingStatus.STARTED,
      attempt,
      adapterVersion: DOCLING_ADAPTER_VERSION,
      message: `${input.auditLabel} from ${bundle.status}`,
      detailsJson: {
        validatorVersion: DOCLING_MARKDOWN_VALIDATOR_VERSION,
        previousValidatorVersion,
      } as Prisma.InputJsonValue,
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
      mode: input.auditLabel.toUpperCase(),
      validatorVersion: DOCLING_MARKDOWN_VALIDATOR_VERSION,
      previousValidatorVersion,
    },
  });

  try {
    const result = await validateAndNormalizeBundle(bundle.id, {
      attempt,
      storage: input.storage,
    });

    const metricsSummary =
      result.validationReport &&
      typeof result.validationReport === "object"
        ? {
            markdownCoverage: (result.validationReport as Record<string, unknown>)
              .markdownCoverage,
            jaccard: (result.validationReport as Record<string, unknown>).jaccard,
            samplePassCount: (result.validationReport as Record<string, unknown>)
              .samplePassCount,
            validatorVersion: (result.validationReport as Record<string, unknown>)
              .validatorVersion,
          }
        : null;

    if (result.status === DoclingImportBundleStatus.REVIEW_READY && !bundle.isActive) {
      const storage = input.storage ?? getDefaultStorage();
      const uploadedKeys =
        (await loadBundleWithRelations(bundle.id))?.files.map((f) => f.storageKey) ?? [];
      try {
        const { replacedBundleId } = await promoteDoclingStagingBundle({
          packId: pack.packId,
          versionId: version.id,
          stagingBundleId: bundle.id,
        });
        if (replacedBundleId) {
          const refreshedPrevious = await loadBundleWithRelations(replacedBundleId);
          if (refreshedPrevious) {
            await finalizePreviousBundleStorage(refreshedPrevious, storage);
          }
        }
      } catch (error) {
        await markBundleDeletePendingAndCleanup(
          bundle.id,
          uploadedKeys,
          storage,
          "activate_failed",
        );
        throw error;
      }
    } else if (result.status !== DoclingImportBundleStatus.REVIEW_READY) {
      await preserveFailedStagingBundle(bundle.id, "validation_or_normalization_failed");
    }

    const refreshed = await loadBundleWithRelations(bundle.id);
    await prisma.doclingProcessingLog.update({
      where: { id: retryLog.id },
      data: {
        status:
          refreshed?.status === DoclingImportBundleStatus.REVIEW_READY && refreshed.isActive
            ? DoclingProcessingStatus.SUCCEEDED
            : result.status === DoclingImportBundleStatus.REVIEW_READY
              ? DoclingProcessingStatus.SUCCEEDED
              : DoclingProcessingStatus.FAILED,
        completedAt: new Date(),
        message:
          result.status === DoclingImportBundleStatus.REVIEW_READY
            ? `${input.auditLabel} succeeded`
            : `${input.auditLabel} completed with failure`,
        errorCode:
          result.status === DoclingImportBundleStatus.REVIEW_READY
            ? null
            : result.lastErrorCode,
        detailsJson: {
          validatorVersion: DOCLING_MARKDOWN_VALIDATOR_VERSION,
          previousValidatorVersion,
          metricsSummary,
          attempt,
        } as Prisma.InputJsonValue,
      },
    });

    const finalBundle = refreshed ?? (await loadBundleWithRelations(bundle.id));
    const hasHistory = await bundleHasSubmissionHistory(
      pack.packId,
      finalBundle!.id,
      version.id,
    );
    return {
      bundle: toDoclingImportBundlePublicDto(finalBundle!, {
        canDelete: pack.status === PackStatus.DRAFT && !hasHistory,
        immutableAfterSubmission: hasHistory,
      }),
    };
  } catch (error) {
    await prisma.doclingProcessingLog.update({
      where: { id: retryLog.id },
      data: {
        status: DoclingProcessingStatus.FAILED,
        completedAt: new Date(),
        message: error instanceof Error ? error.message.slice(0, 1000) : `${input.auditLabel} failed`,
        errorCode: isDoclingImportError(error) ? error.code : "DOCLING_RETRY_FAILED",
      },
    });
    throw error;
  }
}

export async function downloadDoclingImportFile(input: {
  packId: string;
  fileId: string;
  userId?: string;
  clientId?: string;
  asAdmin?: boolean;
  storage?: PayloadStorage;
  /** When set, return at most this many bytes (markdown preview path). */
  previewMaxBytes?: number;
}): Promise<{
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
  checksumSha256: string;
  truncated?: boolean;
  contentLength?: number;
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
    include: { bundle: true },
  });
  if (!file) {
    throw new DoclingImportError("NOT_FOUND", "파일을 찾을 수 없습니다.", 404);
  }

  if (file.bundle.deletedAt != null || file.bundle.storageStatus !== DoclingBundleStorageStatus.ACTIVE) {
    throw new DoclingImportError(
      "DOCLING_OBJECT_MISSING",
      "삭제되었거나 비활성인 Docling 파일은 다운로드할 수 없습니다.",
      410,
    );
  }

  const hasHistory = await bundleHasSubmissionHistory(
    file.packId,
    file.bundleId,
    file.versionId,
  );

  if (!file.bundle.isActive) {
    // Provider may download own pack staging when ACTIVE storage, not deleted, no submission history.
    if (!input.asAdmin) {
      if (hasHistory) {
        throw new DoclingImportError(
          "DOCLING_IMMUTABLE_AFTER_SUBMISSION",
          "검수 제출 이력이 있는 Docling import 파일은 다운로드할 수 없습니다.",
          403,
        );
      }
    } else if (!hasHistory) {
      // Admin: staging without submission history is allowed for inspection of failed imports.
      // (same ACTIVE + not deleted gates already applied)
    }
  }

  const storage = input.storage ?? getDefaultStorage();
  const previewMax =
    input.previewMaxBytes != null && input.previewMaxBytes > 0
      ? Math.min(input.previewMaxBytes, DOCLING_MARKDOWN_PREVIEW_MAX_BYTES)
      : null;
  const objectStorage = asObjectStorage(storage);
  const declaredSize = Number(file.fileSize);

  // Preview path: stream only the first N bytes (no full-object buffer).
  if (previewMax != null && objectStorage) {
    try {
      const streamed = await objectStorage.getObjectStream({ objectKey: file.storageKey });
      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of streamed.body) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
        if (total < previewMax) {
          const need = previewMax - total;
          chunks.push(buf.byteLength <= need ? buf : buf.subarray(0, need));
          total += Math.min(buf.byteLength, need);
        }
        // Continue draining so the upstream connection closes cleanly... but for large
        // objects prefer destroy once we have enough bytes.
        if (total >= previewMax) {
          streamed.body.destroy?.();
          break;
        }
      }
      const bytes = Buffer.concat(chunks, total);
      return {
        bytes,
        mimeType: file.mimeType,
        fileName: file.originalFileName,
        checksumSha256: file.checksumSha256,
        truncated: Number.isFinite(declaredSize) ? declaredSize > bytes.byteLength : true,
        contentLength: Number.isFinite(declaredSize) ? declaredSize : undefined,
      };
    } catch {
      throw new DoclingImportError(
        "DOCLING_STORAGE_UNAVAILABLE",
        "저장소에서 파일을 읽지 못했습니다.",
        503,
      );
    }
  }

  let got;
  try {
    got = await storage.get({ objectKey: file.storageKey });
  } catch {
    throw new DoclingImportError(
      "DOCLING_STORAGE_UNAVAILABLE",
      "저장소에서 파일을 읽지 못했습니다.",
      503,
    );
  }
  const actual = sha256Hex(got.bytes);
  if (actual !== file.checksumSha256) {
    throw new DoclingImportError(
      "DOCLING_OBJECT_INTEGRITY_FAILED",
      "파일 무결성 검증에 실패했습니다.",
      503,
    );
  }

  if (previewMax != null && got.bytes.byteLength > previewMax) {
    return {
      bytes: got.bytes.subarray(0, previewMax),
      mimeType: file.mimeType,
      fileName: file.originalFileName,
      checksumSha256: actual,
      truncated: true,
      contentLength: got.bytes.byteLength,
    };
  }

  return {
    bytes: got.bytes,
    mimeType: file.mimeType,
    fileName: file.originalFileName,
    checksumSha256: actual,
    truncated: false,
    contentLength: got.bytes.byteLength,
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
