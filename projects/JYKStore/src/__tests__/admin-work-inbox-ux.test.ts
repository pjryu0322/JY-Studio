import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { postAuthLandingPath } from "../lib/account-role.ts";
import { ROUTES } from "../lib/routes.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("admin work inbox UX", () => {
  it("lands admins on the work inbox home", () => {
    assert.equal(postAuthLandingPath("ADMIN"), ROUTES.admin);
    assert.ok(readSource("src/app/(store)/admin/page.tsx").includes("AdminWorkInboxPageClient"));
  });

  it("orders admin work by accept, generate, provider review, pack review, returned", () => {
    const inbox = readSource("src/components/AdminWorkInboxPageClient.tsx");
    assert.ok(inbox.includes("ADMIN_WORK_SECTION_ACCEPT_TITLE"));
    assert.ok(inbox.includes("ADMIN_WORK_SECTION_GENERATE_TITLE"));
    assert.ok(!inbox.includes("ADMIN_WORK_SECTION_QUALITY_TITLE"));
    assert.ok(inbox.includes("ADMIN_WORK_SECTION_PROVIDER_REVIEW_TITLE"));
    assert.ok(inbox.includes("ADMIN_WORK_SECTION_PACK_REVIEW_TITLE"));
    assert.ok(inbox.includes("ADMIN_WORK_SECTION_RETURNED_TITLE"));
    assert.ok(inbox.includes("PROVIDER_SUPPLEMENT_REQUIRED") || inbox.includes("returnedItems"));
    assert.ok(inbox.includes("returnedItems"));
    assert.ok(inbox.includes("buildAdminWorkInboxItemViewModel"));
    assert.ok(inbox.includes("countAdminWorkInboxWaiting"));
    assert.ok(!inbox.includes("생성 완료"));
    assert.ok(!inbox.includes('phase === "COMPLETED"'));
    assert.ok(inbox.includes("step=queue"));
    assert.ok(inbox.includes("step=generation"));
    const acceptAt = inbox.indexOf("title={ADMIN_WORK_SECTION_ACCEPT_TITLE}");
    const generateAt = inbox.indexOf("title={ADMIN_WORK_SECTION_GENERATE_TITLE}");
    const providerAt = inbox.indexOf("title={ADMIN_WORK_SECTION_PROVIDER_REVIEW_TITLE}");
    const packAt = inbox.indexOf("title={ADMIN_WORK_SECTION_PACK_REVIEW_TITLE}");
    const returnedAt = inbox.indexOf("title={ADMIN_WORK_SECTION_RETURNED_TITLE}");
    assert.ok(acceptAt > 0 && acceptAt < generateAt);
    assert.ok(generateAt < providerAt);
    assert.ok(providerAt < packAt);
    assert.ok(packAt < returnedAt);
  });

  it("puts 할 일 first in the admin console rail", () => {
    const rail = readSource("src/lib/role-workspace/admin-review-rail.ts");
    assert.ok(rail.includes('label: "할 일"'));
    assert.ok(rail.indexOf('id: "home"') < rail.indexOf('id: "reviews"'));
  });

  it("exposes an admin 할 일 icon on the app left rail", () => {
    const routes = readSource("src/lib/routes.ts");
    const nav = readSource("src/components/BottomTabNav.tsx");
    assert.ok(routes.includes('"admin"'));
    assert.ok(routes.includes('label: "할 일"'));
    assert.ok(nav.includes('"admin"'));
    assert.ok(nav.includes('"categories"'));
    assert.ok(nav.includes('case "admin":'));
  });

  it("removes nested console rail and restores inbox chrome title", () => {
    const workspace = readSource("src/components/role-workspace/AdminConsoleWorkspace.tsx");
    const inbox = readSource("src/components/AdminWorkInboxPageClient.tsx");
    const detail = readSource("src/components/AdminReviewDetailPageClient.tsx");
    const chrome = readSource("src/lib/store-page-chrome.ts");
    assert.ok(!workspace.includes("RoleWorkspaceShell"));
    assert.ok(!workspace.includes("getAdminConsoleRailItems"));
    assert.ok(!detail.includes("RoleWorkspaceShell"));
    assert.ok(!inbox.includes("ADMIN_WORK_INBOX_TITLE"));
    assert.ok(chrome.includes("ADMIN_WORK_INBOX_TITLE"));
    assert.ok(chrome.includes("ADMIN_WORK_INBOX_DESCRIPTION"));
    assert.ok(inbox.includes("admin-work-category"));
    assert.ok(inbox.includes("admin-work-status"));
  });

  it("filters reviewing packs to open review statuses only", () => {
    const service = readSource("src/lib/admin-review-service.ts");
    assert.ok(service.includes("isOpenPackReviewStatus"));
    assert.ok(service.includes('item.status === "PUBLISHED"'));
  });
});
