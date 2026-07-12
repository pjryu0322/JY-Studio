import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDistributionManifest } from "../lib/distribution/payload-manifest.ts";
import { DISTRIBUTION_MANIFEST_SCHEMA_VERSION } from "../lib/distribution/payload-types.ts";
import { sha256Hex } from "../lib/distribution/payload-checksum.ts";

describe("payload-manifest", () => {
  it("builds required fields with schemaVersion and matching checksum", () => {
    const bytes = new TextEncoder().encode("payload-bytes");
    const checksumSha256 = sha256Hex(bytes);

    const manifest = buildDistributionManifest({
      pack: { packId: "toast-ui-grid", name: "TOAST UI Grid", version: "1.0.0" },
      provider: { providerId: "provider-1", displayName: "Provider" },
      generator: { type: "DOCLING", version: "2.x" },
      payload: {
        profile: "docling-chunks-v1",
        originalFileName: "toast-grid-docling.zip",
        mimeType: "application/zip",
        fileSize: bytes.byteLength,
        checksumSha256,
      },
      source: {
        title: "TOAST UI Grid Documentation",
        url: "https://example.com/docs",
        licenseName: "MIT",
      },
      distribution: { visibility: "PRIVATE", allowDownload: true },
      createdAt: "2026-07-12T00:00:00.000Z",
    });

    assert.equal(manifest.schemaVersion, DISTRIBUTION_MANIFEST_SCHEMA_VERSION);
    assert.equal(manifest.pack.packId, "toast-ui-grid");
    assert.equal(manifest.payload.checksumSha256, checksumSha256);
    assert.equal(manifest.generator.type, "DOCLING");
    assert.equal(manifest.generator.version, "2.x");
    assert.equal(manifest.source.licenseName, "MIT");
    assert.equal(manifest.distribution.visibility, "PRIVATE");
    assert.equal(manifest.createdAt, "2026-07-12T00:00:00.000Z");
  });

  it("never includes storagePath or other internal fields", () => {
    const manifest = buildDistributionManifest({
      pack: { packId: "p", name: "n", version: "1.0.0" },
      provider: { providerId: "id", displayName: "d" },
      generator: { type: "UNSTRUCTURED" },
      payload: {
        profile: "unstructured-elements-v1",
        originalFileName: "x.zip",
        mimeType: "application/zip",
        fileSize: 10,
        checksumSha256: "a".repeat(64),
      },
      source: { licenseName: "MIT" },
      distribution: { visibility: "PUBLIC", allowDownload: false },
    });

    const json = JSON.stringify(manifest);
    assert.equal(json.includes("storagePath"), false);
    assert.equal(json.includes("clientId"), false);
    assert.equal(json.includes("apiKey"), false);
    assert.equal("storagePath" in manifest.payload, false);
    assert.equal(manifest.generator.version, undefined);
  });
});
