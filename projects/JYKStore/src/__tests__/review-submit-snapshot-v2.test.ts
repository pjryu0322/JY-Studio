import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDoclingBundleReviewSubmitSnapshot,
  isReviewSubmitSnapshotV2,
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

function buildV2Snapshot(): DoclingBundleReviewSubmitSnapshot {
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
    retrievalEvaluationStatus: "PASS",
  });
}

describe("review submit snapshot version 2 (§11)", () => {
  it("builder stamps the current snapshot schema version", () => {
    const snap = buildV2Snapshot();
    assert.equal(snap.snapshotSchemaVersion, REVIEW_SUBMIT_SNAPSHOT_VERSION);
    assert.equal(REVIEW_SUBMIT_SNAPSHOT_VERSION, 2);
  });

  it("recognizes a complete v2 snapshot", () => {
    assert.equal(isReviewSubmitSnapshotV2(buildV2Snapshot()), true);
  });

  it("round-trips preparationValidation and distributionChannels through the parser", () => {
    const snap = buildV2Snapshot();
    const parsed = parseDoclingBundleReviewSubmitSnapshot(
      JSON.parse(JSON.stringify(snap)),
    );
    assert.ok(parsed);
    assert.equal(parsed.snapshotSchemaVersion, 2);
    assert.ok(parsed.preparationValidation?.API);
    assert.ok(parsed.preparationValidation?.MCP);
    assert.ok(parsed.preparationValidation?.DOWNLOAD);
    assert.deepEqual(parsed.distributionChannels, {
      allowApi: true,
      allowMcp: true,
      allowDownload: false,
    });
    assert.equal(isReviewSubmitSnapshotV2(parsed), true);
  });

  it("rejects a legacy snapshot (serviceValidation only, no version)", () => {
    const legacy: DoclingBundleReviewSubmitSnapshot = {
      ...buildV2Snapshot(),
      snapshotSchemaVersion: undefined,
      preparationValidation: null,
      distributionChannels: null,
      serviceValidation: {
        API: { status: "PASS", runId: "run-api", testedAt: null },
        MCP: { status: "PASS", runId: "run-mcp", testedAt: null },
        DOWNLOAD: { status: "PASS", runId: "run-dl", testedAt: null },
      },
    };
    assert.equal(isReviewSubmitSnapshotV2(legacy), false);
  });

  it("rejects a v2 snapshot missing a channel", () => {
    const snap = buildV2Snapshot();
    snap.preparationValidation = {
      API: snap.preparationValidation!.API,
      MCP: snap.preparationValidation!.MCP,
    };
    assert.equal(isReviewSubmitSnapshotV2(snap), false);
  });

  it("rejects a v2 snapshot with an unconfirmed channel", () => {
    const snap = buildV2Snapshot();
    snap.preparationValidation!.DOWNLOAD!.providerConfirmationStatus = "NOT_REVIEWED";
    assert.equal(isReviewSubmitSnapshotV2(snap), false);
  });

  it("rejects a v2 snapshot with a stale channel validity", () => {
    const snap = buildV2Snapshot();
    snap.preparationValidation!.API!.currentValidity = "STALE";
    assert.equal(isReviewSubmitSnapshotV2(snap), false);
  });

  it("rejects a v2 snapshot without distributionChannels", () => {
    const snap = buildV2Snapshot();
    snap.distributionChannels = null;
    assert.equal(isReviewSubmitSnapshotV2(snap), false);
  });
});
