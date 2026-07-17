import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  doclingBundlePublicToMaterialContext,
  isDoclingSourceMaterialsReady,
  type DoclingBundleMaterialContext,
} from "../lib/docling-import/docling-source-materials-readiness.ts";

function baseContext(): DoclingBundleMaterialContext {
  return {
    id: "bundle-1",
    status: "REVIEW_READY",
    isActive: true,
    deletedAt: null,
    storageStatus: "ACTIVE",
    packId: "pack-1",
    versionId: "version-1",
    files: [
      { id: "src-file", role: "SOURCE_ORIGINAL", checksumSha256: "a".repeat(64) },
      { id: "json-file", role: "DOCLING_JSON", checksumSha256: "b".repeat(64) },
    ],
    normalizedDocument: {
      id: "nd-1",
      packId: "pack-1",
      versionId: "version-1",
      bundleId: "bundle-1",
      isActive: true,
      sourceFileId: "src-file",
      jsonPayloadFileId: "json-file",
      fingerprint: "fp-1",
    },
  };
}

describe("isDoclingSourceMaterialsReady (§14 source materials)", () => {
  it("passes for a fully bound REVIEW_READY bundle", () => {
    assert.equal(isDoclingSourceMaterialsReady(baseContext()), true);
  });

  it("fails when context is null", () => {
    assert.equal(isDoclingSourceMaterialsReady(null), false);
  });

  it("fails when status is not REVIEW_READY", () => {
    const ctx = baseContext();
    ctx.status = "NORMALIZED";
    assert.equal(isDoclingSourceMaterialsReady(ctx), false);
  });

  it("fails when storageStatus is not ACTIVE", () => {
    const ctx = baseContext();
    ctx.storageStatus = "DELETE_PENDING";
    assert.equal(isDoclingSourceMaterialsReady(ctx), false);
  });

  it("fails when bundle is soft-deleted", () => {
    const ctx = baseContext();
    ctx.deletedAt = new Date();
    assert.equal(isDoclingSourceMaterialsReady(ctx), false);
  });

  it("fails when bundle is not active", () => {
    const ctx = baseContext();
    ctx.isActive = false;
    assert.equal(isDoclingSourceMaterialsReady(ctx), false);
  });

  it("fails when SOURCE_ORIGINAL checksum missing", () => {
    const ctx = baseContext();
    ctx.files[0]!.checksumSha256 = "";
    assert.equal(isDoclingSourceMaterialsReady(ctx), false);
  });

  it("fails when DOCLING_JSON checksum missing", () => {
    const ctx = baseContext();
    ctx.files[1]!.checksumSha256 = null;
    assert.equal(isDoclingSourceMaterialsReady(ctx), false);
  });

  it("fails when a required file role is absent", () => {
    const ctx = baseContext();
    ctx.files = [ctx.files[0]!];
    assert.equal(isDoclingSourceMaterialsReady(ctx), false);
  });

  it("fails when ND is inactive", () => {
    const ctx = baseContext();
    ctx.normalizedDocument!.isActive = false;
    assert.equal(isDoclingSourceMaterialsReady(ctx), false);
  });

  it("fails when ND.sourceFileId does not match SOURCE_ORIGINAL", () => {
    const ctx = baseContext();
    ctx.normalizedDocument!.sourceFileId = "other-file";
    assert.equal(isDoclingSourceMaterialsReady(ctx), false);
  });

  it("fails when ND.jsonPayloadFileId does not match DOCLING_JSON", () => {
    const ctx = baseContext();
    ctx.normalizedDocument!.jsonPayloadFileId = "other-file";
    assert.equal(isDoclingSourceMaterialsReady(ctx), false);
  });

  it("fails when ND.fingerprint is missing", () => {
    const ctx = baseContext();
    ctx.normalizedDocument!.fingerprint = "";
    assert.equal(isDoclingSourceMaterialsReady(ctx), false);
  });

  it("fails when ND belongs to a different bundle", () => {
    const ctx = baseContext();
    ctx.normalizedDocument!.bundleId = "other-bundle";
    assert.equal(isDoclingSourceMaterialsReady(ctx), false);
  });

  it("fails when ND is absent", () => {
    const ctx = baseContext();
    ctx.normalizedDocument = null;
    assert.equal(isDoclingSourceMaterialsReady(ctx), false);
  });
});

describe("doclingBundlePublicToMaterialContext", () => {
  it("returns null for null bundle", () => {
    assert.equal(doclingBundlePublicToMaterialContext(null), null);
  });

  it("maps a public DTO into a material context matching readiness", () => {
    const ctx = doclingBundlePublicToMaterialContext({
      id: "bundle-1",
      packId: "pack-1",
      versionId: "version-1",
      status: "REVIEW_READY",
      isActive: true,
      storageStatus: "ACTIVE",
      files: [
        { id: "src-file", role: "SOURCE_ORIGINAL", checksumSha256: "a".repeat(64) },
        { id: "json-file", role: "DOCLING_JSON", checksumSha256: "b".repeat(64) },
      ],
      normalizedDocument: {
        id: "nd-1",
        packId: "pack-1",
        versionId: "version-1",
        bundleId: "bundle-1",
        isActive: true,
        sourceFileId: "src-file",
        jsonPayloadFileId: "json-file",
        fingerprint: "fp-1",
      },
    } as unknown as Parameters<typeof doclingBundlePublicToMaterialContext>[0]);
    assert.ok(ctx);
    assert.equal(isDoclingSourceMaterialsReady(ctx), true);
  });
});
