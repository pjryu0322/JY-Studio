import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { LEGACY_BUILDER_DISABLED_ERROR } from "../lib/legacy-builder-disabled.ts";
import { ADMIN_REVIEW_CTA_REFRESH_ALL } from "../lib/role-based-ux-copy.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("admin review refresh pipeline", () => {
  it("freezes review-refresh route with 410 LEGACY_BUILDER_DISABLED", () => {
    const route = readSource("src/app/api/v1/admin/packs/[packId]/review-refresh/route.ts");
    const page = readSource("src/components/AdminReviewDetailPageClient.tsx");

    assert.ok(route.includes("requireAdminSession"));
    assert.ok(route.includes("legacyBuilderDisabledBody"));
    assert.ok(route.includes("status: 410"));
    assert.ok(!route.includes("refreshAdminReviewReadiness"));
    assert.ok(!page.includes("AdminReviewAdvancedActionsTab"));
    assert.ok(!page.includes("refreshAdminReviewReadinessApi"));
    assert.equal(LEGACY_BUILDER_DISABLED_ERROR, "LEGACY_BUILDER_DISABLED");
  });

  it("keeps refresh CTA copy without mounting advanced actions on review detail", () => {
    const page = readSource("src/components/AdminReviewDetailPageClient.tsx");
    assert.equal(ADMIN_REVIEW_CTA_REFRESH_ALL, "현재 데이터 기준 전체 재점검");
    assert.ok(!page.includes("ADMIN_REVIEW_CTA_REFRESH_ALL"));
    assert.ok(!page.includes("ADMIN_REVIEW_ADVANCED_ACTIONS_TITLE"));
  });
});
