import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateRuntimeEnv } from "../../src/lib/runtime-env.ts";

describe("runtime env validation", () => {
  it("fails in production when DATABASE_URL is missing", () => {
    const result = evaluateRuntimeEnv({
      NODE_ENV: "production",
      JYKSTORE_API_KEY_SECRET: "secret",
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("DATABASE_URL")));
  });

  it("fails in production when JYKSTORE_API_KEY_SECRET is missing", () => {
    const result = evaluateRuntimeEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://localhost/db",
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("JYKSTORE_API_KEY_SECRET")));
  });

  it("allows missing required env in development with warnings", () => {
    const result = evaluateRuntimeEnv({ NODE_ENV: "development" });
    assert.equal(result.ok, true);
    assert.ok(result.warnings.length > 0);
  });

  it("flags invalid quota env in production", () => {
    const result = evaluateRuntimeEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://localhost/db",
      JYKSTORE_API_KEY_SECRET: "secret",
      JYKSTORE_QUOTA_PER_MINUTE: "0",
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("JYKSTORE_QUOTA_PER_MINUTE")));
  });

  it("does not include secret values in the result", () => {
    const secret = "super-secret-api-key-secret-value";
    const result = evaluateRuntimeEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@host/db",
      JYKSTORE_API_KEY_SECRET: secret,
    });
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes(secret));
    assert.ok(!serialized.includes("user:pass"));
  });
});
