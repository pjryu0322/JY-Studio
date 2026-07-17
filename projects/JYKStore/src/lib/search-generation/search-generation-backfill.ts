import { type Prisma, type SearchIndexGenerationScope, type SearchIndexGenerationStatus } from "@prisma/client";
import { parseKnowledgeRunBinding } from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { prisma } from "@/lib/prisma";
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
  skipped: number;
  skipReasons: Record<string, number>;
};

type BackfillClient = Prisma.TransactionClient | typeof prisma;

type ChunkRow = {
  id: string;
  metadata: unknown;
  chunkGenerationId: string | null;
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

/** Map legacy metadata.indexStatus/indexScope → new status/scope (§27). */
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

/**
 * Backfill SearchIndexGeneration rows from legacy KnowledgeChunk.metadata (§27/§28).
 * Idempotent (id = historical indexGenerationId; existing rows are reused, never
 * duplicated or demoted). Processed per version to bound memory.
 */
export async function backfillSearchGenerations(
  options: { versionId?: string; dryRun?: boolean; client?: BackfillClient } = {},
): Promise<BackfillReport> {
  const client = options.client ?? prisma;
  const dryRun = options.dryRun ?? false;
  const report: BackfillReport = {
    generationsFound: 0,
    created: 0,
    reused: 0,
    chunksLinked: 0,
    embeddingsLinked: 0,
    validationRunsLinked: 0,
    snapshotsChecked: 0,
    skipped: 0,
    skipReasons: {},
  };

  const versions = options.versionId
    ? [{ id: options.versionId }]
    : await client.knowledgePackVersion.findMany({ select: { id: true } });

  for (const { id: versionId } of versions) {
    const version = await client.knowledgePackVersion.findUnique({
      where: { id: versionId },
      select: { id: true, packId: true },
    });
    if (!version) continue;
    const packId = version.packId;

    const chunks: ChunkRow[] = await client.knowledgeChunk.findMany({
      where: { versionId },
      select: { id: true, metadata: true, chunkGenerationId: true },
    });
    if (chunks.length === 0) continue;

    // Group chunks by legacy indexGenerationId.
    const groups = new Map<string, ChunkRow[]>();
    for (const chunk of chunks) {
      const gen = metaString(metaRecord(chunk.metadata), "indexGenerationId");
      if (!gen) continue;
      const list = groups.get(gen) ?? [];
      list.push(chunk);
      groups.set(gen, list);
    }

    const reviews = await client.packReview.findMany({
      where: { packId },
      select: { submitSnapshot: true },
    });

    for (const [indexGenerationId, groupChunks] of groups) {
      report.generationsFound += 1;
      const sample = metaRecord(groupChunks[0]!.metadata);
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

      const nd = await client.normalizedDocument.findUnique({
        where: { id: normalizedDocumentId },
        select: { id: true, packId: true, versionId: true },
      });
      if (!nd || nd.packId !== packId || nd.versionId !== versionId) {
        bump(report, "nd_mismatch");
        continue;
      }

      const pipeline = await client.pipelineRun.findUnique({
        where: { id: pipelineRunId },
        select: { id: true, packId: true, summary: true },
      });
      if (!pipeline || pipeline.packId !== packId) {
        bump(report, "pipeline_mismatch");
        continue;
      }
      const binding = parseKnowledgeRunBinding(pipeline.summary);
      if (
        binding &&
        (binding.indexGenerationId !== indexGenerationId || binding.versionId !== versionId)
      ) {
        bump(report, "binding_mismatch");
        continue;
      }

      const chunkIds = groupChunks.map((c) => c.id);
      const embeddings = await client.knowledgeChunkEmbedding.findMany({
        where: { chunkId: { in: chunkIds } },
        select: {
          chunkId: true,
          provider: true,
          model: true,
          dimension: true,
          contentHash: true,
        },
      });
      const contentHashByChunk = new Map(embeddings.map((e) => [e.chunkId, e.contentHash]));
      const descriptor = embeddings[0]
        ? {
            embeddingProvider: embeddings[0].provider,
            embeddingModel: embeddings[0].model,
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
        chunks: chunkIds.map((id) => ({
          chunkId: id,
          contentHash: contentHashByChunk.get(id) ?? "",
        })),
      });

      const { status, scope: genScope } = mapStatusScope(indexStatus, indexScope);

      // Snapshot cross-check (read-only, §28 reporting).
      for (const review of reviews) {
        const snap = metaRecord(review.submitSnapshot);
        if (snap && snap.indexGenerationId === indexGenerationId) {
          report.snapshotsChecked += 1;
        }
      }

      const existing = await client.searchIndexGeneration.findUnique({
        where: { id: indexGenerationId },
        select: { id: true },
      });

      if (existing) {
        report.reused += 1;
      } else if (!dryRun) {
        await client.searchIndexGeneration.create({
          data: {
            id: indexGenerationId,
            packId,
            versionId,
            pipelineRunId,
            normalizedDocumentId,
            chunkGenerationId: indexGenerationId,
            fingerprint,
            ...descriptor,
            chunkCount: chunkIds.length,
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
        report.created += 1;
      } else {
        report.created += 1; // dry-run projection
      }

      if (!dryRun) {
        const linkedChunks = await client.knowledgeChunk.updateMany({
          where: { versionId, id: { in: chunkIds }, chunkGenerationId: null },
          data: { chunkGenerationId: indexGenerationId },
        });
        report.chunksLinked += linkedChunks.count;

        const linkedEmbeddings = await client.knowledgeChunkEmbedding.updateMany({
          where: { chunkId: { in: chunkIds }, searchIndexGenerationId: null },
          data: { searchIndexGenerationId: indexGenerationId },
        });
        report.embeddingsLinked += linkedEmbeddings.count;

        const linkedRuns = await client.serviceValidationRun.updateMany({
          where: { versionId, indexGenerationId, searchIndexGenerationId: null },
          data: { searchIndexGenerationId: indexGenerationId },
        });
        report.validationRunsLinked += linkedRuns.count;
      }
    }
  }

  return report;
}
