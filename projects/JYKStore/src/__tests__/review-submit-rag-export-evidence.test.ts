import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveRunCurrentValidity } from "@/lib/distribution/service-validation-service";

const RAG_EXPORT_DETAILS_BASE = {
  downloadMode: "RAG_EXPORT" as const,
  ragExportPolicyVersion: "rag_export_v1",
  ragExportSchemaVersion: "jyk-rag-export/1.0",
  exportFingerprint: "export-fp-abc",
  checksumsValid: true,
  sourceTraceValid: true,
  manifestValid: true,
  chunksJsonlValid: true,
};

function downloadPassRun(details: Record<string, unknown>) {
  return {
    status: "PASS" as const,
    channel: "DOWNLOAD" as const,
    fingerprint: "binding-fp",
    indexGenerationId: "gen-1",
    invalidatedAt: null as Date | null,
    details,
  };
}

describe("review submit evidence RAG Export download binding", () => {
  it("treats DOWNLOAD PASS with full RAG export details as CURRENT", () => {
    assert.equal(
      resolveRunCurrentValidity({
        run: downloadPassRun(RAG_EXPORT_DETAILS_BASE),
        bindingFingerprint: "binding-fp",
        bindingIndexGenerationId: "gen-1",
      }),
      "CURRENT",
    );
  });

  it("marks legacy original-file DOWNLOAD PASS as STALE (no silent RAG acceptance)", () => {
    assert.equal(
      resolveRunCurrentValidity({
        run: downloadPassRun({
          downloadMode: "LEGACY_ORIGINAL",
          fileId: "source-file-id",
        }),
        bindingFingerprint: "binding-fp",
        bindingIndexGenerationId: "gen-1",
      }),
      "STALE",
    );
  });

  it("does not accept fileId alone when exportFingerprint is missing", () => {
    const { exportFingerprint: omittedFingerprint, ...withoutFingerprint } =
      RAG_EXPORT_DETAILS_BASE;
    void omittedFingerprint;
    assert.equal(
      resolveRunCurrentValidity({
        run: downloadPassRun({
          ...withoutFingerprint,
          fileId: "source-file-id",
        }),
        bindingFingerprint: "binding-fp",
        bindingIndexGenerationId: "gen-1",
      }),
      "STALE",
    );
  });

  it("marks DOWNLOAD STALE when binding fingerprint drifts after data change", () => {
    assert.equal(
      resolveRunCurrentValidity({
        run: downloadPassRun(RAG_EXPORT_DETAILS_BASE),
        bindingFingerprint: "new-binding-fp",
        bindingIndexGenerationId: "gen-1",
      }),
      "STALE",
    );
  });
});
