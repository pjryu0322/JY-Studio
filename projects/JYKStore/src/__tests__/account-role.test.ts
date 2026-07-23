import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getAdminEmailAllowlist,
  isAdminAccountRole,
  isAdminEmailAllowlisted,
  parseAccountRole,
  parseSelectableAccountRole,
  postAuthLandingPath,
  resolveSessionAccountRole,
} from "../lib/account-role.ts";
import { ROUTES } from "../lib/routes.ts";

function withEnv(overrides: Record<string, string | undefined>, run: () => void) {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];
    const next = overrides[key];
    if (next === undefined) delete process.env[key];
    else process.env[key] = next;
  }
  try {
    run();
  } finally {
    for (const key of Object.keys(overrides)) {
      const prev = previous[key];
      if (prev === undefined) delete process.env[key];
      else process.env[key] = prev;
    }
  }
}

describe("account role helpers", () => {
  it("parses ADMIN role and allowlist emails", () => {
    assert.equal(parseAccountRole("admin"), "ADMIN");
    assert.equal(isAdminAccountRole("ADMIN"), true);
    assert.equal(isAdminAccountRole("PROVIDER"), false);

    withEnv({ JYKSTORE_ADMIN_EMAILS: "admin@jyk.store, Ops@Example.com" }, () => {
      assert.deepEqual(getAdminEmailAllowlist(), ["admin@jyk.store", "ops@example.com"]);
      assert.equal(isAdminEmailAllowlisted("Admin@jyk.store"), true);
      assert.equal(isAdminEmailAllowlisted("user@jyk.store"), false);
    });
  });

  it("resolves session role from stored account role only", () => {
    assert.equal(
      resolveSessionAccountRole({ storedRole: "ADMIN", hasProviderProfile: true }),
      "ADMIN",
    );
    assert.equal(
      resolveSessionAccountRole({ storedRole: "USER", hasProviderProfile: true }),
      "USER",
    );
    assert.equal(
      resolveSessionAccountRole({ storedRole: "PROVIDER", hasProviderProfile: false }),
      "PROVIDER",
    );
    assert.equal(
      resolveSessionAccountRole({ storedRole: "USER", hasProviderProfile: false }),
      "USER",
    );
  });

  it("maps selectable roles and post-auth landing paths", () => {
    assert.equal(parseSelectableAccountRole("PROVIDER"), "PROVIDER");
    assert.equal(parseSelectableAccountRole("ADMIN"), "ADMIN");
    assert.equal(parseSelectableAccountRole("USER"), "USER");
    assert.equal(postAuthLandingPath("USER"), ROUTES.home);
    assert.equal(postAuthLandingPath("PROVIDER"), ROUTES.provider);
    assert.equal(postAuthLandingPath("ADMIN"), ROUTES.admin);
  });
});
