import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  encodeProviderReviewConfirmSummary,
  parseProviderReviewRevisionBinding,
} from "../lib/store-workflow-provider-review-binding.ts";
import { canPublish } from "../lib/workflow/admin-workflow-gates.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

describe("P6.1 provider review revision binding", () => {
  it("round-trips binding in confirm summary", () => {
    const summary = encodeProviderReviewConfirmSummary({
      v: 1,
      indexGenerationId: "gen-a",
      versionId: "ver-a",
      pipelineRunId: "pipe-a",
      reviewedAt: "2026-07-30T00:00:00.000Z",
      reviewerClientId: "client-1",
    });
    const parsed = parseProviderReviewRevisionBinding(summary);
    assert.ok(parsed);
    assert.equal(parsed!.indexGenerationId, "gen-a");
    assert.equal(parsed!.versionId, "ver-a");
    assert.equal(parsed!.pipelineRunId, "pipe-a");
  });

  it("treats legacy confirm summary without binding as missing", () => {
    assert.equal(
      parseProviderReviewRevisionBinding("제공자가 생성 결과 검토를 확인 완료했습니다."),
      null,
    );
  });
});

describe("P6.1 publish gate UI/API alignment", () => {
  it("canPublish requires CONFIRMED + SV PASSED", () => {
    assert.equal(
      canPublish({
        serviceValidationPhase: "PASSED",
        providerReviewPhase: "NONE",
        openSupplement: false,
      }),
      false,
    );
    assert.equal(
      canPublish({
        serviceValidationPhase: "NONE",
        providerReviewPhase: "CONFIRMED",
        openSupplement: false,
      }),
      false,
    );
    assert.equal(
      canPublish({
        serviceValidationPhase: "PASSED",
        providerReviewPhase: "CONFIRMED",
        openSupplement: false,
      }),
      true,
    );
  });

  it("approvePackReview enforces canPublish, binding, and unresolved correction", () => {
    const service = readFileSync(join(root, "src/lib/admin-review-service.ts"), "utf8");
    assert.ok(service.includes("canPublish({"));
    assert.ok(service.includes("assertProviderReviewBindingCurrent"));
    assert.ok(service.includes("PROVIDER_REVIEW_STALE"));
    assert.ok(service.includes("UNRESOLVED_CORRECTION"));
    assert.ok(service.includes("promoteSearchGeneration"));
    assert.ok(service.includes("export async function unpublishPackReview"));
  });

  it("unpublish route exists and preserves data", () => {
    const route = readFileSync(
      join(root, "src/app/api/v1/admin/reviews/[packId]/unpublish/route.ts"),
      "utf8",
    );
    assert.ok(route.includes("unpublishPackReview"));
    const service = readFileSync(join(root, "src/lib/admin-review-service.ts"), "utf8");
    assert.ok(service.includes("dataDeleted: false"));
    assert.ok(service.includes("AuditAction.DEPRECATE"));
  });
});
