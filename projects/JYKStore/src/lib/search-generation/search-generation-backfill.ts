import {
  type Prisma,
  type SearchIndexGenerationScope,
  type SearchIndexGenerationStatus,
} from "@prisma/client";
import { parseKnowledgeRunBinding } from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { DOCLING_RETRIEVAL_CHUNK_TYPE } from "@/lib/docling-knowledge/docling-knowledge-stages";
import { computeChunkContentHash } from "@/lib/chunk-embedding-service";
import { prisma } from "@/lib/prisma";
import { LEGACY_MODEL_REVISION } from "@/lib/embedding/e5-embedding-constants";
import { computeSearchGenerationFingerprint } from "@/lib/search-generation/search-generation-fingerprint";
import { defaultLocalEmbeddingDescriptor } from "@/lib/search-generation/search-generation-types";

export type BackfillReport = {
  generationsFound: number;
  created: number;
  reused: number;
  chunksLinked: number;
  embeddingsLinked: number;
  validationRunsLinked: number;
  snapshotsChecked: number;
  snapshotsValid: number;
  snapshotsInvalid: number;
  snapshotMismatchReasons: Record<string, number>;
  skipped: number;
  skipReasons: Record<string, number>;
  nullFkRemaining: {
    chunksWithoutColumn: number;
    embeddingsWithoutFk: number;
    validationRunsWithoutFk: number;
  };
};

type BackfillClient = Prisma.TransactionClient | typeof prisma;

type ChunkRow = {
  id: string;
  metadata: unknown;
  chunkGenerationId: string | null;
  chunkType: string;
  title: string;
  content: string;
  section: string | null;
  tags: string[];
};

function metaRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function metaString(meta: Record<string, unknown> | null, key: string): string | null {
  if (!meta) return null;
  const v = meta[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function mapStatusScope(
  indexStatus: string | null,
  indexScope: string | null,
): { status: SearchIndexGenerationStatus; scope: SearchIndexGenerationScope } {
  switch (indexStatus) {
    case "APPROVED":
      return { status: "PROMOTED", scope: "PRODUCTION" };
    case "FAILED":
      return { status: "FAILED", scope: scope(indexScope) };
    case "RETIRED":
      return { status: "RETIRED", scope: scope(indexScope) };
    case "DRAFT":
      return { status: "READY", scope: "DRAFT" };
    case "BUILDING":
      return { status: "PENDING", scope: "DRAFT" };
    default:
      return { status: "READY", scope: scope(indexScope) };
  }
}

function scope(indexScope: string | null): SearchIndexGenerationScope {
  return indexScope === "PRODUCTION" ? "PRODUCTION" : "DRAFT";
}

function bump(report: BackfillReport, reason: string): void {
  report.skipped += 1;
  report.skipReasons[reason] = (report.skipReasons[reason] ?? 0) + 1;
}

function bumpSnapshot(report: BackfillReport, reason: string): void {
  report.snapshotsInvalid += 1;
  report.snapshotMismatchReasons[reason] =
    (report.snapshotMismatchReasons[reason] ?? 0) + 1;
}

/** All chunks in a generation group must share the same binding fields. */
function assertHomogeneousChunkBinding(
  groupChunks: ChunkRow[],
  indexGenerationId: string,
): { ok: true; sample: Record<string, unknown> } | { ok: false; reason: string } {
  let sample: Record<string, unknown> | null = null;
  for (const chunk of groupChunks) {
    const meta = metaRecord(chunk.metadata);
    if (!meta) return { ok: false, reason: "mixed_chunk_binding" };
    const keys = [
      "indexGenerationId",
      "pipelineRunId",
      "normalizedDocumentId",
      "fingerprint",
      "normalizedDocumentFingerprint",
      "indexScope",
      "indexStatus",
    ] as const;
    if (!sample) {
      sample = meta;
      if (metaString(meta, "indexGenerationId") !== indexGenerationId) {
        return { ok: false, reason: "mixed_chunk_binding" };
      }
      continue;
    }
    for (const key of keys) {
      const a = meta[key] ?? null;
      const b = sample[key] ?? null;
      if (key === "fingerprint" || key === "normalizedDocumentFingerprint") {
        const aFp =
          metaString(meta, "normalizedDocumentFingerprint") ?? metaString(meta, "fingerprint");
        const bFp =
          metaString(sample, "normalizedDocumentFingerprint") ??
          metaString(sample, "fingerprint");
        if (aFp !== bFp) return { ok: false, reason: "mixed_chunk_binding" };
        continue;
      }
      if (String(a ?? "") !== String(b ?? "")) {
        return { ok: false, reason: "mixed_chunk_binding" };
      }
    }
  }
  if (!sample) return { ok: false, reason: "mixed_chunk_binding" };
  return { ok: true, sample };
}

/**
 * Backfill SearchIndexGeneration rows from legacy KnowledgeChunk.metadata.
 * Idempotent; mixed binding/provider groups are skipped; one generation = one tx.
 */
export async function backfillSearchGenerations(
  options: { versionId?: string; dryRun?: boolean; client?: BackfillClient } = {},
): Promise<BackfillReport> {
  const root = options.client ?? prisma;
  const dryRun = options.dryRun ?? false;
  const report: BackfillReport = {
    generationsFound: 0,
    created: 0,
    reused: 0,
    chunksLinked: 0,
    embeddingsLinked: 0,
    validationRunsLinked: 0,
    snapshotsChecked: 0,
    snapshotsValid: 0,
    snapshotsInvalid: 0,
    snapshotMismatchReasons: {},
    skipped: 0,
    skipReasons: {},
    nullFkRemaining: {
      chunksWithoutColumn: 0,
      embeddingsWithoutFk: 0,
      validationRunsWithoutFk: 0,
    },
  };

  const versions = options.versionId
    ? [{ id: options.versionId }]
    : await root.knowledgePackVersion.findMany({ select: { id: true } });

  for (const { id: versionId } of versions) {
    const version = await root.knowledgePackVersion.findUnique({
      where: { id: versionId },
      select: { id: true, packId: true },
    });
    if (!version) continue;
    const packId = version.packId;

    // Distinct generation ids via cursor pagination (avoid loading entire version unboundedly
    // into a single fingerprint map when possible — still group in-memory per version for correctness).
    const PAGE = 500;
    let cursor: string | undefined;
    const groups = new Map<string, ChunkRow[]>();
    for (;;) {
      const page: ChunkRow[] = await root.knowledgeChunk.findMany({
        where: { versionId },
        take: PAGE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
        select: {
          id: true,
          metadata: true,
          chunkGenerationId: true,
          chunkType: true,
          title: true,
          content: true,
          section: true,
          tags: true,
        },
      });
      if (page.length === 0) break;
      for (const chunk of page) {
        const gen = metaString(metaRecord(chunk.metadata), "indexGenerationId");
        if (!gen) continue;
        const list = groups.get(gen) ?? [];
        list.push(chunk);
        groups.set(gen, list);
      }
      cursor = page[page.length - 1]!.id;
      if (page.length < PAGE) break;
    }

    const reviews = await root.packReview.findMany({
      where: { packId },
      select: { submitSnapshot: true },
    });

    for (const [indexGenerationId, groupChunks] of groups) {
      report.generationsFound += 1;

      const bindingCheck = assertHomogeneousChunkBinding(groupChunks, indexGenerationId);
      if (!bindingCheck.ok) {
        bump(report, bindingCheck.reason);
        continue;
      }
      const sample = bindingCheck.sample;
      const normalizedDocumentId = metaString(sample, "normalizedDocumentId");
      const pipelineRunId = metaString(sample, "pipelineRunId");
      const fingerprint =
        metaString(sample, "normalizedDocumentFingerprint") ??
        metaString(sample, "fingerprint");
      const indexStatus = metaString(sample, "indexStatus");
      const indexScope = metaString(sample, "indexScope");

      if (!normalizedDocumentId || !fingerprint) {
        bump(report, "missing_nd_metadata");
        continue;
      }
      if (!pipelineRunId) {
        bump(report, "missing_pipeline_metadata");
        continue;
      }

      const nd = await root.normalizedDocument.findUnique({
        where: { id: normalizedDocumentId },
        select: { id: true, packId: true, versionId: true },
      });
      if (!nd || nd.packId !== packId || nd.versionId !== versionId) {
        bump(report, "nd_mismatch");
        continue;
      }

      const pipeline = await root.pipelineRun.findUnique({
        where: { id: pipelineRunId },
        select: { id: true, packId: true, summary: true },
      });
      if (!pipeline || pipeline.packId !== packId) {
        bump(report, "pipeline_mismatch");
        continue;
      }
      const binding = parseKnowledgeRunBinding(pipeline.summary);
      if (!binding) {
        bump(report, "binding_mismatch");
        continue;
      }
      if (binding.indexGenerationId !== indexGenerationId || binding.versionId !== versionId) {
        bump(report, "binding_mismatch");
        continue;
      }

      const chunkIds = groupChunks.map((c) => c.id);
      const retrievalChunkIds = groupChunks
        .filter((c) => c.chunkType === DOCLING_RETRIEVAL_CHUNK_TYPE)
        .map((c) => c.id);
      const fingerprintChunkIds =
        retrievalChunkIds.length > 0 ? retrievalChunkIds : chunkIds;
      const embeddings = await root.knowledgeChunkEmbedding.findMany({
        where: { chunkId: { in: fingerprintChunkIds } },
        select: {
          chunkId: true,
          provider: true,
          model: true,
          dimension: true,
          contentHash: true,
        },
      });

      const descriptorKeys = new Set(
        embeddings.map((e) => `${e.provider}|${e.model}|${e.dimension}`),
      );
      if (descriptorKeys.size > 1) {
        bump(report, "mixed_embedding_descriptor");
        continue;
      }

      const contentHashByChunk = new Map(embeddings.map((e) => [e.chunkId, e.contentHash]));
      let contentHashMismatch = false;
      for (const chunk of groupChunks) {
        if (!fingerprintChunkIds.includes(chunk.id)) continue;
        const stored = contentHashByChunk.get(chunk.id);
        if (stored == null) continue;
        const expected = computeChunkContentHash(chunk);
        if (stored !== expected) {
          contentHashMismatch = true;
          break;
        }
      }
      if (contentHashMismatch) {
        bump(report, "embedding_content_hash_mismatch");
        continue;
      }

      const descriptor = embeddings[0]
        ? {
            embeddingProvider: embeddings[0].provider,
            embeddingModel: embeddings[0].model,
            // Legacy embeddings predate revision pinning — record explicit compatibility value.
            embeddingModelRevision: LEGACY_MODEL_REVISION,
            embeddingDimension: embeddings[0].dimension,
            distanceMetric: defaultLocalEmbeddingDescriptor().distanceMetric,
          }
        : defaultLocalEmbeddingDescriptor();

      const generationFingerprint = computeSearchGenerationFingerprint({
        packId,
        versionId,
        pipelineRunId,
        normalizedDocumentId,
        chunkGenerationId: indexGenerationId,
        normalizedDocumentFingerprint: fingerprint,
        ...descriptor,
        chunks: fingerprintChunkIds.map((id) => ({
          chunkId: id,
          contentHash: contentHashByChunk.get(id) ?? "",
        })),
      });

      const { status, scope: genScope } = mapStatusScope(indexStatus, indexScope);

      for (const review of reviews) {
        const snap = metaRecord(review.submitSnapshot);
        if (!snap) continue;
        if (
          snap.indexGenerationId !== indexGenerationId &&
          snap.searchIndexGenerationId !== indexGenerationId
        ) {
          continue;
        }
        report.snapshotsChecked += 1;
        const snapPipeline = typeof snap.pipelineRunId === "string" ? snap.pipelineRunId : null;
        const snapNd =
          typeof snap.normalizedDocumentId === "string" ? snap.normalizedDocumentId : null;
        const snapFp =
          typeof snap.normalizedDocumentFingerprint === "string"
            ? snap.normalizedDocumentFingerprint
            : typeof snap.fingerprint === "string"
              ? snap.fingerprint
              : null;
        if (snapPipeline !== pipelineRunId) {
          bumpSnapshot(report, "snapshot_pipeline_mismatch");
          continue;
        }
        if (snapNd !== normalizedDocumentId) {
          bumpSnapshot(report, "snapshot_nd_mismatch");
          continue;
        }
        if (snapFp !== fingerprint) {
          bumpSnapshot(report, "snapshot_fingerprint_mismatch");
          continue;
        }
        report.snapshotsValid += 1;
      }

      const existing = await root.searchIndexGeneration.findUnique({
        where: { id: indexGenerationId },
      });

      if (existing) {
        const mismatch =
          existing.packId !== packId ||
          existing.versionId !== versionId ||
          existing.pipelineRunId !== pipelineRunId ||
          existing.normalizedDocumentId !== normalizedDocumentId ||
          existing.chunkGenerationId !== indexGenerationId ||
          existing.fingerprint !== fingerprint ||
          existing.embeddingProvider !== descriptor.embeddingProvider ||
          existing.embeddingModel !== descriptor.embeddingModel ||
          existing.embeddingDimension !== descriptor.embeddingDimension ||
          existing.distanceMetric !== descriptor.distanceMetric ||
          existing.generationFingerprint !== generationFingerprint;
        if (mismatch) {
          bump(report, "existing_generation_mismatch");
          continue;
        }
        report.reused += 1;
      }

      const apply = async (tx: BackfillClient) => {
        if (!existing) {
          if (!dryRun) {
            await tx.searchIndexGeneration.create({
              data: {
                id: indexGenerationId,
                packId,
                versionId,
                pipelineRunId,
                normalizedDocumentId,
                chunkGenerationId: indexGenerationId,
                fingerprint,
                ...descriptor,
                chunkCount: fingerprintChunkIds.length,
                embeddedCount: embeddings.length,
                status,
                scope: genScope,
                generationFingerprint,
                completedAt: status === "READY" || status === "PROMOTED" ? new Date() : null,
                promotedAt: status === "PROMOTED" ? new Date() : null,
                staleAt: status === "STALE" ? new Date() : null,
                retiredAt: status === "RETIRED" ? new Date() : null,
              },
            });
          }
          report.created += 1;
        }

        if (!dryRun) {
          const linkedChunks = await tx.knowledgeChunk.updateMany({
            where: { versionId, id: { in: chunkIds }, chunkGenerationId: null },
            data: { chunkGenerationId: indexGenerationId },
          });
          report.chunksLinked += linkedChunks.count;

          const linkedEmbeddings = await tx.knowledgeChunkEmbedding.updateMany({
            where: { chunkId: { in: fingerprintChunkIds }, searchIndexGenerationId: null },
            data: { searchIndexGenerationId: indexGenerationId },
          });
          report.embeddingsLinked += linkedEmbeddings.count;

          const linkedRuns = await tx.serviceValidationRun.updateMany({
            where: { versionId, indexGenerationId, searchIndexGenerationId: null },
            data: { searchIndexGenerationId: indexGenerationId },
          });
          report.validationRunsLinked += linkedRuns.count;
        }
      };

      if (dryRun) {
        await apply(root);
      } else if ("$transaction" in root && typeof root.$transaction === "function") {
        try {
          await (root as typeof prisma).$transaction(async (tx) => apply(tx));
        } catch {
          bump(report, "generation_tx_rollback");
        }
      } else {
        await apply(root);
      }
    }

    report.nullFkRemaining.chunksWithoutColumn += await root.knowledgeChunk.count({
      where: { versionId, chunkGenerationId: null },
    });
    report.nullFkRemaining.embeddingsWithoutFk += await root.knowledgeChunkEmbedding.count({
      where: { versionId, searchIndexGenerationId: null },
    });
    report.nullFkRemaining.validationRunsWithoutFk += await root.serviceValidationRun.count({
      where: {
        versionId,
        indexGenerationId: { not: null },
        searchIndexGenerationId: null,
      },
    });
  }

  return report;
}
