import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { logoutDestinationPath } from "../lib/account-menu.ts";
import { performStoreLogout } from "../lib/store-logout.ts";
import { ROUTES } from "../lib/routes.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("admin account switch UX", () => {
  it("admin switch logout targets admin login", async () => {
    assert.equal(logoutDestinationPath("admin-login"), ROUTES.adminLogin);
    const redirects: string[] = [];
    const result = await performStoreLogout({
      destination: "admin-login",
      logout: async () => undefined,
      redirect: (path) => redirects.push(path),
    });
    assert.equal(result.ok, true);
    assert.deepEqual(redirects, [ROUTES.adminLogin]);

    const failedRedirects: string[] = [];
    const failed = await performStoreLogout({
      destination: "admin-login",
      logout: async () => {
        throw new Error("fail");
      },
      redirect: (path) => failedRedirects.push(path),
    });
    assert.equal(failed.ok, false);
    assert.deepEqual(failedRedirects, []);
  });

  it("AdminAccessGate distinguishes not logged in and non-admin sessions", () => {
    const gate = readSource("src/components/AdminAccessGate.tsx");
    assert.ok(gate.includes('status: "not_logged_in"'));
    assert.ok(gate.includes('status: "non_admin"'));
    assert.ok(gate.includes("관리자 계정으로 다시 로그인"));
    assert.ok(gate.includes("현재 계정 로그아웃"));
    assert.ok(gate.includes("useStoreLogout"));
    assert.ok(gate.includes('logoutAndRedirect("admin-login")'));
    assert.ok(gate.includes('logoutAndRedirect("login")'));
    assert.ok(gate.includes("현재 로그인 계정"));
    // Switch CTA must be a button action, not a plain Link.
    assert.ok(gate.includes("관리자 계정으로 다시 로그인"));
    assert.ok(!gate.includes('<Link\n            href={ROUTES.adminLogin}\n            className="mt-4'));
  });

  it("AdminLoginForm does not auto-register unknown emails as USER", () => {
    const form = readSource("src/components/AdminLoginForm.tsx");
    assert.ok(!form.includes("registerStoreAccount"));
    assert.ok(form.includes("등록된 관리자 계정이 아닙니다."));
    assert.ok(form.includes("fetchAuthSession"));
    assert.ok(form.includes("non_admin_session"));
    assert.ok(form.includes("loginStoreAccount"));
    assert.ok(form.includes("logoutStoreAccount"));
  });
});
