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
import { DOCLING_MARKDOWN_VALIDATOR_VERSION, sanitizeMarkdownForPreview } from "@/lib/adapters/docling/docling-markdown-validator";
import { evaluateNormalizedDocumentQuality } from "@/lib/docling-import/docling-quality-gate";
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

function collectFigurePreviewKeysFromBundle(bundle: BundleWithRelations): string[] {
  const keys = new Set<string>();
  for (const nd of bundle.normalizedDocuments ?? []) {
    const figures = Array.isArray(nd.figuresJson) ? nd.figuresJson : [];
    for (const fig of figures) {
      if (
        fig &&
        typeof fig === "object" &&
        typeof (fig as { previewObjectKey?: unknown }).previewObjectKey === "string"
      ) {
        const key = (fig as { previewObjectKey: string }).previewObjectKey.trim();
        if (key) keys.add(key);
      }
    }
  }
  return [...keys];
}

async function cleanupNewlyUploadedFigureKeys(
  keys: Set<string>,
  storage: PayloadStorage,
  bundleId: string,
  reason: string,
): Promise<void> {
  if (keys.size === 0) return;
  const { enqueuePayloadCleanupJob } = await import(
    "@/lib/distribution/payload-cleanup-service"
  );
  for (const objectKey of keys) {
    try {
      await storage.delete({ objectKey });
    } catch {
      await enqueuePayloadCleanupJob({
        objectKey,
        reason,
        lastError: "immediate delete failed",
        doclingBundleId: bundleId,
      });
    }
  }
}

function maybeSanitizeMarkdownPreviewBytes(input: {
  bytes: Uint8Array;
  role: string;
  mimeType: string;
  fileName: string;
  preview: boolean;
}): { bytes: Uint8Array; truncated: boolean } {
  if (!input.preview) return { bytes: input.bytes, truncated: false };
  const role = String(input.role);
  const mime = (input.mimeType ?? "").toLowerCase();
  const name = (input.fileName ?? "").toLowerCase();
  const isMarkdown =
    role === "DOCLING_MARKDOWN" ||
    mime.includes("markdown") ||
    mime.includes("text/") ||
    name.endsWith(".md") ||
    name.endsWith(".markdown");
  if (!isMarkdown) return { bytes: input.bytes, truncated: false };
  const raw = Buffer.from(input.bytes).toString("utf8");
  const sanitized = sanitizeMarkdownForPreview(raw);
  const out = Buffer.from(sanitized, "utf8");
  return {
    bytes: out,
    truncated: out.byteLength < input.bytes.byteLength || sanitized !== raw,
  };
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
  markdown?: UploadFileInput | null;
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
  const hasMarkdown = Boolean(input.markdown?.bytes && input.markdown.bytes.byteLength > 0);
  const mdMeta = hasMarkdown
    ? await assertRoleFileAcceptable(
        KnowledgePackFileRole.DOCLING_MARKDOWN,
        input.markdown!.fileName,
        input.markdown!.mimeType,
        input.markdown!.bytes,
      )
    : null;

  const storage = input.storage ?? getDefaultStorage();
  const prefix = storagePrefix(storage);
  const bundleId = createPayloadId();
  const sourceFileId = createPayloadId();
  const jsonFileId = createPayloadId();
  const markdownFileId = hasMarkdown ? createPayloadId() : null;
  const adapterVersion = DOCLING_ADAPTER_VERSION;

  const sourceChecksum = sha256Hex(input.source.bytes);
  const jsonChecksum = sha256Hex(input.json.bytes);
  const mdChecksum = hasMarkdown ? sha256Hex(input.markdown!.bytes) : null;

  const fileSpecs: {
    id: string;
    role: KnowledgePackFileRole;
    meta: typeof sourceMeta;
    bytes: Uint8Array;
    checksum: string;
  }[] = [
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
  ];
  if (hasMarkdown && mdMeta && markdownFileId && mdChecksum && input.markdown) {
    fileSpecs.push({
      id: markdownFileId,
      role: KnowledgePackFileRole.DOCLING_MARKDOWN,
      meta: mdMeta,
      bytes: input.markdown.bytes,
      checksum: mdChecksum,
    });
  }

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
            message: hasMarkdown
              ? "Three-file Docling import uploaded"
              : "Two-file Docling import uploaded (Markdown optional)",
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

  if (processed.status !== DoclingImportBundleStatus.NORMALIZED) {
    // Preserve failed staging objects for retry/download — do not cleanup.
    await preserveFailedStagingBundle(bundleId, "validation_or_normalization_failed");
    throw new DoclingImportError(
      processed.lastErrorCode ?? "DOCLING_VALIDATION_FAILED",
      processed.lastErrorMessage ??
        "Docling import 검증·정규화에 실패했습니다. 기존 Active Bundle은 유지됩니다.",
      400,
    );
  }

  // Stay staging + NORMALIZED until provider confirms (REVIEW_READY + promote).
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
  // Clear stale errors so clients do not show a previous failure while retrying.
  await prisma.doclingImportBundle.update({
    where: { id: bundleId },
    data: { lastErrorCode: null, lastErrorMessage: null },
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
  const mdFile = byRole.get(KnowledgePackFileRole.DOCLING_MARKDOWN) ?? null;
  if (!sourceFile || !jsonFile) {
    throw new DoclingImportError(
      "DOCLING_INCOMPLETE_FILES",
      "Docling import에 필요한 원본문서와 Docling JSON이 없습니다.",
      400,
    );
  }

  const filesMeta = {
    packId: bundle.packId,
    packVersionId: bundle.versionId,
    sourceFileId: sourceFile.id,
    jsonPayloadFileId: jsonFile.id,
    markdownPayloadFileId: mdFile?.id,
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

  // Soft markdown warnings never contribute to ERROR / fail the bundle.
  const markdownWarnings = loaded.markdown.warnings ?? loaded.markdown.issues.filter(
    (i) => i.severity === "WARNING",
  );
  const markdownHardErrors = loaded.markdown.issues.filter((i) => i.severity === "ERROR");
  const validation: AdapterValidationResult = {
    ok:
      Boolean(loaded.document) &&
      !loaded.jsonIssues.some((i) => i.severity === "ERROR") &&
      markdownHardErrors.length === 0,
    issues: [...loaded.jsonIssues, ...markdownWarnings, ...markdownHardErrors],
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
  const validationReport = {
    ok: validation.ok,
    issues: validation.issues,
    originMatch: validation.originMatch ?? null,
    validatedAt: new Date().toISOString(),
    validatorVersion:
      loaded.markdown.validatorVersion ?? DOCLING_MARKDOWN_VALIDATOR_VERSION,
    previousValidatorVersion,
    source: { integrity: "ok" as const },
    json: {
      status: loaded.jsonIssues.some((i) => i.severity === "ERROR") ? "error" : "ok",
      issueCount: loaded.jsonIssues.length,
    },
    markdown: {
      available: loaded.markdown.available,
      previewAvailable: loaded.markdown.previewAvailable,
      status: !loaded.markdown.available
        ? ("not_provided" as const)
        : markdownHardErrors.length > 0
          ? ("error" as const)
          : markdownWarnings.length > 0
            ? ("warning" as const)
            : ("ok" as const),
      warnings: markdownWarnings,
      textPreview: markdownPreviewText
        ? sanitizeMarkdownForPreview(markdownPreviewText).slice(0, 2_000)
        : null,
    },
    // Legacy similarity fields kept null for Admin report compat readers.
    metrics: null,
    samples: null,
    markdownCoverage: null,
    jaccard: null,
    samplePassCount: null,
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

  const newlyUploadedFigureKeys = new Set<string>();
  try {
    // Normalize from the compact in-memory projection — never re-parse the raw JSON object.
    const draft = normalizeDoclingDocument(validation.document!, {
      files: filesMeta,
      warnings: validation.issues.filter((i) => i.severity === "WARNING"),
      markdownText: markdownPreviewText ?? validation.markdownText ?? null,
      extractedPictureImages: loaded.extractedPictureImages,
    });

    // Persist figure preview objects (Base64 never stored in ND JSON / client DTO).
    const previousFigureKeys = collectFigurePreviewKeysFromBundle(bundle);
    try {
      const { buildFigurePreviewObjectKey } = await import(
        "@/lib/adapters/docling/docling-figure-preview"
      );
      const prefix = storagePrefix(storage);
      const bySha = new Map<string, string>();
      for (const fig of draft.figures) {
        const bytes = fig._previewBytes;
        const sha = fig._previewSha256;
        if (!bytes || !sha) {
          delete fig._previewBytes;
          delete fig._previewSha256;
          continue;
        }
        let objectKey = bySha.get(sha);
        if (!objectKey) {
          const ext = (fig.mimeType ?? "image/png").includes("jpeg")
            ? "jpg"
            : (fig.mimeType ?? "").includes("webp")
              ? "webp"
              : "png";
          objectKey = buildFigurePreviewObjectKey({
            prefix,
            packId: bundle.packId,
            versionId: bundle.versionId,
            bundleId,
            sha256: sha,
            extension: ext,
          });
          await storage.put({
            packId: bundle.packId,
            versionId: bundle.versionId,
            payloadId: sha.slice(0, 32),
            originalFileName: `figure-${sha.slice(0, 8)}.${ext}`,
            mimeType: fig.mimeType ?? "image/png",
            bytes,
            checksumSha256: sha,
            objectKey,
          });
          newlyUploadedFigureKeys.add(objectKey);
          bySha.set(sha, objectKey);
        }
        fig.previewObjectKey = objectKey;
        delete fig._previewBytes;
        delete fig._previewSha256;
      }
    } catch {
      await cleanupNewlyUploadedFigureKeys(
        newlyUploadedFigureKeys,
        storage,
        bundleId,
        "docling_figure_preview_partial_failure",
      );
      newlyUploadedFigureKeys.clear();
      for (const fig of draft.figures) {
        delete fig._previewBytes;
        delete fig._previewSha256;
        fig.previewObjectKey = null;
        draft.warnings.push({
          code: "DOCLING_SCHEMA_INVALID",
          severity: "WARNING",
          field: fig.id,
          message: "그림 미리보기 저장에 실패했습니다.",
        });
      }
    }

    const { buildStructureSummary } = await import("@/lib/docling-import/structure-summary");
    const { evaluateDocumentTitleMatch } = await import("@/lib/docling-import/title-match");
    const { toPackLanguageCode } = await import("@/lib/pack-language");
    const packRow = await prisma.knowledgePack.findUnique({
      where: { packId: bundle.packId },
      select: { name: true },
    });
    const versionRow = await prisma.knowledgePackVersion.findUnique({
      where: { id: bundle.versionId },
      select: { language: true },
    });
    const providerLanguage = toPackLanguageCode(versionRow?.language);
    draft.language = providerLanguage;
    const languageSource = providerLanguage ? "PROVIDER" : null;
    const languageConfidence = null;
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
      markdownPayloadFileId: mdFile?.id ?? null,
      sourceChecksum: sourceFile.checksumSha256,
      jsonChecksum: jsonFile.checksumSha256,
      markdownChecksum: mdFile?.checksumSha256 ?? null,
    });

    const sanitizedMarkdownPreview = sanitizeMarkdownForPreview(
      markdownPreviewText ?? validation.markdownText ?? "",
    );
    const qualityGate = evaluateNormalizedDocumentQuality({
      title: draft.title,
      language: draft.language,
      sections: draft.sections,
      tables: draft.tables,
      figures: draft.figures,
      readingOrder: draft.readingOrder,
      files: [sourceFile, jsonFile, ...(mdFile ? [mdFile] : [])].map((f) => ({
        role: f.role,
        checksumSha256: f.checksumSha256,
      })),
      markdownPreview: sanitizedMarkdownPreview,
      originMismatch: validation.originMatch?.filenameStatus === "MISMATCH",
      hasNormalizedDocument: true,
    });

    const ndId = createPayloadId();
    // Serialize large JSON columns outside the interactive transaction so the
    // default 5s timeout isn't spent on CPU before the first write.
    const structureSummaryJson = structureSummary as unknown as Prisma.InputJsonValue;
    const structureJson = {
      sections: draft.sections,
      tables: draft.tables,
      figures: draft.figures.map((fig) => {
        const rest = { ...fig };
        delete rest._previewBytes;
        delete rest._previewSha256;
        return rest;
      }),
      readingOrder: draft.readingOrder,
      summary: structureSummary,
      qualityGate,
    } as unknown as Prisma.InputJsonValue;
    const sectionsJson = draft.sections as unknown as Prisma.InputJsonValue;
    const tablesJson = draft.tables as unknown as Prisma.InputJsonValue;
    const figuresJson = draft.figures.map((fig) => {
      const rest = { ...fig };
      delete rest._previewBytes;
      delete rest._previewSha256;
      return rest;
    }) as unknown as Prisma.InputJsonValue;
    const readingOrderJson = draft.readingOrder as unknown as Prisma.InputJsonValue;
    const warningsJson = draft.warnings as unknown as Prisma.InputJsonValue;
    const normalizationReportJson = {
      ok: true,
      normalizedDocumentId: ndId,
      fingerprint,
      warningCount: draft.warnings.length,
      qualityGate,
      providerConfirmRequired: true,
      normalizedAt: new Date().toISOString(),
    } as Prisma.InputJsonValue;
    const normalizedAt = new Date();

    // Large Docling docs (hundreds of tables/figures) routinely exceed Prisma's
    // default 5s interactive transaction timeout on create.
    await prisma.$transaction(
      async (tx) => {
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
            languageSource,
            languageConfidence,
            structureSummaryJson,
            structureJson,
            sectionsJson,
            tablesJson,
            figuresJson,
            readingOrderJson,
            warningsJson,
            sourceFileId: sourceFile.id,
            jsonPayloadFileId: jsonFile.id,
            markdownPayloadFileId: mdFile?.id ?? null,
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

        await tx.doclingImportBundle.update({
          where: { id: bundleId },
          data: {
            normalizationReport: normalizationReportJson,
            warningCount: draft.warnings.length,
            errorCount: 0,
            lastErrorCode: null,
            lastErrorMessage: null,
            normalizedAt,
            // Provider must confirm before REVIEW_READY / Active promotion.
            reviewReadyAt: null,
          },
        });
      },
      { maxWait: 15_000, timeout: 120_000 },
    );

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

    const retainedFigureKeys = new Set(
      draft.figures
        .map((f) => f.previewObjectKey?.trim())
        .filter((k): k is string => Boolean(k)),
    );
    for (const key of previousFigureKeys) {
      if (retainedFigureKeys.has(key)) continue;
      try {
        await storage.delete({ objectKey: key });
      } catch {
        const { enqueuePayloadCleanupJob } = await import(
          "@/lib/distribution/payload-cleanup-service"
        );
        await enqueuePayloadCleanupJob({
          objectKey: key,
          reason: "docling_figure_preview_replaced",
          lastError: "immediate delete failed",
          doclingBundleId: bundleId,
        });
      }
    }

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
    await cleanupNewlyUploadedFigureKeys(
      newlyUploadedFigureKeys,
      storage,
      bundleId,
      "docling_figure_preview_normalization_failed",
    );
    const message = error instanceof Error ? error.message : "Normalization failed";
    try {
      await softLockBundleStatus({
        bundleId,
        from: [DoclingImportBundleStatus.NORMALIZING],
        to: DoclingImportBundleStatus.NORMALIZATION_FAILED,
      });
    } catch {
      // Already transitioned (or conflict) — still persist the error fields below.
    }
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
  const keys = [
    ...bundle.files.map((f) => f.storageKey),
    ...collectFigurePreviewKeysFromBundle(bundle),
  ];
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

    if (result.status === DoclingImportBundleStatus.NORMALIZED && !bundle.isActive) {
      // Provider confirm required before REVIEW_READY / Active — keep staging.
    } else if (result.status !== DoclingImportBundleStatus.NORMALIZED) {
      await preserveFailedStagingBundle(bundle.id, "validation_or_normalization_failed");
    }

    const refreshed = await loadBundleWithRelations(bundle.id);
    await prisma.doclingProcessingLog.update({
      where: { id: retryLog.id },
      data: {
        status:
          result.status === DoclingImportBundleStatus.NORMALIZED
            ? DoclingProcessingStatus.SUCCEEDED
            : DoclingProcessingStatus.FAILED,
        completedAt: new Date(),
        message:
          result.status === DoclingImportBundleStatus.NORMALIZED
            ? `${input.auditLabel} succeeded (provider confirm required)`
            : `${input.auditLabel} completed with failure`,
        errorCode:
          result.status === DoclingImportBundleStatus.NORMALIZED ? null : result.lastErrorCode,
        detailsJson: {
          validatorVersion: DOCLING_MARKDOWN_VALIDATOR_VERSION,
          previousValidatorVersion,
          metricsSummary,
          attempt,
          status: result.status,
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

/**
 * Provider confirms NORMALIZED staging → quality gate → REVIEW_READY → Active promote.
 */
export async function confirmProviderDoclingImport(input: {
  userId: string;
  clientId: string;
  packId: string;
  bundleId: string;
  storage?: PayloadStorage;
}): Promise<{ bundle: DoclingImportBundlePublicDto }> {
  const storage = input.storage ?? getDefaultStorage();
  const { pack, version } = await requireOwnedDraftPack({
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });

  const bundle = await loadBundleWithRelations(input.bundleId);
  if (!bundle || bundle.packId !== pack.packId || bundle.versionId !== version.id) {
    throw new DoclingImportError("NOT_FOUND", "Docling Bundle을 찾을 수 없습니다.", 404);
  }

  const staging = await findLatestStagingBundleForVersion(version.id);
  if (!staging || staging.id !== bundle.id) {
    throw new DoclingImportError(
      "DOCLING_CONFIRM_NOT_STAGING",
      "최신 등록(Staging) Bundle만 확인 완료할 수 있습니다.",
      409,
    );
  }

  if (
    bundle.status !== DoclingImportBundleStatus.NORMALIZED &&
    !(bundle.status === DoclingImportBundleStatus.REVIEW_READY && !bundle.isActive)
  ) {
    throw new DoclingImportError(
      "DOCLING_CONFIRM_INVALID_STATUS",
      "정규화 완료(NORMALIZED) 상태에서만 확인 완료할 수 있습니다.",
      409,
    );
  }

  const hasHistory = await bundleHasSubmissionHistory(pack.packId, bundle.id, version.id);
  if (hasHistory) {
    throw new DoclingImportError(
      "DOCLING_IMMUTABLE_AFTER_SUBMISSION",
      "이미 검수 제출된 Bundle은 변경할 수 없습니다.",
      409,
    );
  }

  const nd =
    bundle.normalizedDocuments.find((d) => d.isActive) ?? bundle.normalizedDocuments[0] ?? null;
  if (!nd) {
    throw new DoclingImportError(
      "NORMALIZED_DOCUMENT_MISSING",
      "정규화 문서가 없습니다.",
      409,
    );
  }

  const sections = (nd.sectionsJson as unknown as import("@/lib/adapters/docling/docling-types").NormalizedSection[]) ?? [];
  const tables = (nd.tablesJson as unknown as import("@/lib/adapters/docling/docling-types").NormalizedTable[]) ?? [];
  const figures = (nd.figuresJson as unknown as import("@/lib/adapters/docling/docling-types").NormalizedFigure[]) ?? [];
  const readingOrder =
    (nd.readingOrderJson as unknown as import("@/lib/adapters/docling/docling-types").NormalizedReadingOrderItem[]) ??
    [];

  const qualityGate = evaluateNormalizedDocumentQuality({
    title: nd.title,
    language: nd.language,
    sections,
    tables,
    figures,
    readingOrder,
    files: bundle.files.map((f) => ({
      role: f.role,
      checksumSha256: f.checksumSha256,
    })),
    markdownPreview: sanitizeMarkdownForPreview(
      typeof (bundle.validationReport as { markdown?: { textPreview?: string } } | null)
        ?.markdown?.textPreview === "string"
        ? (bundle.validationReport as { markdown: { textPreview: string } }).markdown
            .textPreview
        : "",
    ),
    originMismatch: false,
    hasNormalizedDocument: true,
    normalizationErrorCount: bundle.errorCount,
  });

  if (!qualityGate.ok) {
    const err = new DoclingImportError(
      "DOCLING_PROVIDER_CONFIRM_BLOCKED",
      "정규화 결과를 확인 완료할 수 없습니다.",
      409,
    );
    (err as DoclingImportError & { blockers?: unknown }).blockers = qualityGate.blockers;
    throw err;
  }

  if (bundle.status === DoclingImportBundleStatus.NORMALIZED) {
    await softLockBundleStatus({
      bundleId: bundle.id,
      from: [DoclingImportBundleStatus.NORMALIZED],
      to: DoclingImportBundleStatus.REVIEW_READY,
    });
  }
  const reviewReadyAt = new Date();
  await prisma.doclingImportBundle.update({
    where: { id: bundle.id },
    data: {
      reviewReadyAt,
      lastErrorCode: null,
      lastErrorMessage: null,
      normalizationReport: {
        ...(typeof bundle.normalizationReport === "object" && bundle.normalizationReport
          ? (bundle.normalizationReport as Record<string, unknown>)
          : {}),
        qualityGate,
        providerConfirmedAt: reviewReadyAt.toISOString(),
      } as Prisma.InputJsonValue,
    },
  });

  try {
    const { replacedBundleId } = await promoteDoclingStagingBundle({
      packId: pack.packId,
      versionId: version.id,
      stagingBundleId: bundle.id,
    });
    if (replacedBundleId) {
      const previous = await loadBundleWithRelations(replacedBundleId);
      if (previous) await finalizePreviousBundleStorage(previous, storage);
    }
  } catch (error) {
    await prisma.doclingImportBundle.updateMany({
      where: {
        id: bundle.id,
        status: DoclingImportBundleStatus.REVIEW_READY,
        isActive: false,
      },
      data: {
        status: DoclingImportBundleStatus.NORMALIZED,
        reviewReadyAt: null,
      },
    });
    if (isDoclingImportError(error)) throw error;
    throw new DoclingImportError(
      "DOCLING_ACTIVE_BUNDLE_CONFLICT",
      "Active Bundle 활성화에 충돌이 발생했습니다.",
      409,
    );
  }

  await recordProviderAudit({
    action: AuditAction.DOCLING_IMPORT_NORMALIZED,
    entityType: "DoclingImportBundle",
    entityId: bundle.id,
    actorUserId: input.userId,
    metadata: {
      packId: pack.packId,
      bundleId: bundle.id,
      providerConfirmed: true,
      reviewReadyAt: reviewReadyAt.toISOString(),
    },
  });

  const refreshed = await loadBundleWithRelations(bundle.id);
  return {
    bundle: toDoclingImportBundlePublicDto(refreshed!, {
      canDelete: pack.status === PackStatus.DRAFT && !hasHistory,
      immutableAfterSubmission: hasHistory,
    }),
  };
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
      const sanitized = maybeSanitizeMarkdownPreviewBytes({
        bytes,
        role: file.role,
        mimeType: file.mimeType,
        fileName: file.originalFileName,
        preview: true,
      });
      return {
        bytes: sanitized.bytes,
        mimeType: file.mimeType,
        fileName: file.originalFileName,
        checksumSha256: file.checksumSha256,
        truncated:
          sanitized.truncated ||
          (Number.isFinite(declaredSize) ? declaredSize > bytes.byteLength : true),
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

  if (previewMax != null) {
    const sliced =
      got.bytes.byteLength > previewMax ? got.bytes.subarray(0, previewMax) : got.bytes;
    const sanitized = maybeSanitizeMarkdownPreviewBytes({
      bytes: sliced,
      role: file.role,
      mimeType: file.mimeType,
      fileName: file.originalFileName,
      preview: true,
    });
    return {
      bytes: sanitized.bytes,
      mimeType: file.mimeType,
      fileName: file.originalFileName,
      checksumSha256: actual,
      truncated: sanitized.truncated || got.bytes.byteLength > previewMax,
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

export async function streamDoclingFigurePreview(input: {
  packId: string;
  bundleId: string;
  figureId: string;
  userId: string;
  clientId: string;
  storage?: PayloadStorage;
}): Promise<{
  stream: NodeJS.ReadableStream;
  mimeType: string;
  contentLength: number | null;
}> {
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

  const bundle = await loadBundleWithRelations(input.bundleId);
  if (!bundle || bundle.packId !== pack.packId) {
    throw new DoclingImportError("NOT_FOUND", "Docling Bundle을 찾을 수 없습니다.", 404);
  }
  if (bundle.deletedAt != null || bundle.storageStatus !== DoclingBundleStorageStatus.ACTIVE) {
    throw new DoclingImportError(
      "DOCLING_OBJECT_MISSING",
      "삭제되었거나 비활성인 Bundle의 그림은 볼 수 없습니다.",
      410,
    );
  }

  const { routeParamToFigureRef } = await import("@/lib/adapters/docling/docling-figure-ids");
  const figureRef = routeParamToFigureRef(input.figureId);
  const nd =
    bundle.normalizedDocuments.find((d) => d.isActive) ?? bundle.normalizedDocuments[0] ?? null;
  if (!nd) {
    throw new DoclingImportError("NORMALIZED_DOCUMENT_MISSING", "정규화 문서가 없습니다.", 404);
  }
  const figures =
    (nd.figuresJson as unknown as import("@/lib/adapters/docling/docling-types").NormalizedFigure[]) ??
    [];
  const fig =
    figures.find((f) => f.id === figureRef || f.sourceRef === figureRef) ??
    null;
  if (!fig?.previewObjectKey?.trim()) {
    throw new DoclingImportError("NOT_FOUND", "그림 미리보기를 찾을 수 없습니다.", 404);
  }

  const storage = input.storage ?? getDefaultStorage();
  const objectStorage = asObjectStorage(storage);
  if (!objectStorage) {
    throw new DoclingImportError(
      "DOCLING_STORAGE_UNAVAILABLE",
      "저장소에서 파일을 읽지 못했습니다.",
      503,
    );
  }
  try {
    const streamed = await objectStorage.getObjectStream({
      objectKey: fig.previewObjectKey,
    });
    return {
      stream: streamed.body,
      mimeType: fig.mimeType ?? "image/png",
      contentLength: streamed.contentLength ?? null,
    };
  } catch {
    throw new DoclingImportError(
      "DOCLING_STORAGE_UNAVAILABLE",
      "저장소에서 파일을 읽지 못했습니다.",
      503,
    );
  }
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

  const active = await findActiveBundleForVersion(version.id);
  const staging = await findLatestStagingBundleForVersion(version.id);
  const preferStaging =
    staging &&
    staging.status === DoclingImportBundleStatus.NORMALIZED &&
    (!active || staging.id !== active.id);
  const bundle = preferStaging
    ? await loadBundleWithRelations(staging.id)
    : active
      ? await loadBundleWithRelations(active.id)
      : null;
  if (!bundle) return { document: null, capabilities: emptyCapabilities };

  const activeNd =
    bundle.normalizedDocuments.find((d) => d.isActive) ??
    bundle.normalizedDocuments[0] ??
    null;
  if (!activeNd) {
    return { document: null, capabilities: emptyCapabilities };
  }

  const structureSummary =
    activeNd.structureSummaryJson && typeof activeNd.structureSummaryJson === "object"
      ? activeNd.structureSummaryJson
      : null;
  const qualityGate =
    activeNd.structureJson &&
    typeof activeNd.structureJson === "object" &&
    (activeNd.structureJson as { qualityGate?: unknown }).qualityGate
      ? (activeNd.structureJson as { qualityGate: unknown }).qualityGate
      : typeof bundle.normalizationReport === "object" &&
          bundle.normalizationReport &&
          (bundle.normalizationReport as { qualityGate?: unknown }).qualityGate
        ? (bundle.normalizationReport as { qualityGate: unknown }).qualityGate
        : null;

  return {
    document: toNormalizedSummaryDto(activeNd),
    structure: {
      sections: activeNd.sectionsJson,
      tables: activeNd.tablesJson,
      figures: activeNd.figuresJson,
      readingOrder: activeNd.readingOrderJson,
      warnings: activeNd.warningsJson,
      summary: structureSummary,
      qualityGate,
    },
    capabilities: buildPackCapabilitiesDto({ hasNormalizedDocument: true }),
  };
}
