import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PackStatus } from "@prisma/client";
import {
  assertRagExportDownloadEvidenceBinding,
  assertReviewSubmitEvidenceInTx,
  ReviewSubmitEvidenceError,
  type PrismaLike,
} from "@/lib/distribution/review-submit-evidence";
import { buildDoclingBundleReviewSubmitSnapshot } from "@/lib/distribution/distribution-submit-snapshot";
import {
  createKnowledgeRunBinding,
  serializeKnowledgeRunBinding,
} from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { DOCLING_KNOWLEDGE_PIPELINE_TRIGGER } from "@/lib/docling-knowledge/docling-knowledge-stages";
import {
  DEFAULT_E5_EMBEDDING_DIMENSION,
  DEFAULT_E5_MODEL_ID,
  E5_DISTANCE_METRIC,
  LOCAL_E5_EMBEDDING_PROVIDER,
} from "@/lib/embedding/e5-embedding-constants";
import { resolveRunCurrentValidity } from "@/lib/distribution/service-validation-service";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const REVISION = "fcfc26bf355882620c48df58be112275bd756f50";
const EXPORT_FP = "export-fp-exact-match";
const TESTED_AT = new Date("2026-07-17T00:00:00.000Z");

const RAG_EXPORT_DETAILS_BASE = {
  downloadMode: "RAG_EXPORT" as const,
  ragExportPolicyVersion: "rag_export_v1",
  ragExportSchemaVersion: "jyk-rag-export/1.0",
  exportFingerprint: EXPORT_FP,
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

type FixtureOverrides = {
  providerProfileId?: string;
  downloadDetails?: Record<string, unknown>;
  downloadTestFileId?: string;
  downloadTestId?: string;
  downloadRunId?: string;
  packStatus?: PackStatus;
};

function buildSubmitFixture(overrides: FixtureOverrides = {}) {
  const packId = "pack-rag-1";
  const versionId = "ver-rag-1";
  const providerProfileId = overrides.providerProfileId ?? "provider-own";
  const bundleId = "bundle-1";
  const ndId = "nd-1";
  const fingerprint = "fp-1";
  const genId = "gen-1";
  const pipelineId = "pipe-1";
  const sourceFileId = "source-file-1";
  const jsonFileId = "json-file-1";
  const apiRunId = "run-api";
  const mcpRunId = "run-mcp";
  const downloadRunId = overrides.downloadRunId ?? "run-download";
  const downloadTestId = overrides.downloadTestId ?? "dt-1";
  const downloadTestFileId = overrides.downloadTestFileId ?? EXPORT_FP;
  const downloadDetails = overrides.downloadDetails ?? {
    ...RAG_EXPORT_DETAILS_BASE,
    fileId: "should-not-be-used-as-fallback",
  };

  const binding = createKnowledgeRunBinding({
    versionId,
    normalizedDocumentId: ndId,
    fingerprint,
    bundleId,
    indexGenerationId: genId,
  });

  const steps = [
    { step: "STRUCTURE_VALIDATING", status: "PASS", details: null },
    { step: "KNOWLEDGE_CHECKING", status: "PASS", details: null },
    { step: "CHUNKING", status: "PASS", details: { chunkCount: 5 } },
    { step: "INDEXING", status: "PASS", details: null },
    {
      step: "SEARCH_EVALUATING",
      status: "PASS",
      details: { retrievalRankingPolicyVersion: "relevance_diversity_v2" },
    },
    { step: "READY_FOR_REVIEW", status: "PASS", details: null },
  ];

  const generation = {
    id: genId,
    packId,
    versionId,
    pipelineRunId: pipelineId,
    normalizedDocumentId: ndId,
    fingerprint,
    chunkGenerationId: genId,
    embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
    embeddingModel: DEFAULT_E5_MODEL_ID,
    embeddingModelRevision: REVISION,
    embeddingDimension: DEFAULT_E5_EMBEDDING_DIMENSION,
    distanceMetric: E5_DISTANCE_METRIC,
    generationFingerprint: "gfp-1",
    status: "READY",
    scope: "DRAFT",
    chunkCount: 5,
    embeddedCount: 5,
    failedCount: 0,
  };

  const runBase = {
    packId,
    status: "PASS",
    invalidatedAt: null,
    pipelineRunId: pipelineId,
    normalizedDocumentId: ndId,
    fingerprint,
    indexGenerationId: genId,
    searchIndexGenerationId: genId,
    testedAt: TESTED_AT,
    resultFingerprint: "rf-shared",
  };

  const runs: Record<string, Record<string, unknown>> = {
    API: { ...runBase, id: apiRunId, channel: "API", details: null },
    MCP: { ...runBase, id: mcpRunId, channel: "MCP", details: null },
    DOWNLOAD: {
      ...runBase,
      id: downloadRunId,
      channel: "DOWNLOAD",
      details: downloadDetails,
      resultFingerprint: null,
    },
  };

  const confIds = {
    API: "conf-api",
    MCP: "conf-mcp",
    DOWNLOAD: "conf-download",
  };

  const snapshot = buildDoclingBundleReviewSubmitSnapshot({
    submittedVersionId: versionId,
    doclingBundleId: bundleId,
    sourceFileId,
    jsonPayloadFileId: jsonFileId,
    markdownPayloadFileId: null,
    checksums: { source: "a".repeat(64), json: "b".repeat(64), markdown: null },
    doclingSchemaVersion: "1.1",
    adapterVersion: "test",
    normalizedDocumentId: ndId,
    fingerprint,
    warningCount: 0,
    sourceTitle: "Source",
    licenseName: "MIT",
    visibility: "PUBLIC",
    allowDownload: true,
    allowApi: true,
    allowMcp: true,
    language: "ko",
    pipelineRunId: pipelineId,
    indexGenerationId: genId,
    searchIndexGenerationId: genId,
    searchGenerationFingerprint: generation.generationFingerprint,
    embeddingProvider: generation.embeddingProvider,
    embeddingModel: generation.embeddingModel,
    embeddingModelRevision: generation.embeddingModelRevision,
    embeddingDimension: generation.embeddingDimension,
    distanceMetric: generation.distanceMetric,
    retrievalEvaluationStatus: "PASS",
    distributionChannels: { allowApi: true, allowMcp: true, allowDownload: true },
    preparationValidation: {
      API: {
        status: "PASS",
        runId: apiRunId,
        testedAt: TESTED_AT.toISOString(),
        currentValidity: "CURRENT",
        providerConfirmationStatus: "CONFIRMED",
        providerConfirmationId: confIds.API,
        confirmedAt: TESTED_AT.toISOString(),
        resultFingerprint: "rf-shared",
        pipelineRunId: pipelineId,
        normalizedDocumentId: ndId,
        indexGenerationId: genId,
        fingerprint,
      },
      MCP: {
        status: "PASS",
        runId: mcpRunId,
        testedAt: TESTED_AT.toISOString(),
        currentValidity: "CURRENT",
        providerConfirmationStatus: "CONFIRMED",
        providerConfirmationId: confIds.MCP,
        confirmedAt: TESTED_AT.toISOString(),
        resultFingerprint: "rf-shared",
        pipelineRunId: pipelineId,
        normalizedDocumentId: ndId,
        indexGenerationId: genId,
        fingerprint,
      },
      DOWNLOAD: {
        status: "PASS",
        runId: downloadRunId,
        testedAt: TESTED_AT.toISOString(),
        currentValidity: "CURRENT",
        providerConfirmationStatus: "CONFIRMED",
        providerConfirmationId: confIds.DOWNLOAD,
        confirmedAt: TESTED_AT.toISOString(),
        downloadTestId,
        pipelineRunId: pipelineId,
        normalizedDocumentId: ndId,
        indexGenerationId: genId,
        fingerprint,
      },
    },
  });

  const client = {
    knowledgePack: {
      findFirst: async ({ where }: { where: { packId: string; providerProfileId: string } }) => {
        if (where.packId !== packId || where.providerProfileId !== providerProfileId) {
          return null;
        }
        return { status: overrides.packStatus ?? PackStatus.DRAFT };
      },
    },
    doclingImportBundle: {
      findFirst: async () => ({
        id: bundleId,
        status: "REVIEW_READY",
        isActive: true,
        deletedAt: null,
        storageStatus: "ACTIVE",
        packId,
        versionId,
        files: [
          { id: sourceFileId, role: "SOURCE_ORIGINAL", checksumSha256: "a".repeat(64) },
          { id: jsonFileId, role: "DOCLING_JSON", checksumSha256: "b".repeat(64) },
        ],
        normalizedDocuments: [
          {
            id: ndId,
            packId,
            versionId,
            bundleId,
            isActive: true,
            sourceFileId,
            jsonPayloadFileId: jsonFileId,
            fingerprint,
          },
        ],
      }),
    },
    pipelineRun: {
      findFirst: async ({ where }: { where: { packId: string; triggerType: string; status: string } }) => {
        if (
          where.packId !== packId ||
          where.triggerType !== DOCLING_KNOWLEDGE_PIPELINE_TRIGGER ||
          where.status !== "PASS"
        ) {
          return null;
        }
        return {
          id: pipelineId,
          summary: serializeKnowledgeRunBinding(binding),
          steps,
        };
      },
    },
    searchIndexGeneration: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === genId ? generation : null,
    },
    serviceValidationRun: {
      findFirst: async ({ where }: { where: { versionId: string; channel: string } }) => {
        if (where.versionId !== versionId) return null;
        return runs[where.channel] ?? null;
      },
    },
    serviceValidationResultItem: {
      count: async () => 1,
    },
    serviceValidationDownloadTest: {
      findUnique: async ({ where }: { where: { runId: string } }) => {
        if (where.runId !== downloadRunId) return null;
        return {
          id: downloadTestId,
          fileId: downloadTestFileId,
          responseReady: true,
        };
      },
    },
    serviceValidationProviderConfirmation: {
      findUnique: async ({ where }: { where: { runId: string } }) => {
        const channel = Object.entries(runs).find(([, r]) => r.id === where.runId)?.[0];
        if (!channel) return null;
        return {
          id: confIds[channel as keyof typeof confIds],
          status: "CONFIRMED",
        };
      },
    },
    packDistributionMetadata: {
      findUnique: async () => ({
        allowApi: true,
        allowMcp: true,
        allowDownload: true,
      }),
    },
  } as unknown as PrismaLike;

  return {
    client,
    input: {
      packId,
      versionId,
      providerProfileId,
      snapshot,
    },
  };
}

describe("assertRagExportDownloadEvidenceBinding (fail-closed)", () => {
  it("accepts matching non-empty exportFingerprint", () => {
    assert.doesNotThrow(() =>
      assertRagExportDownloadEvidenceBinding({
        runDetails: { ...RAG_EXPORT_DETAILS_BASE },
        downloadTestFileId: EXPORT_FP,
      }),
    );
  });

  it("rejects missing exportFingerprint even when fileId is present", () => {
    assert.throws(
      () =>
        assertRagExportDownloadEvidenceBinding({
          runDetails: {
            downloadMode: "RAG_EXPORT",
            fileId: EXPORT_FP,
          },
          downloadTestFileId: EXPORT_FP,
        }),
      (e: unknown) => e instanceof ReviewSubmitEvidenceError && e.code === "VALIDATION_DRIFT",
    );
  });

  it("rejects empty or whitespace exportFingerprint", () => {
    for (const exportFingerprint of ["", "   "]) {
      assert.throws(
        () =>
          assertRagExportDownloadEvidenceBinding({
            runDetails: { ...RAG_EXPORT_DETAILS_BASE, exportFingerprint },
            downloadTestFileId: exportFingerprint || "x",
          }),
        (e: unknown) => e instanceof ReviewSubmitEvidenceError && e.code === "VALIDATION_DRIFT",
      );
    }
  });

  it("rejects fingerprint mismatch", () => {
    assert.throws(
      () =>
        assertRagExportDownloadEvidenceBinding({
          runDetails: { ...RAG_EXPORT_DETAILS_BASE },
          downloadTestFileId: "other-export-fp",
        }),
      (e: unknown) => e instanceof ReviewSubmitEvidenceError && e.code === "VALIDATION_DRIFT",
    );
  });

  it("source contract forbids fileId fallback in review-submit-evidence", () => {
    const src = readFileSync(join(root, "src/lib/distribution/review-submit-evidence.ts"), "utf8");
    assert.ok(src.includes("assertRagExportDownloadEvidenceBinding"));
    assert.ok(!src.includes('typeof runDetails.fileId === "string"'));
    assert.ok(!src.includes("? runDetails.fileId"));
  });
});

describe("assertReviewSubmitEvidenceInTx RAG Export download binding", () => {
  it("passes when downloadTest.fileId equals exportFingerprint", async () => {
    const { client, input } = buildSubmitFixture();
    await assertReviewSubmitEvidenceInTx(client, input);
  });

  it("blocks when exportFingerprint is missing and only fileId exists", async () => {
    const { client, input } = buildSubmitFixture({
      downloadDetails: {
        downloadMode: "RAG_EXPORT",
        fileId: EXPORT_FP,
        ragExportPolicyVersion: "rag_export_v1",
        ragExportSchemaVersion: "jyk-rag-export/1.0",
      },
      downloadTestFileId: EXPORT_FP,
    });
    await assert.rejects(
      () => assertReviewSubmitEvidenceInTx(client, input),
      (e: unknown) => e instanceof ReviewSubmitEvidenceError && e.code === "VALIDATION_DRIFT",
    );
  });

  it("blocks empty exportFingerprint", async () => {
    const { client, input } = buildSubmitFixture({
      downloadDetails: { ...RAG_EXPORT_DETAILS_BASE, exportFingerprint: "" },
      downloadTestFileId: "",
    });
    await assert.rejects(
      () => assertReviewSubmitEvidenceInTx(client, input),
      (e: unknown) => e instanceof ReviewSubmitEvidenceError && e.code === "VALIDATION_DRIFT",
    );
  });

  it("blocks mismatched exportFingerprint vs downloadTest.fileId", async () => {
    const { client, input } = buildSubmitFixture({
      downloadTestFileId: "wrong-fp",
    });
    await assert.rejects(
      () => assertReviewSubmitEvidenceInTx(client, input),
      (e: unknown) => e instanceof ReviewSubmitEvidenceError && e.code === "VALIDATION_DRIFT",
    );
  });

  it("blocks wrong provider ownership before download evidence", async () => {
    const { client, input } = buildSubmitFixture();
    await assert.rejects(
      () =>
        assertReviewSubmitEvidenceInTx(client, {
          ...input,
          providerProfileId: "other-provider",
        }),
      (e: unknown) => e instanceof ReviewSubmitEvidenceError && e.code === "NOT_FOUND",
    );
  });

  it("blocks reuse of a different DOWNLOAD run id from snapshot", async () => {
    const { client, input } = buildSubmitFixture();
    const findFirst = client.serviceValidationRun.findFirst.bind(client.serviceValidationRun);
    client.serviceValidationRun.findFirst = (async (args: {
      where: { versionId: string; channel: string };
    }) => {
      const row = await findFirst(args);
      if (args.where.channel === "DOWNLOAD" && row) {
        return { ...row, id: "run-from-other-execution" };
      }
      return row;
    }) as typeof client.serviceValidationRun.findFirst;

    await assert.rejects(
      () => assertReviewSubmitEvidenceInTx(client, input),
      (e: unknown) => e instanceof ReviewSubmitEvidenceError && e.code === "VALIDATION_DRIFT",
    );
  });
});

describe("resolveRunCurrentValidity RAG Export (supporting)", () => {
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

  it("does not accept fileId alone when exportFingerprint is missing", () => {
    const { exportFingerprint: omitted, ...withoutFingerprint } = RAG_EXPORT_DETAILS_BASE;
    void omitted;
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
});
