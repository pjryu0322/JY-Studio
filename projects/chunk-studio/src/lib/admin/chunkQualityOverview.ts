import type { ChunkDTO } from "@/types/job";
import { evaluateChunkQuality } from "@/lib/chunking/quality/chunkQualityScore";

export interface ChunkQualityOverview {
  totalChunks: number;
  averageQualityScore: number;
  averageBoundaryScore: number;
  averageNoiseScore: number;
  averageStructureScore: number;
  qualityBuckets: {
    poor: number;
    acceptable: number;
    good: number;
  };
}

export function buildChunkQualityOverview(
  chunks: ChunkDTO[],
): ChunkQualityOverview {
  if (chunks.length === 0) {
    return {
      totalChunks: 0,
      averageQualityScore: 0,
      averageBoundaryScore: 0,
      averageNoiseScore: 0,
      averageStructureScore: 0,
      qualityBuckets: {
        poor: 0,
        acceptable: 0,
        good: 0,
      },
    };
  }

  let totalQuality = 0;
  let totalBoundary = 0;
  let totalNoise = 0;
  let totalStructure = 0;
  let poor = 0;
  let acceptable = 0;
  let good = 0;

  for (const chunk of chunks) {
    const metrics = evaluateChunkQuality(chunk);
    totalQuality += metrics.qualityScore;
    totalBoundary += metrics.boundaryScore;
    totalNoise += metrics.noiseScore;
    totalStructure += metrics.structureScore;
    if (metrics.qualityScore >= 0.75) {
      good += 1;
    } else if (metrics.qualityScore >= 0.55) {
      acceptable += 1;
    } else {
      poor += 1;
    }
  }

  const total = chunks.length;
  return {
    totalChunks: total,
    averageQualityScore: round3(totalQuality / total),
    averageBoundaryScore: round3(totalBoundary / total),
    averageNoiseScore: round3(totalNoise / total),
    averageStructureScore: round3(totalStructure / total),
    qualityBuckets: {
      poor,
      acceptable,
      good,
    },
  };
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}
