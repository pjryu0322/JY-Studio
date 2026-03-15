import type { ChunkDTO } from "@/types/job";

export function mergeChunkWithNext(chunks: ChunkDTO[], chunkId: string): ChunkDTO[] {
  const idx = chunks.findIndex((chunk) => chunk.meta.chunkId === chunkId);
  if (idx < 0 || idx >= chunks.length - 1) return chunks;
  const cur = chunks[idx];
  const next = chunks[idx + 1];
  const merged: ChunkDTO = {
    ...cur,
    text: `${cur.text}\n\n${next.text}`.trim(),
    meta: {
      ...cur.meta,
      endBlockIdx: Math.max(cur.meta.endBlockIdx, next.meta.endBlockIdx),
      sourceBlockIds: [...cur.meta.sourceBlockIds, ...next.meta.sourceBlockIds],
      quality: {
        ...cur.meta.quality,
        tokens: cur.meta.quality.tokens + next.meta.quality.tokens,
        warnings: Array.from(new Set([...cur.meta.quality.warnings, ...next.meta.quality.warnings])),
      },
      pageRange:
        cur.meta.pageRange && next.meta.pageRange
          ? [
              Math.min(cur.meta.pageRange[0], next.meta.pageRange[0]),
              Math.max(cur.meta.pageRange[1], next.meta.pageRange[1]),
            ]
          : cur.meta.pageRange ?? next.meta.pageRange,
    },
  };
  return [...chunks.slice(0, idx), merged, ...chunks.slice(idx + 2)];
}

export function splitChunkAtMidpoint(chunks: ChunkDTO[], chunkId: string): ChunkDTO[] {
  const idx = chunks.findIndex((chunk) => chunk.meta.chunkId === chunkId);
  if (idx < 0) return chunks;
  const cur = chunks[idx];
  const text = cur.text.trim();
  if (!text) return chunks;
  const mid = Math.floor(text.length / 2);
  const splitAt = text.indexOf(". ", mid) > 0 ? text.indexOf(". ", mid) + 1 : mid;
  const leftText = text.slice(0, splitAt).trim();
  const rightText = text.slice(splitAt).trim();
  if (!leftText || !rightText) return chunks;
  const left: ChunkDTO = {
    ...cur,
    text: leftText,
    meta: {
      ...cur.meta,
      chunkId: `${cur.meta.chunkId}-a`,
      quality: { ...cur.meta.quality, tokens: Math.max(1, Math.floor(cur.meta.quality.tokens / 2)) },
    },
  };
  const right: ChunkDTO = {
    ...cur,
    text: rightText,
    meta: {
      ...cur.meta,
      chunkId: `${cur.meta.chunkId}-b`,
      quality: {
        ...cur.meta.quality,
        tokens: Math.max(1, cur.meta.quality.tokens - Math.floor(cur.meta.quality.tokens / 2)),
      },
    },
  };
  return [...chunks.slice(0, idx), left, right, ...chunks.slice(idx + 1)];
}

export function buildChunkSuggestion(text: string, tokens: number): string {
  if (tokens >= 950) return "Chunk too long. Split near sentence midpoint.";
  if (tokens <= 120) return "Chunk too short. Merge with adjacent chunk.";
  if (!/[.!?]\s*$/.test(text.trim())) return "Boundary unclear. Review trailing sentence.";
  return "Chunk quality looks stable.";
}
