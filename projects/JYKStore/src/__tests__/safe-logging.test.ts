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
    } finally {
      console.error = original;
    }

    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.length, 1);
    const line = String(calls[0]![0]);
    assert.ok(line.includes("scope=export-chunk"));
    assert.ok(line.includes("method=GET"));
    assert.ok(line.includes("path=/api/v1/exports/rag-jsonl/chunk"));
    assert.ok(line.includes("requestId=req_1"));
    assert.ok(line.includes("code="));
    assert.ok(!line.includes("secret-token"));
  });
});
