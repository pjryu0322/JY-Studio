import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { DOCLING_ADAPTER_VERSION } from "../lib/adapters/docling/docling-types.ts";

const projectRoot = join(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(join(projectRoot, relative), "utf8");
}

describe("docling adapter version lock", () => {
  it("upload route ignores client adapterVersion", () => {
    const route = read(
      "src/app/api/v1/provider/packs/[packId]/docling-import/route.ts",
    );
    assert.ok(route.includes("void adapterVersionRaw") || route.includes("ignored"));
    assert.ok(!route.includes("adapterVersion,"));
    assert.ok(!route.includes("adapterVersion:"));
  });

  it("uploadDoclingImportBundle uses server constant only", () => {
    const service = read("src/lib/docling-import/docling-import-service.ts");
    assert.ok(service.includes("DOCLING_ADAPTER_VERSION"));
    assert.ok(!service.includes("adapterVersion?: string"));
    assert.ok(!service.includes("input.adapterVersion"));
    assert.equal(DOCLING_ADAPTER_VERSION, "1.0.0");
  });

  it("provider FormData no longer appends adapterVersion", () => {
    const api = read("src/lib/provider-center-api.ts");
    assert.ok(api.includes("uploadProviderDoclingImportApi"));
    assert.ok(!api.includes('form.append("adapterVersion"'));
  });

  it("submit snapshot adapterVersion comes from NormalizedDocument", () => {
    const submit = read("src/lib/distribution/distribution-submit-service.ts");
    assert.ok(submit.includes("adapterVersion: nd.adapterVersion"));
    assert.ok(!submit.includes("adapterVersion: doclingBundle.adapterVersion"));
  });
});
