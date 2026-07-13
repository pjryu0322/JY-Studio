import {
  KnowledgePackFileRole,
  type DoclingImportBundle,
  type KnowledgePackFile,
  type NormalizedDocument,
} from "@prisma/client";
import type { DoclingBundleReviewSubmitSnapshot } from "@/lib/distribution/distribution-submit-snapshot";
import { sha256Hex } from "@/lib/distribution/payload-checksum";
import type { PayloadStorage } from "@/lib/distribution/payload-storage";
import { getConfiguredPayloadStorage } from "@/lib/distribution/payload-storage-factory";
import { DoclingImportError } from "@/lib/docling-import/docling-import-errors";
import { prisma } from "@/lib/prisma";
import { AuditAction } from "@prisma/client";
import { recordProviderAudit } from "@/lib/provider-audit";

export type ReviewIntegrityIssue = {
  code: string;
  message: string;
};

export type DoclingReviewIntegrityResult = {
  ok: boolean;
  errors: ReviewIntegrityIssue[];
  warnings: ReviewIntegrityIssue[];
};

const SAFE_USER_MESSAGE =
  "제출 시점 원본 파일과 현재 저장 파일의 무결성이 일치하지 않습니다.";

function err(code: string, message = SAFE_USER_MESSAGE): ReviewIntegrityIssue {
  return { code, message };
}

function getDefaultStorage(): PayloadStorage {
  return getConfiguredPayloadStorage();
}

export async function validateDoclingReviewIntegrity(input: {
  packId: string;
  snapshot: DoclingBundleReviewSubmitSnapshot;
  verifyObjectStorage?: boolean;
  storage?: PayloadStorage;
}): Promise<DoclingReviewIntegrityResult> {
  const errors: ReviewIntegrityIssue[] = [];
  const warnings: ReviewIntegrityIssue[] = [];
  const { packId, snapshot } = input;

  if (snapshot.mode !== "DOCLING_BUNDLE") {
    errors.push(err("DOCLING_REVIEW_BUNDLE_NOT_READY", "Docling Bundle 스냅샷이 아닙니다."));
    return { ok: false, errors, warnings };
  }

  if (
    !snapshot.doclingBundleId ||
    !snapshot.sourceFileId ||
    !snapshot.jsonPayloadFileId ||
    !snapshot.markdownPayloadFileId ||
    !snapshot.normalizedDocumentId ||
    !snapshot.submittedVersionId ||
    !snapshot.adapterVersion ||
    !snapshot.checksums?.source ||
    !snapshot.checksums?.json ||
    !snapshot.checksums?.markdown
  ) {
    errors.push(err("DOCLING_REVIEW_FILE_NOT_FOUND", "제출 스냅샷에 필수 Docling 정보가 없습니다."));
    return { ok: false, errors, warnings };
  }

  const bundle = await prisma.doclingImportBundle.findUnique({
    where: { id: snapshot.doclingBundleId },
  });

  if (!bundle) {
    errors.push(err("DOCLING_REVIEW_BUNDLE_NOT_FOUND"));
    return { ok: false, errors, warnings };
  }

  if (bundle.packId !== packId) {
    errors.push(err("DOCLING_REVIEW_BUNDLE_NOT_FOUND"));
  }
  if (bundle.versionId !== snapshot.submittedVersionId) {
    errors.push(err("DOCLING_REVIEW_VERSION_MISMATCH"));
  }
  if (!bundle.isActive) {
    errors.push(err("DOCLING_REVIEW_BUNDLE_NOT_ACTIVE"));
  }
  if (bundle.status !== "REVIEW_READY") {
    errors.push(err("DOCLING_REVIEW_BUNDLE_NOT_READY"));
  }

  const fileSpecs: {
    id: string;
    role: KnowledgePackFileRole;
    checksum: string;
  }[] = [
    {
      id: snapshot.sourceFileId,
      role: KnowledgePackFileRole.SOURCE_ORIGINAL,
      checksum: snapshot.checksums.source,
    },
    {
      id: snapshot.jsonPayloadFileId,
      role: KnowledgePackFileRole.DOCLING_JSON,
      checksum: snapshot.checksums.json,
    },
    {
      id: snapshot.markdownPayloadFileId,
      role: KnowledgePackFileRole.DOCLING_MARKDOWN,
      checksum: snapshot.checksums.markdown,
    },
  ];

  const files: KnowledgePackFile[] = [];
  for (const spec of fileSpecs) {
    const file = await prisma.knowledgePackFile.findUnique({ where: { id: spec.id } });
    if (!file) {
      errors.push(err("DOCLING_REVIEW_FILE_NOT_FOUND"));
      continue;
    }
    files.push(file);
    if (file.bundleId !== bundle.id) {
      errors.push(err("DOCLING_REVIEW_FILE_NOT_FOUND"));
    }
    if (file.packId !== packId) {
      errors.push(err("DOCLING_REVIEW_FILE_NOT_FOUND"));
    }
    if (file.versionId !== snapshot.submittedVersionId) {
      errors.push(err("DOCLING_REVIEW_VERSION_MISMATCH"));
    }
    if (file.role !== spec.role) {
      errors.push(err("DOCLING_REVIEW_FILE_ROLE_MISMATCH"));
    }
    if (!file.isImmutable) {
      errors.push(err("DOCLING_REVIEW_FILE_ROLE_MISMATCH", "파일이 불변 상태가 아닙니다."));
    }
    if (file.checksumSha256 !== spec.checksum) {
      errors.push(err("DOCLING_REVIEW_CHECKSUM_MISMATCH"));
    }
    if (!file.storageKey?.trim()) {
      errors.push(err("DOCLING_REVIEW_OBJECT_MISSING"));
    }
  }

  if (input.verifyObjectStorage !== false && files.length === fileSpecs.length) {
    const storage = input.storage ?? getDefaultStorage();
    for (const file of files) {
      const snapChecksum =
        file.role === KnowledgePackFileRole.SOURCE_ORIGINAL
          ? snapshot.checksums.source
          : file.role === KnowledgePackFileRole.DOCLING_JSON
            ? snapshot.checksums.json
            : snapshot.checksums.markdown;
      try {
        const head = await storage.head({ objectKey: file.storageKey });
        if (!head.exists) {
          errors.push(err("DOCLING_REVIEW_OBJECT_MISSING"));
          continue;
        }
        const got = await storage.get({ objectKey: file.storageKey });
        if (got.bytes.byteLength !== Number(file.fileSize)) {
          errors.push(err("DOCLING_REVIEW_OBJECT_SIZE_MISMATCH"));
        }
        const actual = sha256Hex(got.bytes);
        if (actual !== file.checksumSha256 || actual !== snapChecksum) {
          errors.push(err("DOCLING_REVIEW_OBJECT_INTEGRITY_FAILED"));
        }
      } catch (error) {
        if (error instanceof DoclingImportError) {
          errors.push(err(error.code));
        } else {
          errors.push(
            err(
              "DOCLING_STORAGE_UNAVAILABLE",
              "저장소에서 파일을 확인하지 못했습니다.",
            ),
          );
        }
      }
    }
  }

  const nd = await prisma.normalizedDocument.findUnique({
    where: { id: snapshot.normalizedDocumentId },
  });
  if (!nd) {
    errors.push(err("DOCLING_REVIEW_NORMALIZED_DOCUMENT_MISSING"));
  } else {
    assertNormalizedMatches(nd, bundle, snapshot, packId, errors);
  }

  return { ok: errors.length === 0, errors, warnings };
}

function assertNormalizedMatches(
  nd: NormalizedDocument,
  bundle: DoclingImportBundle,
  snapshot: DoclingBundleReviewSubmitSnapshot,
  packId: string,
  errors: ReviewIntegrityIssue[],
): void {
  if (nd.bundleId !== bundle.id || nd.packId !== packId) {
    errors.push(err("DOCLING_REVIEW_NORMALIZED_DOCUMENT_MISMATCH"));
  }
  if (nd.versionId !== snapshot.submittedVersionId) {
    errors.push(err("DOCLING_REVIEW_VERSION_MISMATCH"));
  }
  if (!nd.isActive) {
    errors.push(err("DOCLING_REVIEW_NORMALIZED_DOCUMENT_MISMATCH"));
  }
  if (nd.adapterVersion !== snapshot.adapterVersion) {
    errors.push(err("DOCLING_REVIEW_ADAPTER_VERSION_MISMATCH"));
  }
  if ((nd.fingerprint ?? null) !== (snapshot.fingerprint ?? null)) {
    errors.push(err("DOCLING_REVIEW_FINGERPRINT_MISMATCH"));
  }
  if (
    nd.sourceFileId !== snapshot.sourceFileId ||
    nd.jsonPayloadFileId !== snapshot.jsonPayloadFileId ||
    nd.markdownPayloadFileId !== snapshot.markdownPayloadFileId
  ) {
    errors.push(err("DOCLING_REVIEW_NORMALIZED_DOCUMENT_MISMATCH"));
  }
  if ((nd.sourcePayloadChecksum ?? null) !== snapshot.checksums.source) {
    errors.push(err("DOCLING_REVIEW_CHECKSUM_MISMATCH"));
  }
}

export async function assertDoclingReviewIntegrityOrThrow(input: {
  packId: string;
  snapshot: DoclingBundleReviewSubmitSnapshot;
  verifyObjectStorage?: boolean;
  storage?: PayloadStorage;
  actorUserId?: string | null;
}): Promise<DoclingReviewIntegrityResult> {
  const result = await validateDoclingReviewIntegrity({
    packId: input.packId,
    snapshot: input.snapshot,
    verifyObjectStorage: input.verifyObjectStorage ?? true,
    storage: input.storage,
  });

  await recordProviderAudit({
    action: result.ok
      ? AuditAction.DOCLING_REVIEW_INTEGRITY_VERIFIED
      : AuditAction.DOCLING_REVIEW_INTEGRITY_FAILED,
    entityType: "DoclingImportBundle",
    entityId: input.snapshot.doclingBundleId,
    actorUserId: input.actorUserId ?? undefined,
    metadata: {
      packId: input.packId,
      versionId: input.snapshot.submittedVersionId,
      bundleId: input.snapshot.doclingBundleId,
      normalizedDocumentId: input.snapshot.normalizedDocumentId,
      errorCodes: result.errors.map((e) => e.code),
      verifiedAt: new Date().toISOString(),
    },
  });

  if (!result.ok) {
    throw new DoclingImportError(
      result.errors[0]?.code ?? "DOCLING_REVIEW_OBJECT_INTEGRITY_FAILED",
      result.errors[0]?.message ?? SAFE_USER_MESSAGE,
      409,
    );
  }

  return result;
}

/** Sync-friendly summary for DTO / UI helpers (precomputed). */
export function summarizeDoclingReviewIntegrity(
  result: DoclingReviewIntegrityResult | null | undefined,
): {
  status: "PASS" | "BLOCKED" | "UNKNOWN";
  errors: ReviewIntegrityIssue[];
  warnings: ReviewIntegrityIssue[];
} {
  if (!result) {
    return { status: "UNKNOWN", errors: [], warnings: [] };
  }
  return {
    status: result.ok ? "PASS" : "BLOCKED",
    errors: result.errors,
    warnings: result.warnings,
  };
}
