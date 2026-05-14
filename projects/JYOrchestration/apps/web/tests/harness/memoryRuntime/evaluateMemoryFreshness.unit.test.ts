import { describe, expect, it } from "vitest";

import {
  MEMORY_FRESHNESS_THRESHOLDS_MS,
  evaluateMemoryFreshness,
} from "@/lib/harness/memoryRuntime/evaluateMemoryFreshness";

const NOW = new Date("2026-05-14T00:00:00Z").getTime();

describe("evaluateMemoryFreshness", () => {
  it("returns fresh for references within the fresh upper bound", () => {
    const r = evaluateMemoryFreshness({
      lastReferencedAt: NOW - 60 * 60 * 1000,
      now: NOW,
    });
    expect(r.freshness).toBe("fresh");
    expect(r.reason).toBe("recent_within_24h");
  });

  it("returns aging for references between fresh and aging bounds", () => {
    const r = evaluateMemoryFreshness({
      lastReferencedAt: NOW - 3 * 24 * 60 * 60 * 1000,
      now: NOW,
    });
    expect(r.freshness).toBe("aging");
    expect(r.reason).toBe("within_14d");
  });

  it("returns stale for references older than aging bound", () => {
    const r = evaluateMemoryFreshness({
      lastReferencedAt: NOW - 30 * 24 * 60 * 60 * 1000,
      now: NOW,
    });
    expect(r.freshness).toBe("stale");
    expect(r.reason).toBe("older_than_14d");
  });

  it("demotes to stale on conflict regardless of recency", () => {
    const r = evaluateMemoryFreshness({
      lastReferencedAt: NOW - 60 * 1000,
      now: NOW,
      conflictDetected: true,
    });
    expect(r.freshness).toBe("stale");
    expect(r.reason).toBe("conflict_demoted");
  });

  it("returns aging with unknown_timestamp when lastReferencedAt is missing", () => {
    const r = evaluateMemoryFreshness({ lastReferencedAt: null, now: NOW });
    expect(r.freshness).toBe("aging");
    expect(r.reason).toBe("unknown_timestamp");
  });

  it("returns aging with future_timestamp for negative age", () => {
    const r = evaluateMemoryFreshness({
      lastReferencedAt: NOW + 60 * 1000,
      now: NOW,
    });
    expect(r.freshness).toBe("aging");
    expect(r.reason).toBe("future_timestamp");
  });

  it("accepts ISO strings and Date instances", () => {
    const r1 = evaluateMemoryFreshness({
      lastReferencedAt: new Date(NOW - 60 * 1000).toISOString(),
      now: new Date(NOW),
    });
    expect(r1.freshness).toBe("fresh");
    const r2 = evaluateMemoryFreshness({
      lastReferencedAt: new Date(NOW - MEMORY_FRESHNESS_THRESHOLDS_MS.agingUpperBoundMs - 1),
      now: new Date(NOW),
    });
    expect(r2.freshness).toBe("stale");
  });
});
