import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  canRequestProviderReviewHandoff,
  isWorkerKnowledgeGenerationCompleted,
} from "../lib/store-workflow-handoff-gates-policy.ts";
import { classifyStoreServiceChannelRun } from "../lib/store-workflow-handoff-gates.ts";
import { buildProviderPackProgress } from "../lib/provider-pack-progress.ts";
import { resolveRunCurrentValidity } from "../lib/distribution/service-validation-policy.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

const RAG_DETAILS = {
  downloadMode: "RAG_EXPORT",
  ragExportPolicyVersion: "rag_export_v1",
  ragExportSchemaVersion: "jyk-rag-export/1.0",
  exportFingerprint: "export-fp",
  checksumsValid: true,
  sourceTraceValid: true,
};

describe("store workflow handoff gates", () => {
  it("requires worker COMPLETED and quality pass for provider review request", () => {
    const quality = {
      completed: true,
      failCount: 0,
      hasBlockers: false,
      hasWarnings: false,
      blockers: [] as string[],
      warnings: [] as string[],
    };
    assert.equal(
      canRequestProviderReviewHandoff({
        workerZipPhase: "ACCEPTED",
        quality,
      }),
      false,
    );
    assert.equal(
      canRequestProviderReviewHandoff({
        workerZipPhase: "COMPLETED",
        quality,
      }),
      true,
    );
    assert.equal(isWorkerKnowledgeGenerationCompleted("COMPLETED"), true);
  });

  it("treats missing binding fingerprint on PASS run as stale when binding exists", () => {
    assert.equal(
      resolveRunCurrentValidity({
        run: {
          status: "PASS",
          fingerprint: null,
          indexGenerationId: "idx-1",
          invalidatedAt: null,
          channel: "API",
          details: { retrievalRankingPolicyVersion: "v1" },
        },
        bindingFingerprint: "fp-current",
        bindingIndexGenerationId: "idx-1",
        resultItemCount: 3,
        expectedRankingPolicyVersion: "v1",
      }),
      "STALE",
    );
  });

  it("fails channel when binding fingerprint mismatches", () => {
    const result = classifyStoreServiceChannelRun({
      channel: "API",
      run: {
        status: "PASS",
        fingerprint: "fp-old",
        indexGenerationId: "idx-1",
        details: { retrievalRankingPolicyVersion: "irrelevant" },
      },
      bindingFingerprint: "fp-new",
      bindingIndexGenerationId: "idx-1",
      resultItemCount: 2,
    });
    assert.equal(result.passed, false);
    assert.equal(result.reasonCode, "FINGERPRINT_MISMATCH");
  });

  it("fails channel when index generation mismatches", () => {
    const result = classifyStoreServiceChannelRun({
      channel: "MCP",
      run: {
        status: "PASS",
        fingerprint: "fp-1",
        indexGenerationId: "idx-old",
        details: { retrievalRankingPolicyVersion: "irrelevant" },
      },
      bindingFingerprint: "fp-1",
      bindingIndexGenerationId: "idx-new",
      resultItemCount: 2,
    });
    assert.equal(result.passed, false);
    assert.equal(result.reasonCode, "INDEX_GENERATION_MISMATCH");
  });

  it("fails DOWNLOAD when export test incomplete even if fingerprints match", () => {
    const result = classifyStoreServiceChannelRun({
      channel: "DOWNLOAD",
      run: {
        status: "PASS",
        fingerprint: "fp-1",
        indexGenerationId: "idx-1",
        details: RAG_DETAILS,
      },
      bindingFingerprint: "fp-1",
      bindingIndexGenerationId: "idx-1",
      downloadTestReady: false,
    });
    assert.equal(result.passed, false);
    assert.equal(result.reasonCode, "DOWNLOAD_TEST_INCOMPLETE");
  });

  it("passes channel when run matches current binding", () => {
    // Ranking policy version must match whatever RETRIEVAL_RANKING_POLICY_VERSION is —
    // skip ranking by using DOWNLOAD with valid RAG details.
    const result = classifyStoreServiceChannelRun({
      channel: "DOWNLOAD",
      run: {
        status: "PASS",
        fingerprint: "fp-1",
        indexGenerationId: "idx-1",
        details: RAG_DETAILS,
      },
      bindingFingerprint: "fp-1",
      bindingIndexGenerationId: "idx-1",
      downloadTestReady: true,
    });
    assert.equal(result.passed, true);
    assert.equal(result.reasonCode, null);
  });

  it("rejects missing run as NOT_VALIDATED", () => {
    const result = classifyStoreServiceChannelRun({
      channel: "API",
      run: null,
      bindingFingerprint: "fp-1",
      bindingIndexGenerationId: "idx-1",
    });
    assert.equal(result.passed, false);
    assert.equal(result.reasonCode, "NOT_VALIDATED");
  });

  it("enforces binding failure path in resolveStoreServiceChannelGates source", () => {
    const gates = readSource("src/lib/store-workflow-handoff-gates.ts");
    assert.ok(gates.includes("resolveStoreValidationBinding"));
    assert.ok(gates.includes("WORKER_ZIP"));
    assert.ok(gates.includes("BINDING_MISSING"));
    assert.ok(gates.includes("failAllChannels"));
    assert.ok(!gates.includes("// Binding may be missing for early drafts"));
  });

  it("service-validation complete API surfaces binding errors", () => {
    const markers = readSource("src/lib/store-workflow-markers.ts");
    assert.ok(markers.includes("BINDING_MISSING") || markers.includes("STALE_BINDING"));
    assert.ok(markers.includes("bindingStatus"));
  });

  it("admin UI shows latest-knowledge revalidation copy", () => {
    const ui = readSource("src/components/AdminReviewDetailPageClient.tsx");
    assert.ok(ui.includes("bindingStatus"));
    assert.ok(ui.includes("최신 지식데이터 기준 API/MCP/ZIP 검증이 필요합니다."));
  });

  it("shows 생성 결과 검토 and hides draft CTAs when review requested", () => {
    const progress = buildProviderPackProgress({
      packId: "pack-1",
      packStatus: "DRAFT",
      name: "Pack",
      categoryId: "cat",
      shortDescription: "short",
      description: "desc",
      language: "ko",
      adminGenerationHold: "COMPLETED",
      workerZipRequestStatus: "COMPLETED",
      providerReviewPhase: "REQUESTED",
      adminQualityPassed: true,
      workingVersion: {
        id: "v1",
        version: "0.1.0",
        sourceDocumentCount: 2,
        materialReady: true,
        distributionReady: true,
      },
      publishedVersion: null,
    });
    assert.equal(progress.storeWorkflowStatus, "PROVIDER_REVIEW_REQUESTED");
    assert.ok(progress.actions.some((a) => a.label === "생성 결과 검토"));
    assert.ok(!progress.actions.some((a) => a.label === "계속 작성"));
  });
});
