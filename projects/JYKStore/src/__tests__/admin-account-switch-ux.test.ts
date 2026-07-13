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
  it("admin switch logout targets shared login", async () => {
    assert.equal(logoutDestinationPath("login"), ROUTES.login);
    const redirects: string[] = [];
    const result = await performStoreLogout({
      destination: "login",
      logout: async () => undefined,
      redirect: (path) => redirects.push(path),
    });
    assert.equal(result.ok, true);
    assert.deepEqual(redirects, [ROUTES.login]);

    const failedRedirects: string[] = [];
    const failed = await performStoreLogout({
      destination: "login",
      logout: async () => {
        throw new Error("fail");
      },
      redirect: (path) => failedRedirects.push(path),
    });
    assert.equal(failed.ok, false);
    if (!failed.ok) {
      assert.equal(failed.code, "LOGOUT_FAILED");
      assert.ok(!failed.message.includes("fail"));
    }
    assert.deepEqual(failedRedirects, []);
  });

  it("AdminAccessGate distinguishes not logged in and non-admin sessions", () => {
    const gate = readSource("src/components/AdminAccessGate.tsx");
    assert.ok(gate.includes('status: "not_logged_in"'));
    assert.ok(gate.includes('status: "non_admin"'));
    assert.ok(gate.includes("관리자 계정으로 다시 로그인"));
    assert.ok(gate.includes("현재 계정 로그아웃"));
    assert.ok(gate.includes("useStoreLogout"));
    assert.ok(gate.includes('logoutAndRedirect("login")'));
    assert.ok(gate.includes("ROUTES.login"));
    assert.ok(gate.includes("result.ok"));
    assert.ok(gate.includes("현재 로그인 계정"));
    assert.ok(!gate.includes("ROUTES.adminLogin"));
  });

  it("shared StoreLoginForm is the only login entry for admin switch", () => {
    const loginPage = readSource("src/app/(store)/login/page.tsx");
    const legacyAdminLogin = readSource("src/app/(store)/admin/login/page.tsx");
    assert.ok(loginPage.includes("StoreLoginForm"));
    assert.ok(legacyAdminLogin.includes("redirect(ROUTES.login)"));
    assert.ok(!legacyAdminLogin.includes("AdminLoginForm"));
  });

  it("logout hook shares in-flight promise", () => {
    const hook = readSource("src/hooks/useStoreLogout.ts");
    assert.ok(hook.includes("createSharedLogoutExecutor"));
    assert.ok(hook.includes("inFlightPromiseRef") || hook.includes("sharedRef"));
    assert.ok(!/if \(inFlightRef\.current\) return/.test(hook));
  });

  it("logout route remains POST-only with matching cookie clear attrs", () => {
    const route = readSource("src/app/api/v1/auth/logout/route.ts");
    const cookie = readSource("src/lib/auth-cookie.ts");
    assert.ok(route.includes("export async function POST"));
    assert.ok(!route.includes("export async function GET"));
    assert.ok(route.includes("{ ok: true }") || route.includes("{ ok: true }"));
    assert.ok(cookie.includes('sameSite: "lax"'));
    assert.ok(cookie.includes('path: "/"'));
    assert.ok(cookie.includes("httpOnly: true"));
    assert.ok(cookie.includes("maxAge: 0"));
  });
});
