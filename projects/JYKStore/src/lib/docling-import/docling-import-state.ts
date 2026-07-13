import { DoclingImportBundleStatus } from "@prisma/client";
import { DoclingImportError } from "@/lib/docling-import/docling-import-errors";

const ALLOWED_TRANSITIONS: Record<DoclingImportBundleStatus, DoclingImportBundleStatus[]> = {
  UPLOADED: [DoclingImportBundleStatus.VALIDATING],
  VALIDATING: [
    DoclingImportBundleStatus.VALID,
    DoclingImportBundleStatus.VALIDATION_FAILED,
  ],
  VALIDATION_FAILED: [DoclingImportBundleStatus.VALIDATING],
  VALID: [DoclingImportBundleStatus.NORMALIZING],
  NORMALIZING: [
    DoclingImportBundleStatus.NORMALIZED,
    DoclingImportBundleStatus.NORMALIZATION_FAILED,
  ],
  NORMALIZED: [
    DoclingImportBundleStatus.REVIEW_READY,
    DoclingImportBundleStatus.VALIDATING,
  ],
  NORMALIZATION_FAILED: [DoclingImportBundleStatus.VALIDATING],
  REVIEW_READY: [],
};

export function assertTransition(
  from: DoclingImportBundleStatus,
  to: DoclingImportBundleStatus,
): void {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new DoclingImportError(
      "DOCLING_INVALID_TRANSITION",
      `Docling import 상태 전환이 허용되지 않습니다: ${from} → ${to}`,
      409,
    );
  }
}

export function canRetry(status: DoclingImportBundleStatus): boolean {
  return (
    status === DoclingImportBundleStatus.VALIDATION_FAILED ||
    status === DoclingImportBundleStatus.NORMALIZATION_FAILED ||
    status === DoclingImportBundleStatus.NORMALIZED
  );
}

export function getAllowedTransitions(
  from: DoclingImportBundleStatus,
): DoclingImportBundleStatus[] {
  return [...(ALLOWED_TRANSITIONS[from] ?? [])];
}
