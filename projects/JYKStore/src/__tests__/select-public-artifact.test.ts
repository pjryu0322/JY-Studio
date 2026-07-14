import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  diagnoseMultiplePublicArtifacts,
  selectPublicArtifact,
} from "../lib/artifact-state/select-public-artifact.ts";
import { resolvePublicPackDownloadInfo } from "../lib/public-pack-detail-info.ts";

function readySourceBundle(overrides?: { storageKey?: string }) {
  return {
    id: "b1",
    isActive: true,
    status: "REVIEW_READY",
    storageStatus: "ACTIVE",
    deletedAt: null,
    adapterType: "DOCLING",
    normalizedDocuments: [{ id: "n1", isActive: true }],
    files: [
      {
        id: "f1",
        role: "SOURCE_ORIGINAL",
        originalFileName: "guide.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileSize: 12,
        checksumSha256: "a".repeat(64),
        storageKey: overrides?.storageKey ?? "packs/x/source.docx",
      },
    ],
  };
}

describe("selectPublicArtifact", () => {
  it("selects SOURCE_ORIGINAL when Docling import is ready", () => {
    const version = {
      id: "v1",
      payload: null,
      distributionMetadata: {
        visibility: "PUBLIC" as const,
        allowDownload: true,
      },
      doclingImportBundles: [readySourceBundle()],
    };
    const selected = selectPublicArtifact(version);
    assert.equal(selected.kind, "SOURCE_ORIGINAL");
    if (selected.kind === "SOURCE_ORIGINAL") {
      assert.equal(selected.originalFileName, "guide.docx");
      assert.match(selected.mimeType, /wordprocessingml/);
    }
    assert.equal(diagnoseMultiplePublicArtifacts(version), null);
    assert.equal(resolvePublicPackDownloadInfo(version)?.artifactKind, "SOURCE_ORIGINAL");
  });

  it("ignores legacy ZIP payload rows when Docling is ready", () => {
    const version = {
      id: "v1",
      payload: {
        id: "p1",
        validationStatus: "VALID",
        originalFileName: "pack.zip",
        mimeType: "application/zip",
        fileSize: 99,
        checksumSha256: "b".repeat(64),
        storagePath: "packs/x/pack.zip",
      },
      distributionMetadata: {
        visibility: "PUBLIC" as const,
        allowDownload: true,
      },
      doclingImportBundles: [readySourceBundle()],
    };
    assert.equal(selectPublicArtifact(version).kind, "SOURCE_ORIGINAL");
  });

  it("returns INVALID when metadata exists without Docling source", () => {
    const version = {
      id: "v1",
      payload: null,
      distributionMetadata: {
        visibility: "PUBLIC" as const,
        allowDownload: true,
      },
      doclingImportBundles: [],
    };
    const selected = selectPublicArtifact(version);
    assert.equal(selected.kind, "INVALID");
    if (selected.kind === "INVALID") {
      assert.equal(selected.reason, "METADATA_WITHOUT_ARTIFACT");
    }
  });

  it("returns LEGACY or INVALID when version has no Docling artifact", () => {
    const selected = selectPublicArtifact({
      id: "v-empty",
      payload: null,
      distributionMetadata: null,
      doclingImportBundles: [],
    });
    assert.ok(selected.kind === "LEGACY" || selected.kind === "INVALID");
  });
});
