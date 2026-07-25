import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  encodeProviderChangesRequestSummary,
  formatProviderReviewQualityLabel,
  overallProviderReviewQualityLabel,
  parseProviderChangesRequestSummary,
} from "../lib/provider-review-workbench.ts";
import { withdrawProviderStoreReview } from "../lib/store-workflow-markers.ts";

describe("provider review workbench labels", () => {
  it("maps WARNING to 주의 필요 and PASS to 통과", () => {
    assert.equal(formatProviderReviewQualityLabel("WARNING"), "주의 필요");
    assert.equal(formatProviderReviewQualityLabel("PASS"), "통과");
    assert.equal(formatProviderReviewQualityLabel("FAIL"), "실패");
    assert.equal(formatProviderReviewQualityLabel("PENDING"), "대기 중");
    assert.equal(formatProviderReviewQualityLabel("RUNNING"), "처리 중");
    assert.equal(
      overallProviderReviewQualityLabel({
        structure: "PASS",
        chunk: "WARNING",
        retrieval: "PASS",
      }),
      "주의 필요",
    );
  });

  it("round-trips changes-request summary JSON", () => {
    const encoded = encodeProviderChangesRequestSummary({
      changeType: "CHUNKING",
      targetKind: "CHUNK",
      targetLabel: "chunk-1",
      details: "청킹이 너무 잘립니다.",
    });
    const parsed = parseProviderChangesRequestSummary(encoded);
    assert.equal(parsed?.changeType, "CHUNKING");
    assert.equal(parsed?.details, "청킹이 너무 잘립니다.");
  });
});

describe("withdrawProviderStoreReview changes request", () => {
  function createClient(phase: "PENDING" | "PASS" | "SKIPPED" | null) {
    const providerMarker =
      phase == null
        ? null
        : {
            status: phase,
            createdAt: new Date(),
            finishedAt: phase === "PASS" ? new Date() : null,
          };
    return {
      pipelineRun: {
        findFirst: async ({
          where,
        }: {
          where: { triggerType?: string; status?: { in?: string[] } };
        }) => {
          if (where.triggerType === "STORE_PROVIDER_REVIEW") {
            if (providerMarker && where.status?.in?.includes(providerMarker.status)) {
              return providerMarker;
            }
            return null;
          }
          return null;
        },
        updateMany: async () => ({ count: 1 }),
        create: async () => ({ id: "created" }),
      },
    };
  }

  it("rejects empty changes request details", async () => {
    const result = await withdrawProviderStoreReview({
      packId: "pack-1",
      clientId: "client-1",
      changesRequest: {
        changeType: "OTHER",
        targetKind: "OTHER",
        details: "   ",
      },
      prismaClient: createClient("PENDING") as never,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "CHANGES_DETAILS_REQUIRED");
    }
  });

  it("rejects changes request when not in REQUESTED phase", async () => {
    const result = await withdrawProviderStoreReview({
      packId: "pack-1",
      clientId: "client-1",
      changesRequest: {
        changeType: "OTHER",
        targetKind: "OTHER",
        details: "보완이 필요합니다.",
      },
      prismaClient: createClient(null) as never,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "NOT_REQUESTED");
    }
  });
});
