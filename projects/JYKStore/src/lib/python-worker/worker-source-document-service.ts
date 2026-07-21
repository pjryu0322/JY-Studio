/**
 * P5: build the sourcePath -> SourceDocument.id mapping for a ZIP Worker import.
 *
 * `importWorkerOutputToStoreDb({ sourceDocumentIdByPath })` uses this so imported
 * KnowledgeChunks link back to a SourceDocument. SourceDocument only requires
 * `versionId` + `title` (no DoclingImportBundle FK), so the ZIP path can create
 * them directly without touching the Docling bundle machinery.
 *
 * Idempotent: re-running for the same version reuses existing rows (matched by
 * checksum, else fileName) instead of creating duplicates.
 */
import path from "node:path";
import { prisma } from "@/lib/prisma";
import type { WorkerOutputImportPayload } from "@/lib/python-worker/worker-output-import-service";

/** legacySourceType marker for SourceDocuments created from the ZIP Worker path. */
export const WORKER_ZIP_SOURCE_LEGACY_TYPE = "WORKER_ZIP_SOURCE";

type PrismaClientLike = typeof prisma;

export type EnsureWorkerSourceDocumentsInput = {
  payload: WorkerOutputImportPayload;
  productVersion?: string | null;
  prismaClient?: PrismaClientLike;
};

function basename(sourcePath: string): string {
  const normalized = sourcePath.replace(/\\/g, "/");
  return path.posix.basename(normalized) || normalized;
}

/**
 * Ensure a SourceDocument exists for each normalized document and return a
 * `sourcePath -> SourceDocument.id` mapping. Checksums are read from the worker
 * inventory (sha256), falling back to source_trace (sourceHash).
 */
export async function ensureWorkerSourceDocuments(
  input: EnsureWorkerSourceDocumentsInput,
): Promise<Record<string, string>> {
  const client = input.prismaClient ?? prisma;
  const versionId = input.payload.packVersionId;
  const productVersion = input.productVersion?.trim() || null;

  const checksumByPath = new Map<string, string>();
  for (const entry of input.payload.inventory) {
    if (entry.sourcePath && entry.sha256) checksumByPath.set(entry.sourcePath, entry.sha256);
  }
  for (const trace of input.payload.sourceTraces) {
    if (trace.sourcePath && trace.sourceHash && !checksumByPath.has(trace.sourcePath)) {
      checksumByPath.set(trace.sourcePath, trace.sourceHash);
    }
  }

  const mapping: Record<string, string> = {};
  for (const doc of input.payload.normalizedDocuments) {
    const sourcePath = doc.sourcePath;
    if (!sourcePath || mapping[sourcePath]) continue;

    const checksum = checksumByPath.get(sourcePath) ?? null;
    const fileName = basename(sourcePath);
    const title = doc.title?.trim() || fileName || sourcePath;

    const existing = await client.sourceDocument.findFirst({
      where: {
        versionId,
        legacySourceType: WORKER_ZIP_SOURCE_LEGACY_TYPE,
        ...(checksum ? { checksum } : { fileName }),
      },
      select: { id: true },
    });
    if (existing) {
      mapping[sourcePath] = existing.id;
      continue;
    }

    const created = await client.sourceDocument.create({
      data: {
        versionId,
        title,
        sourceType: "ETC",
        legacySourceType: WORKER_ZIP_SOURCE_LEGACY_TYPE,
        sourceFormat: "TEXT",
        fileName,
        checksum,
        productVersion,
        validationStatus: "NOT_CHECKED",
      },
      select: { id: true },
    });
    mapping[sourcePath] = created.id;
  }

  return mapping;
}
