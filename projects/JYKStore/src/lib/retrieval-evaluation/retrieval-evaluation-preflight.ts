export type RetrievalEvaluationPreflightStatus =
  | "ready"
  | "chunk_insufficient"
  | "case_without_expected_source"
  | "case_scope_mismatch"
  | "no_active_cases"
  | "no_active_chunks";

export type RetrievalEvaluationPreflightRecommendedAction =
  | "run_retrieval_evaluation"
  | "regenerate_chunks"
  | "regenerate_cases"
  | "regenerate_chunks_and_cases"
  | "go_to_draft"
  | "go_to_source";

export type RetrievalEvaluationPreflightCase = {
  query: string;
  expectedSourceDocumentIds: string[];
  expectedChunkIds: string[];
};

export type RetrievalEvaluationPreflightResult = {
  status: RetrievalEvaluationPreflightStatus;
  ready: boolean;
  activeChunkCount: number;
  activeCaseCount: number;
  expectedSourceMappedCaseCount: number;
  unmappedCaseTitles: string[];
  mismatchedCaseTitles: string[];
  recommendedAction: RetrievalEvaluationPreflightRecommendedAction;
  userMessage: string;
};

export function evaluateRetrievalEvaluationPreflight(input: {
  activeChunkCount: number;
  activeChunkIds?: string[];
  activeChunkSourceDocumentIds?: string[];
  activeCases: RetrievalEvaluationPreflightCase[];
}): RetrievalEvaluationPreflightResult {
  const activeChunkCount = input.activeChunkCount;
  const activeCases = input.activeCases;
  const activeCaseCount = activeCases.length;
  const activeChunkIds = new Set(input.activeChunkIds ?? []);
  const activeSourceIds = new Set(
    (input.activeChunkSourceDocumentIds ?? []).filter(Boolean),
  );

  const unmappedCaseTitles: string[] = [];
  const mismatchedCaseTitles: string[] = [];
  let expectedSourceMappedCaseCount = 0;

  for (const c of activeCases) {
    const hasExpected =
      c.expectedChunkIds.length > 0 || c.expectedSourceDocumentIds.length > 0;
    if (!hasExpected) {
      unmappedCaseTitles.push(c.query);
      continue;
    }

    const chunkMapped =
      c.expectedChunkIds.length === 0 ||
      c.expectedChunkIds.some((id) => activeChunkIds.has(id));
    const sourceMapped =
      c.expectedSourceDocumentIds.length === 0 ||
      c.expectedSourceDocumentIds.some((id) => activeSourceIds.has(id));

    if (
      (c.expectedChunkIds.length > 0 && !chunkMapped) ||
      (c.expectedSourceDocumentIds.length > 0 && !sourceMapped)
    ) {
      mismatchedCaseTitles.push(c.query);
      continue;
    }

    expectedSourceMappedCaseCount += 1;
  }

  if (activeChunkCount === 0) {
    return {
      status: "no_active_chunks",
      ready: false,
      activeChunkCount,
      activeCaseCount,
      expectedSourceMappedCaseCount,
      unmappedCaseTitles,
      mismatchedCaseTitles,
      recommendedAction: "regenerate_chunks_and_cases",
      userMessage:
        "검색 가능한 Chunk가 없습니다. 시스템이 검색용 데이터를 다시 생성해야 합니다.",
    };
  }

  if (activeCaseCount === 0) {
    return {
      status: "no_active_cases",
      ready: false,
      activeChunkCount,
      activeCaseCount,
      expectedSourceMappedCaseCount,
      unmappedCaseTitles,
      mismatchedCaseTitles,
      recommendedAction: "regenerate_cases",
      userMessage:
        "검색 평가 케이스가 없습니다. 현재 지식 데이터 기준으로 평가 케이스를 다시 생성해야 합니다.",
    };
  }

  const minChunks = Math.min(3, activeCaseCount);
  if (activeChunkCount < minChunks) {
    return {
      status: "chunk_insufficient",
      ready: false,
      activeChunkCount,
      activeCaseCount,
      expectedSourceMappedCaseCount,
      unmappedCaseTitles,
      mismatchedCaseTitles,
      recommendedAction: "regenerate_chunks_and_cases",
      userMessage: `검색 평가에 사용할 Chunk가 부족합니다(활성 ${activeChunkCount}개 / 평가 케이스 ${activeCaseCount}개). 검색용 데이터를 자동 보완해야 합니다.`,
    };
  }

  if (unmappedCaseTitles.length > 0) {
    return {
      status: "case_without_expected_source",
      ready: false,
      activeChunkCount,
      activeCaseCount,
      expectedSourceMappedCaseCount,
      unmappedCaseTitles,
      mismatchedCaseTitles,
      recommendedAction: "regenerate_cases",
      userMessage:
        "일부 검색 평가 케이스가 현재 지식 데이터와 연결되지 않았습니다. 평가 케이스를 다시 생성해야 합니다.",
    };
  }

  if (mismatchedCaseTitles.length > 0 || expectedSourceMappedCaseCount < activeCaseCount) {
    return {
      status: "case_scope_mismatch",
      ready: false,
      activeChunkCount,
      activeCaseCount,
      expectedSourceMappedCaseCount,
      unmappedCaseTitles,
      mismatchedCaseTitles,
      recommendedAction: "regenerate_chunks_and_cases",
      userMessage: `평가 케이스 ${activeCaseCount}개 중 ${activeCaseCount - expectedSourceMappedCaseCount}개가 현재 생성된 지식 범위와 맞지 않습니다. 검색용 데이터를 자동 보완해야 합니다.`,
    };
  }

  return {
    status: "ready",
    ready: true,
    activeChunkCount,
    activeCaseCount,
    expectedSourceMappedCaseCount,
    unmappedCaseTitles,
    mismatchedCaseTitles,
    recommendedAction: "run_retrieval_evaluation",
    userMessage: "검색 품질 평가를 실행할 수 있습니다.",
  };
}
