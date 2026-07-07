export type JYKStoreClientOptions = {
  baseUrl: string;
  apiKey: string;
};

export type ContextQueryInput = {
  packId: string;
  query?: string;
  q?: string;
  limit?: number;
  includeMetadata?: boolean;
};

export class JYKStoreApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly response?: unknown,
  ) {
    super(message);
    this.name = "JYKStoreApiError";
  }
}

export class JYKStoreClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(options: JYKStoreClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
  }

  private authHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      ...extra,
    };
  }

  private async parseResponse(response: Response): Promise<unknown> {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      const code =
        typeof body === "object" && body !== null && "error" in body
          ? (body as { error?: { code?: string } }).error?.code
          : undefined;
      throw new JYKStoreApiError(
        `JYKStore Context API request failed with status ${response.status}`,
        response.status,
        code,
        body,
      );
    }

    return body;
  }

  async getContext(input: ContextQueryInput): Promise<unknown> {
    const params = new URLSearchParams();
    const q = input.q ?? input.query;
    if (q) params.set("q", q);
    if (typeof input.limit === "number") params.set("limit", String(input.limit));
    if (typeof input.includeMetadata === "boolean") {
      params.set("includeMetadata", String(input.includeMetadata));
    }

    const suffix = params.toString() ? `?${params.toString()}` : "";
    const url = `${this.baseUrl}/api/v1/packs/${encodeURIComponent(input.packId)}/context${suffix}`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.authHeaders(),
    });

    return this.parseResponse(response);
  }

  async queryContext(input: ContextQueryInput): Promise<unknown> {
    const url = `${this.baseUrl}/api/v1/packs/${encodeURIComponent(input.packId)}/context/query`;

    const response = await fetch(url, {
      method: "POST",
      headers: this.authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        query: input.query ?? input.q,
        limit: input.limit,
        includeMetadata: input.includeMetadata,
      }),
    });

    return this.parseResponse(response);
  }
}
