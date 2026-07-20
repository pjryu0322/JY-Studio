import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  resolveConfirmationStatusDto,
  resolveRunCurrentValidity,
} from "../lib/distribution/service-validation-service.ts";
import {
  sanitizeValidationSnippet,
  toProviderResultItemDtos,
  PROVIDER_VALIDATION_SNIPPET_MAX,
} from "../lib/distribution/service-validation-result-snapshot.ts";
import { toProviderRelevance } from "../lib/distribution/service-validation-relevance.ts";
import { evaluateRetrievalValidationHits } from "../lib/retrieval/retrieval-api-adapter.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

const SERVICE_VALIDATION_MODULE_FILES = [
  "service-validation-policy.ts",
  "service-validation-queries.ts",
  "service-validation-provider-status.ts",
  "service-validation-run-commands.ts",
  "service-validation-run-execute.ts",
  "service-validation-run-persist-tx.ts",
  "service-validation-evidence-asserts.ts",
  "service-validation-evidence-asserts-helpers.ts",
  "service-validation-evidence-asserts-preparation.ts",
  "service-validation-evidence-asserts-selected.ts",
  "service-validation-evidence-asserts-current.ts",
  "service-validation-admin-listing.ts",
  "service-validation-admin-listing-helpers.ts",
  "service-validation-admin-listing-dto.ts",
];

function readServiceValidationModules(rootDir: string): string {
  return SERVICE_VALIDATION_MODULE_FILES.map((f) =>
    readFileSync(join(rootDir, "src/lib/distribution", f), "utf8"),
  ).join("\n");
}

describe("provider service quality + admin ops log", () => {
  it("hides operational ids from provider main surface; tech panel is opt-in", () => {
    const tab = readFileSync(
      join(root, "src/components/provider-distribution/ProviderServiceValidationTab.tsx"),
      "utf8",
    );
    assert.ok(tab.includes("기술정보 보기"));
    assert.ok(tab.includes('useState(false)'));
    assert.ok(tab.includes("techOpen"));
    assert.equal(tab.includes("jykstore_retrieval_query"), false);
    assert.ok(tab.includes("제공자 품질 확인"));
    assert.ok(tab.includes("원문 위치 확인"));

    const service = readServiceValidationModules(root);
    assert.ok(service.includes("providerConfirmationStatus"));
    assert.ok(service.includes("ServiceValidationChannelDto"));
    assert.ok(service.includes("getAdminServiceValidationForPack"));
    assert.ok(service.includes("SERVICE_CONFIRMATION_REQUIRED"));
  });

  it("limits snippets and maps provider result DTOs without internal ids", () => {
    const long = "가".repeat(500);
    const snippet = sanitizeValidationSnippet(long);
    assert.ok(snippet.length <= PROVIDER_VALIDATION_SNIPPET_MAX);
    const dtos = toProviderResultItemDtos([
      {
        rank: 1,
        title: "제목",
        snippet,
        score: 9,
        sourceDocumentTitle: "가이드",
        pageStart: 21,
        pageEnd: 21,
      },
    ]);
    assert.equal(dtos[0]?.sourceDocumentTitle, "가이드");
    assert.equal(dtos[0]?.pageLabel, "21페이지");
    assert.equal("sourceDocumentId" in (dtos[0] as object), false);
    assert.equal("chunkId" in (dtos[0] as object), false);
  });

  it("normalizes relevance without raw score * 100", () => {
    const bySim = toProviderRelevance(0.2, {
      keywordScore: 1,
      metadataScore: 0,
      vectorScore: 0.9,
      vectorSimilarity: 0.92,
    });
    assert.equal(bySim.label, "높음");
    assert.equal(bySim.percent, 92);

    const mid = toProviderRelevance(0.2, {
      keywordScore: 1,
      metadataScore: 0,
      vectorScore: 0.7,
      vectorSimilarity: 0.7,
    });
    assert.equal(mid.label, "보통");
    assert.equal(mid.percent, 70);

    const byScore = toProviderRelevance(9, null);
    assert.equal(byScore.label, "높음");
    assert.equal(byScore.percent, null);
  });

  it("derives confirmation STALE from run validity", () => {
    assert.equal(
      resolveConfirmationStatusDto({
        confirmationStatus: "CONFIRMED",
        runValidity: "STALE",
      }),
      "STALE",
    );
    assert.equal(
      resolveConfirmationStatusDto({
        confirmationStatus: "CONFIRMED",
        runValidity: "CURRENT",
      }),
      "CONFIRMED",
    );
    assert.equal(
      resolveConfirmationStatusDto({
        confirmationStatus: null,
        runValidity: "CURRENT",
      }),
      "NOT_REVIEWED",
    );
  });

  it("keeps append-only run invalidation semantics", () => {
    assert.equal(
      resolveRunCurrentValidity({
        run: {
          status: "PASS",
          fingerprint: "a",
          indexGenerationId: "g1",
          invalidatedAt: new Date(),
          channel: "API",
        },
        bindingFingerprint: "a",
        bindingIndexGenerationId: "g1",
        expectedRankingPolicyVersion: "relevance_diversity_v2",
      }),
      "STALE",
    );
  });

  it("marks API/MCP runs STALE when ranking policy is missing or outdated", () => {
    assert.equal(
      resolveRunCurrentValidity({
        run: {
          status: "PASS",
          fingerprint: "a",
          indexGenerationId: "g1",
          invalidatedAt: null,
          channel: "API",
          details: {},
        },
        bindingFingerprint: "a",
        bindingIndexGenerationId: "g1",
        expectedRankingPolicyVersion: "relevance_diversity_v2",
      }),
      "STALE",
    );
    assert.equal(
      resolveRunCurrentValidity({
        run: {
          status: "PASS",
          fingerprint: "a",
          indexGenerationId: "g1",
          invalidatedAt: null,
          channel: "API",
          details: { retrievalRankingPolicyVersion: "relevance_diversity_v1" },
        },
        bindingFingerprint: "a",
        bindingIndexGenerationId: "g1",
        expectedRankingPolicyVersion: "relevance_diversity_v2",
      }),
      "STALE",
    );
    assert.equal(
      resolveRunCurrentValidity({
        run: {
          status: "PASS",
          fingerprint: "a",
          indexGenerationId: "g1",
          invalidatedAt: null,
          channel: "API",
          details: { retrievalRankingPolicyVersion: "relevance_diversity_v2" },
        },
        bindingFingerprint: "a",
        bindingIndexGenerationId: "g1",
        expectedRankingPolicyVersion: "relevance_diversity_v2",
      }),
      "CURRENT",
    );
    assert.equal(
      resolveRunCurrentValidity({
        run: {
          status: "PASS",
          fingerprint: "a",
          indexGenerationId: "g1",
          invalidatedAt: null,
          channel: "DOWNLOAD",
          details: {},
        },
        bindingFingerprint: "a",
        bindingIndexGenerationId: "g1",
        expectedRankingPolicyVersion: "relevance_diversity_v2",
      }),
      "STALE",
    );
    assert.equal(
      resolveRunCurrentValidity({
        run: {
          status: "PASS",
          fingerprint: "a",
          indexGenerationId: "g1",
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
        bindingFingerprint: "a",
        bindingIndexGenerationId: "g1",
        expectedRankingPolicyVersion: "relevance_diversity_v2",
      }),
      "CURRENT",
    );
  });

  it("accepts retrieval hits with references provenance", () => {
    const ok = evaluateRetrievalValidationHits({
      data: {
        contexts: [
          {
            chunkId: "c1",
            knowledgePackId: "p",
            title: "t",
            content: "x",
            score: 1,
            matchReasons: [],
            metadata: { versionId: "v1", page: 3, sourceDocumentId: "d1" },
            references: [{ type: "SOURCE_DOCUMENT", title: "doc", sourceDocumentId: "d1" }],
          },
        ],
        usage: {
          requestId: "r",
          contextCount: 1,
          topK: 5,
          usedFilters: {},
          retrievalMode: "hybrid",
          scannedCandidateCount: 1,
          filteredCandidateCount: 1,
          candidateCollectionMode: "query-scan",
        },
      },
      expectedVersionId: "v1",
    });
    assert.equal(ok.ok, true);
  });

  it("wires confirm/reject/source-preview and admin ops routes", () => {
    const confirm = readFileSync(
      join(
        root,
        "src/app/api/v1/provider/packs/[packId]/service-validation/[runId]/confirm/route.ts",
      ),
      "utf8",
    );
    const reject = readFileSync(
      join(
        root,
        "src/app/api/v1/provider/packs/[packId]/service-validation/[runId]/reject/route.ts",
      ),
      "utf8",
    );
    const preview = readFileSync(
      join(
        root,
        "src/app/api/v1/provider/packs/[packId]/service-validation/[runId]/results/[rank]/source-preview/route.ts",
      ),
      "utf8",
    );
    const admin = readFileSync(
      join(root, "src/app/api/v1/admin/reviews/[packId]/service-validation/route.ts"),
      "utf8",
    );
    assert.ok(confirm.includes("confirmServiceValidationRun"));
    assert.ok(reject.includes("rejectServiceValidationRun"));
    assert.ok(preview.includes("objectKey") === false || preview.includes("Never returns"));
    assert.equal(preview.includes("storageKey"), false);
    assert.ok(admin.includes("requireAdminSession"));
    assert.ok(admin.includes("listAdminServiceValidationHistory"));
    const downloadTest = readFileSync(
      join(
        root,
        "src/app/api/v1/provider/packs/[packId]/service-validation/[runId]/download-test/route.ts",
      ),
      "utf8",
    );
    assert.ok(downloadTest.includes("prepareProviderDownloadTest"));
    assert.ok(downloadTest.includes("commitSuccessfulDownloadTestEvidence"));
    assert.ok(downloadTest.includes("bodyBytes"));
    assert.equal(downloadTest.includes("Buffer.from"), false);
    const confirmationService = [
      readFileSync(
        join(root, "src/lib/distribution/service-validation-confirmation-service.ts"),
        "utf8",
      ),
      readFileSync(
        join(root, "src/lib/distribution/service-validation-download-test-service.ts"),
        "utf8",
      ),
      readFileSync(
        join(root, "src/lib/distribution/service-validation-download-test-policy.ts"),
        "utf8",
      ),
    ].join("\n");
    assert.ok(confirmationService.includes('downloadMode === "RAG_EXPORT"'));
    assert.ok(confirmationService.includes("bodyBytes: pkg.zipBytes"));
    assert.ok(confirmationService.includes("isRagExport"));
    assert.equal(/Readable\.from\s*\(/.test(confirmationService), false);
    const inlinePreview = readFileSync(
      join(
        root,
        "src/app/api/v1/provider/packs/[packId]/service-validation/[runId]/results/[rank]/source-file/route.ts",
      ),
      "utf8",
    );
    assert.ok(inlinePreview.includes("streamInlinePdfResponse"));
    const adminUi = readFileSync(
      join(root, "src/components/AdminServiceValidationOpsPanel.tsx"),
      "utf8",
    );
    assert.ok(adminUi.includes("providerConfirmationStatus"));
    assert.ok(adminUi.includes("dateFrom"));
    assert.ok(adminUi.includes("필터 초기화"));
    assert.ok(adminUi.includes("전체 버전"));
  });

  it("extends submit snapshot with confirmation ids", () => {
    const snap = readFileSync(
      join(root, "src/lib/distribution/distribution-submit-snapshot.ts"),
      "utf8",
    );
    assert.ok(snap.includes("providerConfirmationId"));
    assert.ok(snap.includes("providerConfirmationStatus"));
    const service = readServiceValidationModules(root);
    assert.ok(service.includes("providerConfirmationId: confirmation.id"));
  });
});
