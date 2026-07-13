import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const projectRoot = join(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(join(projectRoot, relative), "utf8");
}

describe("payload-cleanup docling sync", () => {
  it("enqueuePayloadCleanupJob accepts doclingBundleId and knowledgePackFileId", () => {
    const cleanup = read("src/lib/distribution/payload-cleanup-service.ts");
    assert.ok(cleanup.includes("doclingBundleId"));
    assert.ok(cleanup.includes("knowledgePackFileId"));
    assert.ok(cleanup.includes("syncDoclingBundleStorageAfterCleanup"));
    assert.ok(cleanup.includes("isObjectAlreadyMissing"));
  });

  it("lifecycle sync sets DELETED or DELETE_FAILED from job statuses", () => {
    const lifecycle = read("src/lib/docling-import/docling-import-lifecycle-service.ts");
    assert.ok(lifecycle.includes("syncDoclingBundleStorageAfterCleanup"));
    assert.ok(lifecycle.includes("DoclingBundleStorageStatus.DELETED"));
    assert.ok(lifecycle.includes("DoclingBundleStorageStatus.DELETE_FAILED"));
    assert.ok(lifecycle.includes("storageDeleteAttempts"));
  });

  it("cleanup enqueue from lifecycle passes bundle and file ids", () => {
    const lifecycle = read("src/lib/docling-import/docling-import-lifecycle-service.ts");
    assert.ok(lifecycle.includes("doclingBundleId:"));
    assert.ok(lifecycle.includes("knowledgePackFileId:"));
  });
});
