import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { toAdminReviewListItem } from "../lib/admin-review-dto.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

function mockPack(overrides?: { status?: string; reviewStatus?: string }) {
  const now = new Date("2026-07-26T00:00:00.000Z");
  return {
    packId: "pack-review-1",
    name: "Review Pack",
    providerName: "Provider",
    categoryId: "cat-1",
    category: { name: "Category" },
    status: overrides?.status ?? "REVIEWING",
    shortDescription: "desc",
    updatedAt: now,
    versions: [{ sourceDocuments: [{ id: "d1" }] }],
    reviews: [
      {
        createdAt: now,
        status: overrides?.reviewStatus ?? "PENDING",
      },
    ],
  } as Parameters<typeof toAdminReviewListItem>[0];
}

describe("admin review list item serviceValidationPhase", () => {
  it("defaults serviceValidationPhase to NONE without markers", () => {
    const item = toAdminReviewListItem(mockPack());
    assert.equal(item.serviceValidationPhase, "NONE");
    assert.equal(item.providerReviewPhase, "NONE");
  });

  it("maps STORE_SERVICE_VALIDATION PASS marker to PASSED", () => {
    const item = toAdminReviewListItem(mockPack(), {
      workflowMarkers: {
        providerReviewPhase: "CONFIRMED",
        serviceValidationPhase: "PASSED",
      },
    });
    assert.equal(item.serviceValidationPhase, "PASSED");
    assert.equal(item.providerReviewPhase, "CONFIRMED");
    assert.equal(item.status, "REVIEWING");
    assert.equal(item.reviewStatus, "PENDING");
  });

  it("keeps NONE when provider confirmed but service validation marker missing", () => {
    const item = toAdminReviewListItem(mockPack(), {
      workflowMarkers: {
        providerReviewPhase: "CONFIRMED",
        serviceValidationPhase: "NONE",
      },
    });
    assert.equal(item.serviceValidationPhase, "NONE");
    assert.equal(item.providerReviewPhase, "CONFIRMED");
  });

  it("listReviewingPacks batch-resolves workflow markers into list DTO", () => {
    const service = readSource("src/lib/admin-review-service.ts");
    assert.ok(service.includes("batchResolveStoreWorkflowMarkers"));
    assert.ok(service.includes("workflowMarkers"));
    assert.ok(service.includes("toAdminReviewListItem(pack"));
    const inbox = readSource("src/components/AdminWorkInboxPageClient.tsx");
    assert.ok(inbox.includes("serviceValidationPhase: item.serviceValidationPhase"));
    assert.ok(inbox.includes("partitionAdminReviewRequiredByServicePhase"));
  });
});
