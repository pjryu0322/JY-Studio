import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertSharedConfirmationEvidence,
  canShareProviderConfirmation,
  compareShareableResultItems,
  computeResultFingerprint,
  isLegacySharedConfirmationMissingFingerprint,
  normalizeValidationQuery,
} from "../lib/distribution/service-validation-share.ts";
import { resolveRunCurrentValidity } from "../lib/distribution/service-validation-service.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

const SERVICE_VALIDATION_MODULE_FILES = [
  "service-validation-policy.ts",
  "service-validation-queries.ts",
  "service-validation-provider-status.ts",
  "service-validation-run-commands.ts",
  "service-validation-evidence-asserts.ts",
  "service-validation-admin-listing.ts",
];

function readServiceValidationModules(rootDir: string): string {
  return SERVICE_VALIDATION_MODULE_FILES.map((f) =>
    readFileSync(join(rootDir, "src/lib/distribution", f), "utf8"),
  ).join("\n");
}

const baseRun = {
  status: "PASS",
  query: "소프트웨어 사업 대가 산정",
  pipelineRunId: "pipe-1",
  indexGenerationId: "gen-1",
  fingerprint: "fp-1",
  normalizedDocumentId: "nd-1",
  resultCount: 2,
  invalidatedAt: null as Date | null,
};

const itemsA = [
  { rank: 1, chunkId: "c1", sourceDocumentId: "d1", pageStart: 21, pageEnd: 21 },
  { rank: 2, chunkId: "c2", sourceDocumentId: "d1", pageStart: 22, pageEnd: 23 },
];

const itemsB = [
  { rank: 1, chunkId: "c1", sourceDocumentId: "d1", pageStart: 21, pageEnd: 21 },
  { rank: 2, chunkId: "c2", sourceDocumentId: "d1", pageStart: 22, pageEnd: 23 },
];

describe("service validation share + incomplete evidence", () => {
  it("allows shared confirmation only for identical retrieval snapshots", () => {
    const fp = computeResultFingerprint({
      query: baseRun.query,
      indexGenerationId: baseRun.indexGenerationId,
      rankingPolicyVersion: "relevance_diversity_v2",
      items: itemsA,
    });
    assert.equal(
      canShareProviderConfirmation({
        apiRun: {
          ...baseRun,
          resultFingerprint: fp,
          rankingPolicyVersion: "relevance_diversity_v2",
        },
        mcpRun: {
          ...baseRun,
          resultFingerprint: fp,
          rankingPolicyVersion: "relevance_diversity_v2",
        },
        apiResults: itemsA,
        mcpResults: itemsB,
        binding: {
          fingerprint: "fp-1",
          indexGenerationId: "gen-1",
          normalizedDocumentId: "nd-1",
          pipelineRunId: "pipe-1",
        },
      }),
      true,
    );
  });

  it("blocks shared confirmation when ranking policy versions differ", () => {
    const fp = computeResultFingerprint({
      query: baseRun.query,
      indexGenerationId: baseRun.indexGenerationId,
      rankingPolicyVersion: "relevance_diversity_v2",
      items: itemsA,
    });
    assert.equal(
      canShareProviderConfirmation({
        apiRun: {
          ...baseRun,
          resultFingerprint: fp,
          rankingPolicyVersion: "relevance_diversity_v2",
        },
        mcpRun: {
          ...baseRun,
          resultFingerprint: fp,
          rankingPolicyVersion: "relevance_diversity_v1",
        },
        apiResults: itemsA,
        mcpResults: itemsB,
        binding: {
          fingerprint: "fp-1",
          indexGenerationId: "gen-1",
          normalizedDocumentId: "nd-1",
          pipelineRunId: "pipe-1",
        },
      }),
      false,
    );
  });

  it("blocks shared confirmation when stored fingerprints are missing", () => {
    assert.equal(
      canShareProviderConfirmation({
        apiRun: baseRun,
        mcpRun: baseRun,
        apiResults: itemsA,
        mcpResults: itemsB,
        binding: { fingerprint: "fp-1", indexGenerationId: "gen-1" },
      }),
      false,
    );
  });

  it("blocks shared confirmation when chunk order differs", () => {
    const swapped = [
      { rank: 1, chunkId: "c2", sourceDocumentId: "d1", pageStart: 22, pageEnd: 23 },
      { rank: 2, chunkId: "c1", sourceDocumentId: "d1", pageStart: 21, pageEnd: 21 },
    ];
    assert.equal(compareShareableResultItems(itemsA, swapped), false);
    assert.equal(
      canShareProviderConfirmation({
        apiRun: { ...baseRun, resultFingerprint: "x" },
        mcpRun: { ...baseRun, resultFingerprint: "x" },
        apiResults: itemsA,
        mcpResults: swapped,
        binding: { fingerprint: "fp-1", indexGenerationId: "gen-1" },
      }),
      false,
    );
  });

  it("blocks shared confirmation when source or page differs", () => {
    assert.equal(
      canShareProviderConfirmation({
        apiRun: { ...baseRun, resultFingerprint: "x" },
        mcpRun: { ...baseRun, resultFingerprint: "x" },
        apiResults: itemsA,
        mcpResults: [
          { rank: 1, chunkId: "c1", sourceDocumentId: "other", pageStart: 21, pageEnd: 21 },
          itemsA[1]!,
        ],
        binding: { fingerprint: "fp-1", indexGenerationId: "gen-1" },
      }),
      false,
    );
    assert.equal(
      canShareProviderConfirmation({
        apiRun: { ...baseRun, resultFingerprint: "x" },
        mcpRun: { ...baseRun, resultFingerprint: "x" },
        apiResults: itemsA,
        mcpResults: [
          { rank: 1, chunkId: "c1", sourceDocumentId: "d1", pageStart: 99, pageEnd: 99 },
          itemsA[1]!,
        ],
        binding: { fingerprint: "fp-1", indexGenerationId: "gen-1" },
      }),
      false,
    );
  });

  it("blocks shared confirmation when generation or fingerprint differs", () => {
    assert.equal(
      canShareProviderConfirmation({
        apiRun: { ...baseRun, resultFingerprint: "fp" },
        mcpRun: { ...baseRun, indexGenerationId: "gen-2", resultFingerprint: "fp" },
        apiResults: itemsA,
        mcpResults: itemsB,
        binding: { fingerprint: "fp-1", indexGenerationId: "gen-1" },
      }),
      false,
    );
    assert.equal(
      canShareProviderConfirmation({
        apiRun: { ...baseRun, resultFingerprint: "fp" },
        mcpRun: { ...baseRun, fingerprint: "fp-2", resultFingerprint: "fp" },
        apiResults: itemsA,
        mcpResults: itemsB,
        binding: { fingerprint: "fp-1", indexGenerationId: "gen-1" },
      }),
      false,
    );
  });

  it("normalizes queries before compare", () => {
    assert.equal(normalizeValidationQuery("  a   b  "), "a b");
  });

  it("marks PASS API/MCP with empty result items as STALE", () => {
    assert.equal(
      resolveRunCurrentValidity({
        run: {
          status: "PASS",
          fingerprint: "fp",
          indexGenerationId: "g",
          invalidatedAt: null,
          channel: "API",
        },
        bindingFingerprint: "fp",
        bindingIndexGenerationId: "g",
        resultItemCount: 0,
      }),
      "STALE",
    );
    assert.equal(
      resolveRunCurrentValidity({
        run: {
          status: "PASS",
          fingerprint: "fp",
          indexGenerationId: "g",
          invalidatedAt: null,
          channel: "DOWNLOAD",
          details: {
            downloadMode: "RAG_EXPORT",
            ragExportPolicyVersion: "rag_export_v1",
            ragExportSchemaVersion: "jyk-rag-export/1.0",
            exportFingerprint: "fp-export",
            checksumsValid: true,
            sourceTraceValid: true,
          },
        },
        bindingFingerprint: "fp",
        bindingIndexGenerationId: "g",
        resultItemCount: 0,
      }),
      "CURRENT",
    );
  });

  it("rejects legacy shared confirmation without stored fingerprints", () => {
    const missing = assertSharedConfirmationEvidence({
      apiRun: { resultFingerprint: null, resultCount: 2 },
      mcpRun: { resultFingerprint: null, resultCount: 2 },
      apiResults: itemsA,
      mcpResults: itemsB,
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.reason, "RESULT_FINGERPRINT_MISSING");
    }
    const oneMissing = assertSharedConfirmationEvidence({
      apiRun: { resultFingerprint: "abc", resultCount: 2 },
      mcpRun: { resultFingerprint: null, resultCount: 2 },
      apiResults: itemsA,
      mcpResults: itemsB,
    });
    assert.equal(oneMissing.ok, false);
    assert.equal(
      isLegacySharedConfirmationMissingFingerprint({
        sharedConfirmationGroupId: "group-1",
        apiResultFingerprint: null,
        mcpResultFingerprint: null,
      }),
      true,
    );
    const ok = assertSharedConfirmationEvidence({
      apiRun: { resultFingerprint: "same", resultCount: 2 },
      mcpRun: { resultFingerprint: "same", resultCount: 2 },
      apiResults: itemsA,
      mcpResults: itemsB,
    });
    assert.equal(ok.ok, true);
  });

  it("records download evidence only after prepare succeeds (source contract)", () => {
    const confirmation = readFileSync(
      join(root, "src/lib/distribution/service-validation-confirmation-service.ts"),
      "utf8",
    );
    assert.ok(confirmation.includes("prepareProviderDownloadTest"));
    assert.ok(confirmation.includes("createMany"));
    assert.ok(confirmation.includes("skipDuplicates"));
    assert.ok(!confirmation.includes("error.code === \"P2002\""));
    assert.ok(confirmation.includes("resolveCurrentValidationBindingTx"));
    const route = readFileSync(
      join(
        root,
        "src/app/api/v1/provider/packs/[packId]/service-validation/[runId]/download-test/route.ts",
      ),
      "utf8",
    );
    const tryBody = route.slice(route.indexOf("try {"));
    const prepareIdx = tryBody.indexOf("prepareProviderDownloadTest");
    const commitIdx = tryBody.indexOf("commitSuccessfulDownloadTestEvidence");
    assert.ok(prepareIdx >= 0 && commitIdx > prepareIdx);
    assert.ok(route.includes("recordDownloadTestAuditBestEffort"));
    assert.ok(route.includes("download-test/audit"));
  });

  it("paginates admin STALE filters before count (source contract)", () => {
    const service = readServiceValidationModules(root);
    assert.ok(service.includes("needsComputedFilter"));
    assert.ok(service.includes("parseAdminHistoryDateBound"));
    assert.ok(service.includes("RESULT_FINGERPRINT_MISSING"));
    assert.ok(service.includes("assertSharedConfirmationEvidence"));
    assert.ok(service.includes('versionScope === "ALL"') || service.includes('versionScope: "ALL"'));
    assert.ok(service.includes("confFilter === \"CONFIRMED\"") || service.includes('confFilter === "CONFIRMED"'));
  });

  it("binds source preview to run/result rather than bare fileId", () => {
    const sourceFile = readFileSync(
      join(
        root,
        "src/app/api/v1/provider/packs/[packId]/service-validation/[runId]/results/[rank]/source-file/route.ts",
      ),
      "utf8",
    );
    assert.ok(sourceFile.includes("resolveSourceOriginalForValidationResult"));
    assert.ok(sourceFile.includes("streamInlinePdfResponse"));
    const previewPage = readFileSync(
      join(root, "src/app/provider/packs/[packId]/source-preview/ProviderSourcePreviewClient.tsx"),
      "utf8",
    );
    assert.ok(previewPage.includes("runId"));
    assert.ok(previewPage.includes("rank"));
    assert.equal(previewPage.includes("fileId"), false);
    const legacy = readFileSync(
      join(root, "src/app/api/v1/provider/packs/[packId]/source-preview/[fileId]/route.ts"),
      "utf8",
    );
    assert.ok(legacy.includes("410") || legacy.includes("GONE"));
    assert.ok(legacy.includes("더 이상 지원되지 않습니다"));
  });
});
