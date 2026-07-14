import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  isDoclingBundleReviewSnapshot,
  parseProviderReviewSubmitSnapshot,
} from "../lib/provider-review-submit-snapshot.ts";
import { buildDoclingBundleReviewSubmitSnapshot } from "../lib/distribution/distribution-submit-snapshot.ts";
import { validateDistributionMetadataInput } from "../lib/distribution/distribution-metadata-service.ts";
import { PayloadServiceError } from "../lib/distribution/payload-errors.ts";
import { PROVIDER_PACK_TAB_IDS } from "../lib/provider-pack-tabs.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("P29 distribution foundation", () => {
  it("provider editor uses 4 tabs basic → payload → distribution → review", () => {
    assert.deepEqual([...PROVIDER_PACK_TAB_IDS], [
      "basic",
      "payload",
      "distribution",
      "review",
    ]);
    const editor = readSource("src/components/ProviderPackEditor.tsx");
    assert.ok(editor.includes('activeTab === "payload"'));
    assert.ok(editor.includes('activeTab === "distribution"'));
    assert.ok(editor.includes('activeTab === "review"'));
    assert.ok(!editor.includes('activeTab === "materials"'));
  });

  it("re-enables create CTA with external payload copy", () => {
    const center = readSource("src/components/ProviderCenterPageClient.tsx");
    assert.ok(center.includes("PROVIDER_PACK_REGISTER_CTA"));
    assert.ok(center.includes("ROUTES.providerPackNew"));
    const packNew = readSource("src/app/(store)/provider/packs/new/page.tsx");
    assert.ok(packNew.includes("ProviderPackCreateForm"));
    assert.ok(!packNew.includes("ensureProviderProfileForAccount"));
  });

  it("submit uses Docling commit path without KnowledgePayload", () => {
    const service = readSource("src/lib/provider-pack-service.ts");
    assert.ok(service.includes("commitDistributionPackForReview"));
    assert.ok(!service.includes("knowledgePayload"));
    const submit = readSource("src/lib/distribution/distribution-submit-service.ts");
    assert.ok(submit.includes("DOCLING_BUNDLE"));
    assert.ok(!submit.includes("version.payload"));
  });

  it("parses Docling submit snapshot without legacy release gate fields", () => {
    const snapshot = buildDoclingBundleReviewSubmitSnapshot({
      submittedVersionId: "ver-1",
      doclingBundleId: "bundle-1",
      sourceFileId: "f-source",
      jsonPayloadFileId: "f-json",
      markdownPayloadFileId: "f-md",
      checksums: {
        source: "a".repeat(64),
        json: "b".repeat(64),
        markdown: "c".repeat(64),
      },
      doclingSchemaVersion: "1",
      adapterVersion: "1",
      normalizedDocumentId: "nd-1",
      fingerprint: "fp-1",
      warningCount: 0,
      sourceTitle: "Docs",
      licenseName: "MIT",
      visibility: "PRIVATE",
      allowDownload: true,
    });
    const parsed = parseProviderReviewSubmitSnapshot(snapshot);
    assert.ok(parsed);
    assert.ok(isDoclingBundleReviewSnapshot(parsed));
    assert.equal(parsed.doclingBundleId, "bundle-1");
  });

  it("rejects distribution metadata without license or source", () => {
    assert.throws(
      () =>
        validateDistributionMetadataInput({
          licenseName: "",
          sourceTitle: "x",
        }),
      (err: unknown) => err instanceof PayloadServiceError && err.code === "LICENSE_REQUIRED",
    );
    assert.throws(
      () =>
        validateDistributionMetadataInput({
          licenseName: "MIT",
        }),
      (err: unknown) => err instanceof PayloadServiceError && err.code === "SOURCE_REQUIRED",
    );
  });

  it("exposes catalog Docling source download route", () => {
    assert.ok(
      readSource("src/app/api/v1/packs/[packId]/payload/download/route.ts").includes(
        "openPublicCatalogSourceOriginalStream",
      ),
    );
  });
});
