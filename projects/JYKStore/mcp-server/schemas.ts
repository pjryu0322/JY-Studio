import { RETRIEVAL_QUERY_MAX_LENGTH } from "../src/lib/retrieval-dto";
import {
  DEFAULT_EXPORT_CHUNK_LIMIT_BYTES,
  MAX_EXPORT_CHUNK_LIMIT_BYTES,
  MIN_EXPORT_CHUNK_LIMIT_BYTES,
} from "../src/lib/export-chunk-dto";
import { mcpError } from "./errors.js";

/** Keep in sync with Public Retrieval API `RETRIEVAL_QUERY_MAX_LENGTH`. */
export const MCP_RETRIEVAL_QUERY_MAX_LENGTH = RETRIEVAL_QUERY_MAX_LENGTH;

export {
  DEFAULT_EXPORT_CHUNK_LIMIT_BYTES,
  MAX_EXPORT_CHUNK_LIMIT_BYTES,
  MIN_EXPORT_CHUNK_LIMIT_BYTES,
};

export type RetrievalToolInput = {
  knowledgePackId: string;
  query: string;
  topK: number;
  retrievalMode: "keyword" | "hybrid";
  metadataFilters?: Record<string, string | number | boolean | string[]>;
};

export type GraphToolInput = {
  knowledgePackId: string;
  nodeTypes?: string[];
  edgeTypes?: string[];
  query?: string;
  limit: number;
};

export type PackIdInput = {
  knowledgePackId: string;
};

export type ExportChunkToolInput = {
  knowledgePackId: string;
  offset: number;
  limitBytes: number;
};

export type ExportChunkQuery = {
  offset: number;
  limitBytes: number;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function requireKnowledgePackId(value: unknown): string {
  if (typeof value !== "string") {
    throw mcpError("JYKSTORE_MCP_INVALID_INPUT", "knowledgePackId must be a string.");
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw mcpError("JYKSTORE_MCP_INVALID_INPUT", "knowledgePackId must be a non-empty string.");
  }
  if (trimmed.length > 100) {
    throw mcpError("JYKSTORE_MCP_INVALID_INPUT", "knowledgePackId must be at most 100 characters.");
  }
  return trimmed;
}

export function parseTopK(value: unknown): number {
  if (value === undefined || value === null) return 5;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw mcpError("JYKSTORE_MCP_INVALID_INPUT", "topK must be an integer.");
  }
  if (value < 1 || value > 20) {
    throw mcpError("JYKSTORE_MCP_INVALID_INPUT", "topK must be between 1 and 20.");
  }
  return value;
}

export function parseRetrievalMode(value: unknown): "keyword" | "hybrid" {
  if (value === undefined || value === null) return "hybrid";
  if (value !== "keyword" && value !== "hybrid") {
    throw mcpError(
      "JYKSTORE_MCP_INVALID_INPUT",
      'retrievalMode must be "keyword" or "hybrid".',
    );
  }
  return value;
}

export function parseGraphLimit(value: unknown): number {
  if (value === undefined || value === null) return 50;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw mcpError("JYKSTORE_MCP_INVALID_INPUT", "limit must be an integer.");
  }
  if (value < 1 || value > 200) {
    throw mcpError("JYKSTORE_MCP_INVALID_INPUT", "limit must be between 1 and 200.");
  }
  return value;
}

export function parseQuery(value: unknown, options?: { maxLength?: number; required?: boolean }): string | undefined {
  const maxLength = options?.maxLength ?? 2000;
  const required = options?.required ?? true;
  if (value === undefined || value === null) {
    if (required) {
      throw mcpError("JYKSTORE_MCP_INVALID_INPUT", "query must be a non-empty string.");
    }
    return undefined;
  }
  if (typeof value !== "string") {
    throw mcpError("JYKSTORE_MCP_INVALID_INPUT", "query must be a string.");
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw mcpError("JYKSTORE_MCP_INVALID_INPUT", "query must be a non-empty string.");
  }
  if (trimmed.length > maxLength) {
    throw mcpError(
      "JYKSTORE_MCP_INVALID_INPUT",
      `query must be at most ${maxLength} characters.`,
    );
  }
  return trimmed;
}

export function parseMetadataFilters(
  value: unknown,
): Record<string, string | number | boolean | string[]> | undefined {
  if (value === undefined || value === null) return undefined;
  const obj = asObject(value);
  if (!obj) {
    throw mcpError("JYKSTORE_MCP_INVALID_INPUT", "metadataFilters must be an object.");
  }

  const out: Record<string, string | number | boolean | string[]> = {};
  for (const [key, raw] of Object.entries(obj)) {
    if (key.trim().length === 0 || key.length > 100) {
      throw mcpError(
        "JYKSTORE_MCP_INVALID_INPUT",
        "metadataFilters keys must be 1..100 characters.",
      );
    }
    if (
      typeof raw === "string" ||
      typeof raw === "number" ||
      typeof raw === "boolean"
    ) {
      out[key] = raw;
      continue;
    }
    if (Array.isArray(raw) && raw.every((item) => typeof item === "string")) {
      out[key] = raw;
      continue;
    }
    throw mcpError(
      "JYKSTORE_MCP_INVALID_INPUT",
      "metadataFilters values must be string, number, boolean, or string[]. Nested objects are not allowed.",
    );
  }
  return out;
}

export function parseOptionalStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw mcpError("JYKSTORE_MCP_INVALID_INPUT", `${field} must be an array of strings.`);
  }
  return value;
}

export function parseRetrievalToolInput(raw: unknown): RetrievalToolInput {
  const body = asObject(raw);
  if (!body) {
    throw mcpError("JYKSTORE_MCP_INVALID_INPUT", "Tool arguments must be an object.");
  }
  return {
    knowledgePackId: requireKnowledgePackId(body.knowledgePackId),
    query: parseQuery(body.query, {
      required: true,
      maxLength: MCP_RETRIEVAL_QUERY_MAX_LENGTH,
    })!,
    topK: parseTopK(body.topK),
    retrievalMode: parseRetrievalMode(body.retrievalMode),
    metadataFilters: parseMetadataFilters(body.metadataFilters),
  };
}

export function parseGraphToolInput(raw: unknown): GraphToolInput {
  const body = asObject(raw);
  if (!body) {
    throw mcpError("JYKSTORE_MCP_INVALID_INPUT", "Tool arguments must be an object.");
  }
  return {
    knowledgePackId: requireKnowledgePackId(body.knowledgePackId),
    nodeTypes: parseOptionalStringArray(body.nodeTypes, "nodeTypes"),
    edgeTypes: parseOptionalStringArray(body.edgeTypes, "edgeTypes"),
    query: parseQuery(body.query, { required: false, maxLength: 2000 }),
    limit: parseGraphLimit(body.limit),
  };
}

export function parsePackIdToolInput(raw: unknown): PackIdInput {
  const body = asObject(raw);
  if (!body) {
    throw mcpError("JYKSTORE_MCP_INVALID_INPUT", "Tool arguments must be an object.");
  }
  return {
    knowledgePackId: requireKnowledgePackId(body.knowledgePackId),
  };
}

export function parseChunkOffset(value: unknown): number {
  if (value === undefined || value === null) return 0;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw mcpError(
      "JYKSTORE_MCP_INVALID_INPUT",
      "offset must be a non-negative integer.",
    );
  }
  return value;
}

export function parseChunkLimitBytes(value: unknown): number {
  if (value === undefined || value === null) return DEFAULT_EXPORT_CHUNK_LIMIT_BYTES;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw mcpError("JYKSTORE_MCP_INVALID_INPUT", "limitBytes must be an integer.");
  }
  if (value < MIN_EXPORT_CHUNK_LIMIT_BYTES || value > MAX_EXPORT_CHUNK_LIMIT_BYTES) {
    throw mcpError(
      "JYKSTORE_MCP_INVALID_INPUT",
      `limitBytes must be between ${MIN_EXPORT_CHUNK_LIMIT_BYTES} and ${MAX_EXPORT_CHUNK_LIMIT_BYTES}.`,
    );
  }
  return value;
}

export function parseExportChunkToolInput(raw: unknown): ExportChunkToolInput {
  const body = asObject(raw);
  if (!body) {
    throw mcpError("JYKSTORE_MCP_INVALID_INPUT", "Tool arguments must be an object.");
  }
  return {
    knowledgePackId: requireKnowledgePackId(body.knowledgePackId),
    offset: parseChunkOffset(body.offset),
    limitBytes: parseChunkLimitBytes(body.limitBytes),
  };
}

export function parseExportChunkQuery(
  searchParams: URLSearchParams,
): ExportChunkQuery | undefined {
  const hasOffset = searchParams.has("offset");
  const hasLimit = searchParams.has("limitBytes");
  if (!hasOffset && !hasLimit) return undefined;

  const offsetRaw = searchParams.get("offset");
  const limitRaw = searchParams.get("limitBytes");

  if (offsetRaw !== null && offsetRaw !== "" && !/^\d+$/.test(offsetRaw)) {
    throw mcpError("JYKSTORE_MCP_INVALID_INPUT", "offset must be a non-negative integer.");
  }
  if (limitRaw !== null && limitRaw !== "" && !/^\d+$/.test(limitRaw)) {
    throw mcpError("JYKSTORE_MCP_INVALID_INPUT", "limitBytes must be an integer.");
  }

  const offset =
    offsetRaw === null || offsetRaw === ""
      ? 0
      : parseChunkOffset(Number(offsetRaw));
  const limitBytes =
    limitRaw === null || limitRaw === ""
      ? DEFAULT_EXPORT_CHUNK_LIMIT_BYTES
      : parseChunkLimitBytes(Number(limitRaw));

  return { offset, limitBytes };
}

export type ResourceKind =
  | "package"
  | "rag-jsonl"
  | "graph"
  | "openapi"
  | "mcp-manifest"
  | "global-openapi";

export type ParsedResourceUri =
  | { kind: "global-openapi" }
  | {
      kind: Exclude<ResourceKind, "global-openapi">;
      knowledgePackId: string;
      chunk?: ExportChunkQuery;
    };

const PACK_KINDS = new Set([
  "package",
  "rag-jsonl",
  "graph",
  "openapi",
  "mcp-manifest",
]);

export function parseResourceUri(uri: string): ParsedResourceUri {
  const trimmed = uri.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw mcpError(
      "JYKSTORE_MCP_RESOURCE_NOT_FOUND",
      `Unknown resource URI: ${uri}`,
    );
  }

  if (parsed.protocol !== "jykstore:") {
    throw mcpError(
      "JYKSTORE_MCP_RESOURCE_NOT_FOUND",
      `Unknown resource URI: ${uri}`,
    );
  }

  const host = parsed.hostname;
  const pathParts = parsed.pathname.replace(/^\/+/, "").split("/").filter(Boolean);

  if (host === "openapi" && pathParts.length === 0) {
    return { kind: "global-openapi" };
  }

  // Node URL: jykstore://packs/{id}/rag-jsonl → hostname=packs, pathname=/{id}/rag-jsonl
  if (host === "packs" && pathParts.length === 2) {
    const [knowledgePackIdRaw, kindRaw] = pathParts;
    if (!PACK_KINDS.has(kindRaw)) {
      throw mcpError(
        "JYKSTORE_MCP_RESOURCE_NOT_FOUND",
        `Unknown resource URI: ${uri}`,
      );
    }
    const chunk = parseExportChunkQuery(parsed.searchParams);
    return {
      kind: kindRaw as Exclude<ResourceKind, "global-openapi">,
      knowledgePackId: decodeURIComponent(knowledgePackIdRaw),
      ...(chunk ? { chunk } : {}),
    };
  }

  throw mcpError(
    "JYKSTORE_MCP_RESOURCE_NOT_FOUND",
    `Unknown resource URI: ${uri}`,
  );
}

export function resourceMimeType(kind: ResourceKind): string {
  if (kind === "rag-jsonl") return "application/x-ndjson";
  return "application/json";
}
