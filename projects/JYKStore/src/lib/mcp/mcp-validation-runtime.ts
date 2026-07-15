import { MCP_TOOL_NAMES, TOOL_DEFINITIONS } from "../../../mcp-server/tool-definitions";
import { parseRetrievalToolInput } from "../../../mcp-server/schemas";
import {
  evaluateRetrievalValidationHits,
  executeRetrievalApiRequest,
} from "@/lib/retrieval/retrieval-api-adapter";
import type { RetrievalResponseDto } from "@/lib/retrieval-dto";

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
    }
  | { ok: false; code: string; message: string };

/**
 * In-process MCP validation: real tool registry + schema + retrieval adapter with MCP channel.
 * Does not call external GPT/Cursor.
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
  const registered =
    (MCP_TOOL_NAMES as readonly string[]).includes(MCP_RETRIEVAL_TOOL) &&
    TOOL_DEFINITIONS.some((t) => t.name === MCP_RETRIEVAL_TOOL);
  if (!registered) {
    return {
      ok: false,
      code: "MCP_VALIDATION_FAILED",
      message: "MCP Tool Registry에 retrieval tool이 없습니다.",
    };
  }

  let parsed;
  try {
    parsed = parseRetrievalToolInput({
      knowledgePackId: input.packId,
      query: input.query,
      topK: input.topK ?? 5,
      retrievalMode: "hybrid",
    });
  } catch (error) {
    return {
      ok: false,
      code: "MCP_VALIDATION_FAILED",
      message: error instanceof Error ? error.message : "MCP 입력 Schema 검증에 실패했습니다.",
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
  };
}
