import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  logSafeRouteError,
  sanitizeLogMessage,
  toSafeLogError,
} from "@/lib/safe-logging";

describe("safe logging", () => {
  it("returns only code/message/status/requestId", () => {
    const safe = toSafeLogError({
      code: "PACK_NOT_FOUND",
      message:
        "Authorization: Bearer secret-token DATABASE_URL=postgresql://user:pass@host/db",
      status: 404,
      requestId: "req_1",
      details: { body: "sensitive" },
      headers: { authorization: "Bearer secret" },
      stack: "stack...",
    });
    assert.equal(safe.code, "PACK_NOT_FOUND");
    assert.equal(safe.status, 404);
    assert.equal(safe.requestId, "req_1");
    assert.ok(!safe.message.includes("secret-token"));
    assert.ok(!safe.message.includes("postgresql://user:pass"));
    assert.equal("details" in safe, false);
    assert.equal("headers" in safe, false);
    assert.equal("stack" in safe, false);
  });

  it("masks Authorization Bearer and plain Bearer tokens", () => {
    const masked = sanitizeLogMessage(
      "Authorization: Bearer secret-token and also Bearer another-token",
    );
    assert.match(masked, /Authorization: Bearer \*\*\*/);
    assert.ok(!masked.includes("secret-token"));
    assert.ok(!masked.includes("another-token"));
  });

  it("masks API keys, DATABASE_URL, postgres URLs, and sk-* keys", () => {
    const masked = sanitizeLogMessage(
      "fail JYKSTORE_API_KEY=supersecret DATABASE_URL=other-secret postgres://user:pass@host/db sk-abcdefghijklmnopqrstuvwxyz",
    );
    assert.ok(!masked.includes("supersecret"));
    assert.ok(!masked.includes("other-secret"));
    assert.ok(!masked.includes("user:pass"));
    assert.ok(!masked.includes("sk-abcdefghijklmnopqrstuvwxyz"));
    assert.match(masked, /JYKSTORE_API_KEY=\*\*\*/);
    assert.match(masked, /DATABASE_URL=\*\*\*/);
    assert.match(masked, /postgresql:\/\/\*\*\*/);
    assert.match(masked, /sk-\*\*\*/);
  });

  it("truncates long messages to 300 chars", () => {
    const masked = sanitizeLogMessage("x".repeat(400));
    assert.equal(masked.length, 300);
  });

  it("logSafeRouteError does not pass raw error objects to console.error", () => {
    const calls: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      calls.push(args);
    };

    try {
      logSafeRouteError({
        scope: "export-chunk",
        method: "GET",
        path: "/api/v1/exports/rag-jsonl/chunk",
        requestId: "req_1",
        error: new Error("Authorization: Bearer secret-token"),
      });
      logSafeRouteError({
        scope: "api-key",
        method: "POST",
        path: "/api/v1/api-keys",
        requestId: "req_2",
        error: new Error("rawKey=jyk_live_secret DATABASE_URL=postgresql://user:pass@host/db"),
      });
      logSafeRouteError({
        scope: "admin-api-key",
        method: "GET",
        path: "/api/v1/admin/api-keys",
        error: new Error("Bearer leaked-token"),
      });
      logSafeRouteError({
        scope: "context",
        method: "GET",
        path: "/api/v1/packs/pack/context",
        error: new Error("Authorization: Bearer context-secret"),
      });
    } finally {
      console.error = original;
    }

    assert.equal(calls.length, 4);
    for (const call of calls) {
      assert.equal(call.length, 1);
      const line = String(call[0]);
      assert.ok(!line.includes("secret-token"));
      assert.ok(!line.includes("jyk_live_secret"));
      assert.ok(!line.includes("user:pass"));
      assert.ok(!line.includes("leaked-token"));
      assert.ok(!line.includes("context-secret"));
    }
    assert.ok(String(calls[1]![0]).includes("scope=api-key"));
    assert.ok(String(calls[2]![0]).includes("scope=admin-api-key"));
    assert.ok(String(calls[3]![0]).includes("scope=context"));
  });
});
