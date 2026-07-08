import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADMIN_OPS_TOKEN_HEADER,
  isAdminOpsConfigured,
  verifyAdminOpsRequest,
} from "../../src/lib/admin-auth.ts";

function withEnv(overrides: Record<string, string | undefined>, run: () => void) {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];
    const next = overrides[key];
    if (next === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = next;
    }
  }
  try {
    run();
  } finally {
    for (const key of Object.keys(overrides)) {
      const prev = previous[key];
      if (prev === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = prev;
      }
    }
  }
}

describe("admin ops auth", () => {
  it("blocks when production has no token configured", () => {
    withEnv({ NODE_ENV: "production", JYKSTORE_ADMIN_OPS_TOKEN: "" }, () => {
      assert.equal(isAdminOpsConfigured(), false);
      const result = verifyAdminOpsRequest(new Request("http://localhost/api/v1/admin/api-keys"));
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.status, 403);
        assert.equal(result.code, "ADMIN_AUTH_REQUIRED");
        assert.ok(!result.message.includes("secret"));
      }
    });
  });

  it("allows development when token is unset (dev only)", () => {
    withEnv({ NODE_ENV: "development", JYKSTORE_ADMIN_OPS_TOKEN: undefined }, () => {
      const result = verifyAdminOpsRequest(new Request("http://localhost/api/v1/admin/api-keys"));
      assert.equal(result.ok, true);
    });
  });

  it("requires header when token is configured", () => {
    withEnv({ NODE_ENV: "test", JYKSTORE_ADMIN_OPS_TOKEN: "ops-token-value" }, () => {
      const missing = verifyAdminOpsRequest(new Request("http://localhost/api/v1/admin/api-keys"));
      assert.equal(missing.ok, false);
      if (!missing.ok) {
        assert.equal(missing.status, 401);
        assert.equal(missing.code, "ADMIN_AUTH_REQUIRED");
        assert.ok(!missing.message.includes("ops-token-value"));
      }
    });
  });

  it("rejects wrong token without leaking configured value", () => {
    withEnv({ NODE_ENV: "test", JYKSTORE_ADMIN_OPS_TOKEN: "ops-token-value" }, () => {
      const wrong = verifyAdminOpsRequest(
        new Request("http://localhost/api/v1/admin/api-keys", {
          headers: { [ADMIN_OPS_TOKEN_HEADER]: "wrong-token" },
        }),
      );
      assert.equal(wrong.ok, false);
      if (!wrong.ok) {
        assert.equal(wrong.status, 403);
        assert.equal(wrong.code, "ADMIN_AUTH_INVALID");
        assert.ok(!wrong.message.includes("ops-token-value"));
        assert.ok(!wrong.message.includes("wrong-token"));
      }
    });
  });

  it("accepts correct token via header", () => {
    withEnv({ NODE_ENV: "production", JYKSTORE_ADMIN_OPS_TOKEN: "ops-token-value" }, () => {
      assert.equal(isAdminOpsConfigured(), true);
      const ok = verifyAdminOpsRequest(
        new Request("http://localhost/api/v1/admin/api-keys", {
          headers: { "X-JYKStore-Admin-Token": "ops-token-value" },
        }),
      );
      assert.equal(ok.ok, true);
    });
  });
});
