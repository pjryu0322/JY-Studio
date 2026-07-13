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
  it("links header profile menu to account profile and store routes", () => {
    const header = readSource("src/components/HeaderProfileButton.tsx");
    const top = readSource("src/components/TopStoreHeader.tsx");
    assert.ok(header.includes("accountMenuLinksForRole"));
    assert.ok(header.includes("ROUTES.login") || header.includes("accountProfile"));
    assert.ok(top.includes("HeaderProfileButton"));
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

  it("account profile page exists", () => {
    const page = readSource("src/app/(store)/account/profile/page.tsx");
    const client = readSource("src/components/AccountProfilePageClient.tsx");
    assert.ok(page.includes("AccountProfilePageClient"));
    assert.ok(client.includes("StoreLoginForm"));
    assert.ok(client.includes("ProviderProfileForm"));
  });
});
