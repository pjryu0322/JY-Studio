import crypto from "crypto";
import {
  DEFAULT_EMBEDDING_DIMENSION,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_PROVIDER,
  type PackEmbeddingSummaryDto,
} from "@/lib/embedding-dto";
import { prisma } from "@/lib/prisma";

/**
 * P7.6: TS document/chunk embedding GENERATION has been removed.
 *
 * The Python Worker (ZIP pipeline) is the single source of document/chunk
 * embeddings — it produces `embeddings.json`, which the Store only *validates*,
 * *persists* (KnowledgeChunkEmbedding), and *reflects* into pgvector
 * (SearchIndexVector). The Store never re-embeds Worker output, and there is no
 * TS-side model for passage embeddings.
 *
 * This module therefore keeps only the read-side helpers:
 *  - `computeChunkContentHash` — stale/parity accounting shared with the Worker.
 *  - `getPackEmbeddingSummary` — admin read-only embedding coverage summary.
 *
 * The former TS chunk-embedding generator was deleted; the legacy Docling
 * search-data generation embed step is now fail-closed (see
 * `search-data-generation-process-embed.ts`). Query embedding (search runtime
 * only) lives in `@/lib/embedding/runtime-query-embedding`.
 */

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
