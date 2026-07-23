import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ROUTES } from "../lib/routes.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("admin account review console UX", () => {
  it("exposes shared login and reviews routes", () => {
    assert.equal(ROUTES.login, "/login");
    assert.equal(ROUTES.adminLogin, ROUTES.login);
    assert.equal(ROUTES.adminReviews, "/admin/reviews");
    assert.ok(readSource("src/app/(store)/admin/login/page.tsx").includes("redirect(ROUTES.login)"));
    assert.ok(readSource("src/app/(store)/admin/reviews/page.tsx").includes("AdminReviewListPageClient"));
    assert.ok(readSource("src/app/(store)/login/page.tsx").includes("StoreLoginForm"));
  });

  it("gates admin console with account role", () => {
    const gate = readSource("src/components/AdminAccessGate.tsx");
    assert.ok(gate.includes("ADMIN_ACCESS_REQUIRED_TITLE"));
    assert.ok(gate.includes("ROUTES.login"));
    assert.ok(gate.includes("isAdminAccountRole"));
    assert.ok(gate.includes("관리자 계정으로 다시 로그인"));
    assert.ok(!gate.includes("confirmAdminSession"));
  });

  it("protects review APIs with requireAdminSession", () => {
    const approve = readSource("src/app/api/v1/admin/reviews/[packId]/approve/route.ts");
    const reject = readSource("src/app/api/v1/admin/reviews/[packId]/reject/route.ts");
    const guard = readSource("src/lib/admin-route-guard.ts");
    assert.ok(guard.includes("requireAdminSession"));
    assert.ok(approve.includes("requireAdminSession"));
    assert.ok(approve.includes("reviewerUserId"));
    assert.ok(reject.includes("requireAdminSession"));
    assert.ok(reject.includes("reviewerUserId"));
  });

  it("shows provider waiting and rejection copy without admin console link", () => {
    const reviewTab = readSource("src/components/ProviderPackReviewTab.tsx");
    assert.ok(reviewTab.includes("PROVIDER_REVIEW_WAITING_TITLE"));
    assert.ok(reviewTab.includes("PROVIDER_REVIEW_WAITING_BODY"));
    assert.ok(reviewTab.includes("PROVIDER_REVIEW_REJECTED_TITLE"));
    assert.ok(!reviewTab.includes("ROUTES.admin"));
    assert.ok(reviewTab.includes("PROVIDER_REVIEW_DEV_ADMIN_HINT"));
  });

  it("exposes admin header menu for ADMIN accounts only", () => {
    const header = readSource("src/components/HeaderProfileButton.tsx");
    const menu = readSource("src/lib/account-menu.ts");
    assert.ok(header.includes("isAdminAccountRole") || header.includes("accountMenuLinksForRole"));
    assert.ok(menu.includes("검수 대기 목록"));
    assert.ok(menu.includes("할 일"));
    assert.ok(header.includes("useStoreLogout"));
  });
});
