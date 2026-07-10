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
  it("links header profile button to account profile", () => {
    const header = readSource("src/components/HeaderProfileButton.tsx");
    const top = readSource("src/components/TopStoreHeader.tsx");
    assert.ok(header.includes("ROUTES.accountProfile"));
    assert.ok(top.includes("HeaderProfileButton"));
    assert.equal(ROUTES.accountProfile, "/account/profile");
  });

  it("shows logout next to profile when logged in", () => {
    const header = readSource("src/components/HeaderProfileButton.tsx");
    assert.ok(header.includes("logoutStoreAccount"));
    assert.ok(header.includes("로그아웃"));
    assert.ok(header.includes("loggedIn"));
  });

  it("account profile page exists", () => {
    const page = readSource("src/app/(store)/account/profile/page.tsx");
    const client = readSource("src/components/AccountProfilePageClient.tsx");
    assert.ok(page.includes("AccountProfilePageClient"));
    assert.ok(client.includes("StoreLoginForm"));
    assert.ok(client.includes("ProviderProfileForm"));
  });
});
