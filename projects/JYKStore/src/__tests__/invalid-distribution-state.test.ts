import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canInstallLatestDistributionPack,
  canPubliclyDownloadLatestDistributionPack,
  canShowInstalledPackInMyPacks,
  isLatestVersionCatalogVisible,
  resolveLatestDistributionState,
} from "../lib/distribution/latest-distribution-state.ts";

function distributionVersion(visibility: "PUBLIC" | "PRIVATE" | "UNLISTED", allowDownload = true) {
  return {
    payload: { id: "pay_1", validationStatus: "VALID" },
    distributionMetadata: { visibility, allowDownload },
  };
}

describe("Invalid distribution state", () => {
  it("classifies legacy when both payload and metadata are absent", () => {
    const state = resolveLatestDistributionState({});
    assert.equal(state.kind, "LEGACY");
    assert.equal(isLatestVersionCatalogVisible(state, "list"), true);
    assert.equal(canInstallLatestDistributionPack(state), true);
    assert.equal(canPubliclyDownloadLatestDistributionPack(state), false);
  });

  it("classifies complete PUBLIC as DISTRIBUTION", () => {
    const state = resolveLatestDistributionState(distributionVersion("PUBLIC"));
    assert.equal(state.kind, "DISTRIBUTION");
    if (state.kind === "DISTRIBUTION") {
      assert.equal(state.visibility, "PUBLIC");
      assert.equal(state.allowDownload, true);
    }
    assert.equal(isLatestVersionCatalogVisible(state, "list"), true);
    assert.equal(canInstallLatestDistributionPack(state), true);
    assert.equal(canPubliclyDownloadLatestDistributionPack(state), true);
  });

  it("payload without metadata is INVALID and fail-closed", () => {
    const state = resolveLatestDistributionState({
      payload: { id: "pay_only", validationStatus: "VALID" },
    });
    assert.deepEqual(state, {
      kind: "INVALID_DISTRIBUTION",
      reason: "PAYLOAD_WITHOUT_METADATA",
    });
    assert.equal(isLatestVersionCatalogVisible(state, "list"), false);
    assert.equal(isLatestVersionCatalogVisible(state, "detail"), false);
    assert.equal(canInstallLatestDistributionPack(state), false);
    assert.equal(canShowInstalledPackInMyPacks(state), false);
    assert.equal(canPubliclyDownloadLatestDistributionPack(state), false);
  });

  it("metadata without payload is INVALID and fail-closed", () => {
    const state = resolveLatestDistributionState({
      distributionMetadata: { visibility: "PUBLIC", allowDownload: true },
    });
    assert.deepEqual(state, {
      kind: "INVALID_DISTRIBUTION",
      reason: "METADATA_WITHOUT_PAYLOAD",
    });
    assert.equal(isLatestVersionCatalogVisible(state, "list"), false);
    assert.equal(canInstallLatestDistributionPack(state), false);
    assert.equal(canPubliclyDownloadLatestDistributionPack(state), false);
  });

  it("metadata with ready external import is catalog visible without ZIP payload", () => {
    const state = resolveLatestDistributionState({
      distributionMetadata: { visibility: "PUBLIC", allowDownload: true },
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
    });
    assert.equal(state.kind, "DISTRIBUTION");
    if (state.kind === "DISTRIBUTION") {
      assert.equal(state.artifact, "EXTERNAL_IMPORT");
    }
    assert.equal(isLatestVersionCatalogVisible(state, "list"), true);
    assert.equal(canInstallLatestDistributionPack(state), true);
    assert.equal(canPubliclyDownloadLatestDistributionPack(state), true);
  });

  it("PRIVATE distribution blocks catalog install and download", () => {
    const state = resolveLatestDistributionState(distributionVersion("PRIVATE"));
    assert.equal(isLatestVersionCatalogVisible(state, "list"), false);
    assert.equal(canInstallLatestDistributionPack(state), false);
    assert.equal(canPubliclyDownloadLatestDistributionPack(state), false);
  });

  it("allowDownload false blocks public download only", () => {
    const state = resolveLatestDistributionState(distributionVersion("PUBLIC", false));
    assert.equal(isLatestVersionCatalogVisible(state, "list"), true);
    assert.equal(canInstallLatestDistributionPack(state), true);
    assert.equal(canPubliclyDownloadLatestDistributionPack(state), false);
  });
});
