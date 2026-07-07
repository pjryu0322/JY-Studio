export type RetrievalApiTestInput = {
  apiKey: string;
  knowledgePackId: string;
  query?: string;
  filters?: Record<string, unknown>;
  topK?: number;
  includeMetadata?: boolean;
  retrievalMode?: "keyword" | "hybrid";
};

export type RetrievalApiUsageSummary = {
  requestId: string | null;
  contextCount: number | null;
  retrievalMode: string | null;
  scannedCandidateCount: number | null;
  filteredCandidateCount: number | null;
  candidateCollectionMode: string | null;
  embeddingProvider: string | null;
  embeddingModel: string | null;
};

export type RetrievalApiTestResult = {
  ok: boolean;
  status: number;
  statusText: string;
  usage: RetrievalApiUsageSummary;
  elapsedMs: number;
  responseBody: unknown;
  errorMessage: string | null;
};

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function extractUsage(body: unknown): RetrievalApiUsageSummary {
  const empty: RetrievalApiUsageSummary = {
    requestId: null,
    contextCount: null,
    retrievalMode: null,
    scannedCandidateCount: null,
    filteredCandidateCount: null,
    candidateCollectionMode: null,
    embeddingProvider: null,
    embeddingModel: null,
  };
  if (!body || typeof body !== "object") return empty;

  const usage = (body as { usage?: Record<string, unknown> }).usage;
  if (!usage) return empty;

  return {
    requestId: str(usage.requestId),
    contextCount: num(usage.contextCount),
    retrievalMode: str(usage.retrievalMode),
    scannedCandidateCount: num(usage.scannedCandidateCount),
    filteredCandidateCount: num(usage.filteredCandidateCount),
    candidateCollectionMode: str(usage.candidateCollectionMode),
    embeddingProvider: str(usage.embeddingProvider),
    embeddingModel: str(usage.embeddingModel),
  };
}

function extractErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const error = (body as { error?: { message?: string } }).error;
  return typeof error?.message === "string" ? error.message : null;
}

export async function runRetrievalApiTest(input: RetrievalApiTestInput): Promise<RetrievalApiTestResult> {
  const startedAt = Date.now();
  const trimmedKey = input.apiKey.trim();

  const body: Record<string, unknown> = {
    knowledgePackId: input.knowledgePackId.trim(),
    includeMetadata: input.includeMetadata ?? true,
  };
  if (input.query?.trim()) body.query = input.query.trim();
  if (input.filters && Object.keys(input.filters).length > 0) body.filters = input.filters;
  if (typeof input.topK === "number") body.topK = input.topK;
  if (input.retrievalMode) body.retrievalMode = input.retrievalMode;

  const response = await fetch("/api/v1/retrieval/query", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${trimmedKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const elapsedMs = Date.now() - startedAt;
  let responseBody: unknown = null;
  try {
    responseBody = await response.json();
  } catch {
    responseBody = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    usage: extractUsage(responseBody),
    elapsedMs,
    responseBody,
    errorMessage: response.ok ? null : extractErrorMessage(responseBody),
  };
}
