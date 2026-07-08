import { assertPackAllowed } from "./config.js";
import { formatToolError } from "./errors.js";
import type { JYKStoreClient } from "./jykstore-client.js";
import { parseResourceUri, resourceMimeType, requireKnowledgePackId } from "./schemas.js";

export type ResourceReadResult = {
  contents: {
    uri: string;
    mimeType: string;
    text: string;
  }[];
  isError?: boolean;
};

export async function handleResourceRead(input: {
  uri: string;
  client: JYKStoreClient;
  allowedPackIds: string[];
}): Promise<ResourceReadResult> {
  try {
    const parsed = parseResourceUri(input.uri);

    if (parsed.kind === "global-openapi") {
      const text = await input.client.getText("/api/v1/openapi.json");
      return {
        contents: [
          {
            uri: input.uri,
            mimeType: resourceMimeType("global-openapi"),
            text,
          },
        ],
      };
    }

    const knowledgePackId = requireKnowledgePackId(parsed.knowledgePackId);
    assertPackAllowed(knowledgePackId, input.allowedPackIds);

    let text: string;
    switch (parsed.kind) {
      case "package":
        text = JSON.stringify(
          await input.client.getJson("/api/v1/exports/package", { knowledgePackId }),
          null,
          2,
        );
        break;
      case "rag-jsonl":
        text = await input.client.getText("/api/v1/exports/rag-jsonl", { knowledgePackId });
        break;
      case "graph":
        text = JSON.stringify(
          await input.client.getJson("/api/v1/exports/graph", { knowledgePackId }),
          null,
          2,
        );
        break;
      case "openapi":
        text = JSON.stringify(
          await input.client.getJson("/api/v1/exports/openapi", { knowledgePackId }),
          null,
          2,
        );
        break;
      case "mcp-manifest":
        text = JSON.stringify(
          await input.client.getJson("/api/v1/exports/mcp-manifest", { knowledgePackId }),
          null,
          2,
        );
        break;
      default:
        text = "";
    }

    return {
      contents: [
        {
          uri: input.uri,
          mimeType: resourceMimeType(parsed.kind),
          text,
        },
      ],
    };
  } catch (error) {
    const formatted = formatToolError(error);
    return {
      contents: [
        {
          uri: input.uri,
          mimeType: "application/json",
          text: formatted.content[0]?.text ?? '{"code":"JYKSTORE_MCP_INTERNAL_ERROR"}',
        },
      ],
      isError: true,
    };
  }
}

export const STATIC_RESOURCE_LIST = [
  {
    uri: "jykstore://openapi",
    name: "JYKStore Public OpenAPI",
    description: "JYKStore Public API OpenAPI schema (GET /api/v1/openapi.json)",
    mimeType: "application/json",
  },
] as const;

export const RESOURCE_TEMPLATES = [
  {
    uriTemplate: "jykstore://packs/{knowledgePackId}/package",
    name: "Pack package export",
    description: "GET /api/v1/exports/package",
    mimeType: "application/json",
  },
  {
    uriTemplate: "jykstore://packs/{knowledgePackId}/rag-jsonl",
    name: "Pack RAG JSONL export",
    description: "GET /api/v1/exports/rag-jsonl",
    mimeType: "application/x-ndjson",
  },
  {
    uriTemplate: "jykstore://packs/{knowledgePackId}/graph",
    name: "Pack graph export",
    description: "GET /api/v1/exports/graph",
    mimeType: "application/json",
  },
  {
    uriTemplate: "jykstore://packs/{knowledgePackId}/openapi",
    name: "Pack OpenAPI export",
    description: "GET /api/v1/exports/openapi",
    mimeType: "application/json",
  },
  {
    uriTemplate: "jykstore://packs/{knowledgePackId}/mcp-manifest",
    name: "Pack MCP-ready manifest",
    description: "GET /api/v1/exports/mcp-manifest (P15 contract document)",
    mimeType: "application/json",
  },
] as const;
