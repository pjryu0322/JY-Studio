import type { Chunk } from "@/lib/chunking/types";

export function exportChunksToJsonl(chunks: Chunk[]): string {
  return chunks
    .map((chunk, i) =>
      JSON.stringify({
        id: chunk.meta.chunkId || `chunk-${i + 1}`,
        text: chunk.text,
        sectionPath: chunk.meta.sectionPath,
        tags: chunk.meta.tags,
        normalized: chunk.meta.normalized,
        sourceBlockIds: chunk.meta.sourceBlockIds,
        pipelineVersion: chunk.meta.pipelineVersion,
      })
    )
    .join("\n");
}

