import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  accountMenuLinksForRole,
  accountRoleDisplayLabel,
  logoutDestinationPath,
} from "../lib/account-menu.ts";
import { performStoreLogout } from "../lib/store-logout.ts";
import { ROUTES } from "../lib/routes.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("account session exit UX", () => {
  it("maps logout destinations", () => {
    assert.equal(logoutDestinationPath("login"), ROUTES.login);
    assert.equal(logoutDestinationPath("admin-login"), ROUTES.adminLogin);
    assert.equal(logoutDestinationPath("home"), ROUTES.home);
  });

  it("builds role-specific account menus without unauthorized entries", () => {
    assert.deepEqual(
      accountMenuLinksForRole("USER").map((item) => item.label),
      ["계정 정보", "스토어 홈"],
    );
    assert.deepEqual(
      accountMenuLinksForRole("PROVIDER").map((item) => item.label),
      ["계정 정보", "제공자 정보", "제공자 센터", "스토어 홈"],
    );
    assert.deepEqual(
      accountMenuLinksForRole("ADMIN").map((item) => item.label),
      ["계정 정보", "관리자 콘솔", "검수 대기 목록", "스토어 홈"],
    );
    assert.ok(!accountMenuLinksForRole("USER").some((item) => item.href === ROUTES.admin));
    assert.ok(!accountMenuLinksForRole("USER").some((item) => item.href === ROUTES.provider));
    assert.equal(accountRoleDisplayLabel("USER"), "일반 사용자");
    assert.equal(accountRoleDisplayLabel("PROVIDER"), "제공자");
    assert.equal(accountRoleDisplayLabel("ADMIN"), "관리자");
  });

  it("redirects only after successful logout", async () => {
    const redirects: string[] = [];
    let calls = 0;
    const ok = await performStoreLogout({
      destination: "login",
      logout: async () => {
        calls += 1;
      },
      redirect: (path) => redirects.push(path),
    });
    assert.equal(ok.ok, true);
    assert.equal(calls, 1);
    assert.deepEqual(redirects, [ROUTES.login]);

    const redirectsFail: string[] = [];
    const failed = await performStoreLogout({
      destination: "login",
      logout: async () => {
        throw new Error("network");
      },
      redirect: (path) => redirectsFail.push(path),
    });
    assert.equal(failed.ok, false);
    if (!failed.ok) assert.equal(failed.message, "network");
    assert.deepEqual(redirectsFail, []);
  });

  it("header profile uses single account menu without adjacent logout button", () => {
    const header = readSource("src/components/HeaderProfileButton.tsx");
    assert.ok(header.includes("useStoreLogout"));
    assert.ok(header.includes("계정 메뉴 열기"));
    assert.ok(header.includes('aria-haspopup="menu"'));
    assert.ok(header.includes("현재 역할:"));
    assert.ok(header.includes("accountMenuLinksForRole"));
    assert.ok(!header.includes("logoutButton"));
    assert.ok(!header.includes("ProviderProfileEditor"));
    assert.ok(header.includes("z-[100]"));
    assert.ok(header.includes("로그아웃"));
  });
});
