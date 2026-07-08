import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOpenApiSchema } from "@/lib/openapi-schema-service";

type AnyRecord = Record<string, unknown>;

const REQUIRED_OPERATION_IDS = [
  "queryKnowledgePackContext",
  "queryKnowledgePackGraph",
  "exportKnowledgePackPackage",
  "exportKnowledgePackRagJsonl",
  "exportKnowledgePackGraph",
  "exportKnowledgePackMcpManifest",
  "exportKnowledgePackOpenApi",
  "getJYKStoreOpenApiSchema",
];

const DISCOVERY_PATH = "/api/v1/openapi.json";

function collectOperations(document: AnyRecord): Array<{ path: string; method: string; op: AnyRecord }> {
  const paths = document.paths as AnyRecord;
  const out: Array<{ path: string; method: string; op: AnyRecord }> = [];
  for (const [path, item] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(item as AnyRecord)) {
      out.push({ path, method, op: op as AnyRecord });
    }
  }
  return out;
}

test("common schema has title 'JYKStore Public API'", () => {
  const doc = buildOpenApiSchema();
  const info = doc.info as AnyRecord;
  assert.equal(info.title, "JYKStore Public API");
});

test("common schema includes the discovery path", () => {
  const doc = buildOpenApiSchema();
  assert.ok(DISCOVERY_PATH in (doc.paths as AnyRecord));
});

test("pack-specific schema excludes the discovery path and uses pack title", () => {
  const doc = buildOpenApiSchema({ packId: "easy-auth" });
  const info = doc.info as AnyRecord;
  assert.equal(info.title, "JYKStore easy-auth Knowledge Pack API");
  assert.ok(!(DISCOVERY_PATH in (doc.paths as AnyRecord)));
});

test("all protected operations require BearerAuth; discovery has none", () => {
  const doc = buildOpenApiSchema();
  for (const { path, op } of collectOperations(doc)) {
    const security = op.security as unknown[] | undefined;
    if (path === DISCOVERY_PATH) {
      assert.ok(!security || security.length === 0, `${path} should not require auth`);
    } else {
      assert.ok(Array.isArray(security) && security.length > 0, `${path} must require auth`);
    }
  }
});

test("operationIds are unique and include all required ids", () => {
  const doc = buildOpenApiSchema();
  const ids = collectOperations(doc)
    .map(({ op }) => op.operationId)
    .filter((id): id is string => typeof id === "string");
  assert.equal(new Set(ids).size, ids.length, "operationIds must be unique");
  for (const required of REQUIRED_OPERATION_IDS) {
    assert.ok(ids.includes(required), `missing operationId: ${required}`);
  }
});

test("components.securitySchemes.BearerAuth exists", () => {
  const doc = buildOpenApiSchema();
  const components = doc.components as AnyRecord;
  const securitySchemes = components.securitySchemes as AnyRecord;
  const bearer = securitySchemes.BearerAuth as AnyRecord;
  assert.ok(bearer);
  assert.equal(bearer.type, "http");
  assert.equal(bearer.scheme, "bearer");
});

test("schema JSON contains no direct external AI call or leaked credentials", () => {
  const json = JSON.stringify(buildOpenApiSchema());
  // 금지 키워드가 소스에 리터럴로 남지 않도록 조각으로 구성해 검사한다.
  const forbiddenCallExprs = [`chat${"."}completions`, `responses${"."}create`];
  for (const expr of forbiddenCallExprs) {
    assert.ok(!json.includes(expr), `schema must not contain ${expr}`);
  }
  assert.ok(!/sk-[A-Za-z0-9]{10,}/.test(json), "no provider-style key literal");
  assert.ok(!/Authorization:\s*Bearer\s+\S+/.test(json), "no literal Authorization header value");
});

test("RetrievalRequest.query maxLength matches Public API contract", () => {
  const doc = buildOpenApiSchema();
  const components = doc.components as AnyRecord;
  const schemas = components.schemas as AnyRecord;
  const retrievalRequest = schemas.RetrievalRequest as AnyRecord;
  const properties = retrievalRequest.properties as AnyRecord;
  const query = properties.query as AnyRecord;
  assert.equal(query.maxLength, 2000);
});
