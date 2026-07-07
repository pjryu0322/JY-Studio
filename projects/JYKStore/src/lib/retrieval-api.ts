export type RetrievalApiTestInput = {
  apiKey: string;
  knowledgePackId: string;
  query?: string;
  filters?: Record<string, unknown>;
  topK?: number;
  includeMetadata?: boolean;
  retrievalMode?: "keyword" | "hybrid";
};

export type RetrievalApiTestResult = {
  ok: boolean;
  status: number;
  statusText: string;
  requestId: string | null;
  contextCount: number | null;
  elapsedMs: number;
  responseBody: unknown;
  errorMessage: string | null;
};

function extractUsage(body: unknown): { requestId: string | null; contextCount: number | null } {
  if (!body || typeof body !== "object") {
    return { requestId: null, contextCount: null };
  }
  const usage = (body as { usage?: { requestId?: string; contextCount?: number } }).usage;
  const requestId = typeof usage?.requestId === "string" ? usage.requestId : null;
  const contextCount = typeof usage?.contextCount === "number" ? usage.contextCount : null;
  return { requestId, contextCount };
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

  const { requestId, contextCount } = extractUsage(responseBody);

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    requestId,
    contextCount,
    elapsedMs,
    responseBody,
    errorMessage: response.ok ? null : extractErrorMessage(responseBody),
  };
}
