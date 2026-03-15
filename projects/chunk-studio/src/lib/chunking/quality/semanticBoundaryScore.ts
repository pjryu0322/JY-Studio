import type { ChunkDTO } from "@/types/job";

export function semanticBoundaryScore(chunk: ChunkDTO): number {
  const text = chunk.text.trim();
  if (!text) return 0;

  let score = 1;
  const compact = text.replace(/\s+/g, " ").trim();
  const startsWithHeadingLike =
    /^[A-Z0-9][A-Z0-9 .:_-]{2,}$/.test(compact) ||
    /^(\d+(\.\d+){0,3})\s+\S+/.test(compact);
  const endsWithBoundary = /[.!?)]$/.test(compact);
  const fragmentedList =
    /^[-*]\s+\S+$/m.test(compact) &&
    compact.split(/\n+/).length <= 2;
  const startsMidSentence = /^[a-z]/.test(compact);
  const endsMidSentence = /[,;:]$/.test(compact);
  const hasList = chunk.meta.quality.hasList;

  if (startsMidSentence && !startsWithHeadingLike) score -= 0.2;
  if (!endsWithBoundary && !hasList) score -= 0.2;
  if (endsMidSentence) score -= 0.15;
  if (fragmentedList) score -= 0.2;

  return clamp01(score);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
