import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canInstallLatestDistributionPack,
  canPubliclyDownloadLatestDistributionPack,
  canShowInstalledPackInMyPacks,
  isLatestVersionCatalogVisible,
  resolveLatestDistributionState,
} from "../lib/distribution/latest-distribution-state.ts";

function readyExternal(visibility: "PUBLIC" | "PRIVATE" | "UNLISTED", allowDownload = true) {
  return {
    distributionMetadata: { visibility, allowDownload },
    doclingImportBundles: [
      {
        id: "bundle_ready",
        isActive: true,
        status: "REVIEW_READY",
        storageStatus: "ACTIVE",
        deletedAt: null,
        adapterType: "EXTERNAL",
        normalizedDocuments: [{ id: "nd_ready", isActive: true }],
      },
    ],
  };
}

describe("Invalid distribution state", () => {
  it("classifies legacy when metadata and external import are absent", () => {
    const state = resolveLatestDistributionState({});
    assert.equal(state.kind, "LEGACY");
    assert.equal(isLatestVersionCatalogVisible(state, "list"), true);
    assert.equal(canInstallLatestDistributionPack(state), true);
    assert.equal(canPubliclyDownloadLatestDistributionPack(state), false);
  });

  it("classifies complete PUBLIC Docling as DISTRIBUTION", () => {
    const state = resolveLatestDistributionState(readyExternal("PUBLIC"));
    assert.equal(state.kind, "DISTRIBUTION");
    if (state.kind === "DISTRIBUTION") {
      assert.equal(state.visibility, "PUBLIC");
      assert.equal(state.allowDownload, true);
      assert.equal(state.artifact, "EXTERNAL_IMPORT");
    }
    assert.equal(isLatestVersionCatalogVisible(state, "list"), true);
    assert.equal(canInstallLatestDistributionPack(state), true);
    assert.equal(canPubliclyDownloadLatestDistributionPack(state), true);
  });

  it("orphan payload fields without metadata are treated as legacy", () => {
    const state = resolveLatestDistributionState({
      payload: { id: "pay_only", validationStatus: "VALID" },
    } as never);
    assert.equal(state.kind, "LEGACY");
  });

  it("metadata without Docling artifact is INVALID and fail-closed", () => {
    const state = resolveLatestDistributionState({
      distributionMetadata: { visibility: "PUBLIC", allowDownload: true },
    });
    assert.deepEqual(state, {
      kind: "INVALID_DISTRIBUTION",
      reason: "METADATA_WITHOUT_PAYLOAD",
    });
    assert.equal(isLatestVersionCatalogVisible(state, "list"), false);
    assert.equal(canInstallLatestDistributionPack(state), false);
    assert.equal(canShowInstalledPackInMyPacks(state), false);
    assert.equal(canPubliclyDownloadLatestDistributionPack(state), false);
  });

  it("metadata with ready external import is catalog visible", () => {
    const state = resolveLatestDistributionState(readyExternal("PUBLIC"));
    assert.equal(state.kind, "DISTRIBUTION");
    if (state.kind === "DISTRIBUTION") {
      assert.equal(state.artifact, "EXTERNAL_IMPORT");
    }
    assert.equal(isLatestVersionCatalogVisible(state, "list"), true);
    assert.equal(canInstallLatestDistributionPack(state), true);
    assert.equal(canPubliclyDownloadLatestDistributionPack(state), true);
  });

  it("PRIVATE distribution blocks catalog install and download", () => {
    const state = resolveLatestDistributionState(readyExternal("PRIVATE"));
    assert.equal(isLatestVersionCatalogVisible(state, "list"), false);
    assert.equal(canInstallLatestDistributionPack(state), false);
    assert.equal(canPubliclyDownloadLatestDistributionPack(state), false);
  });

  it("allowDownload false blocks public download only", () => {
    const state = resolveLatestDistributionState(readyExternal("PUBLIC", false));
    assert.equal(isLatestVersionCatalogVisible(state, "list"), true);
    assert.equal(canInstallLatestDistributionPack(state), true);
    assert.equal(canPubliclyDownloadLatestDistributionPack(state), false);
  });
});
