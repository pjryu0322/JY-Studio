import type { Chunk } from "@/lib/chunking/types";

export interface ChunkQualityReport {
  totalChunks: number;
  sectionChunks: number;
  paragraphChunks: number;
  tableChunks: number;
  repeatChunks: number;
  tinyChunks: number;
  oversizedChunks: number;
  noiseChunksRemoved: number;
  orphanChunks: number;
  averageChunkLength: number;
}

export function generateChunkQualityReport(chunks: Chunk[]): ChunkQualityReport {
  const totalChunks = chunks.length;
  if (totalChunks === 0) {
    return {
      totalChunks: 0,
      sectionChunks: 0,
      paragraphChunks: 0,
      tableChunks: 0,
      repeatChunks: 0,
      tinyChunks: 0,
      oversizedChunks: 0,
      noiseChunksRemoved: 0,
      orphanChunks: 0,
      averageChunkLength: 0,
    };
  }

  let sectionChunks = 0;
  let paragraphChunks = 0;
  let tableChunks = 0;
  let repeatChunks = 0;
  let tinyChunks = 0;
  let oversizedChunks = 0;
  let orphanChunks = 0;
  let noiseChunksRemoved = 0;
  let totalLength = 0;

  for (const chunk of chunks) {
    const text = chunk.text ?? "";
    const length = text.length;
    totalLength += length;

    const sectionPath = chunk.meta.sectionPath ?? [];
    if (!sectionPath.length) {
      orphanChunks += 1;
    }
    if (length < 40) tinyChunks += 1;
    if (length > 1500) oversizedChunks += 1;
    if (chunk.meta.quality.warnings.includes("HEADER_NOISE")) {
      noiseChunksRemoved += 1;
    }

    const tags = chunk.meta.tags ?? [];
    if (tags.includes("TABLE_STRUCTURED")) {
      tableChunks += 1;
    } else if (tags.includes("LIST_ITEM")) {
      repeatChunks += 1;
    } else if (sectionPath.length > 0) {
      sectionChunks += 1;
    } else {
      paragraphChunks += 1;
    }
  }

  return {
    totalChunks,
    sectionChunks,
    paragraphChunks,
    tableChunks,
    repeatChunks,
    tinyChunks,
    oversizedChunks,
    noiseChunksRemoved,
    orphanChunks,
    averageChunkLength: Math.round(totalLength / totalChunks),
  };
}
