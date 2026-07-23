import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { confirmProviderStoreReview } from "../lib/store-workflow-markers.ts";

type MockRun = {
  id: string;
  status: string;
  createdAt?: Date;
  finishedAt?: Date | null;
};

function createConfirmClient(opts: {
  providerPhaseStatus: "PENDING" | "PASS" | "SKIPPED" | null;
  latestZip?: { id: string; status: string } | null;
  generation?: { id: string } | null;
  structureStatus?: string | null;
  chunkStatus?: string | null;
  knowledgeStatus?: string | null;
  openReview?: MockRun | null;
}) {
  const providerMarker =
    opts.providerPhaseStatus == null
      ? null
      : {
          status: opts.providerPhaseStatus,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          finishedAt:
            opts.providerPhaseStatus === "PASS" ? new Date("2026-01-02T00:00:00Z") : null,
        };

  return {
    pipelineRun: {
      findFirst: async ({
        where,
      }: {
        where: { triggerType?: string; status?: { in?: string[] } | string };
      }) => {
        if (where.triggerType === "STORE_PROVIDER_REVIEW") {
          if (where.status && typeof where.status === "object" && where.status.in) {
            if (
              opts.openReview &&
              where.status.in.includes(opts.openReview.status)
            ) {
              return opts.openReview;
            }
            if (
              providerMarker &&
              where.status.in.includes(providerMarker.status)
            ) {
              return providerMarker;
            }
            return null;
          }
          return providerMarker;
        }
        if (where.triggerType === "WORKER_ZIP_IMPORT") {
          return opts.latestZip ?? null;
        }
        if (where.triggerType === "STORE_SERVICE_VALIDATION") {
          return null;
        }
        return null;
      },
      update: async () => ({ id: "updated" }),
    },
    searchIndexGeneration: {
      findFirst: async () => opts.generation ?? null,
    },
    structureCoverageReport: {
      findFirst: async () =>
        opts.structureStatus ? { status: opts.structureStatus } : null,
    },
    chunkQualityReport: {
      findFirst: async () => (opts.chunkStatus ? { status: opts.chunkStatus } : null),
    },
    knowledgeQualityReport: {
      findFirst: async () =>
        opts.knowledgeStatus ? { status: opts.knowledgeStatus } : null,
    },
  };
}

describe("confirmProviderStoreReview guards", () => {
  it("rejects when review is not requested", async () => {
    const result = await confirmProviderStoreReview({
      packId: "pack-1",
      clientId: "client-1",
      prismaClient: createConfirmClient({
        providerPhaseStatus: null,
      }) as never,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "NOT_REQUESTED");
      assert.match(result.message, /아직 검토 요청 상태가 아닙니다/);
    }
  });

  it("rejects when latest generation or quality evidence is missing", async () => {
    const result = await confirmProviderStoreReview({
      packId: "pack-1",
      clientId: "client-1",
      prismaClient: createConfirmClient({
        providerPhaseStatus: "PENDING",
        latestZip: { id: "zip-1", status: "PASS" },
        generation: null,
        structureStatus: "PASS",
        openReview: { id: "review-1", status: "PENDING" },
      }) as never,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "GENERATION_OR_QUALITY_NOT_READY");
      assert.match(result.message, /생성 결과 또는 품질점검 결과가 준비되지 않았습니다/);
    }
  });

  it("rejects when quality reports are FAIL", async () => {
    const result = await confirmProviderStoreReview({
      packId: "pack-1",
      clientId: "client-1",
      prismaClient: createConfirmClient({
        providerPhaseStatus: "PENDING",
        latestZip: { id: "zip-1", status: "PASS" },
        generation: { id: "gen-1" },
        structureStatus: "FAIL",
        openReview: { id: "review-1", status: "PENDING" },
      }) as never,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "GENERATION_OR_QUALITY_NOT_READY");
    }
  });

  it("confirms when requested with generation and quality ready", async () => {
    const result = await confirmProviderStoreReview({
      packId: "pack-1",
      clientId: "client-1",
      prismaClient: createConfirmClient({
        providerPhaseStatus: "PENDING",
        latestZip: { id: "zip-1", status: "PASS" },
        generation: { id: "gen-1" },
        structureStatus: "PASS",
        openReview: { id: "review-1", status: "PENDING" },
      }) as never,
    });
    assert.equal(result.ok, true);
  });

  it("is idempotent when already confirmed", async () => {
    const result = await confirmProviderStoreReview({
      packId: "pack-1",
      clientId: "client-1",
      prismaClient: createConfirmClient({
        providerPhaseStatus: "PASS",
      }) as never,
    });
    assert.equal(result.ok, true);
  });
});
