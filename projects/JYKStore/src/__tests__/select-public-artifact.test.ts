import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  diagnoseMultiplePublicArtifacts,
  selectPublicArtifact,
} from "../lib/artifact-state/select-public-artifact.ts";
import { resolvePublicPackDownloadInfo } from "../lib/public-pack-detail-info.ts";
import { resolvePublicPackContentType } from "../lib/public-pack-content-type.ts";
import { resolveLatestPackArtifactState } from "../lib/artifact-state/latest-pack-artifact-state.ts";

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

function validZipPayload() {
  return {
    id: "p1",
    validationStatus: "VALID",
    originalFileName: "pack.zip",
    mimeType: "application/zip",
    fileSize: 99,
    checksumSha256: "b".repeat(64),
    storagePath: "packs/x/pack.zip",
  };
}

describe("selectPublicArtifact", () => {
  it("prefers ZIP when both ZIP and external import are ready (compat default)", () => {
    const version = {
      id: "v1",
      payload: validZipPayload(),
      distributionMetadata: {
        visibility: "PUBLIC" as const,
        allowDownload: true,
        primaryArtifactType: null,
      },
      doclingImportBundles: [readySourceBundle()],
    };
    const selected = selectPublicArtifact(version);
    assert.equal(selected.kind, "KNOWLEDGE_PACKAGE");
    assert.equal(diagnoseMultiplePublicArtifacts(version), "PACK_MULTIPLE_PUBLIC_ARTIFACTS");
    assert.equal(resolvePublicPackDownloadInfo(version)?.artifactKind, "KNOWLEDGE_PACKAGE");
    assert.equal(
      resolveLatestPackArtifactState({
        payload: { id: "p1", validationStatus: "VALID" },
        distributionMetadata: { visibility: "PUBLIC", allowDownload: true },
        externalImports: [
          {
            bundleId: "b1",
            isActive: true,
            status: "REVIEW_READY",
            storageStatus: "ACTIVE",
            deletedAt: null,
            normalizedDocument: { id: "n1", isActive: true },
            generatorName: "DOCLING",
          },
        ],
      }).kind,
      "DISTRIBUTION_ZIP",
    );
  });

  it("honors primaryArtifactType SOURCE_ORIGINAL when both ready", () => {
    const version = {
      id: "v1",
      payload: validZipPayload(),
      distributionMetadata: {
        visibility: "PUBLIC" as const,
        allowDownload: true,
        primaryArtifactType: "SOURCE_ORIGINAL" as const,
      },
      doclingImportBundles: [readySourceBundle()],
    };
    const selected = selectPublicArtifact(version);
    assert.equal(selected.kind, "SOURCE_ORIGINAL");
    if (selected.kind === "SOURCE_ORIGINAL") {
      assert.equal(selected.originalFileName, "guide.docx");
      assert.match(selected.mimeType, /wordprocessingml/);
    }
    assert.equal(resolvePublicPackDownloadInfo(version)?.artifactKind, "SOURCE_ORIGINAL");
  });

  it("honors primaryArtifactType KNOWLEDGE_PACKAGE when both ready", () => {
    const version = {
      id: "v1",
      payload: validZipPayload(),
      distributionMetadata: {
        visibility: "PUBLIC" as const,
        allowDownload: true,
        primaryArtifactType: "KNOWLEDGE_PACKAGE" as const,
      },
      doclingImportBundles: [readySourceBundle()],
    };
    assert.equal(selectPublicArtifact(version).kind, "KNOWLEDGE_PACKAGE");
  });

  it("selects SOURCE_ORIGINAL when only external import is ready", () => {
    const version = {
      id: "v1",
      payload: null,
      distributionMetadata: {
        visibility: "PUBLIC" as const,
        allowDownload: true,
      },
      doclingImportBundles: [readySourceBundle()],
    };
    assert.equal(selectPublicArtifact(version).kind, "SOURCE_ORIGINAL");
  });
});

describe("explicit contentType metadata", () => {
  it("prefers explicit DOCUMENT over product-shaped inference", () => {
    assert.equal(
      resolvePublicPackContentType({
        explicitContentType: "DOCUMENT",
        categoryName: "UI Components",
        tags: ["component"],
        features: ["표"],
        supportedEnvironments: ["React"],
        useCases: ["대시보드"],
      }),
      "DOCUMENT",
    );
  });

  it("prefers explicit API", () => {
    assert.equal(
      resolvePublicPackContentType({
        explicitContentType: "API",
        hasDocumentSource: true,
        downloadReady: true,
      }),
      "API",
    );
  });
});
