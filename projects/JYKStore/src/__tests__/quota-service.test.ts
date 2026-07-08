import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_QUOTA_POLICY, type QuotaPolicy } from "../../src/lib/quota-policy.ts";
import {
  evaluateQuotaUsage,
  resolveTenantKey,
} from "../../src/lib/quota-service.ts";

describe("quota service helpers", () => {
  it("resolves tenantKey from clientId with apiKeyId fallback", () => {
    assert.equal(resolveTenantKey("client_a", "key_1"), "client_a");
    assert.equal(resolveTenantKey(null, "key_1"), "key_1");
    assert.equal(resolveTenantKey("  ", "key_1"), "key_1");
  });

  it("returns ok under limit", () => {
    const result = evaluateQuotaUsage({
      minuteCount: 1,
      dayCount: 10,
      policy: DEFAULT_QUOTA_POLICY,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.warning, undefined);
    }
  });

  it("emits warning at 80% threshold", () => {
    const result = evaluateQuotaUsage({
      minuteCount: 24,
      dayCount: 10,
      policy: DEFAULT_QUOTA_POLICY,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.warning, "NEAR_MINUTE_LIMIT");
    }
  });

  it("blocks per-minute exceed with 429 when ENFORCE", () => {
    const result = evaluateQuotaUsage({
      minuteCount: 30,
      dayCount: 10,
      policy: DEFAULT_QUOTA_POLICY,
      minuteWindowStartedAt: new Date(Date.now() - 10_000),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "QUOTA_EXCEEDED");
      assert.equal(result.reason, "PER_MINUTE");
      assert.ok(result.retryAfterSeconds >= 1);
    }
  });

  it("blocks per-day exceed with 429 when ENFORCE", () => {
    const result = evaluateQuotaUsage({
      minuteCount: 1,
      dayCount: 1000,
      policy: DEFAULT_QUOTA_POLICY,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "PER_DAY");
    }
  });

  it("WARN_ONLY allows exceed without blocking", () => {
    const policy: QuotaPolicy = {
      ...DEFAULT_QUOTA_POLICY,
      enforcement: "WARN_ONLY",
      blockingEnabled: false,
    };
    const result = evaluateQuotaUsage({
      minuteCount: 50,
      dayCount: 2000,
      policy,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.warning, "NEAR_MINUTE_LIMIT");
    }
  });
});
