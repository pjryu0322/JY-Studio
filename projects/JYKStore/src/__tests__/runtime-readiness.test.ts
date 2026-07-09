import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkDatabaseReady,
  getRuntimeReadiness,
} from "../../src/lib/runtime-readiness.ts";
import { evaluateRuntimeEnv } from "../../src/lib/runtime-env.ts";

describe("runtime readiness", () => {
  it("checkDatabaseReady succeeds with mock probe", async () => {
    const result = await checkDatabaseReady({
      $queryRaw: async () => [{ "?column?": 1 }],
    });
    assert.equal(result.ok, true);
    assert.ok(typeof result.latencyMs === "number");
  });

  it("checkDatabaseReady fails safely when probe throws", async () => {
    const result = await checkDatabaseReady({
      $queryRaw: async () => {
        throw new Error("connection refused secret-token");
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, "DATABASE_UNAVAILABLE");
    assert.ok(!JSON.stringify(result).includes("secret-token"));
  });

  it("getRuntimeReadiness is not ok when env fails in production", async () => {
    const prev = {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL,
      JYKSTORE_API_KEY_SECRET: process.env.JYKSTORE_API_KEY_SECRET,
      JYKSTORE_ADMIN_OPS_TOKEN: process.env.JYKSTORE_ADMIN_OPS_TOKEN,
    };
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;
    delete process.env.JYKSTORE_API_KEY_SECRET;
    delete process.env.JYKSTORE_ADMIN_OPS_TOKEN;
    try {
      const readiness = await getRuntimeReadiness({
        $queryRaw: async () => [{ ok: 1 }],
      });
      assert.equal(readiness.ok, false);
      assert.equal(readiness.checks.env.ok, false);
      assert.ok(readiness.checks.env.missingRequired.length > 0);
      assert.equal(readiness.checks.database.ok, true);
      const serialized = JSON.stringify(readiness);
      assert.ok(!serialized.includes("postgresql://"));
    } finally {
      process.env.NODE_ENV = prev.NODE_ENV;
      if (prev.DATABASE_URL !== undefined) process.env.DATABASE_URL = prev.DATABASE_URL;
      else delete process.env.DATABASE_URL;
      if (prev.JYKSTORE_API_KEY_SECRET !== undefined) {
        process.env.JYKSTORE_API_KEY_SECRET = prev.JYKSTORE_API_KEY_SECRET;
      } else delete process.env.JYKSTORE_API_KEY_SECRET;
      if (prev.JYKSTORE_ADMIN_OPS_TOKEN !== undefined) {
        process.env.JYKSTORE_ADMIN_OPS_TOKEN = prev.JYKSTORE_ADMIN_OPS_TOKEN;
      } else delete process.env.JYKSTORE_ADMIN_OPS_TOKEN;
    }
  });

  it("evaluateRuntimeEnv and readiness configured flags align", async () => {
    const prev = {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL,
      JYKSTORE_API_KEY_SECRET: process.env.JYKSTORE_API_KEY_SECRET,
      JYKSTORE_ADMIN_OPS_TOKEN: process.env.JYKSTORE_ADMIN_OPS_TOKEN,
    };
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "postgresql://localhost/db";
    process.env.JYKSTORE_API_KEY_SECRET = "s";
    process.env.JYKSTORE_ADMIN_OPS_TOKEN = "t";
    try {
      const env = evaluateRuntimeEnv(process.env);
      assert.equal(env.ok, true);
      const readiness = await getRuntimeReadiness({
        $queryRaw: async () => [1],
      });
      assert.equal(readiness.configured.databaseUrl, true);
      assert.equal(readiness.configured.apiKeySecret, true);
      assert.equal(readiness.configured.adminOpsToken, true);
    } finally {
      process.env.NODE_ENV = prev.NODE_ENV;
      if (prev.DATABASE_URL !== undefined) process.env.DATABASE_URL = prev.DATABASE_URL;
      else delete process.env.DATABASE_URL;
      if (prev.JYKSTORE_API_KEY_SECRET !== undefined) {
        process.env.JYKSTORE_API_KEY_SECRET = prev.JYKSTORE_API_KEY_SECRET;
      } else delete process.env.JYKSTORE_API_KEY_SECRET;
      if (prev.JYKSTORE_ADMIN_OPS_TOKEN !== undefined) {
        process.env.JYKSTORE_ADMIN_OPS_TOKEN = prev.JYKSTORE_ADMIN_OPS_TOKEN;
      } else delete process.env.JYKSTORE_ADMIN_OPS_TOKEN;
    }
  });
});
