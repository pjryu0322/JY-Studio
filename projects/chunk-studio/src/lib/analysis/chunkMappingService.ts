import type { ChunkDTO } from "@/types/job";

export interface ChunkPageMapping {
  chunkId: string;
  pageStart: number | null;
  pageEnd: number | null;
}

export function mapChunkToPage(chunk: ChunkDTO): ChunkPageMapping {
  const pageRange = (chunk.meta as unknown as { pageRange?: [number, number] }).pageRange;
  if (!Array.isArray(pageRange) || pageRange.length !== 2) {
    return { chunkId: chunk.meta.chunkId, pageStart: null, pageEnd: null };
  }
  return {
    chunkId: chunk.meta.chunkId,
    pageStart: pageRange[0],
    pageEnd: pageRange[1],
  };
}

export function mapPageToChunks(chunks: ChunkDTO[], page: number): ChunkDTO[] {
  return chunks.filter((chunk) => {
    const mapped = mapChunkToPage(chunk);
    if (mapped.pageStart == null || mapped.pageEnd == null) return false;
    return mapped.pageStart <= page && page <= mapped.pageEnd;
  });
}

export function highlightChunkInPreview(chunk: ChunkDTO): void {
  if (typeof window === "undefined") return;
  const mapping = mapChunkToPage(chunk);
  if (mapping.pageStart == null) return;
  window.dispatchEvent(new CustomEvent("chunkstudio:go-page", { detail: mapping.pageStart }));
  window.dispatchEvent(
    new CustomEvent("chunkstudio:selected-page", { detail: mapping.pageStart })
  );
}
