/**
 * P5: build the sourcePath -> SourceDocument.id mapping for a ZIP Worker import.
 *
 * `importWorkerOutputToStoreDb({ sourceDocumentIdByPath })` uses this so imported
 * KnowledgeChunks link back to a SourceDocument. SourceDocument only requires
 * `versionId` + `title` (no DoclingImportBundle FK), so the ZIP path can create
 * them directly without touching the Docling bundle machinery.
 *
 * Idempotent: re-running for the same version+revision reuses existing rows
 * (matched by checksum, else fileName) instead of creating duplicates. When
 * reusing, empty `content` is backfilled from the Worker normalized document so
 * legacy quality gates (source validation / structure coverage) can actually run.
 *
 * License / review-only documents are not persisted (not knowledge/quality targets).
 * Orphan WORKER_ZIP rows are removed only within the same
 * versionId+sourceRevisionId+workingCopyId so other revisions/copies are never
 * deleted or overwritten.
 */
import path from "node:path";
import { prisma } from "@/lib/prisma";
import type { WorkerOutputImportPayload } from "@/lib/python-worker/worker-output-import-service";
import {
  buildWorkerSourceDocumentContent,
  resolveWorkerSourceDocumentFormat,
  resolveWorkerSourceDocumentType,
} from "@/lib/python-worker/worker-source-document-content";
import { isWorkerReviewOnlyDocument } from "@/lib/python-worker/worker-license-like";

/** legacySourceType marker for SourceDocuments created from the ZIP Worker path. */
export const WORKER_ZIP_SOURCE_LEGACY_TYPE = "WORKER_ZIP_SOURCE";

type PrismaClientLike = typeof prisma;

export type EnsureWorkerSourceDocumentsInput = {
  payload: WorkerOutputImportPayload;
  productVersion?: string | null;
  /** P1: scope create/reuse/orphan-delete to this immutable source revision. */
  sourceRevisionId?: string | null;
  /** P1.1: scope create/reuse/orphan-delete to this Working Copy execution. */
  workingCopyId?: string | null;
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
  const sourceRevisionId = input.sourceRevisionId?.trim() || null;
  const workingCopyId = input.workingCopyId?.trim() || null;

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
    if (isWorkerReviewOnlyDocument(doc)) continue;

    const checksum = checksumByPath.get(sourcePath) ?? null;
    const fileName = basename(sourcePath);
    const title = doc.title?.trim() || fileName || sourcePath;
    const content = buildWorkerSourceDocumentContent(doc);
    const sourceType = resolveWorkerSourceDocumentType(doc);
    const sourceFormat = resolveWorkerSourceDocumentFormat(doc);

    const existing = await client.sourceDocument.findFirst({
      where: {
        versionId,
        legacySourceType: WORKER_ZIP_SOURCE_LEGACY_TYPE,
        ...(sourceRevisionId
          ? { sourceRevisionId }
          : { sourceRevisionId: null }),
        ...(workingCopyId
          ? { workingCopyId }
          : { workingCopyId: null }),
        ...(checksum ? { checksum } : { fileName }),
      },
      select: { id: true, content: true },
    });
    if (existing) {
      // Backfill content/typing when an earlier Worker import left the row empty
      // (pre-quality-wiring). Do not clobber a non-empty content the Admin edited.
      if (!existing.content?.trim() && content.trim()) {
        await client.sourceDocument.update({
          where: { id: existing.id },
          data: {
            content,
            sourceType,
            sourceFormat,
            title,
            ...(productVersion ? { productVersion } : {}),
            ...(sourceRevisionId ? { sourceRevisionId } : {}),
            ...(workingCopyId ? { workingCopyId } : {}),
            validationStatus: "NOT_CHECKED",
          },
        });
      } else if (sourceRevisionId || workingCopyId) {
        await client.sourceDocument.update({
          where: { id: existing.id },
          data: {
            ...(sourceRevisionId ? { sourceRevisionId } : {}),
            ...(workingCopyId ? { workingCopyId } : {}),
          },
        });
      }
      mapping[sourcePath] = existing.id;
      continue;
    }

    const created = await client.sourceDocument.create({
      data: {
        versionId,
        sourceRevisionId,
        workingCopyId,
        title,
        sourceType,
        legacySourceType: WORKER_ZIP_SOURCE_LEGACY_TYPE,
        sourceFormat,
        fileName,
        checksum,
        content,
        productVersion,
        validationStatus: "NOT_CHECKED",
      },
      select: { id: true },
    });
    mapping[sourcePath] = created.id;
  }

  // Never delete SourceDocuments belonging to other revisions or working copies.
  if (sourceRevisionId && workingCopyId) {
    const keptIds = Object.values(mapping);
    await client.sourceDocument.deleteMany({
      where: {
        versionId,
        sourceRevisionId,
        workingCopyId,
        legacySourceType: WORKER_ZIP_SOURCE_LEGACY_TYPE,
        ...(keptIds.length > 0 ? { id: { notIn: keptIds } } : {}),
      },
    });
  } else if (sourceRevisionId && !workingCopyId) {
    // Legacy P1 rows without workingCopyId: keep prior revision-scoped orphan delete.
    const keptIds = Object.values(mapping);
    await client.sourceDocument.deleteMany({
      where: {
        versionId,
        sourceRevisionId,
        workingCopyId: null,
        legacySourceType: WORKER_ZIP_SOURCE_LEGACY_TYPE,
        ...(keptIds.length > 0 ? { id: { notIn: keptIds } } : {}),
      },
    });
  }

  return mapping;
}
