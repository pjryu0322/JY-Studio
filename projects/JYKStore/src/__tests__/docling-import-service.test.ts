import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { buildPackFileObjectKey } from "../lib/distribution/payload-storage-config.ts";
import {
  buildDoclingBundleReviewSubmitSnapshot,
  parseReviewSubmitSnapshot,
} from "../lib/distribution/distribution-submit-snapshot.ts";
import { InMemoryPayloadStorage } from "../lib/distribution/in-memory-payload-storage.ts";

const projectRoot = join(import.meta.dirname, "../..");

describe("docling-import-service contracts", () => {
  it("buildPackFileObjectKey is stable and role-scoped", () => {
    const key = buildPackFileObjectKey({
      prefix: "payloads",
      packId: "pack_abc",
      versionId: "ver_1",
      bundleId: "c0123456789abc",
      fileId: "cfile001",
      role: "SOURCE_ORIGINAL",
      extension: ".pdf",
    });
    assert.equal(
      key,
      "payloads/pack-files/pack_abc/ver_1/c0123456789abc/SOURCE_ORIGINAL/cfile001.pdf",
    );
  });

  it("InMemoryPayloadStorage stores custom objectKey for pack files", async () => {
    const storage = new InMemoryPayloadStorage();
    const objectKey = buildPackFileObjectKey({
      prefix: storage.prefix,
      packId: "pack1",
      versionId: "ver1",
      bundleId: "bundle1",
      fileId: "file1",
      role: "DOCLING_JSON",
      extension: "json",
    });
    const bytes = new TextEncoder().encode('{"schema_name":"DoclingDocument"}');
    await storage.put({
      packId: "pack1",
      versionId: "ver1",
      payloadId: "file1",
      originalFileName: "doc.json",
      mimeType: "application/json",
      bytes,
      checksumSha256: "abc",
      objectKey,
    });
    const got = await storage.get({ objectKey });
    assert.equal(got.bytes.byteLength, bytes.byteLength);
  });

  it("parses DOCLING_BUNDLE submit snapshot", () => {
    const snap = buildDoclingBundleReviewSubmitSnapshot({
      submittedVersionId: "ver1",
      doclingBundleId: "bundle1",
      sourceFileId: "s1",
      jsonPayloadFileId: "j1",
      markdownPayloadFileId: "m1",
      checksums: { source: "a", json: "b", markdown: "c" },
      doclingSchemaVersion: "1.10.0",
      adapterVersion: "1.0.0",
      normalizedDocumentId: "nd1",
      fingerprint: "fp",
      warningCount: 1,
      sourceTitle: "Title",
      licenseName: "MIT",
      visibility: "PRIVATE",
      allowDownload: true,
    });
    const parsed = parseReviewSubmitSnapshot(snap);
    assert.ok(parsed);
    assert.equal(parsed?.mode, "DOCLING_BUNDLE");
    if (parsed?.mode === "DOCLING_BUNDLE") {
      assert.equal(parsed.doclingBundleId, "bundle1");
      assert.equal(parsed.checksums.json, "b");
    }
  });

  it("provider/admin routes call docling-import service helpers", () => {
    const providerRoute = readFileSync(
      join(projectRoot, "src/app/api/v1/provider/packs/[packId]/docling-import/route.ts"),
      "utf8",
    );
    assert.ok(providerRoute.includes("getActiveDoclingImport"));
    assert.ok(providerRoute.includes("deleteActiveDoclingImport"));
    assert.ok(providerRoute.includes("requireProviderApiAuth"));
    assert.ok(providerRoute.includes("DOCLING_FORMDATA_UPLOAD_GONE"));
    assert.ok(providerRoute.includes("410"));

    const uploadSessionsRoute = readFileSync(
      join(
        projectRoot,
        "src/app/api/v1/provider/packs/[packId]/docling-import/upload-sessions/route.ts",
      ),
      "utf8",
    );
    assert.ok(uploadSessionsRoute.includes("createDoclingUploadSession"));

    const retryRoute = readFileSync(
      join(projectRoot, "src/app/api/v1/provider/packs/[packId]/docling-import/retry/route.ts"),
      "utf8",
    );
    assert.ok(retryRoute.includes("retryDoclingImport"));

    const submit = readFileSync(
      join(projectRoot, "src/lib/distribution/distribution-submit-service.ts"),
      "utf8",
    );
    assert.ok(submit.includes("DOCLING_BUNDLE"));
    assert.ok(submit.includes("buildDoclingBundleReviewSubmitSnapshot"));
    assert.ok(submit.includes("REVIEW_READY"));

    const adminRoute = readFileSync(
      join(projectRoot, "src/app/api/v1/admin/reviews/[packId]/docling-import/route.ts"),
      "utf8",
    );
    assert.ok(adminRoute.includes("requireAdminSession"));
    assert.ok(adminRoute.includes("getAdminDoclingImport"));

    const adminMeta = readFileSync(
      join(
        projectRoot,
        "src/app/api/v1/admin/reviews/[packId]/distribution-metadata/route.ts",
      ),
      "utf8",
    );
    assert.ok(adminMeta.includes("patchAdminPackDistribution"));
  });
});
