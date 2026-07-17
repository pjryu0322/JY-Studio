import type { RetrievalScoreDetail } from "@/lib/retrieval-dto";

export type ProviderRelevanceLabel = "높음" | "보통" | "낮음";

export type ProviderRelevance = {
  label: ProviderRelevanceLabel;
  /** Only when scoreDetail allows a trustworthy normalization. */
  percent: number | null;
};

/**
 * Map retrieval scores to provider-facing relevance.
 * Does NOT multiply raw hybrid scores by 100.
 * Prefer vectorSimilarity (0..1) when present; otherwise use relative label bands.
 */
export function toProviderRelevance(
  score: number,
  scoreDetail?: RetrievalScoreDetail | null,
): ProviderRelevance {
  const similarity =
    typeof scoreDetail?.vectorSimilarity === "number" &&
    Number.isFinite(scoreDetail.vectorSimilarity)
      ? clamp01(scoreDetail.vectorSimilarity)
      : null;

  if (similarity != null) {
    const percent = Math.round(similarity * 100);
    return {
      label: percent >= 70 ? "높음" : percent >= 40 ? "보통" : "낮음",
      percent,
    };
  }

  // Keyword/hybrid aggregate scores are not a reliable percent scale.
  if (!Number.isFinite(score) || score <= 0) {
    return { label: "낮음", percent: null };
  }
  if (score >= 8) return { label: "높음", percent: null };
  if (score >= 3) return { label: "보통", percent: null };
  return { label: "낮음", percent: null };
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
