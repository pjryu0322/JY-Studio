import type {
  RetrievalEvaluationCandidate,
  RetrievalEvaluationCaseInput,
  RetrievalEvaluationCaseResultDraft,
  RetrievalEvaluationIssueDraft,
  RetrievalEvaluationRunAggregate,
  RetrievalEvaluationStatus,
} from "@/lib/retrieval-evaluation/retrieval-evaluation-types";
import { MIN_RETRIEVAL_EVAL_CASES } from "@/lib/retrieval-evaluation/retrieval-evaluation-types";

function clampScore(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function metadataSubsetMatch(
  expected: Record<string, unknown> | null,
  actual: Record<string, unknown> | null,
): boolean {
  if (!expected || Object.keys(expected).length === 0) return false;
  if (!actual) return false;
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) return false;
  }
  return true;
}

function candidateHitsExpectation(
  candidate: RetrievalEvaluationCandidate,
  expected: RetrievalEvaluationCaseInput,
): { hit: boolean; matchedChunkIds: string[]; matchedSourceIds: string[] } {
  const matchedChunkIds: string[] = [];
  const matchedSourceIds: string[] = [];

  if (expected.expectedChunkIds.includes(candidate.chunkId)) {
    matchedChunkIds.push(candidate.chunkId);
  }
  if (
    candidate.sourceDocumentId &&
    expected.expectedSourceDocumentIds.includes(candidate.sourceDocumentId)
  ) {
    matchedSourceIds.push(candidate.sourceDocumentId);
  }

  const sectionHaystack = [
    candidate.section ?? "",
    candidate.title,
    String(candidate.metadata?.section ?? ""),
  ]
    .join(" ")
    .toLowerCase();
  const sectionHit = expected.expectedSections.some((s) =>
    sectionHaystack.includes(s.toLowerCase()),
  );

  const tagHit = expected.expectedTags.some((tag) =>
    candidate.tags.map((t) => t.toLowerCase()).includes(tag.toLowerCase()),
  );

  const metaHit = metadataSubsetMatch(expected.expectedMetadata, candidate.metadata);

  const hit =
    matchedChunkIds.length > 0 ||
    matchedSourceIds.length > 0 ||
    sectionHit ||
    tagHit ||
    metaHit;

  return { hit, matchedChunkIds, matchedSourceIds };
}

export function evaluateRetrievalCaseAgainstCandidates(input: {
  caseInput: RetrievalEvaluationCaseInput;
  retrievalMode: "keyword" | "hybrid";
  candidates: RetrievalEvaluationCandidate[];
}): RetrievalEvaluationCaseResultDraft {
  const { caseInput, retrievalMode, candidates } = input;
  const topK = caseInput.topK;
  const sliced = candidates.slice(0, topK);

  const returnedChunkIds = sliced.map((c) => c.chunkId);
  const returnedSourceIds = [
    ...new Set(
      sliced.map((c) => c.sourceDocumentId).filter((id): id is string => Boolean(id)),
    ),
  ];

  let firstHitRank: number | null = null;
  const matchedChunkIds: string[] = [];
  const matchedSourceIds: string[] = [];
  let bestScore = 0;

  for (let i = 0; i < sliced.length; i += 1) {
    const candidate = sliced[i]!;
    const check = candidateHitsExpectation(candidate, caseInput);
    if (check.hit && firstHitRank === null) {
      firstHitRank = i + 1;
      bestScore = candidate.score;
      matchedChunkIds.push(...check.matchedChunkIds);
      matchedSourceIds.push(...check.matchedSourceIds);
    } else if (check.hit) {
      matchedChunkIds.push(...check.matchedChunkIds);
      matchedSourceIds.push(...check.matchedSourceIds);
    }
  }

  const hit = firstHitRank !== null;
  const reciprocalRank = hit && firstHitRank ? 1 / firstHitRank : 0;

  let status: RetrievalEvaluationStatus;
  const issueCodes: string[] = [];
  if (!hit) {
    status = "FAIL";
    if (caseInput.expectedChunkIds.length > 0) {
      issueCodes.push("RETRIEVAL_EXPECTED_CHUNK_MISSING");
    }
    if (caseInput.expectedSourceDocumentIds.length > 0) {
      issueCodes.push("RETRIEVAL_EXPECTED_SOURCE_MISSING");
    }
    if (issueCodes.length === 0) {
      issueCodes.push("RETRIEVAL_EXPECTED_CHUNK_MISSING");
    }
  } else if (firstHitRank! <= 3) {
    status = "PASS";
  } else {
    status = "WARNING";
  }

  return {
    caseId: caseInput.id,
    retrievalMode,
    query: caseInput.query,
    status,
    topK,
    hit,
    firstHitRank,
    reciprocalRank,
    bestScore,
    matchedChunkIds: [...new Set(matchedChunkIds)],
    matchedSourceIds: [...new Set(matchedSourceIds)],
    returnedChunkIds,
    returnedSourceIds,
    issueCodes,
  };
}

export function aggregateRetrievalEvaluationResults(input: {
  cases: RetrievalEvaluationCaseInput[];
  results: RetrievalEvaluationCaseResultDraft[];
}): RetrievalEvaluationRunAggregate {
  const results = input.results;
  const evaluatedCaseCount = results.length;
  const uniqueCaseIds = new Set(input.cases.map((c) => c.id));
  const totalCaseCount = uniqueCaseIds.size;

  const passCaseCount = results.filter((r) => r.status === "PASS").length;
  const warningCaseCount = results.filter((r) => r.status === "WARNING").length;
  const failCaseCount = results.filter((r) => r.status === "FAIL").length;

  const hitCount = results.filter((r) => r.hit).length;
  const hitRate = evaluatedCaseCount > 0 ? hitCount / evaluatedCaseCount : 0;
  const meanReciprocalRank =
    evaluatedCaseCount > 0
      ? results.reduce((sum, r) => sum + r.reciprocalRank, 0) / evaluatedCaseCount
      : 0;

  const hitRanks = results
    .filter((r) => r.firstHitRank != null)
    .map((r) => r.firstHitRank!);
  const averageTopRank =
    hitRanks.length > 0
      ? hitRanks.reduce((sum, r) => sum + r, 0) / hitRanks.length
      : null;

  const hitScores = results.filter((r) => r.hit).map((r) => r.bestScore);
  const averageScore =
    hitScores.length > 0
      ? hitScores.reduce((sum, s) => sum + s, 0) / hitScores.length
      : 0;

  const totalScore = clampScore(hitRate * 70 + meanReciprocalRank * 30);

  const issues: RetrievalEvaluationIssueDraft[] = [];

  if (totalCaseCount < MIN_RETRIEVAL_EVAL_CASES || evaluatedCaseCount < MIN_RETRIEVAL_EVAL_CASES) {
    issues.push({
      severity: "BLOCKER",
      code: "RETRIEVAL_EVAL_CASES_TOO_FEW",
      message: `검색 품질 평가 케이스가 ${MIN_RETRIEVAL_EVAL_CASES}개 미만입니다.`,
      hint: "케이스를 자동 생성하거나 추가한 뒤 재평가하세요.",
    });
  }

  if (hitRate < 0.7) {
    issues.push({
      severity: "BLOCKER",
      code: "RETRIEVAL_LOW_HIT_RATE",
      message: `hitRate(${hitRate.toFixed(2)})가 0.70 미만입니다.`,
    });
  }

  if (meanReciprocalRank < 0.4 && evaluatedCaseCount >= MIN_RETRIEVAL_EVAL_CASES) {
    issues.push({
      severity: "WARNING",
      code: "RETRIEVAL_LOW_MRR",
      message: `meanReciprocalRank(${meanReciprocalRank.toFixed(2)})가 낮습니다.`,
    });
  }

  const byCase = new Map<string, RetrievalEvaluationCaseResultDraft[]>();
  for (const result of results) {
    const list = byCase.get(result.caseId) ?? [];
    list.push(result);
    byCase.set(result.caseId, list);
  }
  let divergence = 0;
  let compared = 0;
  for (const list of byCase.values()) {
    const keyword = list.find((r) => r.retrievalMode === "keyword");
    const hybrid = list.find((r) => r.retrievalMode === "hybrid");
    if (!keyword || !hybrid) continue;
    compared += 1;
    const kFail = keyword.status === "FAIL";
    const hFail = hybrid.status === "FAIL";
    if (kFail !== hFail) divergence += 1;
  }
  if (compared > 0 && divergence / compared >= 0.3) {
    issues.push({
      severity: "WARNING",
      code: "RETRIEVAL_MODE_DIVERGENCE",
      message: "keyword와 hybrid 결과가 크게 어긋나는 케이스가 있습니다.",
    });
  }

  for (const result of results) {
    for (const code of result.issueCodes) {
      if (issues.some((i) => i.code === code && i.field === result.caseId)) continue;
      if (result.status !== "FAIL") continue;
      issues.push({
        severity: "WARNING",
        code,
        message: `케이스 검색 실패: ${result.query}`,
        field: result.caseId,
        hint: `${result.retrievalMode} mode`,
      });
    }
  }

  const blockingIssueCount = issues.filter((i) => i.severity === "BLOCKER").length;
  const warningIssueCount = issues.filter((i) => i.severity === "WARNING").length;

  let status: RetrievalEvaluationStatus;
  if (
    evaluatedCaseCount < MIN_RETRIEVAL_EVAL_CASES ||
    hitRate < 0.7 ||
    totalScore < 70 ||
    blockingIssueCount > 0
  ) {
    status = "FAIL";
  } else if (
    (hitRate >= 0.7 && hitRate < 0.85) ||
    (totalScore >= 70 && totalScore < 85) ||
    failCaseCount > 0 ||
    warningIssueCount > 0
  ) {
    status = "WARNING";
  } else if (hitRate >= 0.85 && totalScore >= 85) {
    status = "PASS";
  } else {
    status = "WARNING";
  }

  const summary = [
    `검색 품질 ${status} (총점 ${totalScore})`,
    `hitRate ${(hitRate * 100).toFixed(0)}%`,
    `MRR ${meanReciprocalRank.toFixed(2)}`,
    `평가 ${evaluatedCaseCount}건 (P ${passCaseCount}/W ${warningCaseCount}/F ${failCaseCount})`,
  ].join(" · ");

  return {
    status,
    retrievalMode: "mixed",
    totalCaseCount,
    evaluatedCaseCount,
    passCaseCount,
    warningCaseCount,
    failCaseCount,
    hitRate,
    meanReciprocalRank,
    averageTopRank,
    averageScore,
    totalScore,
    blockingIssueCount,
    warningIssueCount,
    summary,
    issues,
    results,
  };
}

/** Modes to evaluate for a case. */
export function modesForCase(
  mode: RetrievalEvaluationCaseInput["mode"],
): Array<"keyword" | "hybrid"> {
  if (mode === "keyword") return ["keyword"];
  if (mode === "hybrid") return ["hybrid"];
  return ["keyword", "hybrid"];
}
