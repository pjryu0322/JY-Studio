import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { NextRequest } from "next/server";
import { GET as listTestAccountsGET } from "@/app/api/v1/dev/test-accounts/route";
import { POST as loginTestAccountPOST } from "@/app/api/v1/dev/test-accounts/login/route";
import { JYKSTORE_AUTH_SESSION_COOKIE } from "@/lib/auth-session";
import {
  canUseTestAccountSwitcher,
  isLocalTestAccountRequest,
  isPrivateOrLoopbackHostname,
} from "@/lib/test-account-switcher";
import type { TestAccountDto } from "@/lib/test-account-service";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  JYKSTORE_ENABLE_TEST_ACCOUNT_SWITCHER: process.env.JYKSTORE_ENABLE_TEST_ACCOUNT_SWITCHER,
};

afterEach(() => {
  process.env.NODE_ENV = originalEnv.NODE_ENV;
  if (originalEnv.JYKSTORE_ENABLE_TEST_ACCOUNT_SWITCHER === undefined) {
    delete process.env.JYKSTORE_ENABLE_TEST_ACCOUNT_SWITCHER;
  } else {
    process.env.JYKSTORE_ENABLE_TEST_ACCOUNT_SWITCHER =
      originalEnv.JYKSTORE_ENABLE_TEST_ACCOUNT_SWITCHER;
  }
});

function enableLocalDev() {
  process.env.NODE_ENV = "development";
  process.env.JYKSTORE_ENABLE_TEST_ACCOUNT_SWITCHER = "true";
}

const stubAccounts: TestAccountDto[] = [
  {
    id: "u-admin",
    displayName: "Admin",
    email: "admin@example.com",
    accountRole: "ADMIN",
    roleLabel: "관리자",
  },
];

describe("dev test-accounts API contracts", () => {
  it("list route is force-dynamic, no-store, and uses shared guard", () => {
    const source = readSource("src/app/api/v1/dev/test-accounts/route.ts");
    assert.ok(source.includes('export const dynamic = "force-dynamic"'));
    assert.ok(source.includes("Cache-Control"));
    assert.ok(source.includes("no-store"));
    assert.ok(source.includes("canUseTestAccountSwitcher"));
    assert.ok(source.includes("listTestAccounts"));
  });

  it("login route attaches session cookie without mutating users", () => {
    const login = readSource("src/app/api/v1/dev/test-accounts/login/route.ts");
    const service = readSource("src/lib/test-account-service.ts");
    assert.ok(login.includes("attachAuthSessionCookie"));
    assert.ok(login.includes("findTestAccountById"));
    assert.ok(login.includes("canUseTestAccountSwitcher"));
    assert.ok(login.includes("Cache-Control"));
    assert.ok(login.includes("no-store"));
    for (const banned of [
      "loginStoreUser",
      "registerStoreUser",
      "loginOrCreateStoreUser",
      "user.update",
      "user.upsert",
    ]) {
      assert.ok(!login.includes(banned), `login route must not call ${banned}`);
      assert.ok(!service.includes(banned), `service must not call ${banned}`);
    }
    assert.ok(service.includes("findUnique"));
    assert.ok(service.includes("findMany"));
    assert.ok(!service.includes("user.create"));
  });

  it("returns 404 when disabled", async () => {
    process.env.NODE_ENV = "development";
    process.env.JYKSTORE_ENABLE_TEST_ACCOUNT_SWITCHER = "false";
    const list = await listTestAccountsGET(
      new NextRequest("http://localhost:3004/api/v1/dev/test-accounts"),
    );
    assert.equal(list.status, 404);
    assert.equal(list.headers.get("Cache-Control"), "no-store");
    assert.equal((await list.json()).error, "NOT_FOUND");

    const login = await loginTestAccountPOST(
      new NextRequest("http://localhost:3004/api/v1/dev/test-accounts/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "any" }),
      }),
    );
    assert.equal(login.status, 404);
    assert.equal(login.headers.get("Cache-Control"), "no-store");
  });

  it("returns 404 in production even with flag true", async () => {
    process.env.NODE_ENV = "production";
    process.env.JYKSTORE_ENABLE_TEST_ACCOUNT_SWITCHER = "true";
    const list = await listTestAccountsGET(
      new NextRequest("http://localhost:3004/api/v1/dev/test-accounts"),
    );
    assert.equal(list.status, 404);

    const login = await loginTestAccountPOST(
      new NextRequest("http://localhost:3004/api/v1/dev/test-accounts/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "any" }),
      }),
    );
    assert.equal(login.status, 404);
  });

  it("allows private LAN and loopback hosts by pure guard (no DB)", () => {
    enableLocalDev();
    const env = process.env;
    assert.equal(isPrivateOrLoopbackHostname("192.168.0.5"), true);
    assert.equal(isPrivateOrLoopbackHostname("10.0.0.8"), true);
    assert.equal(isPrivateOrLoopbackHostname("172.16.1.2"), true);
    assert.equal(isPrivateOrLoopbackHostname("localhost"), true);
    assert.equal(isPrivateOrLoopbackHostname("example.com"), false);
    assert.equal(isPrivateOrLoopbackHostname("8.8.8.8"), false);

    assert.equal(
      isLocalTestAccountRequest(new NextRequest("http://192.168.0.5:3004/api/v1/dev/test-accounts")),
      true,
    );
    assert.equal(
      canUseTestAccountSwitcher(
        new NextRequest("http://192.168.0.5:3004/api/v1/dev/test-accounts"),
        env,
      ),
      true,
    );
    assert.equal(
      canUseTestAccountSwitcher(new NextRequest("http://localhost:3004/api/v1/dev/test-accounts"), env),
      true,
    );
  });

  it("allows private LAN list route with stubbed accounts (no Prisma)", async () => {
    enableLocalDev();
    const list = await listTestAccountsGET(
      new NextRequest("http://192.168.0.5:3004/api/v1/dev/test-accounts"),
      undefined,
      { listAccounts: async () => stubAccounts },
    );
    assert.equal(list.status, 200);
    assert.equal(list.headers.get("Cache-Control"), "no-store");
    const body = (await list.json()) as { accounts: TestAccountDto[] };
    assert.deepEqual(body.accounts, stubAccounts);
  });

  it("returns 404 for public internet hostnames", async () => {
    enableLocalDev();
    const list = await listTestAccountsGET(
      new NextRequest("http://example.com/api/v1/dev/test-accounts"),
      undefined,
      { listAccounts: async () => stubAccounts },
    );
    assert.equal(list.status, 404);

    const login = await loginTestAccountPOST(
      new NextRequest("http://example.com/api/v1/dev/test-accounts/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "any" }),
      }),
      undefined,
      { findAccountById: async () => null },
    );
    assert.equal(login.status, 404);
  });

  it("validates login body and missing users without setting cookie", async () => {
    enableLocalDev();
    const bad = await loginTestAccountPOST(
      new NextRequest("http://localhost:3004/api/v1/dev/test-accounts/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      undefined,
      { findAccountById: async () => null },
    );
    assert.equal(bad.status, 400);
    assert.equal(bad.headers.get("Cache-Control"), "no-store");
    assert.equal(bad.cookies.get(JYKSTORE_AUTH_SESSION_COOKIE)?.value, undefined);

    const missing = await loginTestAccountPOST(
      new NextRequest("http://localhost:3004/api/v1/dev/test-accounts/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "missing-user-that-does-not-exist" }),
      }),
      undefined,
      { findAccountById: async () => null },
    );
    assert.equal(missing.status, 404);
    assert.equal(missing.cookies.get(JYKSTORE_AUTH_SESSION_COOKIE)?.value, undefined);
    assert.equal(missing.headers.get("Cache-Control"), "no-store");
  });

  it("lists accounts with no-store when enabled on localhost", async () => {
    enableLocalDev();
    const response = await listTestAccountsGET(
      new NextRequest("http://localhost:3004/api/v1/dev/test-accounts"),
      undefined,
      { listAccounts: async () => stubAccounts },
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const body = (await response.json()) as {
      accounts: Array<Record<string, unknown>>;
    };
    assert.ok(Array.isArray(body.accounts));
    for (const account of body.accounts) {
      assert.ok(typeof account.id === "string");
      assert.ok(typeof account.displayName === "string");
      assert.ok(typeof account.email === "string");
      assert.ok(typeof account.accountRole === "string");
      assert.ok(typeof account.roleLabel === "string");
      assert.ok(!("password" in account));
      assert.ok(!("token" in account));
      assert.ok(!("sessionId" in account));
      assert.ok(!("apiKey" in account));
    }
  });
});
