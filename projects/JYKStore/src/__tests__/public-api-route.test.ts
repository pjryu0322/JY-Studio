import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import type { PublicApiRouteScope } from "../../src/lib/public-api-route.ts";
import { withPublicApiGateway } from "../../src/lib/public-api-route.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readRoute(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("public api route wrapper", () => {
  it("exports withPublicApiGateway", () => {
    assert.equal(typeof withPublicApiGateway, "function");
  });

  it("allows retrieval, graph, and context scopes", () => {
    const scopes: PublicApiRouteScope[] = ["retrieval", "graph", "context"];
    assert.equal(scopes.length, 3);
  });

  it("retrieval route uses withPublicApiGateway", () => {
    const source = readRoute("src/app/api/v1/retrieval/query/route.ts");
    assert.ok(source.includes("withPublicApiGateway"));
    assert.ok(!source.includes("requireContextReadApiKey"));
    assert.ok(!source.includes("requireQuota"));
  });

  it("graph route uses withPublicApiGateway", () => {
    const source = readRoute("src/app/api/v1/graph/query/route.ts");
    assert.ok(source.includes("withPublicApiGateway"));
    assert.ok(!source.includes("requireContextReadApiKey"));
  });

  it("context routes use withPublicApiGateway", () => {
    const getSource = readRoute("src/app/api/v1/packs/[packId]/context/route.ts");
    const postSource = readRoute("src/app/api/v1/packs/[packId]/context/query/route.ts");
    assert.ok(getSource.includes("withPublicApiGateway"));
    assert.ok(postSource.includes("withPublicApiGateway"));
    assert.ok(!getSource.includes("checkQuota"));
    assert.ok(!postSource.includes("authenticateApiKey"));
  });
});
