import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDoclingBundleReviewSubmitSnapshot,
  isReviewSubmitSnapshotV2,
  isReviewSubmitSnapshotV3,
  parseDoclingBundleReviewSubmitSnapshot,
  REVIEW_SUBMIT_SNAPSHOT_VERSION,
  type DoclingBundleReviewSubmitSnapshot,
} from "../lib/distribution/distribution-submit-snapshot.ts";

function preparationEntry(overrides: Record<string, unknown> = {}) {
  return {
    status: "PASS",
    runId: "run-x",
    testedAt: "2026-07-17T00:00:00.000Z",
    currentValidity: "CURRENT",
    providerConfirmationStatus: "CONFIRMED",
    providerConfirmationId: "conf-x",
    confirmedAt: "2026-07-17T00:01:00.000Z",
    pipelineRunId: "pipe-1",
    normalizedDocumentId: "nd-1",
    indexGenerationId: "gen-1",
    fingerprint: "fp-1",
    ...overrides,
  };
}

function buildV3Snapshot(): DoclingBundleReviewSubmitSnapshot {
  return buildDoclingBundleReviewSubmitSnapshot({
    submittedVersionId: "version-1",
    doclingBundleId: "bundle-1",
    sourceFileId: "src-file",
    jsonPayloadFileId: "json-file",
    markdownPayloadFileId: null,
    checksums: { source: "a".repeat(64), json: "b".repeat(64), markdown: null },
    doclingSchemaVersion: "1.1",
    adapterVersion: "test",
    normalizedDocumentId: "nd-1",
    fingerprint: "fp-1",
    warningCount: 0,
    sourceTitle: "Source",
    licenseName: "MIT",
    visibility: "PUBLIC",
    allowDownload: true,
    allowApi: true,
    allowMcp: true,
    preparationValidation: {
      API: preparationEntry({ runId: "run-api", resultFingerprint: "rf-api" }),
      MCP: preparationEntry({ runId: "run-mcp", resultFingerprint: "rf-mcp" }),
      DOWNLOAD: preparationEntry({ runId: "run-dl", downloadTestId: "dt-1" }),
    },
    distributionChannels: { allowApi: true, allowMcp: true, allowDownload: false },
    language: "ko",
    pipelineRunId: "pipe-1",
    indexGenerationId: "gen-1",
    searchIndexGenerationId: "gen-1",
    searchGenerationFingerprint: "sgf-1",
    chunkGenerationId: "gen-1",
    embeddingProvider: "local-e5",
    embeddingModel: "dragonkue/multilingual-e5-small-ko-v2",
    embeddingModelRevision: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    embeddingDimension: 384,
    distanceMetric: "cosine",
    retrievalEvaluationStatus: "PASS",
  });
}

describe("review submit snapshot version 3 (P4.1)", () => {
  it("builder stamps snapshot schema version 3", () => {
    const snap = buildV3Snapshot();
    assert.equal(snap.snapshotSchemaVersion, REVIEW_SUBMIT_SNAPSHOT_VERSION);
    assert.equal(REVIEW_SUBMIT_SNAPSHOT_VERSION, 3);
  });

  it("recognizes a complete v3 snapshot", () => {
    assert.equal(isReviewSubmitSnapshotV3(buildV3Snapshot()), true);
    assert.equal(isReviewSubmitSnapshotV2(buildV3Snapshot()), true);
  });

  it("rejects v3 when search generation fields are missing", () => {
    const snap = buildV3Snapshot();
    snap.searchIndexGenerationId = null;
    assert.equal(isReviewSubmitSnapshotV3(snap), false);
  });

  it("round-trips V3 generation fields through the parser", () => {
    const snap = buildV3Snapshot();
    const parsed = parseDoclingBundleReviewSubmitSnapshot(
      JSON.parse(JSON.stringify(snap)),
    );
    assert.ok(parsed);
    assert.equal(parsed.snapshotSchemaVersion, 3);
    assert.equal(parsed.searchIndexGenerationId, "gen-1");
    assert.equal(parsed.searchGenerationFingerprint, "sgf-1");
    assert.equal(parsed.chunkGenerationId, "gen-1");
    assert.equal(parsed.embeddingProvider, "local-e5");
    assert.equal(parsed.embeddingDimension, 384);
    assert.equal(parsed.embeddingModelRevision, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  });

  it("rejects v3 when embeddingModelRevision is missing or legacy-unknown", () => {
    const missing = buildV3Snapshot();
    missing.embeddingModelRevision = null;
    assert.equal(isReviewSubmitSnapshotV3(missing), false);
    const legacyRev = buildV3Snapshot();
    legacyRev.embeddingModelRevision = "legacy-unknown";
    assert.equal(isReviewSubmitSnapshotV3(legacyRev), false);
    const branch = buildV3Snapshot();
    branch.embeddingModelRevision = "main";
    assert.equal(isReviewSubmitSnapshotV3(branch), false);
  });

  it("still parses legacy v2 snapshots for read compatibility", () => {
    const legacy = {
      ...buildV3Snapshot(),
      snapshotSchemaVersion: 2,
      searchIndexGenerationId: null,
      searchGenerationFingerprint: null,
      chunkGenerationId: null,
      embeddingProvider: null,
      embeddingModel: null,
      embeddingModelRevision: null,
      embeddingDimension: null,
      distanceMetric: null,
    };
    const parsed = parseDoclingBundleReviewSubmitSnapshot(
      JSON.parse(JSON.stringify(legacy)),
    );
    assert.ok(parsed);
    assert.equal(parsed.snapshotSchemaVersion, 2);
    assert.equal(isReviewSubmitSnapshotV3(parsed), false);
    assert.equal(isReviewSubmitSnapshotV2(parsed), true);
  });
});
