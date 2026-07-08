import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { apiErrorResponse, mapAuthFailureToPublicCode } from "../../src/lib/public-api-handler.ts";

describe("public api quota response helpers", () => {
  it("builds 429 QUOTA_EXCEEDED response without leaking secrets", async () => {
    const response = apiErrorResponse(
      "req_test",
      "QUOTA_EXCEEDED",
      "API quota를 초과했습니다.",
      429,
      undefined,
      {
        reason: "PER_MINUTE",
        retryAfterSeconds: 42,
        quota: {
          minuteCount: 31,
          perMinuteLimit: 30,
          dayCount: 100,
          perDayLimit: 1000,
        },
      },
    );
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("Retry-After"), "42");
    const body = (await response.json()) as {
      error: Record<string, unknown>;
      usage: Record<string, unknown>;
    };
    assert.equal(body.error.code, "QUOTA_EXCEEDED");
    assert.equal(body.error.reason, "PER_MINUTE");
    assert.equal(body.usage.requestId, "req_test");
    const serialized = JSON.stringify(body);
    assert.ok(!serialized.includes("jyk_live_"));
    assert.ok(!serialized.includes("Bearer"));
    assert.ok(!serialized.includes("Authorization"));
  });

  it("keeps auth failure mapping independent from quota", () => {
    assert.equal(mapAuthFailureToPublicCode("INSUFFICIENT_SCOPE"), "INSUFFICIENT_SCOPE");
  });
});
