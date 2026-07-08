import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  apiErrorResponse,
  buildQuotaUsageMetadata,
  mapAuthFailureToPublicCode,
} from "../../src/lib/public-api-handler.ts";
import type { QuotaCheckResult } from "../../src/lib/quota-service.ts";
import { DEFAULT_QUOTA_POLICY } from "../../src/lib/quota-policy.ts";

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

  it("buildQuotaUsageMetadata includes warning and limits for ok quota", () => {
    const quota = {
      ok: true as const,
      tenantKey: "client_a",
      policy: DEFAULT_QUOTA_POLICY,
      usage: {
        minuteCount: 25,
        dayCount: 400,
        perMinuteLimit: 30,
        perDayLimit: 1000,
      },
      warning: "NEAR_MINUTE_LIMIT" as const,
    } satisfies QuotaCheckResult;
    const meta = buildQuotaUsageMetadata(quota);
    assert.equal(meta.quotaWarning, "NEAR_MINUTE_LIMIT");
    assert.equal(meta.quotaMinuteCount, 25);
    assert.equal(meta.quotaDayCount, 400);
    assert.equal(meta.quotaPerMinuteLimit, 30);
    assert.equal(meta.quotaPerDayLimit, 1000);
    const serialized = JSON.stringify(meta);
    assert.ok(!serialized.includes("jyk_live_"));
    assert.ok(!serialized.includes("Bearer"));
    assert.ok(!serialized.includes("Authorization"));
  });

  it("buildQuotaUsageMetadata returns empty object without ok quota", () => {
    assert.deepEqual(buildQuotaUsageMetadata(undefined), {});
    const failed = {
      ok: false as const,
      tenantKey: "k1",
      status: 429 as const,
      code: "QUOTA_EXCEEDED" as const,
      message: "API quota를 초과했습니다.",
      policy: DEFAULT_QUOTA_POLICY,
      usage: {
        minuteCount: 31,
        dayCount: 10,
        perMinuteLimit: 30,
        perDayLimit: 1000,
      },
      retryAfterSeconds: 5,
      reason: "PER_MINUTE" as const,
    } satisfies QuotaCheckResult;
    assert.deepEqual(buildQuotaUsageMetadata(failed), {});
  });
});
