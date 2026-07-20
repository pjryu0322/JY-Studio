/**
 * Import channel labels — separates legacy Docling JSON/MD from ZIP Worker path.
 * Not a Prisma enum; stored in job/pipeline metadata / audit fields.
 */

export const IMPORT_CHANNELS = {
  LEGACY_DOCLING_UPLOAD: "legacy_docling_upload",
  MANUAL_DOCLING_IMPORT: "manual_docling_import",
  WORKER_ZIP_IMPORT: "worker_zip_import",
} as const;

export type ImportChannel = (typeof IMPORT_CHANNELS)[keyof typeof IMPORT_CHANNELS];

export function isWorkerZipImportChannel(channel: string | null | undefined): boolean {
  return channel === IMPORT_CHANNELS.WORKER_ZIP_IMPORT;
}

export function isLegacyDoclingImportChannel(channel: string | null | undefined): boolean {
  return (
    channel === IMPORT_CHANNELS.LEGACY_DOCLING_UPLOAD ||
    channel === IMPORT_CHANNELS.MANUAL_DOCLING_IMPORT
  );
}
