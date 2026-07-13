import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canPubliclyDownloadLatestPack,
  isLatestVersionCatalogVisible,
  resolveLatestPackArtifactState,
} from "../lib/artifact-state/latest-pack-artifact-state.ts";
import {
  canInstallLatestDistributionPack,
  canPubliclyDownloadLatestDistributionPack,
  isLatestVersionCatalogVisible as isCompatCatalogVisible,
  resolveLatestDistributionState,
} from "../lib/distribution/latest-distribution-state.ts";

function readyExternalImport(overrides?: Partial<{
  status: string;
  storageStatus: string;
  isActive: boolean;
  hasNormalized: boolean;
}>) {
  const status = overrides?.status ?? "REVIEW_READY";
  const storageStatus = overrides?.storageStatus ?? "ACTIVE";
  const isActive = overrides?.isActive ?? true;
  const hasNormalized = overrides?.hasNormalized ?? true;
  return {
    bundleId: "bundle_1",
    isActive,
    status,
    storageStatus,
    deletedAt: null,
    normalizedDocument: hasNormalized ? { id: "nd_1", isActive: true } : null,
    generatorName: "ADAPTER",
  };
}

describe("latest pack artifact state", () => {
  it("keeps legacy and zip distribution behavior", () => {
    assert.equal(resolveLatestPackArtifactState({}).kind, "LEGACY");
    const zip = resolveLatestPackArtifactState({
      payload: { id: "pay_1", validationStatus: "VALID" },
      distributionMetadata: { visibility: "PUBLIC", allowDownload: true },
    });
    assert.equal(zip.kind, "DISTRIBUTION_ZIP");
    assert.equal(isLatestVersionCatalogVisible(zip, "list"), true);
    assert.equal(canPubliclyDownloadLatestPack(zip), true);
  });

  it("shows ready external import + PUBLIC metadata in catalog", () => {
    const state = resolveLatestPackArtifactState({
      distributionMetadata: { visibility: "PUBLIC", allowDownload: true },
      externalImports: [readyExternalImport()],
    });
    assert.equal(state.kind, "EXTERNAL_IMPORT");
    assert.equal(isLatestVersionCatalogVisible(state, "list"), true);
    assert.equal(isLatestVersionCatalogVisible(state, "detail"), true);
    assert.equal(canPubliclyDownloadLatestPack(state), true);
  });

  it("hides UNLISTED external import from list but allows detail", () => {
    const state = resolveLatestPackArtifactState({
      distributionMetadata: { visibility: "UNLISTED", allowDownload: true },
      externalImports: [readyExternalImport()],
    });
    assert.equal(isLatestVersionCatalogVisible(state, "list"), false);
    assert.equal(isLatestVersionCatalogVisible(state, "detail"), true);
  });

  it("hides PRIVATE external import", () => {
    const state = resolveLatestPackArtifactState({
      distributionMetadata: { visibility: "PRIVATE", allowDownload: true },
      externalImports: [readyExternalImport()],
    });
    assert.equal(isLatestVersionCatalogVisible(state, "list"), false);
    assert.equal(isLatestVersionCatalogVisible(state, "detail"), false);
    assert.equal(canPubliclyDownloadLatestPack(state), false);
  });

  it("metadata without artifact remains invalid", () => {
    const state = resolveLatestPackArtifactState({
      distributionMetadata: { visibility: "PUBLIC", allowDownload: true },
    });
    assert.equal(state.kind, "INVALID");
    if (state.kind === "INVALID") {
      assert.equal(state.reason, "METADATA_WITHOUT_ARTIFACT");
    }
    assert.equal(isLatestVersionCatalogVisible(state, "list"), false);
  });

  it("external import without normalized document is not catalog visible", () => {
    const state = resolveLatestPackArtifactState({
      distributionMetadata: { visibility: "PUBLIC", allowDownload: true },
      externalImports: [readyExternalImport({ hasNormalized: false })],
    });
    assert.equal(state.kind, "INVALID");
    if (state.kind === "INVALID") {
      assert.equal(state.reason, "NORMALIZED_DOCUMENT_MISSING");
    }
    assert.equal(isLatestVersionCatalogVisible(state, "list"), false);
  });

  it("retrieval readiness does not affect catalog visibility", () => {
    const state = resolveLatestPackArtifactState({
      distributionMetadata: { visibility: "PUBLIC", allowDownload: true },
      externalImports: [readyExternalImport()],
    });
    // Catalog visibility is independent of retrieval/MCP capability flags.
    assert.equal(isLatestVersionCatalogVisible(state, "list"), true);
  });

  it("compat facade maps external import to DISTRIBUTION with EXTERNAL_IMPORT artifact", () => {
    const state = resolveLatestDistributionState({
      distributionMetadata: { visibility: "PUBLIC", allowDownload: true },
      doclingImportBundles: [
        {
          id: "b1",
          isActive: true,
          status: "REVIEW_READY",
          storageStatus: "ACTIVE",
          deletedAt: null,
          adapterType: "DOCLING",
          normalizedDocuments: [{ id: "nd1", isActive: true }],
        },
      ],
    });
    assert.equal(state.kind, "DISTRIBUTION");
    if (state.kind === "DISTRIBUTION") {
      assert.equal(state.artifact, "EXTERNAL_IMPORT");
    }
    assert.equal(isCompatCatalogVisible(state, "list"), true);
    assert.equal(canInstallLatestDistributionPack(state), true);
    assert.equal(canPubliclyDownloadLatestDistributionPack(state), true);
  });

  it("compat facade keeps metadata-only as METADATA_WITHOUT_PAYLOAD", () => {
    const state = resolveLatestDistributionState({
      distributionMetadata: { visibility: "PUBLIC", allowDownload: true },
    });
    assert.deepEqual(state, {
      kind: "INVALID_DISTRIBUTION",
      reason: "METADATA_WITHOUT_PAYLOAD",
    });
  });
});
