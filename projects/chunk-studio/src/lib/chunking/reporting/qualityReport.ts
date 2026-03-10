import type { Chunk } from "@/lib/chunking/types";

export interface QualityReport {
  totalChunks: number;
  avgTokens: number;
  minTokens: number;
  maxTokens: number;
  warningDistribution: Record<string, number>;
  tagDistribution: Record<string, number>;
  ocr?: {
    avgUnknownCharRatio: number;
    avgSymbolNoiseRatio: number;
    avgBrokenSpacingScore: number;
  };
}

export function buildQualityReport(chunks: Chunk[]): QualityReport {
  if (chunks.length === 0) {
    return {
      totalChunks: 0,
      avgTokens: 0,
      minTokens: 0,
      maxTokens: 0,
      warningDistribution: {},
      tagDistribution: {},
      ocr: {
        avgUnknownCharRatio: 0,
        avgSymbolNoiseRatio: 0,
        avgBrokenSpacingScore: 0,
      },
    };
  }
  const tokenValues = chunks.map((c) => c.meta.quality.tokens);
  const warningDistribution: Record<string, number> = {};
  const tagDistribution: Record<string, number> = {};
  const unknownRatios: number[] = [];
  const symbolRatios: number[] = [];
  const spacingScores: number[] = [];
  for (const chunk of chunks) {
    for (const w of chunk.meta.quality.warnings) {
      warningDistribution[w] = (warningDistribution[w] ?? 0) + 1;
    }
    for (const t of chunk.meta.tags) {
      tagDistribution[t] = (tagDistribution[t] ?? 0) + 1;
    }
    if (typeof chunk.meta.ocrQuality?.unknownCharRatio === "number") {
      unknownRatios.push(chunk.meta.ocrQuality.unknownCharRatio);
    }
    if (typeof chunk.meta.ocrQuality?.symbolNoiseRatio === "number") {
      symbolRatios.push(chunk.meta.ocrQuality.symbolNoiseRatio);
    }
    if (typeof chunk.meta.ocrQuality?.brokenSpacingScore === "number") {
      spacingScores.push(chunk.meta.ocrQuality.brokenSpacingScore);
    }
  }
  const sum = tokenValues.reduce((a, b) => a + b, 0);
  return {
    totalChunks: chunks.length,
    avgTokens: Math.round(sum / chunks.length),
    minTokens: Math.min(...tokenValues),
    maxTokens: Math.max(...tokenValues),
    warningDistribution,
    tagDistribution,
    ocr: {
      avgUnknownCharRatio: unknownRatios.length
        ? Number((unknownRatios.reduce((a, b) => a + b, 0) / unknownRatios.length).toFixed(4))
        : 0,
      avgSymbolNoiseRatio: symbolRatios.length
        ? Number((symbolRatios.reduce((a, b) => a + b, 0) / symbolRatios.length).toFixed(4))
        : 0,
      avgBrokenSpacingScore: spacingScores.length
        ? Number((spacingScores.reduce((a, b) => a + b, 0) / spacingScores.length).toFixed(4))
        : 0,
    },
  };
}

