import crypto from "crypto";
import type { KnowledgeChunk, Prisma } from "@prisma/client";
import {
  DEFAULT_EMBEDDING_DIMENSION,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_PROVIDER,
  type EmbeddingRebuildResultDto,
  type PackEmbeddingSummaryDto,
} from "@/lib/embedding-dto";
import type { EmbeddingDescriptor, EmbeddingProviderAdapter } from "@/lib/embedding/embedding-provider-adapter";
import { readEmbeddingProviderConfig } from "@/lib/embedding/embedding-provider-config";
import { isEmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";
import { LOCAL_E5_EMBEDDING_PROVIDER } from "@/lib/embedding/e5-embedding-constants";
import {
  buildPassageEmbeddingText,
  validateRetrievalChunkPassageForE5,
} from "@/lib/embedding/e5-embedding-text";
import {
  assertEmbeddingProviderProductionReady,
  resolveEmbeddingProviderAdapter,
  resolveEmbeddingProviderAdapterForDescriptor,
} from "@/lib/embedding/embedding-provider-registry";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import { prisma } from "@/lib/prisma";
import { loadSearchGeneration } from "@/lib/search-generation/search-generation-service";
import { upsertSearchIndexVector } from "@/lib/search-vector/search-vector-store";

const PROVIDER = DEFAULT_EMBEDDING_PROVIDER;
const MODEL = DEFAULT_EMBEDDING_MODEL;
const DIMENSION = DEFAULT_EMBEDDING_DIMENSION;

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${k}:${stableStringify(v)}`).join(",")}}`;
  }
  return String(value);
}

// P14.1: embedding contentHash는 title/content/section/tags 기준으로만 계산한다.
// metadata는 Retrieval filter 조건으로만 사용되고 embedding vector text에는 포함되지 않으므로
// stale 판정에서도 제외한다. (metadata만 변경해도 embedding rebuild가 유도되지 않도록)
export function computeChunkContentHash(chunk: {
  title: string;
  content: string;
  section: string | null;
  tags: string[];
}): string {
  const payload = stableStringify({
    title: chunk.title,
    content: chunk.content,
    section: chunk.section ?? "",
    tags: [...chunk.tags].sort(),
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function buildEmbeddingText(
  chunk: {
    id: string;
    title: string;
    content: string;
    section: string | null;
    tags: string[];
  },
  provider: string,
): string {
  if (provider === LOCAL_E5_EMBEDDING_PROVIDER) {
    return buildPassageEmbeddingText(chunk);
  }
  return [chunk.title, chunk.section ?? "", chunk.tags.join(" "), chunk.content]
    .filter(Boolean)
    .join("\n");
}

async function getLatestVersionId(packId: string): Promise<string | null> {
  const version = await prisma.knowledgePackVersion.findFirst({
    where: { packId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return version?.id ?? null;
}

export async function getPackEmbeddingSummary(
  packId: string,
): Promise<PackEmbeddingSummaryDto | null> {
  const pack = await prisma.knowledgePack.findUnique({ where: { packId }, select: { packId: true } });
  if (!pack) return null;

  const versionId = await getLatestVersionId(packId);

  const base: PackEmbeddingSummaryDto = {
    packId,
    provider: PROVIDER,
    model: MODEL,
    dimension: DIMENSION,
    activeChunkCount: 0,
    embeddedChunkCount: 0,
    missingEmbeddingCount: 0,
    staleEmbeddingCount: 0,
  };

  if (!versionId) return base;

  const activeChunks = await prisma.knowledgeChunk.findMany({
    where: { versionId, isActive: true },
    select: { id: true, title: true, content: true, section: true, tags: true, metadata: true },
  });

  const embeddings = await prisma.knowledgeChunkEmbedding.findMany({
    where: { chunkId: { in: activeChunks.map((c) => c.id) }, provider: PROVIDER, model: MODEL },
    select: { chunkId: true, contentHash: true },
  });
  const embeddingByChunk = new Map(embeddings.map((e) => [e.chunkId, e.contentHash]));

  let embeddedChunkCount = 0;
  let missingEmbeddingCount = 0;
  let staleEmbeddingCount = 0;

  for (const chunk of activeChunks) {
    const storedHash = embeddingByChunk.get(chunk.id);
    if (!storedHash) {
      missingEmbeddingCount += 1;
      continue;
    }
    embeddedChunkCount += 1;
    if (storedHash !== computeChunkContentHash(chunk)) {
      staleEmbeddingCount += 1;
    }
  }

  return {
    ...base,
    activeChunkCount: activeChunks.length,
    embeddedChunkCount,
    missingEmbeddingCount,
    staleEmbeddingCount,
  };
}

export async function rebuildPackEmbeddings(input: {
  packId: string;
  force?: boolean;
  versionId?: string;
  chunkType?: string;
  indexGenerationId?: string;
  /** P4: required when embedding for a search generation pipeline. */
  searchIndexGenerationId?: string;
  pipelineRunId?: string;
  fingerprint?: string;
  normalizedDocumentId?: string;
  chunkGenerationId?: string;
  /** When true with indexGenerationId, include inactive BUILDING chunks. */
  includeInactiveForGeneration?: boolean;
  onChunkProcessed?: (processedCount: number) => void | Promise<void>;
}): Promise<EmbeddingRebuildResultDto | null> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId: input.packId },
    select: { packId: true },
  });
  if (!pack) return null;

  const versionId = input.versionId ?? (await getLatestVersionId(input.packId));
  const result: EmbeddingRebuildResultDto = {
    packId: input.packId,
    processedCount: 0,
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
  };

  if (!versionId) return result;

  const searchIndexGenerationId =
    input.searchIndexGenerationId ?? input.indexGenerationId ?? null;

  let generation: Awaited<ReturnType<typeof loadSearchGeneration>> = null;
  if (searchIndexGenerationId) {
    generation = await loadSearchGeneration(searchIndexGenerationId);
    if (!generation) {
      throw new PayloadServiceError(
        "SEARCH_GENERATION_NOT_FOUND",
        "Embedding 전에 검색 세대가 필요합니다.",
        404,
      );
    }
    if (generation.scope !== "DRAFT") {
      throw new PayloadServiceError(
        "SEARCH_GENERATION_NOT_CURRENT",
        "DRAFT 검색 세대만 Embedding할 수 있습니다.",
        409,
      );
    }
    if (generation.status !== "PENDING" && generation.status !== "EMBEDDING") {
      throw new PayloadServiceError(
        "SEARCH_GENERATION_NOT_READY",
        "PENDING 또는 EMBEDDING 상태의 검색 세대만 Embedding할 수 있습니다.",
        409,
      );
    }
    if (input.versionId && generation.versionId !== input.versionId) {
      throw new PayloadServiceError(
        "SEARCH_GENERATION_MISMATCH",
        "검색 세대 version이 일치하지 않습니다.",
        409,
      );
    }
    if (input.pipelineRunId && generation.pipelineRunId !== input.pipelineRunId) {
      throw new PayloadServiceError(
        "SEARCH_GENERATION_MISMATCH",
        "검색 세대 pipelineRun이 일치하지 않습니다.",
        409,
      );
    }
    if (
      input.normalizedDocumentId &&
      generation.normalizedDocumentId !== input.normalizedDocumentId
    ) {
      throw new PayloadServiceError(
        "SEARCH_GENERATION_MISMATCH",
        "검색 세대 NormalizedDocument가 일치하지 않습니다.",
        409,
      );
    }
    if (input.fingerprint && generation.fingerprint !== input.fingerprint) {
      throw new PayloadServiceError(
        "SEARCH_GENERATION_MISMATCH",
        "검색 세대 fingerprint가 일치하지 않습니다.",
        409,
      );
    }
    const expectedChunkGen = input.chunkGenerationId ?? input.indexGenerationId;
    if (expectedChunkGen && generation.chunkGenerationId !== expectedChunkGen) {
      throw new PayloadServiceError(
        "SEARCH_GENERATION_MISMATCH",
        "검색 세대 chunkGenerationId가 일치하지 않습니다.",
        409,
      );
    }
  }

  const activeChunks = await prisma.knowledgeChunk.findMany({
    where: {
      versionId,
      ...(input.includeInactiveForGeneration && input.indexGenerationId
        ? {}
        : { isActive: true }),
      ...(input.chunkType ? { chunkType: input.chunkType } : {}),
      ...(input.includeInactiveForGeneration && input.indexGenerationId
        ? {
            OR: [
              { chunkGenerationId: input.indexGenerationId },
              {
                metadata: {
                  path: ["indexGenerationId"],
                  equals: input.indexGenerationId,
                },
              },
            ],
          }
        : {}),
    },
  });

  const filtered = activeChunks.filter((chunk) => {
    const meta =
      chunk.metadata && typeof chunk.metadata === "object" && !Array.isArray(chunk.metadata)
        ? (chunk.metadata as Record<string, unknown>)
        : null;
    if (
      input.indexGenerationId &&
      chunk.chunkGenerationId !== input.indexGenerationId &&
      meta?.indexGenerationId !== input.indexGenerationId
    ) {
      return false;
    }
    if (input.pipelineRunId && meta?.pipelineRunId !== input.pipelineRunId) {
      return false;
    }
    if (
      input.fingerprint &&
      meta?.fingerprint !== input.fingerprint &&
      meta?.normalizedDocumentFingerprint !== input.fingerprint
    ) {
      return false;
    }
    return true;
  });

  // P5: resolve the async embedding provider adapter. When embedding for a search
  // generation, the adapter MUST match the generation's declared descriptor
  // (embeddingProvider/Model/Dimension) — never the ambient env config — so
  // assertSearchGenerationCounts' descriptor check keeps holding.
  const config = readEmbeddingProviderConfig();
  let descriptor: EmbeddingDescriptor;
  let adapter: EmbeddingProviderAdapter;
  if (generation) {
    descriptor = {
      provider: generation.embeddingProvider,
      model: generation.embeddingModel,
      dimension: generation.embeddingDimension,
    };
    assertEmbeddingProviderProductionReady({ provider: descriptor.provider });
    adapter = resolveEmbeddingProviderAdapterForDescriptor(descriptor);
  } else {
    assertEmbeddingProviderProductionReady(config);
    adapter = resolveEmbeddingProviderAdapter(config);
    descriptor = adapter.resolveDescriptor();
  }

  type ChunkPlanItem = {
    chunk: (typeof filtered)[number];
    contentHash: string;
    existing: { id: string; contentHash: string; searchIndexGenerationId: string | null } | null;
    action: "skip-unchanged" | "embed";
  };

  const plan: ChunkPlanItem[] = [];
  for (const chunk of filtered) {
    const contentHash = computeChunkContentHash(chunk as KnowledgeChunk);
    const existing = await prisma.knowledgeChunkEmbedding.findUnique({
      where: {
        chunkId_provider_model: { chunkId: chunk.id, provider: descriptor.provider, model: descriptor.model },
      },
      select: { id: true, contentHash: true, searchIndexGenerationId: true },
    });

    if (
      existing?.searchIndexGenerationId &&
      searchIndexGenerationId &&
      existing.searchIndexGenerationId !== searchIndexGenerationId
    ) {
      throw new PayloadServiceError(
        "SEARCH_GENERATION_MISMATCH",
        "다른 검색 세대에 연결된 Embedding을 덮어쓸 수 없습니다.",
        409,
      );
    }

    const unchanged = existing && existing.contentHash === contentHash && !input.force;
    plan.push({ chunk, contentHash, existing, action: unchanged ? "skip-unchanged" : "embed" });
  }

  if (descriptor.provider === LOCAL_E5_EMBEDDING_PROVIDER) {
    const health = await adapter.healthCheck();
    if (!health.ok) {
      throw new PayloadServiceError(
        "INCOMPLETE",
        health.message ?? "local-e5 Embedding Worker가 준비되지 않았습니다.",
        502,
      );
    }
    for (const chunk of filtered) {
      validateRetrievalChunkPassageForE5({
        id: chunk.id,
        title: chunk.title,
        content: chunk.content,
        section: chunk.section,
        tags: chunk.tags,
      });
    }
  }

  const toEmbed = plan.filter((item) => item.action === "embed");
  let batchResult: { vectors: number[][] } = { vectors: [] };
  if (toEmbed.length > 0) {
    try {
      batchResult = await adapter.embedBatch({
        texts: toEmbed.map((item) => buildEmbeddingText(item.chunk, descriptor.provider)),
      });
    } catch (error) {
      // Token-limit is a content problem — propagate the typed error so the pipeline can
      // mark the generation FAILED with EMBEDDING_TOKEN_LIMIT_EXCEEDED (not a transient 502).
      if (isEmbeddingProviderError(error) && error.code === "EMBEDDING_TOKEN_LIMIT_EXCEEDED") {
        throw error;
      }
      if (isEmbeddingProviderError(error)) {
        throw new PayloadServiceError("INCOMPLETE", error.message, 502);
      }
      throw error;
    }
    if (batchResult.vectors.length !== toEmbed.length) {
      throw new PayloadServiceError(
        "INCOMPLETE",
        "Embedding batch 결과 개수가 요청한 chunk 수와 일치하지 않습니다.",
        502,
      );
    }
  }

  let vectorSyncWarning: string | undefined;
  let embedIndex = 0;
  for (const item of plan) {
    result.processedCount += 1;
    const { chunk, contentHash, existing } = item;

    if (item.action === "skip-unchanged") {
      if (searchIndexGenerationId && existing && !existing.searchIndexGenerationId) {
        await prisma.knowledgeChunkEmbedding.update({
          where: { id: existing.id },
          data: { searchIndexGenerationId },
        });
      }
      result.skippedCount += 1;
      await input.onChunkProcessed?.(result.processedCount);
      continue;
    }

    const vector = batchResult.vectors[embedIndex]!;
    embedIndex += 1;
    const vectorJson = vector as unknown as Prisma.InputJsonValue;

    if (existing) {
      await prisma.knowledgeChunkEmbedding.update({
        where: { id: existing.id },
        data: {
          dimension: descriptor.dimension,
          vector: vectorJson,
          contentHash,
          ...(searchIndexGenerationId ? { searchIndexGenerationId } : {}),
        },
      });
      result.updatedCount += 1;
    } else {
      await prisma.knowledgeChunkEmbedding.create({
        data: {
          chunkId: chunk.id,
          versionId,
          provider: descriptor.provider,
          model: descriptor.model,
          dimension: descriptor.dimension,
          vector: vectorJson,
          contentHash,
          ...(searchIndexGenerationId ? { searchIndexGenerationId } : {}),
        },
      });
      result.createdCount += 1;
    }

    if (searchIndexGenerationId) {
      const write = await upsertSearchIndexVector({
        searchIndexGenerationId,
        chunkId: chunk.id,
        provider: descriptor.provider,
        model: descriptor.model,
        dimension: descriptor.dimension,
        contentHash,
        vector,
      });
      if (write.skipped) vectorSyncWarning = write.reason;
    }

    await input.onChunkProcessed?.(result.processedCount);
  }

  if (vectorSyncWarning) result.vectorSyncWarning = vectorSyncWarning;
  return result;
}
