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

  it("account profile page exists", () => {
    const page = readSource("src/app/(store)/account/profile/page.tsx");
    const client = readSource("src/components/AccountProfilePageClient.tsx");
    assert.ok(page.includes("AccountProfilePageClient"));
    assert.ok(client.includes("loginStoreAccount"));
    assert.ok(client.includes("ProviderProfileForm"));
  });
});
