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

describe("admin first screen landing", () => {
  it("lands admins on operations inbox after auth", () => {
    assert.equal(postAuthLandingPath("ADMIN"), ROUTES.admin);
    assert.equal(postAuthLandingPath("USER"), ROUTES.home);
    assert.equal(postAuthLandingPath("PROVIDER"), ROUTES.provider);
  });

  it("redirects admin away from consumer home and today", () => {
    const home = readSource("src/app/(store)/page.tsx");
    const today = readSource("src/app/(store)/today/page.tsx");
    assert.ok(home.includes("isAdminAccountRole"));
    assert.ok(home.includes("redirect(ROUTES.admin)"));
    assert.ok(today.includes("isAdminAccountRole"));
    assert.ok(today.includes("redirect(ROUTES.admin)"));
    assert.ok(home.includes("isProviderAccountRole"));
    assert.ok(today.includes("isProviderAccountRole"));
  });

  it("keeps consumer TodayView only for non-admin paths", () => {
    const home = readSource("src/app/(store)/page.tsx");
    const today = readSource("src/app/(store)/today/page.tsx");
    assert.ok(home.includes("TodayView"));
    assert.ok(today.includes("TodayView"));
    // Admin redirect must happen before featured catalog load side-effects for admins.
    assert.ok(home.indexOf("isAdminAccountRole") < home.indexOf("listTodayFeaturedPacks"));
    assert.ok(today.indexOf("isAdminAccountRole") < today.indexOf("listTodayFeaturedPacks"));
  });

  it("admin inbox exposes operations queue copy without consumer discovery language", () => {
    const inbox = readSource("src/components/AdminWorkInboxPageClient.tsx");
    const chrome = readSource("src/lib/store-page-chrome.ts");
    const copy = readSource("src/lib/role-based-ux-copy.ts");
    assert.ok(inbox.includes("AdminWorkInboxPageClient") || inbox.includes("ADMIN_WORK_SECTION"));
    assert.ok(inbox.includes("ADMIN_WORK_SECTION_SERVICE_VALIDATION_TITLE"));
    assert.ok(inbox.includes("ADMIN_WORK_SECTION_ACCEPT_TITLE"));
    assert.ok(inbox.includes("ADMIN_WORK_SECTION_PACK_REVIEW_TITLE"));
    assert.ok(!inbox.includes("추천 지식팩"));
    assert.ok(!inbox.includes("인기 지식팩"));
    assert.ok(!inbox.includes("TodayView"));
    assert.ok(!inbox.includes("투데이"));
    assert.ok(!copy.includes("오늘 처리할 일"));
    assert.ok(copy.includes('ADMIN_WORK_INBOX_TITLE = "지식데이터 접수"'));
    assert.ok(copy.includes('ADMIN_WORK_INBOX_DESCRIPTION = ""'));
    assert.ok(copy.includes("현재 처리 대기 중인 작업이 없습니다."));
    assert.ok(copy.includes("서비스 검증 대기"));
    assert.ok(copy.includes("승인·게시 대기"));
    assert.ok(chrome.includes("ADMIN_WORK_INBOX_TITLE"));
    assert.ok(chrome.includes("ADMIN_GENERATION_QUEUE_TITLE"));
    assert.ok(chrome.includes("adminQueueChrome") || chrome.includes("parseAdminWorkQueue"));
  });

  it("admin /admin redirects bare path to queue=receipt", () => {
    const page = readSource("src/app/(store)/admin/page.tsx");
    assert.ok(page.includes('adminQueuePath("receipt")') || page.includes('adminQueuePath("accept")'));
    assert.ok(page.includes("redirect"));
  });

  it("admin rail starts at 자료 접수 (/admin), not 투데이", () => {
    const nav = readSource("src/components/BottomTabNav.tsx");
    const routes = readSource("src/lib/routes.ts");
    assert.ok(nav.includes('role === "ADMIN"'));
    assert.ok(nav.includes('"admin"'));
    const adminBlock = nav.slice(nav.indexOf('role === "ADMIN"'), nav.indexOf('role === "PROVIDER"'));
    assert.ok(adminBlock.includes('"admin"'));
    assert.ok(!adminBlock.includes('"today"'));
    assert.ok(routes.includes('label: "자료 접수"'));
  });
});
