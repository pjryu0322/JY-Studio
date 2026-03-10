import type { ChunkDTO } from "@/types/job";

export interface BoundaryIssue {
  chunkId: string;
  issue:
    | "TOO_LONG"
    | "TOO_SHORT"
    | "NOISY_BOUNDARY"
    | "SECTION_CROSSING"
    | "UNCLEAR_BOUNDARY";
  severity: "low" | "medium" | "high";
  reason: string;
}

export interface MergeCandidate {
  leftChunkId: string;
  rightChunkId: string;
  confidence: number;
  reason: string;
}

export interface SplitPointSuggestion {
  chunkId: string;
  offset: number;
  reason: string;
}

export function detectBoundaryIssues(chunks: ChunkDTO[]): BoundaryIssue[] {
  const issues: BoundaryIssue[] = [];
  chunks.forEach((chunk, index) => {
    const token = chunk.meta.quality.tokens;
    if (token >= 1000) {
      issues.push({
        chunkId: chunk.meta.chunkId,
        issue: "TOO_LONG",
        severity: "high",
        reason: "chunk length exceeds recommended review threshold",
      });
    }
    if (token > 0 && token <= 120) {
      issues.push({
        chunkId: chunk.meta.chunkId,
        issue: "TOO_SHORT",
        severity: "medium",
        reason: "chunk may be fragmented and need merge review",
      });
    }
    if (chunk.meta.quality.warnings.some((w) => /noise|header|footer/i.test(w))) {
      issues.push({
        chunkId: chunk.meta.chunkId,
        issue: "NOISY_BOUNDARY",
        severity: "medium",
        reason: "warnings indicate noisy boundary candidates",
      });
    }
    const prev = chunks[index - 1];
    if (prev && prev.meta.sectionPath.join(" > ") !== chunk.meta.sectionPath.join(" > ")) {
      const delta = Math.abs(prev.meta.endBlockIdx - chunk.meta.startBlockIdx);
      if (delta <= 1) {
        issues.push({
          chunkId: chunk.meta.chunkId,
          issue: "SECTION_CROSSING",
          severity: "low",
          reason: "boundary sits near section transition",
        });
      }
    }
    if (!/[.!?]\s*$/.test(chunk.text.trim())) {
      issues.push({
        chunkId: chunk.meta.chunkId,
        issue: "UNCLEAR_BOUNDARY",
        severity: "low",
        reason: "chunk tail does not end with clear sentence boundary",
      });
    }
  });
  return issues;
}

export function suggestMergeCandidates(chunks: ChunkDTO[]): MergeCandidate[] {
  const candidates: MergeCandidate[] = [];
  for (let i = 0; i < chunks.length - 1; i += 1) {
    const left = chunks[i];
    const right = chunks[i + 1];
    const sameSection = left.meta.sectionPath.join(" > ") === right.meta.sectionPath.join(" > ");
    const combinedToken = left.meta.quality.tokens + right.meta.quality.tokens;
    const shortPair = left.meta.quality.tokens <= 140 || right.meta.quality.tokens <= 140;
    if (sameSection && shortPair && combinedToken <= 900) {
      candidates.push({
        leftChunkId: left.meta.chunkId,
        rightChunkId: right.meta.chunkId,
        confidence: 0.78,
        reason: "same section with short adjacent chunks",
      });
    }
  }
  return candidates;
}

export function suggestSplitPoints(chunk: ChunkDTO): SplitPointSuggestion[] {
  if (chunk.meta.quality.tokens < 850) return [];
  const text = chunk.text;
  const middle = Math.floor(text.length / 2);
  const sentenceBreak = text.indexOf(". ", middle);
  const newlineBreak = text.indexOf("\n", middle);
  const offset =
    sentenceBreak > 0 ? sentenceBreak + 1 : newlineBreak > 0 ? newlineBreak : middle;
  return [
    {
      chunkId: chunk.meta.chunkId,
      offset,
      reason: "suggest split near content midpoint boundary",
    },
  ];
}
