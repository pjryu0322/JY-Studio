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

describe("store entry login UX", () => {
  it("exposes /login and redirects home when logged out", () => {
    assert.equal(ROUTES.login, "/login");
    const home = readSource("src/app/(store)/page.tsx");
    const login = readSource("src/app/(store)/login/page.tsx");
    assert.ok(home.includes("getStoreAuthSessionFromCookies"));
    assert.ok(home.includes("ROUTES.login"));
    assert.ok(login.includes("StoreLoginForm"));
    assert.ok(login.includes("postAuthLandingPath"));
  });

  it("separates login and register actions", () => {
    const form = readSource("src/components/StoreLoginForm.tsx");
    assert.ok(form.includes(">로그인<") || form.includes('"로그인"'));
    assert.ok(form.includes("계정 생성"));
    assert.ok(!form.includes("로그인 / 계정 생성"));
    assert.ok(form.includes('mode: "login"') || form.includes('finish("login")'));
    assert.ok(form.includes("registerStoreAccount") || form.includes('finish("register")'));
  });

  it("lets register choose USER or PROVIDER and lands by role", () => {
    const form = readSource("src/components/StoreLoginForm.tsx");
    const login = readSource("src/app/(store)/login/page.tsx");
    assert.ok(form.includes("intendedRole"));
    assert.ok(form.includes("ACCOUNT_REGISTER_ROLE_USER"));
    assert.ok(form.includes("ACCOUNT_REGISTER_ROLE_PROVIDER"));
    assert.ok(form.includes("postAuthLandingPath"));
    assert.ok(login.includes("postAuthLandingPath"));
    assert.ok(login.includes("getStoreUserById"));
  });
});
