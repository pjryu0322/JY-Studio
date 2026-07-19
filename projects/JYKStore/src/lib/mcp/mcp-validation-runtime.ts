import {
  evaluateRetrievalValidationHits,
  executeRetrievalApiRequest,
} from "@/lib/retrieval/retrieval-api-adapter";
import { RETRIEVAL_QUERY_MAX_LENGTH, type RetrievalResponseDto } from "@/lib/retrieval-dto";
import type { RerankStats } from "@/lib/retrieval/relevance-diversity-rerank";

/** Keep in sync with mcp-server/tool-definitions.ts MCP_TOOL_NAMES. */
const MCP_TOOL_REGISTRY = [
  "jykstore_retrieval_query",
  "jykstore_graph_query",
  "jykstore_export_package",
  "jykstore_export_rag_jsonl",
  "jykstore_export_graph",
  "jykstore_export_openapi",
  "jykstore_export_mcp_manifest",
  "jykstore_export_package_chunk",
  "jykstore_export_rag_jsonl_chunk",
  "jykstore_export_graph_chunk",
] as const;

const MCP_RETRIEVAL_TOOL = "jykstore_retrieval_query" as const;
const DEFAULT_MAX_RESPONSE_BYTES = 2_000_000;

export type ExecuteMcpValidationResult =
  | {
      ok: true;
      data: RetrievalResponseDto;
      toolName: string;
      responseBytes: number;
      latencyMs: number;
      mcpProtocolVersion: string;
      rerankStats?: RerankStats | null;
    }
  | { ok: false; code: string; message: string };

/**
 * Mirror of mcp-server retrieval tool input schema (without importing mcp-server/*.js —
 * those ESM .js extensions break Next/Webpack bundling of provider UI).
 */
function parseMcpRetrievalToolInput(input: {
  knowledgePackId: string;
  query: string;
  topK?: number;
  retrievalMode?: string;
}):
  | {
      ok: true;
      knowledgePackId: string;
      query: string;
      topK: number;
      retrievalMode: "keyword" | "hybrid";
    }
  | { ok: false; message: string } {
  const knowledgePackId = input.knowledgePackId.trim();
  if (!knowledgePackId) {
    return { ok: false, message: "knowledgePackId must be a non-empty string." };
  }
  if (knowledgePackId.length > 100) {
    return { ok: false, message: "knowledgePackId must be at most 100 characters." };
  }
  const query = input.query.trim();
  if (!query) {
    return { ok: false, message: "query must be a non-empty string." };
  }
  if (query.length > RETRIEVAL_QUERY_MAX_LENGTH) {
    return {
      ok: false,
      message: `query must be at most ${RETRIEVAL_QUERY_MAX_LENGTH} characters.`,
    };
  }
  const topK = input.topK ?? 5;
  if (!Number.isInteger(topK) || topK < 1 || topK > 20) {
    return { ok: false, message: "topK must be between 1 and 20." };
  }
  const retrievalMode = input.retrievalMode ?? "hybrid";
  if (retrievalMode !== "keyword" && retrievalMode !== "hybrid") {
    return { ok: false, message: 'retrievalMode must be "keyword" or "hybrid".' };
  }
  return { ok: true, knowledgePackId, query, topK, retrievalMode };
}

/**
 * In-process MCP validation: tool registry + schema + retrieval adapter with MCP channel.
 * Does not import mcp-server packages into the Next.js client/server webpack graph.
 */
export async function executeMcpValidation(input: {
  packId: string;
  versionId: string;
  query: string;
  indexGenerationId: string | null;
  topK?: number;
  maxResponseBytes?: number;
}): Promise<ExecuteMcpValidationResult> {
  const started = Date.now();
  if (!(MCP_TOOL_REGISTRY as readonly string[]).includes(MCP_RETRIEVAL_TOOL)) {
    return {
      ok: false,
      code: "MCP_VALIDATION_FAILED",
      message: "MCP Tool Registry에 retrieval tool이 없습니다.",
    };
  }

  const parsed = parseMcpRetrievalToolInput({
    knowledgePackId: input.packId,
    query: input.query,
    topK: input.topK ?? 5,
    retrievalMode: "hybrid",
  });
  if (!parsed.ok) {
    return {
      ok: false,
      code: "MCP_VALIDATION_FAILED",
      message: parsed.message,
    };
  }

  const result = await executeRetrievalApiRequest({
    knowledgePackId: parsed.knowledgePackId,
    query: parsed.query,
    topK: parsed.topK,
    retrievalMode: parsed.retrievalMode,
    includeMetadata: true,
    requestId: `mcp-validation-${Date.now()}`,
    serviceChannel: "MCP",
    executionMode: "PROVIDER_VALIDATION",
    versionId: input.versionId,
    indexGenerationId: input.indexGenerationId,
  });

  if (!result.ok) {
    return {
      ok: false,
      code: result.code === "SERVICE_CHANNEL_DISABLED" ? result.code : "MCP_VALIDATION_FAILED",
      message: result.message,
    };
  }

  const encoded = JSON.stringify(result.data);
  const responseBytes = Buffer.byteLength(encoded, "utf8");
  const maxBytes = input.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  if (responseBytes > maxBytes) {
    return {
      ok: false,
      code: "MCP_VALIDATION_FAILED",
      message: `MCP 응답 크기가 제한(${maxBytes} bytes)을 초과했습니다.`,
    };
  }

  const hits = evaluateRetrievalValidationHits({
    data: result.data,
    expectedVersionId: input.versionId,
    expectedIndexGenerationId: input.indexGenerationId,
  });
  if (!hits.ok) {
    return {
      ok: false,
      code: "MCP_VALIDATION_FAILED",
      message: hits.message,
    };
  }

  return {
    ok: true,
    data: result.data,
    toolName: MCP_RETRIEVAL_TOOL,
    responseBytes,
    latencyMs: Date.now() - started,
    mcpProtocolVersion: "2024-11-05",
    rerankStats: result.rerankStats,
  };
}
