import type { ExternalImportArtifactInput } from "@/lib/artifact-state/types";

/** Tool-agnostic readiness for a public catalog external import artifact. */
export function isExternalImportArtifactReady(
  input: ExternalImportArtifactInput | null | undefined,
): boolean {
  if (!input) return false;
  if (!input.isActive) return false;
  if (input.deletedAt != null) return false;
  if (input.storageStatus !== "ACTIVE") return false;
  // REVIEW_READY is the serviceable publish gate used by current external import adapters.
  if (input.status !== "REVIEW_READY") return false;
  if (!input.normalizedDocument?.isActive) return false;
  return true;
}

export function pickReadyExternalImport(
  imports: ExternalImportArtifactInput[] | null | undefined,
): ExternalImportArtifactInput | null {
  if (!imports?.length) return null;
  return imports.find((item) => isExternalImportArtifactReady(item)) ?? null;
}

/**
 * Convert a DB Docling (or future) import bundle row into the common external-import input.
 * Catalog/UI must not call this; query layer only.
 */
export function toExternalImportArtifactInput(bundle: {
  id: string;
  isActive: boolean;
  status: string;
  storageStatus: string;
  deletedAt: Date | null;
  adapterType?: string | null;
  normalizedDocuments?: Array<{ id: string; isActive: boolean }> | null;
}): ExternalImportArtifactInput {
  const normalized = bundle.normalizedDocuments?.find((doc) => doc.isActive) ?? null;
  return {
    bundleId: bundle.id,
    isActive: bundle.isActive,
    status: bundle.status,
    storageStatus: bundle.storageStatus,
    deletedAt: bundle.deletedAt,
    normalizedDocument: normalized
      ? { id: normalized.id, isActive: normalized.isActive }
      : null,
    generatorName: bundle.adapterType?.trim() || null,
  };
}
