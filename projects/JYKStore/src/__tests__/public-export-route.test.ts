import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { createPublicExportRoute } from "../../src/lib/public-export-route.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

const exportRoutes = [
  "src/app/api/v1/exports/package/route.ts",
  "src/app/api/v1/exports/rag-jsonl/route.ts",
  "src/app/api/v1/exports/graph/route.ts",
  "src/app/api/v1/exports/openapi/route.ts",
  "src/app/api/v1/exports/mcp-manifest/route.ts",
];

describe("public export route factory", () => {
  it("exports createPublicExportRoute", () => {
    assert.equal(typeof createPublicExportRoute, "function");
  });

  it("factory returns a GET handler function", () => {
    const handler = createPublicExportRoute({
      build: async () => null,
      metadata: () => ({}),
      response: () => new Response("ok"),
    });
    assert.equal(typeof handler, "function");
  });

  it("full export routes use createPublicExportRoute", () => {
    for (const routePath of exportRoutes) {
      const source = readFileSync(join(projectRoot, routePath), "utf8");
      assert.ok(source.includes("createPublicExportRoute"), routePath);
      assert.ok(!source.includes("resolvePublicExportRequest"), routePath);
    }
  });
});
