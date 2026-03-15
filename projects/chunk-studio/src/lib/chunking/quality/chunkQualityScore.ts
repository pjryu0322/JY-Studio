import type { ChunkDTO } from "@/types/job";
import { noiseRatio } from "./noiseRatio";
import { semanticBoundaryScore } from "./semanticBoundaryScore";
import { structureScore } from "./structureScore";

export interface ChunkQualityMetrics {
  qualityScore: number;
  boundaryScore: number;
  noiseScore: number;
  structureScore: number;
}

export function chunkQualityScore(chunk: ChunkDTO): number {
  const metrics = evaluateChunkQuality(chunk);
  return metrics.qualityScore;
}

export function evaluateChunkQuality(
  chunk: ChunkDTO,
): ChunkQualityMetrics {
  const boundary = semanticBoundaryScore(chunk);
  const noise = noiseRatio(chunk);
  const structure = structureScore(chunk);
  const quality = clamp01(
    boundary * 0.45 + structure * 0.35 + (1 - noise) * 0.2,
  );

  return {
    qualityScore: quality,
    boundaryScore: boundary,
    noiseScore: noise,
    structureScore: structure,
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
