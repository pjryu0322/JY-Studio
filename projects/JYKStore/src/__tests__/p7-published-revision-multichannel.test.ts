import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

describe("P7 published revision multi-channel alignment", () => {
  it("public RAG export uses public revision resolver (PROMOTED only)", () => {
    const source = readFileSync(join(root, "src/lib/exports/rag-export-public.ts"), "utf8");
    assert.match(source, /resolvePublicRetrievalGenerationScope/);
    assert.match(source, /status:\s*"PROMOTED"/);
    assert.match(source, /scope:\s*"PRODUCTION"/);
    assert.doesNotMatch(source, /fall back to latest READY/);
    assert.match(source, /assertServiceChannelEnabled\("DOWNLOAD"/);
  });

  it("RAG builder accepts READY and PROMOTED generations", () => {
    const source = readFileSync(join(root, "src/lib/exports/rag-export-builder.ts"), "utf8");
    assert.match(source, /status:\s*\{\s*in:\s*\["READY",\s*"PROMOTED"\]\s*\}/);
    assert.match(source, /versionId:\s*version\.id/);
    assert.match(source, /scope:\s*generation\.scope/);
    assert.match(source, /status:\s*generation\.status/);
  });

  it("Public API and MCP share executeRetrievalApiRequest", () => {
    const api = readFileSync(join(root, "src/app/api/v1/retrieval/query/route.ts"), "utf8");
    const mcp = readFileSync(join(root, "src/app/api/v1/mcp/retrieval/query/route.ts"), "utf8");
    assert.match(api, /executeRetrievalApiRequest/);
    assert.match(mcp, /executeRetrievalApiRequest/);
    assert.match(api, /serviceChannel:\s*"API"/);
    assert.match(mcp, /serviceChannel:\s*"MCP"/);
  });

  it("prefer-const baseline keepId is const", () => {
    const source = readFileSync(
      join(root, "src/lib/correction/correction-apply-service.ts"),
      "utf8",
    );
    assert.match(source, /const keepId = keepAnchor\.id/);
    assert.doesNotMatch(source, /let keepId = keepAnchor\.id/);
  });
});
