import type {
  RetrievalEvaluationCandidate,
  RetrievalEvaluationCaseInput,
  RetrievalEvaluationCaseResultDraft,
  RetrievalEvaluationIssueDraft,
  RetrievalEvaluationModeMetric,
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

export function aggregateCaseStatus(
  resultsByCase: RetrievalEvaluationCaseResultDraft[],
): {
  status: RetrievalEvaluationStatus;
  hit: boolean;
  bestFirstHitRank: number | null;
  bestReciprocalRank: number;
  bestScore: number;
  hasModeDivergence: boolean;
} {
  if (resultsByCase.length === 0) {
    return {
      status: "FAIL",
      hit: false,
      bestFirstHitRank: null,
      bestReciprocalRank: 0,
      bestScore: 0,
      hasModeDivergence: false,
    };
  }

  const statuses = resultsByCase.map((r) => r.status);
  const allFail = statuses.every((s) => s === "FAIL");
  const anyPass = statuses.some((s) => s === "PASS");
  const anyFail = statuses.some((s) => s === "FAIL");
  const anyWarning = statuses.some((s) => s === "WARNING");

  const keyword = resultsByCase.find((r) => r.retrievalMode === "keyword");
  const hybrid = resultsByCase.find((r) => r.retrievalMode === "hybrid");
  const hasModeDivergence = Boolean(
    keyword && hybrid && (keyword.status === "FAIL") !== (hybrid.status === "FAIL"),
  );

  let status: RetrievalEvaluationStatus;
  if (allFail) {
    status = "FAIL";
  } else if (hasModeDivergence || anyFail || (anyWarning && !anyPass) || (anyPass && anyFail)) {
    status = "WARNING";
  } else if (anyPass && !anyFail) {
    // PASS only if at least one PASS and no FAIL; WARNING siblings ok → still WARNING if any WARNING
    status = anyWarning ? "WARNING" : "PASS";
  } else {
    status = "WARNING";
  }

  // Conservative policy from prompt:
  // PASS + FAIL → WARNING; both PASS → PASS; both FAIL → FAIL
  if (keyword && hybrid) {
    if (keyword.status === "FAIL" && hybrid.status === "FAIL") status = "FAIL";
    else if (keyword.status === "PASS" && hybrid.status === "PASS") status = "PASS";
    else if (
      (keyword.status === "PASS" && hybrid.status === "FAIL") ||
      (keyword.status === "FAIL" && hybrid.status === "PASS") ||
      (keyword.status === "WARNING" && hybrid.status === "FAIL") ||
      (keyword.status === "FAIL" && hybrid.status === "WARNING")
    ) {
      status = "WARNING";
    }
  }

  const hitResults = resultsByCase.filter((r) => r.hit);
  const hit = hitResults.length > 0;
  let bestFirstHitRank: number | null = null;
  let bestReciprocalRank = 0;
  let bestScore = 0;
  for (const r of hitResults) {
    if (r.reciprocalRank >= bestReciprocalRank) {
      bestReciprocalRank = r.reciprocalRank;
      bestFirstHitRank = r.firstHitRank;
      bestScore = r.bestScore;
    }
  }

  // If hit but all hits have rank > 3 and no PASS mode → WARNING already covered
  if (hit && hitResults.every((r) => (r.firstHitRank ?? 99) > 3) && !anyPass) {
    status = status === "FAIL" ? "FAIL" : "WARNING";
  }

  return {
    status,
    hit,
    bestFirstHitRank,
    bestReciprocalRank,
    bestScore,
    hasModeDivergence,
  };
}

function emptyModeMetric(): RetrievalEvaluationModeMetric {
  return {
    evaluatedResultCount: 0,
    passCount: 0,
    warningCount: 0,
    failCount: 0,
    hitRate: 0,
    meanReciprocalRank: 0,
    averageTopRank: null,
    averageScore: 0,
  };
}

export function computeModeMetric(
  results: RetrievalEvaluationCaseResultDraft[],
): RetrievalEvaluationModeMetric {
  const evaluatedResultCount = results.length;
  if (evaluatedResultCount === 0) return emptyModeMetric();

  const passCount = results.filter((r) => r.status === "PASS").length;
  const warningCount = results.filter((r) => r.status === "WARNING").length;
  const failCount = results.filter((r) => r.status === "FAIL").length;
  const hitCount = results.filter((r) => r.hit).length;
  const hitRate = hitCount / evaluatedResultCount;
  const meanReciprocalRank =
    results.reduce((sum, r) => sum + r.reciprocalRank, 0) / evaluatedResultCount;
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

  return {
    evaluatedResultCount,
    passCount,
    warningCount,
    failCount,
    hitRate,
    meanReciprocalRank,
    averageTopRank,
    averageScore,
  };
}

export function aggregateRetrievalEvaluationResults(input: {
  cases: RetrievalEvaluationCaseInput[];
  results: RetrievalEvaluationCaseResultDraft[];
}): RetrievalEvaluationRunAggregate {
  const results = input.results;
  const uniqueCaseIds = [...new Set(input.cases.map((c) => c.id))];
  const totalCaseCount = uniqueCaseIds.length;

  const byCase = new Map<string, RetrievalEvaluationCaseResultDraft[]>();
  for (const caseId of uniqueCaseIds) {
    byCase.set(caseId, []);
  }
  for (const result of results) {
    const list = byCase.get(result.caseId) ?? [];
    list.push(result);
    byCase.set(result.caseId, list);
  }

  const caseAggregates = uniqueCaseIds.map((caseId) =>
    aggregateCaseStatus(byCase.get(caseId) ?? []),
  );

  const evaluatedCaseCount = caseAggregates.length;
  const passCaseCount = caseAggregates.filter((c) => c.status === "PASS").length;
  const warningCaseCount = caseAggregates.filter((c) => c.status === "WARNING").length;
  const failCaseCount = caseAggregates.filter((c) => c.status === "FAIL").length;

  const caseHitCount = caseAggregates.filter((c) => c.hit).length;
  const caseHitRate = evaluatedCaseCount > 0 ? caseHitCount / evaluatedCaseCount : 0;
  const caseMeanReciprocalRank =
    evaluatedCaseCount > 0
      ? caseAggregates.reduce((sum, c) => sum + c.bestReciprocalRank, 0) / evaluatedCaseCount
      : 0;

  const caseHitRanks = caseAggregates
    .filter((c) => c.bestFirstHitRank != null)
    .map((c) => c.bestFirstHitRank!);
  const averageTopRank =
    caseHitRanks.length > 0
      ? caseHitRanks.reduce((sum, r) => sum + r, 0) / caseHitRanks.length
      : null;
  const caseHitScores = caseAggregates.filter((c) => c.hit).map((c) => c.bestScore);
  const averageScore =
    caseHitScores.length > 0
      ? caseHitScores.reduce((sum, s) => sum + s, 0) / caseHitScores.length
      : 0;

  const evaluatedResultCount = results.length;
  const passResultCount = results.filter((r) => r.status === "PASS").length;
  const warningResultCount = results.filter((r) => r.status === "WARNING").length;
  const failResultCount = results.filter((r) => r.status === "FAIL").length;
  const resultHitCount = results.filter((r) => r.hit).length;
  const resultHitRate =
    evaluatedResultCount > 0 ? resultHitCount / evaluatedResultCount : 0;
  const resultMeanReciprocalRank =
    evaluatedResultCount > 0
      ? results.reduce((sum, r) => sum + r.reciprocalRank, 0) / evaluatedResultCount
      : 0;

  const keywordResults = results.filter((r) => r.retrievalMode === "keyword");
  const hybridResults = results.filter((r) => r.retrievalMode === "hybrid");
  const modeMetrics = {
    keyword: computeModeMetric(keywordResults),
    hybrid: computeModeMetric(hybridResults),
  };

  const totalScore = clampScore(caseHitRate * 70 + caseMeanReciprocalRank * 30);

  const issues: RetrievalEvaluationIssueDraft[] = [];

  if (totalCaseCount < MIN_RETRIEVAL_EVAL_CASES || evaluatedCaseCount < MIN_RETRIEVAL_EVAL_CASES) {
    issues.push({
      severity: "BLOCKER",
      code: "RETRIEVAL_EVAL_CASES_TOO_FEW",
      message: `검색 품질 평가 케이스가 ${MIN_RETRIEVAL_EVAL_CASES}개 미만입니다.`,
      hint: "케이스를 자동 생성하거나 추가한 뒤 재평가하세요.",
    });
  }

  if (caseHitRate < 0.7) {
    issues.push({
      severity: "BLOCKER",
      code: "RETRIEVAL_LOW_HIT_RATE",
      message: `caseHitRate(${caseHitRate.toFixed(2)})가 0.70 미만입니다.`,
    });
  }

  if (caseMeanReciprocalRank < 0.4 && evaluatedCaseCount >= MIN_RETRIEVAL_EVAL_CASES) {
    issues.push({
      severity: "WARNING",
      code: "RETRIEVAL_LOW_MRR",
      message: `caseMeanReciprocalRank(${caseMeanReciprocalRank.toFixed(2)})가 낮습니다.`,
    });
  }

  let divergence = 0;
  let compared = 0;
  for (const list of byCase.values()) {
    const keyword = list.find((r) => r.retrievalMode === "keyword");
    const hybrid = list.find((r) => r.retrievalMode === "hybrid");
    if (!keyword || !hybrid) continue;
    compared += 1;
    if ((keyword.status === "FAIL") !== (hybrid.status === "FAIL")) divergence += 1;
  }
  const hasDivergenceWarning = compared > 0 && divergence / compared >= 0.3;
  if (hasDivergenceWarning) {
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
    caseHitRate < 0.7 ||
    totalScore < 70 ||
    blockingIssueCount > 0
  ) {
    status = "FAIL";
  } else if (
    (caseHitRate >= 0.7 && caseHitRate < 0.85) ||
    (totalScore >= 70 && totalScore < 85) ||
    failCaseCount > 0 ||
    warningCaseCount > 0 ||
    hasDivergenceWarning ||
    warningIssueCount > 0
  ) {
    status = "WARNING";
  } else if (caseHitRate >= 0.85 && totalScore >= 85 && failCaseCount === 0) {
    status = "PASS";
  } else {
    status = "WARNING";
  }

  const summary = [
    `검색 품질 ${status} (총점 ${totalScore})`,
    `caseHit ${(caseHitRate * 100).toFixed(0)}%`,
    `caseMRR ${caseMeanReciprocalRank.toFixed(2)}`,
    `케이스 ${evaluatedCaseCount}/${totalCaseCount} (P ${passCaseCount}/W ${warningCaseCount}/F ${failCaseCount})`,
    `결과 ${evaluatedResultCount}`,
  ].join(" · ");

  return {
    status,
    retrievalMode: "mixed",
    totalCaseCount,
    evaluatedCaseCount,
    passCaseCount,
    warningCaseCount,
    failCaseCount,
    hitRate: caseHitRate,
    meanReciprocalRank: caseMeanReciprocalRank,
    caseHitRate,
    caseMeanReciprocalRank,
    evaluatedResultCount,
    passResultCount,
    warningResultCount,
    failResultCount,
    resultHitRate,
    resultMeanReciprocalRank,
    modeMetrics,
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

export function canRunAdminRetrievalEvaluationForStatus(status: string): boolean {
  return status === "DRAFT" || status === "REVIEWING";
}
