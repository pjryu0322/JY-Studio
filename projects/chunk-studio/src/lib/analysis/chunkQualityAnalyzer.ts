import type { ChunkDTO } from "@/types/job";

export type ChunkQualityStatus =
  | "NORMAL"
  | "REVIEW_REQUIRED"
  | "NOISE_SUSPECTED"
  | "TOO_LONG"
  | "TOO_SHORT";

export interface ChunkQualityResult {
  chunkId: string;
  score: number;
  status: ChunkQualityStatus;
  warnings: string[];
  chunkLength: number;
  semanticDensity: number;
  structureAlignment: number;
  noiseRatio: number;
  ocrConfidence: number;
}

export function analyzeChunkQuality(chunk: ChunkDTO): ChunkQualityResult {
  const chunkLength = chunk.meta.quality.tokens || approximateTokenLength(chunk.text);
  const semanticDensity = estimateSemanticDensity(chunk.text);
  const structureAlignment = chunk.meta.sectionPath.length > 0 ? 0.9 : 0.45;
  const noiseRatio = estimateNoiseRatio(chunk);
  const ocrConfidence = chunk.meta.ocrQuality?.avgConfidence ?? 1;

  const warnings = [...(chunk.meta.quality.warnings || [])];
  if (chunkLength >= 1000) warnings.push("TOO_LONG");
  if (chunkLength > 0 && chunkLength <= 120) warnings.push("TOO_SHORT");
  if (noiseRatio >= 0.25) warnings.push("NOISE_SUSPECTED");
  if (ocrConfidence < 0.85) warnings.push("OCR_CONFIDENCE_LOW");
  if (chunk.meta.quality.hasTable) warnings.push("TABLE_CONTAINING_CHUNK");
  if (semanticDensity < 0.45) warnings.push("SEMANTIC_DENSITY_LOW");
  if (structureAlignment < 0.6) warnings.push("STRUCTURE_ALIGNMENT_LOW");

  const score = clamp01(
    0.32 * normalizeRange(chunkLength, 120, 900) +
      0.25 * semanticDensity +
      0.2 * structureAlignment +
      0.13 * (1 - noiseRatio) +
      0.1 * ocrConfidence
  );

  const status: ChunkQualityStatus =
    noiseRatio >= 0.25
      ? "NOISE_SUSPECTED"
      : chunkLength >= 1000
        ? "TOO_LONG"
        : chunkLength > 0 && chunkLength <= 120
          ? "TOO_SHORT"
          : warnings.length > 0
            ? "REVIEW_REQUIRED"
            : "NORMAL";

  return {
    chunkId: chunk.meta.chunkId,
    score,
    status,
    warnings: unique(warnings),
    chunkLength,
    semanticDensity,
    structureAlignment,
    noiseRatio,
    ocrConfidence,
  };
}

export function analyzeChunkQualityBatch(chunks: ChunkDTO[]): ChunkQualityResult[] {
  return chunks.map(analyzeChunkQuality);
}

function estimateSemanticDensity(text: string): number {
  const words = text
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (words.length === 0) return 0;
  const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
  return clamp01(uniqueWords.size / words.length + 0.25);
}

function estimateNoiseRatio(chunk: ChunkDTO): number {
  const warningNoise = chunk.meta.quality.warnings.filter(
    (w) => /noise|header|footer|artifact/i.test(w)
  ).length;
  const warningRatio = chunk.meta.quality.warnings.length
    ? warningNoise / chunk.meta.quality.warnings.length
    : 0;
  const tokenPenalty = chunk.meta.quality.tokens <= 40 ? 0.15 : 0;
  return clamp01(warningRatio + tokenPenalty);
}

function normalizeRange(value: number, min: number, max: number): number {
  if (value <= min) return 0;
  if (value >= max) return 1;
  return (value - min) / (max - min);
}

function approximateTokenLength(text: string): number {
  return text
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
