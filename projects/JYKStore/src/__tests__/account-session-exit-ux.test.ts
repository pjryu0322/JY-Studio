import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  accountMenuLinksForRole,
  accountRoleDisplayLabel,
  logoutDestinationPath,
  PROVIDER_PROFILE_PATH,
} from "../lib/account-menu.ts";
import {
  createSharedLogoutExecutor,
  performStoreLogout,
} from "../lib/store-logout.ts";
import { ROUTES } from "../lib/routes.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("account session exit UX", () => {
  it("maps logout destinations", () => {
    assert.equal(logoutDestinationPath("login"), ROUTES.login);
    assert.equal(logoutDestinationPath("home"), ROUTES.home);
  });

  it("builds role-specific account menus without unauthorized entries", () => {
    assert.deepEqual(
      accountMenuLinksForRole("USER").map((item) => item.label),
      ["계정 정보", "스토어 홈"],
    );
    const provider = accountMenuLinksForRole("PROVIDER");
    assert.deepEqual(
      provider.map((item) => item.label),
      ["계정 정보", "제공자 정보", "제공자 센터", "스토어 홈"],
    );
    assert.equal(
      provider.find((item) => item.label === "제공자 정보")?.href,
      PROVIDER_PROFILE_PATH,
    );
    assert.equal(PROVIDER_PROFILE_PATH, `${ROUTES.accountProfile}#provider-profile`);
    assert.deepEqual(
      accountMenuLinksForRole("ADMIN").map((item) => item.label),
      ["계정 정보", "지식데이터 접수", "운영 사용량", "AuditLog", "Ops 대시보드", "검수 대기 목록", "스토어 홈"],
    );
    assert.equal(
      accountMenuLinksForRole("ADMIN").find((item) => item.label === "Ops 대시보드")?.href,
      ROUTES.adminOps,
    );
    assert.ok(!accountMenuLinksForRole("ADMIN").some((item) => item.label === "관리자 로그인"));
    assert.ok(!accountMenuLinksForRole("USER").some((item) => item.href === ROUTES.admin));
    assert.ok(!accountMenuLinksForRole("USER").some((item) => item.href === ROUTES.provider));
    assert.equal(accountRoleDisplayLabel("USER"), "일반 사용자");
    assert.equal(accountRoleDisplayLabel("PROVIDER"), "제공자");
    assert.equal(accountRoleDisplayLabel("ADMIN"), "관리자");
  });

  it("redirects only after successful logout with safe failure messages", async () => {
    const redirects: string[] = [];
    const refreshes: number[] = [];
    let calls = 0;
    const ok = await performStoreLogout({
      destination: "login",
      logout: async () => {
        calls += 1;
      },
      redirect: (path) => redirects.push(path),
      refresh: () => refreshes.push(1),
    });
    assert.equal(ok.ok, true);
    assert.equal(calls, 1);
    assert.deepEqual(redirects, [ROUTES.login]);
    assert.equal(refreshes.length, 1);

    const redirectsFail: string[] = [];
    const refreshesFail: number[] = [];
    const failed = await performStoreLogout({
      destination: "login",
      logout: async () => {
        throw new Error("secret stack / cookie abc");
      },
      redirect: (path) => redirectsFail.push(path),
      refresh: () => refreshesFail.push(1),
    });
    assert.equal(failed.ok, false);
    if (!failed.ok) {
      assert.equal(failed.code, "LOGOUT_FAILED");
      assert.equal(failed.message, "로그아웃에 실패했습니다. 다시 시도해 주세요.");
      assert.ok(!failed.message.includes("secret"));
      assert.ok(!failed.message.includes("cookie"));
    }
    assert.deepEqual(redirectsFail, []);
    assert.equal(refreshesFail.length, 0);
  });

  it("shares one in-flight logout promise across concurrent callers", async () => {
    let logoutCalls = 0;
    const redirects: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const shared = createSharedLogoutExecutor(async (destination) => {
      logoutCalls += 1;
      await gate;
      return performStoreLogout({
        destination,
        logout: async () => undefined,
        redirect: (path) => redirects.push(path),
      });
    });

    const first = shared("login");
    const second = shared("home");
    release();
    const [a, b] = await Promise.all([first, second]);
    assert.equal(logoutCalls, 1);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.deepEqual(redirects, [ROUTES.login]);

    let failCalls = 0;
    const failRedirects: string[] = [];
    let releaseFail!: () => void;
    const failGate = new Promise<void>((resolve) => {
      releaseFail = resolve;
    });
    const sharedFail = createSharedLogoutExecutor(async (destination) => {
      failCalls += 1;
      await failGate;
      return performStoreLogout({
        destination,
        logout: async () => {
          throw new Error("boom");
        },
        redirect: (path) => failRedirects.push(path),
      });
    });
    const f1 = sharedFail("login");
    const f2 = sharedFail("home");
    releaseFail();
    const [fa, fb] = await Promise.all([f1, f2]);
    assert.equal(failCalls, 1);
    assert.equal(fa.ok, false);
    assert.equal(fb.ok, false);
    assert.deepEqual(failRedirects, []);
  });

  it("header profile clears session only after logout success", () => {
    const header = readSource("src/components/HeaderProfileButton.tsx");
    assert.ok(header.includes("useStoreLogout"));
    assert.ok(header.includes("result.ok"));
    assert.ok(header.includes("setSession(emptySession)"));
    assert.ok(header.includes("계정 메뉴 열기"));
    assert.ok(header.includes('logoutAndRedirect("login")'));
    assert.ok(!header.includes("logoutButton"));
    assert.ok(!header.includes("ProviderProfileEditor"));
    assert.ok(!/if \(inFlightRef\.current\) return/.test(header));
  });

  it("AccountProfilePageClient uses shared logout hook", () => {
    const profile = readSource("src/components/AccountProfilePageClient.tsx");
    assert.ok(profile.includes("useStoreLogout"));
    assert.ok(!profile.includes("logoutStoreAccount"));
    assert.ok(profile.includes('logoutAndRedirect("login")'));
    assert.ok(profile.includes('id="provider-profile"'));
  });
});
