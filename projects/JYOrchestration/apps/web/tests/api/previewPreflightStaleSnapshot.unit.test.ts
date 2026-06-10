import { describe, expect, it } from "vitest";
import {
  isPreviewDeploymentPreflightSnapshotStale,
  resolvePreviewDeploymentPreflightStaleReason,
} from "@/lib/prototype/integrationPreviewPreflightState";

describe("previewPreflightStaleSnapshot", () => {
  it("1. treats missing checkedAt as stale", () => {
    expect(isPreviewDeploymentPreflightSnapshotStale({ checkedAt: null })).toBe(true);
    expect(resolvePreviewDeploymentPreflightStaleReason({ checkedAt: null })).toBe(
      "missing_checked_at",
    );
  });

  it("2. treats checkedAt before tokenUpdatedAt as stale", () => {
    expect(
      isPreviewDeploymentPreflightSnapshotStale({
        checkedAt: "2026-06-03T10:00:00.000Z",
        tokenUpdatedAt: "2026-06-03T10:05:00.000Z",
      }),
    ).toBe(true);
  });

  it("3. treats checkedAt before integrationRunStartedAt as stale", () => {
    expect(
      isPreviewDeploymentPreflightSnapshotStale({
        checkedAt: "2026-06-03T09:00:00.000Z",
        currentRunStartedAt: "2026-06-03T10:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("4. fresh passed snapshot within bounds is not stale", () => {
    const now = new Date().toISOString();
    expect(
      isPreviewDeploymentPreflightSnapshotStale({
        checkedAt: now,
        currentRunStartedAt: now,
        maxAgeMinutes: 10,
      }),
    ).toBe(false);
  });
});
