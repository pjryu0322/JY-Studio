import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  canProviderWithdrawReview,
  PackReviewStatus,
} from "../lib/pack-review-status.ts";
import {
  ADMIN_REVIEW_CTA_ACCEPT,
  PROVIDER_REVIEW_WITHDRAW_CTA,
} from "../lib/role-based-ux-copy.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("pack review accept and withdraw gate", () => {
  it("allows withdraw only while PENDING and approve only after accept", () => {
    assert.equal(canProviderWithdrawReview(PackReviewStatus.PENDING), true);
    assert.equal(canProviderWithdrawReview(PackReviewStatus.IN_REVIEW), false);
    assert.equal(canProviderWithdrawReview(null), false);
  });

  it("wires admin accept and provider withdraw gate", () => {
    const adminService = readSource("src/lib/admin-review-service.ts");
    const acceptRoute = readSource(
      "src/app/api/v1/admin/reviews/[packId]/accept/route.ts",
    );
    const approveRoute = readSource(
      "src/app/api/v1/admin/reviews/[packId]/approve/route.ts",
    );
    const rejectRoute = readSource(
      "src/app/api/v1/admin/reviews/[packId]/reject/route.ts",
    );
    const withdrawService = readSource("src/lib/provider-pack-service.ts");
    const withdrawRoute = readSource(
      "src/app/api/v1/provider/packs/[packId]/withdraw-review/route.ts",
    );
    const decision = readSource("src/components/AdminReviewAcceptTab.tsx");
    const tab = readSource("src/components/ProviderPackReviewTab.tsx");
    const decisionLib = readSource("src/lib/admin-review-decision.ts");

    assert.ok(adminService.includes("acceptPackReview"));
    assert.ok(adminService.includes("PackReviewStatus.IN_REVIEW"));
    assert.ok(adminService.includes("NOT_ACCEPTED"));
    assert.ok(acceptRoute.includes("acceptPackReview"));
    assert.ok(approveRoute.includes("NOT_ACCEPTED"));
    assert.ok(rejectRoute.includes("NOT_ACCEPTED"));
    assert.ok(withdrawService.includes("ALREADY_ACCEPTED"));
    assert.ok(withdrawRoute.includes("ALREADY_ACCEPTED"));
    assert.ok(decisionLib.includes("isAdminReviewAccepted"));
    assert.equal(ADMIN_REVIEW_CTA_ACCEPT, "검수 접수");
    assert.equal(PROVIDER_REVIEW_WITHDRAW_CTA, "검수 요청 회수");
    assert.ok(decision.includes("ADMIN_REVIEW_CTA_ACCEPT"));
    assert.ok(decision.includes("showDecisionActions"));
    assert.ok(tab.includes("canProviderWithdrawReview"));
  });
});
