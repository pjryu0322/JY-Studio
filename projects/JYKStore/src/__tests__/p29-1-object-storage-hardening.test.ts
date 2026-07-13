import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { buildDistributionManifest } from "../lib/distribution/payload-manifest.ts";
import {
  assertManifestIntegrity,
  stableManifestFingerprint,
} from "../lib/distribution/distribution-manifest-service.ts";
import { InMemoryPayloadStorage } from "../lib/distribution/in-memory-payload-storage.ts";
import { getPayloadLimitConfig } from "../lib/distribution/payload-limit-config.ts";
import {
  buildPayloadObjectKey,
  describePayloadStorageConfig,
  parsePayloadStorageConfig,
} from "../lib/distribution/payload-storage-config.ts";
import { validateZipBytes } from "../lib/distribution/payload-zip-validator.ts";
import { resolveAnonymousDownloadTenantKey } from "../lib/distribution/payload-download-quota.ts";
import { NextRequest } from "next/server";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("P29.1 payload storage config", () => {
  it("fails closed when S3 env is incomplete", () => {
    const parsed = parsePayloadStorageConfig({
      JYKSTORE_PAYLOAD_STORAGE_DRIVER: "s3",
    } as NodeJS.ProcessEnv);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.ok(parsed.errors.some((e) => e.includes("JYKSTORE_PAYLOAD_S3_BUCKET")));
    }
  });

  it("parses valid S3 config without exposing secrets in describe", () => {
    const parsed = parsePayloadStorageConfig({
      JYKSTORE_PAYLOAD_STORAGE_DRIVER: "s3",
      JYKSTORE_PAYLOAD_S3_REGION: "ap-northeast-2",
      JYKSTORE_PAYLOAD_S3_BUCKET: "jyk-payloads",
      JYKSTORE_PAYLOAD_S3_ACCESS_KEY_ID: "AKIAEXAMPLE",
      JYKSTORE_PAYLOAD_S3_SECRET_ACCESS_KEY: "super-secret-value",
      JYKSTORE_PAYLOAD_S3_PREFIX: "payloads",
    } as NodeJS.ProcessEnv);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const summary = describePayloadStorageConfig(parsed.config);
    const serialized = JSON.stringify(summary);
    assert.ok(!serialized.includes("super-secret-value"));
    assert.equal(summary.bucket, "jyk-payloads");
  });

  it("builds safe object keys", () => {
    const key = buildPayloadObjectKey({
      prefix: "payloads",
      packId: "pack_abc",
      versionId: "ver_1",
      payloadId: "pay_1",
    });
    assert.equal(key, "payloads/pack_abc/ver_1/pay_1.zip");
  });

  it("removes local payload storage fallback and temp zip writes", () => {
    assert.throws(() => readSource("src/lib/distribution/local-payload-storage.ts"));
    const envExample = readSource(".env.example");
    assert.ok(!envExample.includes("JYKSTORE_PAYLOAD_STORAGE_DIR"));
    assert.ok(envExample.includes("JYKSTORE_PAYLOAD_S3_BUCKET"));
    const factory = readSource("src/lib/distribution/payload-storage-factory.ts");
    assert.ok(factory.includes("S3PayloadStorage"));
    assert.ok(!factory.includes("LocalPayloadStorage"));
    const zipReader = readSource("src/lib/distribution/payload-zip-reader.ts");
    assert.ok(zipReader.includes("fromBuffer"));
    assert.ok(!zipReader.includes("tmpdir"));
    assert.ok(!zipReader.includes("writeTempZip"));
    assert.ok(!zipReader.includes("node:fs"));
    assert.ok(!zipReader.includes("node:os"));
  });
});

describe("P29.1 in-memory payload storage", () => {
  it("puts gets heads and deletes objects", async () => {
    const storage = new InMemoryPayloadStorage();
    const bytes = new TextEncoder().encode("hello-zip");
    const checksumSha256 = "a".repeat(64);
    const put = await storage.put({
      packId: "pack1",
      versionId: "ver1",
      payloadId: "pay1",
      originalFileName: "x.zip",
      mimeType: "application/zip",
      bytes,
      checksumSha256,
    });
    assert.ok(put.objectKey.includes("pack1"));
    const got = await storage.get({ objectKey: put.objectKey });
    assert.equal(Buffer.from(got.bytes).toString("utf8"), "hello-zip");
    const head = await storage.head({ objectKey: put.objectKey });
    assert.equal(head.exists, true);
    await storage.delete({ objectKey: put.objectKey });
    const missing = await storage.head({ objectKey: put.objectKey });
    assert.equal(missing.exists, false);
  });
});

describe("P29.1 ZIP hardening", () => {
  it("applies env limit config fallbacks under hard caps", () => {
    const cfg = getPayloadLimitConfig({
      JYKSTORE_PAYLOAD_MAX_BYTES: "999999999999",
    } as NodeJS.ProcessEnv);
    assert.ok(cfg.maxZipBytes < 999999999999);
    assert.ok(cfg.maxZipBytes > 0);
  });

  it("rejects extreme compression ratio when configured tightly", async () => {
    const zip = new JSZip();
    // Must exceed compressionRatioMinUncompressedBytes (1 MiB default)
    zip.file("payload/chunks.jsonl", `${"a".repeat(1_200_000)}\n`);
    const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const result = await validateZipBytes(bytes, {
      maxCompressionRatio: 2,
      maxUnpackedBytes: 10_000_000,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /compression|ratio|Suspicious/i.test(e)));
  });
});

describe("P29.1 manifest fingerprint", () => {
  it("is stable across createdAt and key order", () => {
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
    const m2 = buildDistributionManifest(base);
    m2.createdAt = "2099-01-01T00:00:00.000Z";
    assert.equal(stableManifestFingerprint(m1), stableManifestFingerprint(m2));
  });

  it("fails integrity when checksum mismatches", () => {
    const manifest = buildDistributionManifest({
      pack: { packId: "p1", versionId: "ver", name: "N", version: "1.0.0" },
      provider: { providerId: "prov", displayName: "Prov" },
      generator: { type: "DOCLING", version: null },
      payload: {
        payloadId: "pay",
        profile: "docling-chunks-v1",
        originalFileName: "a.zip",
        mimeType: "application/zip",
        fileSize: 10,
        checksumSha256: "c".repeat(64),
      },
      source: { title: "T", url: null, licenseName: "MIT" },
      distribution: { visibility: "PUBLIC", allowDownload: true },
    });
    const result = assertManifestIntegrity({
      manifest,
      payloadId: "pay",
      packId: "p1",
      versionId: "ver",
      checksumSha256: "d".repeat(64),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "MANIFEST_STALE");
  });
});

describe("P29.1 visibility and immutability source guards", () => {
  it("does not force PUBLIC on admin approve", () => {
    const service = readSource("src/lib/admin-review-service.ts");
    assert.ok(!service.includes('visibility: "PUBLIC"'));
    assert.ok(!service.includes("visibility: 'PUBLIC'"));
  });

  it("catalog list filters latest PUBLIC distribution packs", () => {
    const catalog = readSource("src/lib/pack-catalog-service.ts");
    assert.ok(catalog.includes("isLatestVersionCatalogVisible"));
    assert.ok(catalog.includes("resolveLatestDistributionState"));
    assert.ok(!/distributionMetadata:\s*\{\s*some/.test(catalog));
  });

  it("blocks delete after submission via dedicated error code", () => {
    const service = readSource("src/lib/distribution/payload-service.ts");
    assert.ok(service.includes("PAYLOAD_IMMUTABLE_AFTER_SUBMISSION"));
    assert.ok(service.includes("payloadHasSubmissionHistory"));
  });

  it("upload route prechecks Content-Length and file.size", () => {
    const route = readSource("src/app/api/v1/provider/packs/[packId]/payload/route.ts");
    assert.ok(route.includes("content-length"));
    assert.ok(route.includes("file.size"));
    assert.ok(route.includes("413"));
  });

  it("public download records usage and enforces quota", () => {
    const route = readSource("src/app/api/v1/packs/[packId]/payload/download/route.ts");
    assert.ok(route.includes("enforcePublicPayloadDownloadQuota"));
    assert.ok(route.includes("recordApiUsage"));
    assert.ok(route.includes("PAYLOAD_DOWNLOAD"));
  });

  it("hashes anonymous tenant without storing raw IP", () => {
    const request = new NextRequest("http://localhost/api/v1/packs/x/payload/download", {
      headers: {
        "x-forwarded-for": "203.0.113.10",
      },
    });
    process.env.JYKSTORE_TRUST_PROXY = "true";
    process.env.JYKSTORE_ANONYMOUS_ID_SECRET = "test-secret";
    const key = resolveAnonymousDownloadTenantKey(request);
    assert.ok(key.startsWith("anon_payload_"));
    assert.ok(!key.includes("203.0.113.10"));
  });

  it("provider Docling UI blocks replace after submission history", () => {
    const ui = readSource("src/components/provider-distribution/ProviderDoclingImportTab.tsx");
    assert.ok(ui.includes("immutableAfterSubmission") || ui.includes("canDelete"));
    assert.ok(ui.includes("검수 제출 이력이 있어 교체할 수 없습니다"));
  });

  it("readiness includes payload storage probe", () => {
    const readiness = readSource("src/lib/runtime-readiness.ts");
    assert.ok(readiness.includes("payloadStorage"));
    assert.ok(readiness.includes("probePayloadObjectStorage"));
  });
});
