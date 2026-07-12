import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDistributionManifest } from "../lib/distribution/payload-manifest.ts";
import { DISTRIBUTION_MANIFEST_SCHEMA_VERSION } from "../lib/distribution/payload-types.ts";
import {
  assertManifestIntegrity,
  stableManifestFingerprint,
} from "../lib/distribution/distribution-manifest-service.ts";
import { sha256Hex } from "../lib/distribution/payload-checksum.ts";

describe("payload-manifest", () => {
  it("builds required fields with schemaVersion 0.2 and ID binding", () => {
    const bytes = new TextEncoder().encode("payload-bytes");
    const checksumSha256 = sha256Hex(bytes);

    const manifest = buildDistributionManifest({
      pack: {
        packId: "toast-ui-grid",
        versionId: "ver-1",
        name: "TOAST UI Grid",
        version: "1.0.0",
      },
      provider: { providerId: "provider-1", displayName: "Provider" },
      generator: { type: "DOCLING", version: "2.x" },
      payload: {
        payloadId: "pay-1",
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
    assert.equal(manifest.schemaVersion, "jyk-distribution-0.2");
    assert.equal(manifest.pack.packId, "toast-ui-grid");
    assert.equal(manifest.pack.versionId, "ver-1");
    assert.equal(manifest.payload.payloadId, "pay-1");
    assert.equal(manifest.payload.checksumSha256, checksumSha256);
    assert.equal(manifest.generator.type, "DOCLING");
    assert.equal(manifest.distribution.visibility, "PRIVATE");
  });

  it("never includes storagePath or other internal fields", () => {
    const manifest = buildDistributionManifest({
      pack: { packId: "p", versionId: "v", name: "n", version: "1.0.0" },
      provider: { providerId: "id", displayName: "d" },
      generator: { type: "UNSTRUCTURED" },
      payload: {
        payloadId: "pay",
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
    assert.equal("storagePath" in manifest.payload, false);
  });

  it("asserts integrity for bound ids and rejects mismatches", () => {
    const manifest = buildDistributionManifest({
      pack: { packId: "p1", versionId: "ver1", name: "N", version: "1.0.0" },
      provider: { providerId: "prov", displayName: "Prov" },
      generator: { type: "DOCLING", version: null },
      payload: {
        payloadId: "pay1",
        profile: "docling-chunks-v1",
        originalFileName: "a.zip",
        mimeType: "application/zip",
        fileSize: 10,
        checksumSha256: "c".repeat(64),
      },
      source: { title: "T", url: null, licenseName: "MIT" },
      distribution: { visibility: "PUBLIC", allowDownload: true },
    });

    const ok = assertManifestIntegrity({
      manifest,
      payloadId: "pay1",
      packId: "p1",
      versionId: "ver1",
      checksumSha256: "c".repeat(64),
      fileSize: 10,
      profile: "docling-chunks-v1",
    });
    assert.equal(ok.ok, true);

    const stale = assertManifestIntegrity({
      manifest,
      payloadId: "other",
      packId: "p1",
      versionId: "ver1",
      checksumSha256: "c".repeat(64),
    });
    assert.equal(stale.ok, false);
    if (!stale.ok) assert.equal(stale.code, "MANIFEST_STALE");
  });

  it("changes fingerprint when visibility changes", () => {
    const base = {
      pack: { packId: "p1", versionId: "ver1", name: "N", version: "1.0.0" },
      provider: { providerId: "prov", displayName: "Prov" },
      generator: { type: "DOCLING" as const, version: "1" },
      payload: {
        payloadId: "pay1",
        profile: "docling-chunks-v1" as const,
        originalFileName: "a.zip",
        mimeType: "application/zip",
        fileSize: 10,
        checksumSha256: "b".repeat(64),
      },
      source: { title: "T", url: null, licenseName: "MIT" },
      distribution: { visibility: "PRIVATE" as const, allowDownload: true },
    };
    const m1 = buildDistributionManifest(base);
    const m2 = buildDistributionManifest({
      ...base,
      distribution: { visibility: "PUBLIC", allowDownload: true },
    });
    assert.notEqual(stableManifestFingerprint(m1), stableManifestFingerprint(m2));
  });
});
