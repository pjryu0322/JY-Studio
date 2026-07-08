import {
  DEFAULT_EXPORT_CHUNK_LIMIT_BYTES,
  MAX_EXPORT_CHUNK_LIMIT_BYTES,
  MCP_RETRIEVAL_QUERY_MAX_LENGTH,
  MIN_EXPORT_CHUNK_LIMIT_BYTES,
} from "./schemas.js";

export const MCP_TOOL_NAMES = [
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

export type McpToolName = (typeof MCP_TOOL_NAMES)[number];

export type JsonSchemaObject = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type ToolDefinition = {
  name: McpToolName;
  description: string;
  inputSchema: JsonSchemaObject;
};

const packIdProperty = {
  type: "string",
  description: "Published or verified JYKStore knowledgePackId",
  minLength: 1,
  maxLength: 100,
};

const chunkInputProperties = {
  knowledgePackId: packIdProperty,
  offset: {
    type: "integer",
    description: "Byte offset (default 0)",
    minimum: 0,
  },
  limitBytes: {
    type: "integer",
    description: `Max bytes per chunk (${MIN_EXPORT_CHUNK_LIMIT_BYTES}-${MAX_EXPORT_CHUNK_LIMIT_BYTES}, default ${DEFAULT_EXPORT_CHUNK_LIMIT_BYTES})`,
    minimum: MIN_EXPORT_CHUNK_LIMIT_BYTES,
    maximum: MAX_EXPORT_CHUNK_LIMIT_BYTES,
  },
};

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "jykstore_retrieval_query",
    description:
      "Search validated context chunks from a JYKStore knowledge pack via Public Retrieval API. Returns raw JSON context, not a generated answer.",
    inputSchema: {
      type: "object",
      properties: {
        knowledgePackId: packIdProperty,
        query: {
          type: "string",
          description: `Search query text (1-${MCP_RETRIEVAL_QUERY_MAX_LENGTH} characters)`,
          minLength: 1,
          maxLength: MCP_RETRIEVAL_QUERY_MAX_LENGTH,
        },
        topK: {
          type: "integer",
          description: "Max results (1-20, default 5)",
          minimum: 1,
          maximum: 20,
        },
        retrievalMode: {
          type: "string",
          enum: ["keyword", "hybrid"],
          description: "Retrieval mode (default hybrid)",
        },
        metadataFilters: {
          type: "object",
          description: "Flat metadata filters (string/number/boolean/string[] values only)",
          additionalProperties: true,
        },
      },
      required: ["knowledgePackId", "query"],
      additionalProperties: false,
    },
  },
  {
    name: "jykstore_graph_query",
    description:
      "Query the knowledge graph of a JYKStore knowledge pack via Public Graph API.",
    inputSchema: {
      type: "object",
      properties: {
        knowledgePackId: packIdProperty,
        nodeTypes: {
          type: "array",
          items: { type: "string" },
          description: "Optional node type filters",
        },
        edgeTypes: {
          type: "array",
          items: { type: "string" },
          description: "Optional edge type filters",
        },
        query: {
          type: "string",
          description: "Optional graph search query",
          maxLength: 2000,
        },
        limit: {
          type: "integer",
          description: "Max nodes/edges (1-200, default 50)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["knowledgePackId"],
      additionalProperties: false,
    },
  },
  {
    name: "jykstore_export_package",
    description: "Export a full knowledge pack package JSON via Public Export API.",
    inputSchema: {
      type: "object",
      properties: { knowledgePackId: packIdProperty },
      required: ["knowledgePackId"],
      additionalProperties: false,
    },
  },
  {
    name: "jykstore_export_rag_jsonl",
    description: "Export RAG JSONL lines for a knowledge pack via Public Export API.",
    inputSchema: {
      type: "object",
      properties: { knowledgePackId: packIdProperty },
      required: ["knowledgePackId"],
      additionalProperties: false,
    },
  },
  {
    name: "jykstore_export_graph",
    description: "Export knowledge graph JSON for a pack via Public Export API.",
    inputSchema: {
      type: "object",
      properties: { knowledgePackId: packIdProperty },
      required: ["knowledgePackId"],
      additionalProperties: false,
    },
  },
  {
    name: "jykstore_export_openapi",
    description: "Export pack-specific OpenAPI schema via Public Export API.",
    inputSchema: {
      type: "object",
      properties: { knowledgePackId: packIdProperty },
      required: ["knowledgePackId"],
      additionalProperties: false,
    },
  },
  {
    name: "jykstore_export_mcp_manifest",
    description:
      "Export the P15 MCP-ready manifest (contract document). This tool returns the manifest JSON; this runtime server is the P22 bridge.",
    inputSchema: {
      type: "object",
      properties: { knowledgePackId: packIdProperty },
      required: ["knowledgePackId"],
      additionalProperties: false,
    },
  },
  {
    name: "jykstore_export_package_chunk",
    description:
      "Read a byte chunk of a knowledge pack package JSON export via Public Export API.",
    inputSchema: {
      type: "object",
      properties: chunkInputProperties,
      required: ["knowledgePackId"],
      additionalProperties: false,
    },
  },
  {
    name: "jykstore_export_rag_jsonl_chunk",
    description: "Read a byte chunk of RAG JSONL export via Public Export API.",
    inputSchema: {
      type: "object",
      properties: chunkInputProperties,
      required: ["knowledgePackId"],
      additionalProperties: false,
    },
  },
  {
    name: "jykstore_export_graph_chunk",
    description:
      "Read a byte chunk of knowledge graph JSON export via Public Export API.",
    inputSchema: {
      type: "object",
      properties: chunkInputProperties,
      required: ["knowledgePackId"],
      additionalProperties: false,
    },
  },
];
