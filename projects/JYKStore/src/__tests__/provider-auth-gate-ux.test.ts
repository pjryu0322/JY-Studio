import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { LOGIN_REQUIRED_ERROR } from "../lib/auth-guard.ts";
import { isLoggedInRequest } from "../lib/auth-session.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("provider auth gate UX", () => {
  it("exposes login required error code for APIs", () => {
    assert.equal(LOGIN_REQUIRED_ERROR.error, "LOGIN_REQUIRED");
  });

  it("Provider Center has login CTA without inline profile form", () => {
    const center = readSource("src/components/ProviderCenterPageClient.tsx");
    assert.ok(center.includes("notLoggedIn"));
    assert.ok(center.includes("PROVIDER_CENTER_LOGIN_CTA"));
    assert.ok(!center.includes("프로필 수정"));
    assert.ok(!center.includes("ProviderProfileForm"));
  });

  it("pack new page gates login and provider profile", () => {
    const packNew = readSource("src/app/(store)/provider/packs/new/page.tsx");
    assert.ok(packNew.includes("AuthRequiredCard"));
    assert.ok(packNew.includes("ProviderRequiredCard"));
    assert.ok(packNew.includes("getUserIdFromCookies"));
  });

  it("provider API routes require login helper", () => {
    const packs = readSource("src/app/api/v1/provider/packs/route.ts");
    assert.ok(packs.includes("requireLoggedInRequest"));
  });
});

describe("isLoggedInRequest", () => {
  it("returns false without session cookie", () => {
    const request = {
      cookies: { get: () => undefined },
    } as unknown as import("next/server").NextRequest;
    assert.equal(isLoggedInRequest(request), false);
  });
});
