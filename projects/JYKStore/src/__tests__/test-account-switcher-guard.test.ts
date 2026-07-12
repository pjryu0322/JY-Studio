import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import {
  canUseTestAccountSwitcher,
  isLocalTestAccountRequest,
  isTestAccountSwitcherConfigured,
} from "../lib/test-account-switcher.ts";

function req(url: string) {
  return new NextRequest(url);
}

describe("test-account-switcher guard", () => {
  it("enables only for development + flag + localhost", () => {
    const env = {
      NODE_ENV: "development",
      JYKSTORE_ENABLE_TEST_ACCOUNT_SWITCHER: "true",
    } as NodeJS.ProcessEnv;
    assert.equal(isTestAccountSwitcherConfigured(env), true);
    assert.equal(canUseTestAccountSwitcher(req("http://localhost:3004/api"), env), true);
  });

  it("disables when flag is false", () => {
    const env = {
      NODE_ENV: "development",
      JYKSTORE_ENABLE_TEST_ACCOUNT_SWITCHER: "false",
    } as NodeJS.ProcessEnv;
    assert.equal(isTestAccountSwitcherConfigured(env), false);
    assert.equal(canUseTestAccountSwitcher(req("http://localhost:3004/api"), env), false);
  });

  it("fails closed in production even when flag is true", () => {
    const env = {
      NODE_ENV: "production",
      JYKSTORE_ENABLE_TEST_ACCOUNT_SWITCHER: "true",
    } as NodeJS.ProcessEnv;
    assert.equal(isTestAccountSwitcherConfigured(env), false);
    assert.equal(canUseTestAccountSwitcher(req("http://localhost:3004/api"), env), false);
  });

  it("allows 127.0.0.1 and ::1", () => {
    const env = {
      NODE_ENV: "development",
      JYKSTORE_ENABLE_TEST_ACCOUNT_SWITCHER: "1",
    } as NodeJS.ProcessEnv;
    assert.equal(isLocalTestAccountRequest(req("http://127.0.0.1:3004/x")), true);
    assert.equal(canUseTestAccountSwitcher(req("http://127.0.0.1:3004/x"), env), true);
    assert.equal(isLocalTestAccountRequest(req("http://[::1]:3004/x")), true);
    assert.equal(canUseTestAccountSwitcher(req("http://[::1]:3004/x"), env), true);
  });

  it("rejects LAN and public hostnames", () => {
    const env = {
      NODE_ENV: "development",
      JYKSTORE_ENABLE_TEST_ACCOUNT_SWITCHER: "true",
    } as NodeJS.ProcessEnv;
    assert.equal(isLocalTestAccountRequest(req("http://192.168.1.10:3004/x")), false);
    assert.equal(canUseTestAccountSwitcher(req("http://192.168.1.10:3004/x"), env), false);
    assert.equal(isLocalTestAccountRequest(req("http://example.com/x")), false);
    assert.equal(canUseTestAccountSwitcher(req("http://example.com/x"), env), false);
  });
});
