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

describe("header profile UX", () => {
  it("moves profile entry to the left rail and drops header avatar", () => {
    const header = readSource("src/components/HeaderProfileButton.tsx");
    const top = readSource("src/components/TopStoreHeader.tsx");
    const nav = readSource("src/components/BottomTabNav.tsx");
    assert.ok(header.includes("accountMenuLinksForRole"));
    assert.ok(header.includes("ROUTES.login") || header.includes("accountProfile"));
    assert.ok(!top.includes("HeaderProfileButton"));
    assert.ok(nav.includes("ROUTES.accountProfile"));
    assert.ok(nav.includes("프로필"));
    assert.ok(nav.includes("accountRoleDisplayLabel"));
    assert.ok(nav.includes("displayName"));
    assert.equal(ROUTES.accountProfile, "/account/profile");
  });

  it("exposes logout inside the account menu only", () => {
    const header = readSource("src/components/HeaderProfileButton.tsx");
    assert.ok(header.includes("useStoreLogout"));
    assert.ok(header.includes("로그아웃"));
    assert.ok(!header.includes("logoutButton"));
    assert.ok(header.includes("loggedIn"));
  });

  it("uses shared login for guests and portals the account menu", () => {
    const header = readSource("src/components/HeaderProfileButton.tsx");
    const menu = readSource("src/lib/account-menu.ts");
    assert.ok(header.includes("ROUTES.login"));
    assert.ok(header.includes('logoutAndRedirect("login")'));
    assert.ok(header.includes("createPortal"));
    assert.ok(!menu.includes("관리자 로그인"));
    assert.ok(!header.includes("admin-login"));
  });

  it("account profile page uses shell title without back link", () => {
    const page = readSource("src/app/(store)/account/profile/page.tsx");
    const top = readSource("src/components/TopStoreHeader.tsx");
    const chrome = readSource("src/lib/store-page-chrome.ts");
    const client = readSource("src/components/AccountProfilePageClient.tsx");
    assert.ok(page.includes("AccountProfilePageClient"));
    assert.ok(!page.includes("← 계정"));
    assert.ok(!page.includes("프로필 관리"));
    assert.ok(top.includes("resolveStorePageChrome"));
    assert.ok(chrome.includes("프로필 관리"));
    assert.ok(chrome.includes("별도 계정"));
    assert.ok(client.includes("StoreLoginForm"));
    assert.ok(client.includes("ProviderProfileForm"));
    assert.ok(client.includes("ACCOUNT_USER_NEEDS_PROVIDER_ACCOUNT"));
    assert.ok(client.includes("canEditProviderProfile"));
  });
});
