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
  it("upload session complete uses server adapter constant", () => {
    const session = read("src/lib/docling-import/docling-upload-session-service.ts");
    assert.ok(session.includes("DOCLING_ADAPTER_VERSION"));
    assert.ok(!session.includes("input.adapterVersion"));
  });

  it("normalize path uses server constant only", () => {
    const service = read("src/lib/docling-import/docling-import-service.ts");
    assert.ok(service.includes("DOCLING_ADAPTER_VERSION"));
    assert.ok(!service.includes("adapterVersion?: string"));
    assert.ok(!service.includes("input.adapterVersion"));
    assert.equal(DOCLING_ADAPTER_VERSION, "1.1.1");
  });

  it("provider client does not append adapterVersion on upload", () => {
    const api = read("src/lib/provider-center-api.ts");
    assert.ok(
      api.includes("createProviderDoclingUploadSessionApi") ||
        api.includes("completeProviderDoclingUploadSessionApi") ||
        api.includes("uploadProviderDoclingImportApi"),
    );
    assert.ok(!api.includes('form.append("adapterVersion"'));
  });

  it("submit snapshot adapterVersion comes from NormalizedDocument", () => {
    const submit = read("src/lib/distribution/distribution-submit-service.ts");
    assert.ok(submit.includes("adapterVersion: nd.adapterVersion"));
    assert.ok(!submit.includes("adapterVersion: doclingBundle.adapterVersion"));
  });
});
