import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  canRequestProviderReviewHandoff,
  isWorkerKnowledgeGenerationCompleted,
} from "../lib/store-workflow-handoff-gates-policy.ts";
import {
  classifyStoreServiceChannelRun,
  resolveStoreServiceChannelGates,
  resolveStoreValidationBinding,
} from "../lib/store-workflow-handoff-gates.ts";
import { buildProviderPackProgress } from "../lib/provider-pack-progress.ts";
import { resolveRunCurrentValidity } from "../lib/distribution/service-validation-policy.ts";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "../lib/retrieval/relevance-diversity-rerank.ts";
import { DOCLING_KNOWLEDGE_PIPELINE_TRIGGER } from "../lib/docling-knowledge/docling-knowledge-stages.ts";
import { WORKER_ZIP_IMPORT_TRIGGER } from "../lib/python-worker/worker-zip-step-log.ts";

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

const RANKING_DETAILS = {
  retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
};

type MockGen = {
  id: string;
  fingerprint: string;
  pipelineRunId: string | null;
  versionId: string;
  status: string;
};

type MockValidationRun = {
  id: string;
  status: string;
  fingerprint: string | null;
  indexGenerationId: string | null;
  invalidatedAt?: Date | null;
  details?: unknown;
  channel: string;
};

function doclingSummary(input: {
  versionId: string;
  fingerprint: string;
  indexGenerationId: string;
  normalizedDocumentId?: string;
  bundleId?: string;
}): string {
  return JSON.stringify({
    v: 1,
    versionId: input.versionId,
    normalizedDocumentId: input.normalizedDocumentId ?? "nd-1",
    fingerprint: input.fingerprint,
    bundleId: input.bundleId ?? "bundle-1",
    indexGenerationId: input.indexGenerationId,
  });
}

function createBindingClient(opts: {
  /** Latest Worker ZIP run (any status). Prefer this over legacy workerZipPassId. */
  latestWorkerZipRun?: { id: string; status: string } | null;
  /** @deprecated use latestWorkerZipRun */
  workerZipPassId?: string | null;
  workerZipGeneration?: MockGen | null;
  orphanReadyGeneration?: MockGen | null;
  doclingPass?: {
    id: string;
    summary: string;
  } | null;
  normalizedDocumentFound?: boolean;
}) {
  const latestZip =
    opts.latestWorkerZipRun !== undefined
      ? opts.latestWorkerZipRun
      : opts.workerZipPassId
        ? { id: opts.workerZipPassId, status: "PASS" }
        : null;

  return {
    pipelineRun: {
      findFirst: async ({
        where,
      }: {
        where: { triggerType?: string; status?: string };
      }) => {
        if (where.triggerType === WORKER_ZIP_IMPORT_TRIGGER) {
          // Policy: latest run is status-unfiltered. Reject mocks that still filter PASS-only.
          if (where.status != null) {
            throw new Error("resolveStoreValidationBinding must not query Worker ZIP by status PASS");
          }
          return latestZip;
        }
        if (where.triggerType === DOCLING_KNOWLEDGE_PIPELINE_TRIGGER) {
          return opts.doclingPass
            ? {
                id: opts.doclingPass.id,
                packId: "pack-1",
                status: "PASS",
                summary: opts.doclingPass.summary,
              }
            : null;
        }
        return null;
      },
    },
    searchIndexGeneration: {
      findFirst: async ({
        where,
      }: {
        where: { pipelineRunId?: string };
      }) => {
        if (where.pipelineRunId && latestZip?.id === where.pipelineRunId) {
          return opts.workerZipGeneration ?? null;
        }
        if (!where.pipelineRunId) {
          return opts.orphanReadyGeneration ?? null;
        }
        return null;
      },
    },
    normalizedDocument: {
      findFirst: async () => (opts.normalizedDocumentFound === false ? null : { id: "nd-1" }),
    },
  };
}

function createGatesClient(input: {
  versionId: string;
  bindingClient: ReturnType<typeof createBindingClient>;
  runs: Partial<Record<"API" | "MCP" | "DOWNLOAD", MockValidationRun | null>>;
  downloadTestReady?: boolean;
  resultItemCount?: number;
}) {
  return {
    ...input.bindingClient,
    knowledgePack: {
      findUnique: async () => ({
        packId: "pack-1",
        versions: [{ id: input.versionId }],
      }),
    },
    serviceValidationRun: {
      findFirst: async ({ where }: { where: { channel: string } }) => {
        const run = input.runs[where.channel as "API" | "MCP" | "DOWNLOAD"];
        return run ?? null;
      },
    },
    serviceValidationResultItem: {
      count: async () => input.resultItemCount ?? 2,
    },
    serviceValidationDownloadTest: {
      findUnique: async () =>
        input.downloadTestReady === false ? null : { responseReady: true },
    },
  };
}

describe("store workflow handoff gates", () => {
  it("requires service validation PASSED for provider review request", () => {
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
        workerZipPhase: "COMPLETED",
        quality,
        serviceValidationPhase: "NONE",
      }),
      false,
    );
    assert.equal(
      canRequestProviderReviewHandoff({
        workerZipPhase: "COMPLETED",
        quality,
        serviceValidationPhase: "PASSED",
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

  it("prefers Worker ZIP binding over current Docling binding", async () => {
    const versionId = "ver-1";
    const resolved = await resolveStoreValidationBinding({
      packId: "pack-1",
      versionId,
      prismaClient: createBindingClient({
        workerZipPassId: "zip-pass-new",
        workerZipGeneration: {
          id: "gen-zip",
          fingerprint: "fp-zip",
          pipelineRunId: "zip-pass-new",
          versionId,
          status: "READY",
        },
        doclingPass: {
          id: "docling-old",
          summary: doclingSummary({
            versionId,
            fingerprint: "fp-docling",
            indexGenerationId: "gen-docling",
          }),
        },
      }) as never,
    });
    assert.equal(resolved.status, "CURRENT");
    assert.equal(resolved.source, "WORKER_ZIP");
    assert.equal(resolved.binding?.fingerprint, "fp-zip");
    assert.equal(resolved.binding?.indexGenerationId, "gen-zip");
  });

  it("blocks when Worker ZIP PASS exists but linked generation is missing", async () => {
    const versionId = "ver-1";
    const resolved = await resolveStoreValidationBinding({
      packId: "pack-1",
      versionId,
      prismaClient: createBindingClient({
        workerZipPassId: "zip-pass-new",
        workerZipGeneration: null,
        orphanReadyGeneration: {
          id: "gen-orphan",
          fingerprint: "fp-orphan",
          pipelineRunId: "old-run",
          versionId,
          status: "READY",
        },
        doclingPass: {
          id: "docling-old",
          summary: doclingSummary({
            versionId,
            fingerprint: "fp-docling",
            indexGenerationId: "gen-docling",
          }),
        },
      }) as never,
    });
    assert.equal(resolved.status, "STALE");
    assert.equal(resolved.source, "WORKER_ZIP");
    assert.equal(resolved.reasonCode, "WORKER_ZIP_GENERATION_MISSING");
    assert.equal(resolved.binding, null);
    assert.match(resolved.reason ?? "", /검색 인덱스 세대가 연결되지 않았습니다/);
  });

  it("allows Docling current binding when no Worker ZIP PASS exists", async () => {
    const versionId = "ver-1";
    const resolved = await resolveStoreValidationBinding({
      packId: "pack-1",
      versionId,
      prismaClient: createBindingClient({
        workerZipPassId: null,
        doclingPass: {
          id: "docling-1",
          summary: doclingSummary({
            versionId,
            fingerprint: "fp-docling",
            indexGenerationId: "gen-docling",
          }),
        },
        normalizedDocumentFound: true,
      }) as never,
    });
    assert.equal(resolved.status, "CURRENT");
    assert.equal(resolved.source, "DOCLING_KNOWLEDGE");
    assert.equal(resolved.binding?.fingerprint, "fp-docling");
  });

  it("rejects stale Docling PASS after newer Worker ZIP without matching channel runs", async () => {
    const versionId = "ver-1";
    const snapshot = await resolveStoreServiceChannelGates(
      "pack-1",
      createGatesClient({
        versionId,
        bindingClient: createBindingClient({
          workerZipPassId: "zip-pass-new",
          workerZipGeneration: {
            id: "gen-zip",
            fingerprint: "fp-zip",
            pipelineRunId: "zip-pass-new",
            versionId,
            status: "READY",
          },
          doclingPass: {
            id: "docling-old",
            summary: doclingSummary({
              versionId,
              fingerprint: "fp-docling",
              indexGenerationId: "gen-docling",
            }),
          },
        }),
        runs: {
          API: {
            id: "api-old",
            channel: "API",
            status: "PASS",
            fingerprint: "fp-docling",
            indexGenerationId: "gen-docling",
            details: RANKING_DETAILS,
          },
          MCP: {
            id: "mcp-old",
            channel: "MCP",
            status: "PASS",
            fingerprint: "fp-docling",
            indexGenerationId: "gen-docling",
            details: RANKING_DETAILS,
          },
          DOWNLOAD: {
            id: "dl-old",
            channel: "DOWNLOAD",
            status: "PASS",
            fingerprint: "fp-docling",
            indexGenerationId: "gen-docling",
            details: RAG_DETAILS,
          },
        },
        downloadTestReady: true,
      }) as never,
    );
    assert.equal(snapshot.serviceValidationReady, false);
    assert.equal(snapshot.bindingSource, "WORKER_ZIP");
    assert.equal(snapshot.bindingFingerprint, "fp-zip");
    assert.ok(snapshot.channels.every((c) => !c.passed));
    assert.ok(
      snapshot.channels.every(
        (c) =>
          c.reasonCode === "FINGERPRINT_MISMATCH" ||
          c.reasonCode === "INDEX_GENERATION_MISMATCH" ||
          c.reasonCode === "STALE_BINDING",
      ),
    );
  });

  it("blocks service validation when Worker ZIP PASS has no linked generation", async () => {
    const versionId = "ver-1";
    const snapshot = await resolveStoreServiceChannelGates(
      "pack-1",
      createGatesClient({
        versionId,
        bindingClient: createBindingClient({
          workerZipPassId: "zip-pass-new",
          workerZipGeneration: null,
          orphanReadyGeneration: {
            id: "gen-orphan",
            fingerprint: "fp-orphan",
            pipelineRunId: "old-run",
            versionId,
            status: "READY",
          },
        }),
        runs: {
          API: {
            id: "api-1",
            channel: "API",
            status: "PASS",
            fingerprint: "fp-orphan",
            indexGenerationId: "gen-orphan",
            details: RANKING_DETAILS,
          },
          MCP: {
            id: "mcp-1",
            channel: "MCP",
            status: "PASS",
            fingerprint: "fp-orphan",
            indexGenerationId: "gen-orphan",
            details: RANKING_DETAILS,
          },
          DOWNLOAD: {
            id: "dl-1",
            channel: "DOWNLOAD",
            status: "PASS",
            fingerprint: "fp-orphan",
            indexGenerationId: "gen-orphan",
            details: RAG_DETAILS,
          },
        },
        downloadTestReady: true,
      }) as never,
    );
    assert.equal(snapshot.serviceValidationReady, false);
    assert.equal(snapshot.bindingStatus, "STALE");
    assert.equal(
      snapshot.channels[0]?.reasonCode,
      "WORKER_ZIP_GENERATION_MISSING",
    );
    assert.match(
      snapshot.bindingReason ?? "",
      /검색 인덱스 세대가 연결되지 않았습니다/,
    );
  });

  it("allows Docling-only packs when three channels match Docling binding", async () => {
    const versionId = "ver-1";
    const snapshot = await resolveStoreServiceChannelGates(
      "pack-1",
      createGatesClient({
        versionId,
        bindingClient: createBindingClient({
          workerZipPassId: null,
          doclingPass: {
            id: "docling-1",
            summary: doclingSummary({
              versionId,
              fingerprint: "fp-docling",
              indexGenerationId: "gen-docling",
            }),
          },
          normalizedDocumentFound: true,
        }),
        runs: {
          API: {
            id: "api-1",
            channel: "API",
            status: "PASS",
            fingerprint: "fp-docling",
            indexGenerationId: "gen-docling",
            details: RANKING_DETAILS,
          },
          MCP: {
            id: "mcp-1",
            channel: "MCP",
            status: "PASS",
            fingerprint: "fp-docling",
            indexGenerationId: "gen-docling",
            details: RANKING_DETAILS,
          },
          DOWNLOAD: {
            id: "dl-1",
            channel: "DOWNLOAD",
            status: "PASS",
            fingerprint: "fp-docling",
            indexGenerationId: "gen-docling",
            details: RAG_DETAILS,
          },
        },
        downloadTestReady: true,
      }) as never,
    );
    assert.equal(snapshot.serviceValidationReady, true);
    assert.equal(snapshot.bindingSource, "DOCLING_KNOWLEDGE");
    assert.equal(snapshot.allPassed, true);
  });

  it("passes when Worker ZIP binding and three channels match", async () => {
    const versionId = "ver-1";
    const snapshot = await resolveStoreServiceChannelGates(
      "pack-1",
      createGatesClient({
        versionId,
        bindingClient: createBindingClient({
          workerZipPassId: "zip-pass-new",
          workerZipGeneration: {
            id: "gen-zip",
            fingerprint: "fp-zip",
            pipelineRunId: "zip-pass-new",
            versionId,
            status: "READY",
          },
        }),
        runs: {
          API: {
            id: "api-1",
            channel: "API",
            status: "PASS",
            fingerprint: "fp-zip",
            indexGenerationId: "gen-zip",
            details: RANKING_DETAILS,
          },
          MCP: {
            id: "mcp-1",
            channel: "MCP",
            status: "PASS",
            fingerprint: "fp-zip",
            indexGenerationId: "gen-zip",
            details: RANKING_DETAILS,
          },
          DOWNLOAD: {
            id: "dl-1",
            channel: "DOWNLOAD",
            status: "PASS",
            fingerprint: "fp-zip",
            indexGenerationId: "gen-zip",
            details: RAG_DETAILS,
          },
        },
        downloadTestReady: true,
      }) as never,
    );
    assert.equal(snapshot.serviceValidationReady, true);
    assert.equal(snapshot.bindingSource, "WORKER_ZIP");
    assert.equal(snapshot.bindingFingerprint, "fp-zip");
    assert.equal(snapshot.allPassed, true);
  });

  it("keeps mismatch channel failed under Worker ZIP binding", async () => {
    const versionId = "ver-1";
    const snapshot = await resolveStoreServiceChannelGates(
      "pack-1",
      createGatesClient({
        versionId,
        bindingClient: createBindingClient({
          workerZipPassId: "zip-pass-new",
          workerZipGeneration: {
            id: "gen-zip",
            fingerprint: "fp-zip",
            pipelineRunId: "zip-pass-new",
            versionId,
            status: "READY",
          },
        }),
        runs: {
          API: {
            id: "api-1",
            channel: "API",
            status: "PASS",
            fingerprint: "fp-zip",
            indexGenerationId: "gen-zip",
            details: RANKING_DETAILS,
          },
          MCP: {
            id: "mcp-1",
            channel: "MCP",
            status: "PASS",
            fingerprint: "fp-old",
            indexGenerationId: "gen-zip",
            details: RANKING_DETAILS,
          },
          DOWNLOAD: {
            id: "dl-1",
            channel: "DOWNLOAD",
            status: "PASS",
            fingerprint: "fp-zip",
            indexGenerationId: "gen-zip",
            details: RAG_DETAILS,
          },
        },
        downloadTestReady: true,
      }) as never,
    );
    assert.equal(snapshot.serviceValidationReady, false);
    const mcp = snapshot.channels.find((c) => c.channel === "MCP");
    assert.equal(mcp?.passed, false);
    assert.equal(mcp?.reasonCode, "FINGERPRINT_MISMATCH");
  });

  it("blocks when latest Worker ZIP is RUNNING even if older PASS exists", async () => {
    const versionId = "ver-1";
    const resolved = await resolveStoreValidationBinding({
      packId: "pack-1",
      versionId,
      prismaClient: createBindingClient({
        latestWorkerZipRun: { id: "zip-running", status: "RUNNING" },
        // Linked to older PASS — must not be used when latest is RUNNING
        workerZipGeneration: {
          id: "gen-old-pass",
          fingerprint: "fp-old",
          pipelineRunId: "zip-old-pass",
          versionId,
          status: "READY",
        },
        orphanReadyGeneration: {
          id: "gen-orphan",
          fingerprint: "fp-orphan",
          pipelineRunId: "zip-old-pass",
          versionId,
          status: "READY",
        },
        doclingPass: {
          id: "docling-old",
          summary: doclingSummary({
            versionId,
            fingerprint: "fp-docling",
            indexGenerationId: "gen-docling",
          }),
        },
      }) as never,
    });
    assert.equal(resolved.status, "NOT_READY");
    assert.equal(resolved.source, "WORKER_ZIP");
    assert.equal(resolved.reasonCode, "WORKER_ZIP_NOT_PASSED");
    assert.equal(resolved.binding, null);
    assert.match(resolved.reason ?? "", /RUNNING/);
  });

  it("blocks when latest Worker ZIP is FAIL even if older PASS exists", async () => {
    const versionId = "ver-1";
    const resolved = await resolveStoreValidationBinding({
      packId: "pack-1",
      versionId,
      prismaClient: createBindingClient({
        latestWorkerZipRun: { id: "zip-fail", status: "FAIL" },
        orphanReadyGeneration: {
          id: "gen-orphan",
          fingerprint: "fp-orphan",
          pipelineRunId: "zip-old-pass",
          versionId,
          status: "READY",
        },
        doclingPass: {
          id: "docling-old",
          summary: doclingSummary({
            versionId,
            fingerprint: "fp-docling",
            indexGenerationId: "gen-docling",
          }),
        },
      }) as never,
    });
    assert.equal(resolved.status, "STALE");
    assert.equal(resolved.reasonCode, "WORKER_ZIP_NOT_PASSED");
    assert.equal(resolved.binding, null);
    assert.match(resolved.reason ?? "", /FAIL/);
  });

  it("blocks service validation gates when latest Worker ZIP is RUNNING", async () => {
    const versionId = "ver-1";
    const snapshot = await resolveStoreServiceChannelGates(
      "pack-1",
      createGatesClient({
        versionId,
        bindingClient: createBindingClient({
          latestWorkerZipRun: { id: "zip-running", status: "RUNNING" },
          orphanReadyGeneration: {
            id: "gen-old",
            fingerprint: "fp-old",
            pipelineRunId: "zip-old-pass",
            versionId,
            status: "READY",
          },
        }),
        runs: {
          API: {
            id: "api-1",
            channel: "API",
            status: "PASS",
            fingerprint: "fp-old",
            indexGenerationId: "gen-old",
            details: RANKING_DETAILS,
          },
          MCP: {
            id: "mcp-1",
            channel: "MCP",
            status: "PASS",
            fingerprint: "fp-old",
            indexGenerationId: "gen-old",
            details: RANKING_DETAILS,
          },
          DOWNLOAD: {
            id: "dl-1",
            channel: "DOWNLOAD",
            status: "PASS",
            fingerprint: "fp-old",
            indexGenerationId: "gen-old",
            details: RAG_DETAILS,
          },
        },
        downloadTestReady: true,
      }) as never,
    );
    assert.equal(snapshot.serviceValidationReady, false);
    assert.equal(snapshot.bindingStatus, "NOT_READY");
    assert.equal(snapshot.channels[0]?.reasonCode, "WORKER_ZIP_NOT_PASSED");
  });

  it("blocks when MCP is missing under current Worker ZIP binding", async () => {
    const versionId = "ver-1";
    const snapshot = await resolveStoreServiceChannelGates(
      "pack-1",
      createGatesClient({
        versionId,
        bindingClient: createBindingClient({
          latestWorkerZipRun: { id: "zip-pass-new", status: "PASS" },
          workerZipGeneration: {
            id: "gen-zip",
            fingerprint: "fp-zip",
            pipelineRunId: "zip-pass-new",
            versionId,
            status: "READY",
          },
        }),
        runs: {
          API: {
            id: "api-1",
            channel: "API",
            status: "PASS",
            fingerprint: "fp-zip",
            indexGenerationId: "gen-zip",
            details: RANKING_DETAILS,
          },
          MCP: null,
          DOWNLOAD: {
            id: "dl-1",
            channel: "DOWNLOAD",
            status: "PASS",
            fingerprint: "fp-zip",
            indexGenerationId: "gen-zip",
            details: RAG_DETAILS,
          },
        },
        downloadTestReady: true,
      }) as never,
    );
    assert.equal(snapshot.serviceValidationReady, false);
    const mcp = snapshot.channels.find((c) => c.channel === "MCP");
    assert.equal(mcp?.passed, false);
    assert.equal(mcp?.reasonCode, "NOT_VALIDATED");
    assert.ok(snapshot.missingLabels.includes("MCP"));
  });

  it("enforces latest Worker ZIP run (status-unfiltered) before Docling fallback", () => {
    const gates = readSource("src/lib/store-workflow-handoff-gates.ts");
    assert.match(gates, /latestZipRun[\s\S]*resolveValidationBindingState\(/);
    assert.ok(gates.includes("WORKER_ZIP_NOT_PASSED"));
    assert.ok(gates.includes("WORKER_ZIP_GENERATION_MISSING"));
    assert.ok(!gates.includes('status: "PASS"'));
  });

  it("service-validation complete API surfaces binding errors", () => {
    const markers = readSource("src/lib/store-workflow-markers.ts");
    assert.ok(markers.includes("BINDING_MISSING") || markers.includes("STALE_BINDING"));
    assert.ok(markers.includes("WORKER_ZIP_GENERATION_MISSING"));
    assert.ok(markers.includes("WORKER_ZIP_NOT_PASSED"));
    assert.ok(markers.includes("bindingStatus"));
  });

  it("admin UI shows latest-knowledge revalidation copy", () => {
    const ui = readSource("src/lib/role-workspace/admin-service-validation-view-model.ts");
    const panel = readSource("src/components/AdminServiceValidationWorkbenchPanel.tsx");
    assert.ok(ui.includes("bindingStatus"));
    assert.ok(panel.includes("vm.summaryMessage") || panel.includes("summaryMessage"));
    assert.ok(ui.includes("최신 산출물 기준 API/MCP/ZIP 검증을 다시 수행해야 합니다."));
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
    assert.ok(progress.actions.some((a) => a.label === "검토하기"));
    assert.ok(!progress.actions.some((a) => a.label === "상세 검토하기"));
    assert.ok(!progress.actions.some((a) => a.label === "확인 완료"));
    assert.ok(!progress.actions.some((a) => a.label === "계속 작성"));
  });
});
