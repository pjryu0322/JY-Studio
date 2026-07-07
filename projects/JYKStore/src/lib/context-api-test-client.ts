export type ContextApiTestMethod = "GET" | "POST";

export type ContextApiTestInput = {
  packId: string;
  apiKey: string;
  method: ContextApiTestMethod;
  query?: string;
  limit?: number;
  includeMetadata?: boolean;
};

export type ContextApiTestResult = {
  ok: boolean;
  status: number;
  statusText: string;
  requestId: string | null;
  chunkCount: number | null;
  elapsedMs: number;
  responseBody: unknown;
  errorMessage: string | null;
};

function extractUsage(body: unknown): { requestId: string | null; chunkCount: number | null } {
  if (!body || typeof body !== "object") {
    return { requestId: null, chunkCount: null };
  }

  const usage = (body as { usage?: { requestId?: string; chunkCount?: number } }).usage;
  const requestId = typeof usage?.requestId === "string" ? usage.requestId : null;
  const chunkCount = typeof usage?.chunkCount === "number" ? usage.chunkCount : null;

  return { requestId, chunkCount };
}

function extractErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const error = (body as { error?: { message?: string } }).error;
  return typeof error?.message === "string" ? error.message : null;
}

export async function runContextApiTest(input: ContextApiTestInput): Promise<ContextApiTestResult> {
  const startedAt = Date.now();
  const trimmedKey = input.apiKey.trim();
  const packId = encodeURIComponent(input.packId.trim());
  const limit = input.limit ?? 10;
  const includeMetadata = input.includeMetadata ?? true;
  const query = input.query?.trim() ?? "";

  const headers: HeadersInit = {
    Authorization: `Bearer ${trimmedKey}`,
  };

  let response: Response;

  if (input.method === "GET") {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("includeMetadata", includeMetadata ? "true" : "false");
    if (query) params.set("q", query);

    response = await fetch(`/api/v1/packs/${packId}/context?${params.toString()}`, {
      method: "GET",
      headers,
    });
  } else {
    headers["Content-Type"] = "application/json";
    response = await fetch(`/api/v1/packs/${packId}/context/query`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: query || undefined,
        limit,
        includeMetadata,
      }),
    });
  }

  const elapsedMs = Date.now() - startedAt;
  let responseBody: unknown = null;

  try {
    responseBody = await response.json();
  } catch {
    responseBody = null;
  }

  const { requestId, chunkCount } = extractUsage(responseBody);

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    requestId,
    chunkCount,
    elapsedMs,
    responseBody,
    errorMessage: response.ok ? null : extractErrorMessage(responseBody),
  };
}
