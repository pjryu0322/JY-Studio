import {
  DoclingBundleStorageStatus,
  DoclingImportBundleStatus,
  type KnowledgePackFileRole,
} from "@prisma/client";
import type { DoclingImportBundlePublicDto } from "@/lib/docling-import/docling-import-dto";

export type DoclingBundleMaterialContext = {
  id: string;
  status: string;
  isActive: boolean;
  deletedAt: Date | null;
  storageStatus: DoclingBundleStorageStatus | string;
  packId: string;
  versionId: string;
  files: Array<{ id: string; role: KnowledgePackFileRole; checksumSha256?: string | null }>;
  normalizedDocument: {
    id: string;
    packId: string;
    versionId: string;
    bundleId: string;
    isActive: boolean;
    sourceFileId: string | null;
    jsonPayloadFileId: string | null;
    fingerprint: string | null;
  } | null;
};

/**
 * Docling registration flow: active REVIEW_READY bundle with required files and ND links.
 */
export function isDoclingSourceMaterialsReady(
  ctx: DoclingBundleMaterialContext | null | undefined,
): boolean {
  if (!ctx) return false;
  if (!ctx.isActive || ctx.deletedAt != null) return false;
  if (ctx.storageStatus !== DoclingBundleStorageStatus.ACTIVE) return false;
  if (ctx.status !== DoclingImportBundleStatus.REVIEW_READY) return false;

  const byRole = new Map(ctx.files.map((f) => [f.role, f]));
  const source = byRole.get("SOURCE_ORIGINAL");
  const json = byRole.get("DOCLING_JSON");
  if (!source?.id?.trim() || !json?.id?.trim()) return false;
  if (!source.checksumSha256?.trim() || !json.checksumSha256?.trim()) return false;

  const nd = ctx.normalizedDocument;
  if (!nd || !nd.isActive) return false;
  if (nd.packId !== ctx.packId || nd.versionId !== ctx.versionId) return false;
  if (nd.bundleId !== ctx.id) return false;
  if (!nd.sourceFileId || nd.sourceFileId !== source.id) return false;
  if (!nd.jsonPayloadFileId || nd.jsonPayloadFileId !== json.id) return false;
  if (!nd.fingerprint?.trim()) return false;

  return true;
}

export function doclingBundlePublicToMaterialContext(
  bundle: DoclingImportBundlePublicDto | null | undefined,
): DoclingBundleMaterialContext | null {
  if (!bundle) return null;
  const nd = bundle.normalizedDocument;
  return {
    id: bundle.id,
    status: bundle.status,
    isActive: bundle.isActive,
    deletedAt: null,
    storageStatus: bundle.storageStatus,
    packId: bundle.packId,
    versionId: bundle.versionId,
    files: bundle.files.map((f) => ({
      id: f.id,
      role: f.role,
      checksumSha256: f.checksumSha256,
    })),
    normalizedDocument: nd
      ? {
          id: nd.id,
          packId: nd.packId,
          versionId: nd.versionId,
          bundleId: nd.bundleId,
          isActive: nd.isActive,
          sourceFileId: nd.sourceFileId,
          jsonPayloadFileId: nd.jsonPayloadFileId,
          fingerprint: nd.fingerprint,
        }
      : null,
  };
}
