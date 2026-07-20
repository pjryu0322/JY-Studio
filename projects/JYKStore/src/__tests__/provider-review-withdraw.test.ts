import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PROVIDER_REVIEW_WITHDRAW_CTA } from "../lib/role-based-ux-copy.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("provider review withdraw", () => {
  it("exposes withdraw service, route, and review-tab CTA", () => {
    const service = readSource("src/lib/provider-pack/provider-pack-review-submit-service.ts");
    const route = readSource(
      "src/app/api/v1/provider/packs/[packId]/withdraw-review/route.ts",
    );
    const tab = readSource("src/components/ProviderPackReviewTab.tsx");
    const api = readSource("src/lib/provider-center-api.ts");

    assert.ok(service.includes("withdrawProviderPackFromReview"));
    assert.ok(service.includes('status: "WITHDRAWN"'));
    assert.ok(service.includes("PackStatus.DRAFT"));
    assert.ok(service.includes("ALREADY_ACCEPTED"));
    assert.ok(route.includes("withdrawProviderPackFromReview"));
    assert.ok(api.includes("withdrawProviderPackReviewApi"));
    assert.equal(PROVIDER_REVIEW_WITHDRAW_CTA, "검수 요청 회수");
    assert.ok(tab.includes("PROVIDER_REVIEW_WITHDRAW_CTA"));
    assert.ok(tab.includes("canProviderWithdrawReview"));
    assert.ok(tab.includes("onWithdrawReview"));
  });
});
