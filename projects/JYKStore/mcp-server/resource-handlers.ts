import { assertPackAllowed } from "./config.js";
import { sliceUtf8TextByBytes } from "./chunking.js";
import { formatToolError } from "./errors.js";
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
  useExportSourceLimit: boolean;
}): Promise<string> {
  const { client, kind, knowledgePackId, useExportSourceLimit } = input;
  const getJson = useExportSourceLimit
    ? client.getExportSourceJson.bind(client)
    : client.getJson.bind(client);
  const getText = useExportSourceLimit
    ? client.getExportSourceText.bind(client)
    : client.getText.bind(client);

  switch (kind) {
    case "package":
      return JSON.stringify(await getJson("/api/v1/exports/package", { knowledgePackId }), null, 2);
    case "rag-jsonl":
      return getText("/api/v1/exports/rag-jsonl", { knowledgePackId });
    case "graph":
      return JSON.stringify(await getJson("/api/v1/exports/graph", { knowledgePackId }), null, 2);
    case "openapi":
      return JSON.stringify(await getJson("/api/v1/exports/openapi", { knowledgePackId }), null, 2);
    case "mcp-manifest":
      return JSON.stringify(
        await getJson("/api/v1/exports/mcp-manifest", { knowledgePackId }),
        null,
        2,
      );
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function formatChunkResourceText(input: {
  knowledgePackId: string;
  exportType: string;
  chunk: ExportChunkQuery;
  sourceText: string;
  mimeType: string;
}): string {
  const slice = sliceUtf8TextByBytes(input.sourceText, input.chunk.offset, input.chunk.limitBytes);
  return JSON.stringify(
    {
      knowledgePackId: input.knowledgePackId,
      exportType: input.exportType,
      offset: input.chunk.offset,
      limitBytes: input.chunk.limitBytes,
      nextOffset: slice.nextOffset,
      hasMore: slice.hasMore,
      byteLength: slice.byteLength,
      mimeType: input.mimeType,
      content: slice.content,
    },
    null,
    2,
  );
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

    const chunk = "chunk" in parsed ? parsed.chunk : undefined;
    const mimeType = resourceMimeType(parsed.kind);
    const sourceText = await loadPackExportText({
      client: input.client,
      kind: parsed.kind,
      knowledgePackId,
      useExportSourceLimit: Boolean(chunk),
    });

    let text: string;
    if (chunk) {
      text = formatChunkResourceText({
        knowledgePackId,
        exportType: parsed.kind,
        chunk,
        sourceText,
        mimeType,
      });
      assertResponseSize(Buffer.byteLength(text, "utf8"), input.client.maxResponseBytes, {
        code: "JYKSTORE_MCP_RESPONSE_TOO_LARGE",
        hint: "Chunk resource response is too large after JSON encoding. Reduce limitBytes and retry from the same offset.",
      });
    } else {
      text = sourceText;
    }

    return {
      contents: [
        {
          uri: input.uri,
          mimeType: chunk ? "application/json" : mimeType,
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
