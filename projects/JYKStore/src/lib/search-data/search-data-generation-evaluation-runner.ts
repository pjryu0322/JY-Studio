/**
 * Retrieval evaluation execution + result packaging for validateSearchData.
 */
import { runDoclingRetrievalEvaluation } from "@/lib/docling-knowledge/docling-knowledge-eval";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "@/lib/retrieval/relevance-diversity-rerank";

export async function runSearchDataRetrievalEvaluation(input: {
  packId: string;
  versionId: string;
  indexGenerationId: string;
}) {
  const evaluation = await runDoclingRetrievalEvaluation(input);
  const evaluationDetails = {
    ...evaluation,
    retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
  };
  return { evaluation, evaluationDetails };
}

export function isEvaluationNonPass(
  status: string,
): status is "FAIL" | "WARNING" {
  return status === "FAIL" || status === "WARNING";
}
