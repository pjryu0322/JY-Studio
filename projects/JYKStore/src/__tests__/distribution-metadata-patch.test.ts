import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  buildDistributionPatchUpdateData,
  isZipPayloadReady,
  validatePrimaryArtifactSelection,
  type PatchDistributionMetadataInput,
} from "../lib/distribution/distribution-metadata-service.ts";
import { PayloadServiceError } from "../lib/distribution/payload-errors.ts";
import { selectPublicArtifact } from "../lib/artifact-state/select-public-artifact.ts";

function existingRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "meta-1",
    packId: "pack-1",
    versionId: "ver-1",
    sourceTitle: "원천",
    sourceUrl: "https://example.com/doc",
    sourcePublisherName: "기관 A",
    sourcePublisherUrl: "https://publisher.example",
    sourceDocumentVersion: "2025",
    sourcePublishedAt: new Date("2025-01-01T00:00:00.000Z"),
    sourceRetrievedAt: new Date("2026-07-13T00:00:00.000Z"),
    licenseName: "기존 라이선스",
    licenseUrl: "https://license.example",
    usageTerms: "이용조건",
    readmeText: "README",
    visibility: "PUBLIC" as const,
    allowDownload: true,
    contentType: "DOCUMENT" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("isZipPayloadReady", () => {
  it("always returns false after ZIP Knowledge Package removal", () => {
    assert.equal(
      isZipPayloadReady({
        id: "p1",
        validationStatus: "VALID",
        storagePath: "packs/a.zip",
        checksumSha256: "a".repeat(64),
        fileSize: 10,
      }),
      false,
    );
  });
});

describe("validatePrimaryArtifactSelection", () => {
  it("is a no-op after primary ZIP selection removal", () => {
    validatePrimaryArtifactSelection(null, { zipReady: false, externalImportReady: false });
    validatePrimaryArtifactSelection("SOURCE_ORIGINAL", {
      zipReady: false,
      externalImportReady: false,
    });
  });
});

describe("admin distribution PATCH merge", () => {
  it("license-only patch preserves publisher fields and does not write primary", () => {
    const update = buildDistributionPatchUpdateData(
      { licenseName: "수정 라이선스" },
      existingRow() as never,
    );
    assert.deepEqual(update, { licenseName: "수정 라이선스" });
    assert.equal("sourcePublisherName" in update, false);
    assert.equal("primaryArtifactType" in update, false);
    assert.equal("contentType" in update, false);
  });

  it("explicit null clears only that field", () => {
    const update = buildDistributionPatchUpdateData(
      { sourcePublisherUrl: null },
      existingRow() as never,
    );
    assert.deepEqual(update, { sourcePublisherUrl: null });
    assert.equal("sourcePublisherName" in update, false);
  });

  it("rejects empty licenseName", () => {
    assert.throws(
      () =>
        buildDistributionPatchUpdateData({ licenseName: "" }, existingRow() as never),
      (error: unknown) =>
        error instanceof PayloadServiceError && error.code === "LICENSE_REQUIRED",
    );
  });

  it("rejects clearing both source title and url", () => {
    assert.throws(
      () =>
        buildDistributionPatchUpdateData(
          { sourceTitle: null, sourceUrl: null },
          existingRow({ sourceTitle: "only-title", sourceUrl: null }) as never,
        ),
      (error: unknown) =>
        error instanceof PayloadServiceError && error.code === "SOURCE_REQUIRED",
    );
  });
});

describe("selectPublicArtifact Docling readiness", () => {
  it("returns METADATA_WITHOUT_ARTIFACT when Docling source is missing", () => {
    const selected = selectPublicArtifact({
      id: "v1",
      distributionMetadata: {
        visibility: "PUBLIC",
        allowDownload: true,
      },
      doclingImportBundles: [],
    });
    assert.equal(selected.kind, "INVALID");
    if (selected.kind === "INVALID") {
      assert.equal(selected.reason, "METADATA_WITHOUT_ARTIFACT");
    }
  });
});

describe("admin PATCH route preserves missing fields", () => {
  it("parses body with hasOwnProperty / undefined semantics", () => {
    const route = readFileSync(
      new URL("../app/api/v1/admin/reviews/[packId]/distribution-metadata/route.ts", import.meta.url),
      "utf8",
    );
    assert.match(route, /hasOwnProperty/);
    assert.match(route, /patchAdminPackDistribution/);
    assert.equal(route.includes('licenseName: typeof body.licenseName === "string" ? body.licenseName : ""'), false);
    assert.equal(route.includes("primaryArtifactType"), false);
  });
});

describe("PatchDistributionMetadataInput type usage", () => {
  it("keeps optional patch fields", () => {
    const patch: PatchDistributionMetadataInput = { licenseName: "MIT" };
    assert.equal(patch.sourcePublisherName, undefined);
  });
});
