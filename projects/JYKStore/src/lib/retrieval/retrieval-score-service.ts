import type { RetrievalFilters } from "@/lib/retrieval-dto";
import { scoreRetrievalChunk } from "@/lib/retrieval-ranking";
import { toMetadataRecord, type CandidateChunk, type ScoredCandidate } from "./retrieval-types";

/**
 * 수집된 candidate를 keyword/metadata 기준으로 scoring한다.
 * vectorScore / vectorSimilarity는 0으로 초기화한다(hybrid 단계에서 가산).
 */
export function scoreRetrievalCandidates(input: {
  candidates: CandidateChunk[];
  tokens: string[];
  filters: RetrievalFilters;
}): ScoredCandidate[] {
  return input.candidates.map((chunk) => {
    const metadataRecord = toMetadataRecord(chunk.metadata);
    const result = scoreRetrievalChunk({
      chunk: { ...chunk, metadata: metadataRecord },
      tokens: input.tokens,
      filters: input.filters,
    });
    return {
      chunk,
      metadataRecord,
      keywordScore: result.keywordScore,
      metadataScore: result.metadataScore,
      vectorScore: 0,
      vectorSimilarity: 0,
      score: result.score,
      matchReasons: [...result.matchReasons],
    };
  });
}
