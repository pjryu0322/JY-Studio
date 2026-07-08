import { assertPackAllowed } from "./config.js";
import { formatToolError, mcpError } from "./errors.js";
import type { JYKStoreClient } from "./jykstore-client.js";
import {
  parseGraphToolInput,
  parsePackIdToolInput,
  parseRetrievalToolInput,
} from "./schemas.js";
import type { McpToolName } from "./tool-definitions.js";

function textResult(payload: unknown) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  return {
    content: [{ type: "text" as const, text }],
  };
}

export async function handleMcpToolCall(input: {
  name: string;
  args: unknown;
  client: JYKStoreClient;
  allowedPackIds: string[];
}): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
  try {
    const name = input.name as McpToolName;

    switch (name) {
      case "jykstore_retrieval_query": {
        const parsed = parseRetrievalToolInput(input.args);
        assertPackAllowed(parsed.knowledgePackId, input.allowedPackIds);
        const body: Record<string, unknown> = {
          knowledgePackId: parsed.knowledgePackId,
          query: parsed.query,
          topK: parsed.topK,
          retrievalMode: parsed.retrievalMode,
        };
        if (parsed.metadataFilters) {
          body.filters = parsed.metadataFilters;
        }
        const result = await input.client.postJson("/api/v1/retrieval/query", body);
        return textResult(result);
      }
      case "jykstore_graph_query": {
        const parsed = parseGraphToolInput(input.args);
        assertPackAllowed(parsed.knowledgePackId, input.allowedPackIds);
        const body: Record<string, unknown> = {
          knowledgePackId: parsed.knowledgePackId,
          limit: parsed.limit,
        };
        if (parsed.nodeTypes) body.nodeTypes = parsed.nodeTypes;
        if (parsed.edgeTypes) body.edgeTypes = parsed.edgeTypes;
        if (parsed.query) body.query = parsed.query;
        const result = await input.client.postJson("/api/v1/graph/query", body);
        return textResult(result);
      }
      case "jykstore_export_package": {
        const parsed = parsePackIdToolInput(input.args);
        assertPackAllowed(parsed.knowledgePackId, input.allowedPackIds);
        const result = await input.client.getJson("/api/v1/exports/package", {
          knowledgePackId: parsed.knowledgePackId,
        });
        return textResult(result);
      }
      case "jykstore_export_rag_jsonl": {
        const parsed = parsePackIdToolInput(input.args);
        assertPackAllowed(parsed.knowledgePackId, input.allowedPackIds);
        const result = await input.client.getText("/api/v1/exports/rag-jsonl", {
          knowledgePackId: parsed.knowledgePackId,
        });
        return textResult(result);
      }
      case "jykstore_export_graph": {
        const parsed = parsePackIdToolInput(input.args);
        assertPackAllowed(parsed.knowledgePackId, input.allowedPackIds);
        const result = await input.client.getJson("/api/v1/exports/graph", {
          knowledgePackId: parsed.knowledgePackId,
        });
        return textResult(result);
      }
      case "jykstore_export_openapi": {
        const parsed = parsePackIdToolInput(input.args);
        assertPackAllowed(parsed.knowledgePackId, input.allowedPackIds);
        const result = await input.client.getJson("/api/v1/exports/openapi", {
          knowledgePackId: parsed.knowledgePackId,
        });
        return textResult(result);
      }
      case "jykstore_export_mcp_manifest": {
        const parsed = parsePackIdToolInput(input.args);
        assertPackAllowed(parsed.knowledgePackId, input.allowedPackIds);
        const result = await input.client.getJson("/api/v1/exports/mcp-manifest", {
          knowledgePackId: parsed.knowledgePackId,
        });
        return textResult(result);
      }
      default:
        throw mcpError(
          "JYKSTORE_MCP_TOOL_NOT_FOUND",
          `Unknown MCP tool: ${input.name}`,
        );
    }
  } catch (error) {
    return formatToolError(error);
  }
}
