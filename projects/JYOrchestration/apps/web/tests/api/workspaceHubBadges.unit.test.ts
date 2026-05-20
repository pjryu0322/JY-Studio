import { describe, expect, it } from "vitest";
import { shouldShowWorkspaceHubNotificationBadges } from "@/lib/requirements/requirementsWorkspaceHelpers";

describe("shouldShowWorkspaceHubNotificationBadges", () => {
  it("hides badges when orchestration is at 0% with no slot progress", () => {
    expect(
      shouldShowWorkspaceHubNotificationBadges({
        readinessPercent: 0,
        statusCounts: { confirmed: 0, partial: 0, candidate: 0, stale: 0, empty: 8, total: 8 },
      }),
    ).toBe(false);
  });

  it("shows badges when any orchestration slot has progress", () => {
    expect(
      shouldShowWorkspaceHubNotificationBadges({
        readinessPercent: 0,
        statusCounts: { confirmed: 0, partial: 0, candidate: 1, stale: 0, empty: 7, total: 8 },
      }),
    ).toBe(true);
  });

  it("shows badges when weighted readiness is above 0", () => {
    expect(
      shouldShowWorkspaceHubNotificationBadges({
        readinessPercent: 12,
        statusCounts: { confirmed: 0, partial: 0, candidate: 0, stale: 0, empty: 8, total: 8 },
      }),
    ).toBe(true);
  });
});
