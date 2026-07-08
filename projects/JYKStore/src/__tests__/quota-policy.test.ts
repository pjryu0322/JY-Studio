import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_QUOTA_POLICY,
  loadQuotaPolicy,
} from "../../src/lib/quota-policy.ts";

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

describe("quota policy", () => {
  it("defaults to FREE 30/min and 1000/day ENFORCE", () => {
    withEnv(
      {
        JYKSTORE_QUOTA_PER_MINUTE: undefined,
        JYKSTORE_QUOTA_PER_DAY: undefined,
        JYKSTORE_QUOTA_ENFORCEMENT: undefined,
      },
      () => {
        const policy = loadQuotaPolicy(process.env);
        assert.equal(policy.plan, DEFAULT_QUOTA_POLICY.plan);
        assert.equal(policy.perMinuteRequests, 30);
        assert.equal(policy.perDayRequests, 1000);
        assert.equal(policy.enforcement, "ENFORCE");
        assert.equal(policy.blockingEnabled, true);
      },
    );
  });

  it("accepts valid env overrides", () => {
    withEnv(
      {
        JYKSTORE_QUOTA_PER_MINUTE: "5",
        JYKSTORE_QUOTA_PER_DAY: "50",
        JYKSTORE_QUOTA_ENFORCEMENT: "WARN_ONLY",
      },
      () => {
        const policy = loadQuotaPolicy(process.env);
        assert.equal(policy.perMinuteRequests, 5);
        assert.equal(policy.perDayRequests, 50);
        assert.equal(policy.enforcement, "WARN_ONLY");
        assert.equal(policy.blockingEnabled, false);
      },
    );
  });

  it("falls back to defaults on invalid env", () => {
    withEnv(
      {
        JYKSTORE_QUOTA_PER_MINUTE: "0",
        JYKSTORE_QUOTA_PER_DAY: "-10",
        JYKSTORE_QUOTA_ENFORCEMENT: "FAST",
      },
      () => {
        const policy = loadQuotaPolicy(process.env);
        assert.equal(policy.perMinuteRequests, 30);
        assert.equal(policy.perDayRequests, 1000);
        assert.equal(policy.enforcement, "ENFORCE");
      },
    );
  });
});
