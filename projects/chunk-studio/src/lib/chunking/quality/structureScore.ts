import type { ChunkDTO } from "@/types/job";

export function structureScore(chunk: ChunkDTO): number {
  const tokens = chunk.meta.quality.tokens;
  let score = 0.8;

  if (tokens < 80) score -= 0.35;
  else if (tokens < 140) score -= 0.15;
  else if (tokens > 1200) score -= 0.35;
  else if (tokens > 900) score -= 0.2;
  else if (tokens >= 180 && tokens <= 700) score += 0.12;

  if (chunk.meta.sectionPath.length > 0) score += 0.08;
  if (chunk.meta.sectionTitle?.trim()) score += 0.05;
  if (chunk.meta.quality.hasTable) score += 0.06;
  if (chunk.meta.quality.hasConstraints) score += 0.05;
  if (chunk.meta.quality.hasList) score += 0.03;

  if (
    chunk.meta.quality.warnings.includes("TOO_SHORT") ||
    chunk.meta.quality.warnings.includes("MISSING_LEAD")
  ) {
    score -= 0.2;
  }
  if (chunk.meta.quality.warnings.includes("TOO_LONG")) {
    score -= 0.2;
  }

  return clamp01(score);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
