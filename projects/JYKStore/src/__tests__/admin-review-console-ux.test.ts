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
  it("exposes admin login and reviews routes", () => {
    assert.equal(ROUTES.adminLogin, "/admin/login");
    assert.equal(ROUTES.adminReviews, "/admin/reviews");
    assert.ok(readSource("src/app/(store)/admin/login/page.tsx").includes("AdminLoginForm"));
    assert.ok(readSource("src/app/(store)/admin/reviews/page.tsx").includes("AdminReviewListPageClient"));
    assert.ok(readSource("src/components/AdminLoginForm.tsx").includes("ADMIN_LOGIN_TITLE"));
  });

  it("gates admin console with account role", () => {
    const gate = readSource("src/components/AdminAccessGate.tsx");
    assert.ok(gate.includes("ADMIN_ACCESS_REQUIRED_TITLE"));
    assert.ok(gate.includes("ROUTES.adminLogin"));
    assert.ok(gate.includes("isAdminAccountRole"));
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
    assert.ok(header.includes("isAdminAccountRole"));
    assert.ok(header.includes("검수 대기 목록"));
    assert.ok(header.includes("관리자 콘솔"));
    assert.ok(header.includes("logoutStoreAccount"));
  });
});
