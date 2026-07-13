import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("test account quick login UX", () => {
  it("login page mounts switcher only when configured and keeps StoreLoginForm", () => {
    const page = readSource("src/app/(store)/login/page.tsx");
    assert.ok(page.includes("TestAccountQuickLogin"));
    assert.ok(page.includes("isTestAccountSwitcherConfigured"));
    assert.ok(page.includes("StoreLoginForm"));
    assert.ok(page.includes("getStoreAuthSessionFromCookies"));
    assert.ok(page.includes("postAuthLandingPath"));
  });

  it("admin login page redirects to shared store login", () => {
    const page = readSource("src/app/(store)/admin/login/page.tsx");
    assert.ok(page.includes("redirect(ROUTES.login)"));
    assert.ok(!page.includes("AdminLoginForm"));
    assert.ok(!page.includes("TestAccountQuickLogin"));
  });

  it("shows development-only copy, role groups, and CTA labels", () => {
    const ui = readSource("src/components/TestAccountQuickLogin.tsx");
    assert.ok(ui.includes("개발·테스트 전용"));
    assert.ok(ui.includes("관리자"));
    assert.ok(ui.includes("제공자"));
    assert.ok(ui.includes("일반 사용자"));
    assert.ok(ui.includes("관리자로 로그인"));
    assert.ok(ui.includes("제공자로 로그인"));
    assert.ok(ui.includes("일반 사용자로 로그인"));
    assert.ok(ui.includes("account.email"));
    assert.ok(ui.includes("roleLabel"));
    assert.ok(ui.includes("min-h-[44px]"));
    assert.ok(ui.includes("sm:grid-cols-2"));
  });

  it("calls login API, uses postAuthLandingPath, and locks busy selection", () => {
    const ui = readSource("src/components/TestAccountQuickLogin.tsx");
    assert.ok(ui.includes("loginWithTestAccount"));
    assert.ok(ui.includes("postAuthLandingPath"));
    assert.ok(ui.includes("router.replace"));
    assert.ok(ui.includes("router.refresh"));
    assert.ok(ui.includes("busyUserId"));
    assert.ok(ui.includes("disabled={busy}"));
    assert.ok(ui.includes("테스트 계정을 불러오지 못했습니다."));
    assert.ok(ui.includes("다시 시도"));
    assert.ok(ui.includes("선택한 계정으로 로그인하지 못했습니다."));
  });

  it("does not use browser storage or client redirect params", () => {
    const ui = readSource("src/components/TestAccountQuickLogin.tsx");
    const api = readSource("src/lib/test-account-api.ts");
    for (const source of [ui, api]) {
      assert.ok(!source.includes("localStorage"));
      assert.ok(!source.includes("sessionStorage"));
      assert.ok(!source.includes("indexedDB"));
    }
    assert.ok(api.includes('credentials: "include"'));
    assert.ok(api.includes('cache: "no-store"'));
    assert.ok(!api.includes("redirect"));
  });

  it("documents the flag in .env.example as off by default", () => {
    const env = readSource(".env.example");
    assert.ok(env.includes("JYKSTORE_ENABLE_TEST_ACCOUNT_SWITCHER=false"));
  });
});
