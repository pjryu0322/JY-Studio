import { mcpError, type JYKStoreMcpError } from "./errors.js";

export type JYKStoreClientConfig = {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  maxExportSourceBytes?: number;
  allowedPackIds?: string[];
  fetchImpl?: typeof fetch;
};

export type AuthHeaders = {
  Authorization: string;
  "Content-Type": string;
  Accept: string;
};

export function buildAuthHeaders(apiKey: string, accept = "application/json"): AuthHeaders {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: accept,
  };
}

export function buildQueryString(
  query?: Record<string, string | number | boolean | undefined>,
): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export function assertResponseSize(
  byteLength: number,
  maxResponseBytes: number,
  options?: { code?: string; hint?: string },
): void {
  if (byteLength > maxResponseBytes) {
    throw mcpError(
      options?.code ?? "JYKSTORE_MCP_RESPONSE_TOO_LARGE",
      `Response size ${byteLength} bytes exceeds limit ${maxResponseBytes}.`,
      {
        hint:
          options?.hint ??
          "Reduce topK/limit, use a smaller pack, request a narrower export, or use chunked export tools.",
      },
    );
  }
}

export function normalizeHttpError(input: {
  status: number;
  bodyText: string;
}): JYKStoreMcpError {
  let parsed: Record<string, unknown> | null = null;
  try {
    const json = JSON.parse(input.bodyText) as unknown;
    if (json && typeof json === "object" && !Array.isArray(json)) {
      parsed = json as Record<string, unknown>;
    }
  } catch {
    parsed = null;
  }

  const code =
    (typeof parsed?.code === "string" && parsed.code) ||
    (typeof parsed?.error === "string" && parsed.error) ||
    "JYKSTORE_MCP_HTTP_ERROR";
  const message =
    (typeof parsed?.message === "string" && parsed.message) ||
    (typeof parsed?.error === "string" && parsed.error !== code ? parsed.error : null) ||
    `JYKStore Public API request failed with HTTP ${input.status}.`;
  const requestId =
    typeof parsed?.requestId === "string"
      ? parsed.requestId
      : typeof parsed?.request_id === "string"
        ? parsed.request_id
        : undefined;

  return {
    code,
    message,
    status: input.status,
    requestId,
    details: parsed ?? (input.bodyText ? { body: input.bodyText.slice(0, 500) } : undefined),
  };
}

export class JYKStoreClient {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
  readonly maxExportSourceBytes: number;
  readonly allowedPackIds: string[];
  private readonly fetchImpl: typeof fetch;

  constructor(config: JYKStoreClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.maxResponseBytes = config.maxResponseBytes ?? 2_000_000;
    this.maxExportSourceBytes = config.maxExportSourceBytes ?? 20_000_000;
    this.allowedPackIds = config.allowedPackIds ?? [];
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async postJson<T>(path: string, body: unknown): Promise<T> {
    const response = await this.request(path, {
      method: "POST",
      headers: buildAuthHeaders(this.apiKey, "application/json"),
      body: JSON.stringify(body),
    });
    return JSON.parse(response) as T;
  }

  async getJson<T>(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    const response = await this.request(`${path}${buildQueryString(query)}`, {
      method: "GET",
      headers: buildAuthHeaders(this.apiKey, "application/json"),
    });
    return JSON.parse(response) as T;
  }

  async getText(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<string> {
    return this.request(`${path}${buildQueryString(query)}`, {
      method: "GET",
      headers: buildAuthHeaders(
        this.apiKey,
        "application/x-ndjson, text/plain, application/json",
      ),
    });
  }

  /** Fetch full export text with the larger export-source byte limit (for chunking). */
  async getExportSourceText(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<string> {
    return this.request(
      `${path}${buildQueryString(query)}`,
      {
        method: "GET",
        headers: buildAuthHeaders(
          this.apiKey,
          "application/x-ndjson, text/plain, application/json",
        ),
      },
      {
        maxBytes: this.maxExportSourceBytes,
        tooLargeCode: "JYKSTORE_MCP_EXPORT_TOO_LARGE",
        tooLargeHint:
          "Export exceeds JYKSTORE_MCP_MAX_EXPORT_SOURCE_BYTES. Use a smaller pack or raise the limit carefully.",
      },
    );
  }

  async getExportSourceJson<T>(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    const text = await this.getExportSourceText(path, query);
    return JSON.parse(text) as T;
  }

  private async request(
    path: string,
    init: RequestInit,
    sizeGuard?: {
      maxBytes: number;
      tooLargeCode?: string;
      tooLargeHint?: string;
    },
  ): Promise<string> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const maxBytes = sizeGuard?.maxBytes ?? this.maxResponseBytes;

    try {
      const response = await this.fetchImpl(url, {
        ...init,
        signal: controller.signal,
      });
      const bodyText = await response.text();
      const byteLength = Buffer.byteLength(bodyText, "utf8");
      assertResponseSize(byteLength, maxBytes, {
        code: sizeGuard?.tooLargeCode,
        hint: sizeGuard?.tooLargeHint,
      });

      if (!response.ok) {
        const normalized = normalizeHttpError({ status: response.status, bodyText });
        throw mcpError(normalized.code, normalized.message, normalized);
      }

      return bodyText;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw mcpError(
          "JYKSTORE_MCP_HTTP_ERROR",
          `JYKStore Public API request timed out after ${this.timeoutMs}ms.`,
        );
      }
      throw mcpError(
        "JYKSTORE_MCP_INTERNAL_ERROR",
        error instanceof Error ? error.message : "Unexpected MCP client error.",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
