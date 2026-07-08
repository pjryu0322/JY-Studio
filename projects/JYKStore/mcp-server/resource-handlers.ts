import { assertPackAllowed } from "./config.js";
import { formatToolError, mcpError } from "./errors.js";
import { assertResponseSize, type JYKStoreClient } from "./jykstore-client.js";
import {
  parseResourceUri,
  resourceMimeType,
  requireKnowledgePackId,
  type ExportChunkQuery,
  type ResourceKind,
} from "./schemas.js";

export type ResourceReadResult = {
  contents: {
    uri: string;
    mimeType: string;
    text: string;
  }[];
  isError?: boolean;
};

async function loadPackExportText(input: {
  client: JYKStoreClient;
  kind: Exclude<ResourceKind, "global-openapi">;
  knowledgePackId: string;
}): Promise<string> {
  const { client, kind, knowledgePackId } = input;

  switch (kind) {
    case "package":
      return JSON.stringify(
        await client.getJson("/api/v1/exports/package", { knowledgePackId }),
        null,
        2,
      );
    case "rag-jsonl":
      return client.getText("/api/v1/exports/rag-jsonl", { knowledgePackId });
    case "graph":
      return JSON.stringify(
        await client.getJson("/api/v1/exports/graph", { knowledgePackId }),
        null,
        2,
      );
    case "openapi":
      return JSON.stringify(
        await client.getJson("/api/v1/exports/openapi", { knowledgePackId }),
        null,
        2,
      );
    case "mcp-manifest":
      return JSON.stringify(
        await client.getJson("/api/v1/exports/mcp-manifest", { knowledgePackId }),
        null,
        2,
      );
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function isChunkableExportKind(
  kind: Exclude<ResourceKind, "global-openapi">,
): kind is "package" | "rag-jsonl" | "graph" {
  return kind === "package" || kind === "rag-jsonl" || kind === "graph";
}

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

    const chunk: ExportChunkQuery | undefined =
      "chunk" in parsed ? parsed.chunk : undefined;
    const mimeType = resourceMimeType(parsed.kind);

    if (chunk) {
      if (!isChunkableExportKind(parsed.kind)) {
        throw mcpError(
          "JYKSTORE_MCP_INVALID_INPUT",
          `Chunk query is only supported for package, rag-jsonl, and graph resources (got ${parsed.kind}).`,
        );
      }

      const apiChunk = await input.client.getExportChunk(parsed.kind, {
        knowledgePackId,
        offset: chunk.offset,
        limitBytes: chunk.limitBytes,
      });
      const text = JSON.stringify(apiChunk, null, 2);
      assertResponseSize(Buffer.byteLength(text, "utf8"), input.client.maxResponseBytes, {
        code: "JYKSTORE_MCP_RESPONSE_TOO_LARGE",
        hint: "Chunk resource response is too large after JSON encoding. Reduce limitBytes and retry from the same offset.",
      });

      return {
        contents: [
          {
            uri: input.uri,
            mimeType: "application/json",
            text,
          },
        ],
      };
    }

    const text = await loadPackExportText({
      client: input.client,
      kind: parsed.kind,
      knowledgePackId,
    });

    return {
      contents: [
        {
          uri: input.uri,
          mimeType,
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
