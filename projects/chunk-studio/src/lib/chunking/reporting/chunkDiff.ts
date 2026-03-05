import type { Chunk, ChunkDiffSummary, DiffStats } from "@/lib/chunking/types";

function buildStats(chunks: Chunk[]): DiffStats {
  const warnings: Record<string, number> = {};
  const tags: Record<string, number> = {};
  const tokenValues = chunks.map((c) => c.meta.quality.tokens);
  for (const chunk of chunks) {
    for (const w of chunk.meta.quality.warnings) {
      warnings[w] = (warnings[w] ?? 0) + 1;
    }
    for (const t of chunk.meta.tags) {
      tags[t] = (tags[t] ?? 0) + 1;
    }
  }
  return {
    chunkCount: chunks.length,
    avgTokens:
      tokenValues.length > 0
        ? Math.round(tokenValues.reduce((a, b) => a + b, 0) / tokenValues.length)
        : 0,
    warnings,
    tags,
  };
}

function deltaMap(
  before: Record<string, number>,
  after: Record<string, number>
): Record<string, number> {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out: Record<string, number> = {};
  for (const key of keys) {
    out[key] = (after[key] ?? 0) - (before[key] ?? 0);
  }
  return out;
}

export function buildChunkDiffSummary(
  beforeChunks: Chunk[],
  afterChunks: Chunk[],
  removedTextSample?: string[]
): ChunkDiffSummary {
  const before = buildStats(beforeChunks);
  const after = buildStats(afterChunks);
  return {
    before,
    after,
    delta: {
      chunkCount: after.chunkCount - before.chunkCount,
      avgTokens: after.avgTokens - before.avgTokens,
    },
    warningsDelta: deltaMap(before.warnings, after.warnings),
    tagsDelta: deltaMap(before.tags, after.tags),
    removedTextSample,
  };
}

