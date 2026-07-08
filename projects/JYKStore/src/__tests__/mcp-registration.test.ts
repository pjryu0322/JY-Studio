import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MCP_RETRIEVAL_QUERY_MAX_LENGTH,
  MAX_EXPORT_CHUNK_LIMIT_BYTES,
  MIN_EXPORT_CHUNK_LIMIT_BYTES,
} from "../../mcp-server/schemas.ts";
import { TOOL_DEFINITIONS, MCP_TOOL_NAMES } from "../../mcp-server/tool-definitions.ts";
import {
  RESOURCE_TEMPLATES,
  STATIC_RESOURCE_LIST,
} from "../../mcp-server/resource-handlers.ts";
import {
  EXPECTED_MCP_TOOL_NAMES,
  EXPECTED_RESOURCE_TEMPLATES,
  EXPECTED_STATIC_RESOURCE_URIS,
} from "./helpers/mcp-runtime-test-utils.ts";

describe("mcp registration snapshot", () => {
  it("registers all expected tool names", () => {
    assert.deepEqual([...MCP_TOOL_NAMES].sort(), [...EXPECTED_MCP_TOOL_NAMES].sort());
    const definitionNames = TOOL_DEFINITIONS.map((tool) => tool.name).sort();
    assert.deepEqual(definitionNames, [...EXPECTED_MCP_TOOL_NAMES].sort());
  });

  it("keeps retrieval query maxLength at 2000", () => {
    assert.equal(MCP_RETRIEVAL_QUERY_MAX_LENGTH, 2000);
    const retrieval = TOOL_DEFINITIONS.find((tool) => tool.name === "jykstore_retrieval_query");
    assert.ok(retrieval);
    const query = retrieval.inputSchema.properties.query as {
      maxLength?: number;
      minLength?: number;
    };
    assert.equal(query.maxLength, 2000);
    assert.equal(query.minLength, 1);
  });

  it("exposes offset/limitBytes on chunk tools", () => {
    for (const name of [
      "jykstore_export_package_chunk",
      "jykstore_export_rag_jsonl_chunk",
      "jykstore_export_graph_chunk",
    ] as const) {
      const tool = TOOL_DEFINITIONS.find((item) => item.name === name);
      assert.ok(tool, `missing tool ${name}`);
      assert.ok("offset" in tool.inputSchema.properties);
      assert.ok("limitBytes" in tool.inputSchema.properties);
      const limit = tool.inputSchema.properties.limitBytes as {
        minimum?: number;
        maximum?: number;
      };
      assert.equal(limit.minimum, MIN_EXPORT_CHUNK_LIMIT_BYTES);
      assert.equal(limit.maximum, MAX_EXPORT_CHUNK_LIMIT_BYTES);
    }
  });

  it("keeps static resources and pack templates", () => {
    assert.deepEqual(
      STATIC_RESOURCE_LIST.map((item) => item.uri),
      EXPECTED_STATIC_RESOURCE_URIS,
    );
    assert.deepEqual(
      RESOURCE_TEMPLATES.map((item) => item.uriTemplate).sort(),
      [...EXPECTED_RESOURCE_TEMPLATES].sort(),
    );
    assert.ok(EXPECTED_STATIC_RESOURCE_URIS.includes("jykstore://openapi"));
    for (const suffix of ["package", "rag-jsonl", "graph", "openapi", "mcp-manifest"]) {
      assert.ok(
        EXPECTED_RESOURCE_TEMPLATES.includes(`jykstore://packs/{knowledgePackId}/${suffix}`),
        `missing template for ${suffix}`,
      );
    }
  });
});
