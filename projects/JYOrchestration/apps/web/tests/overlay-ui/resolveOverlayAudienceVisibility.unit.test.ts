import { describe, expect, it } from "vitest";

import { isOverlaySectionVisibleForAudience } from "@/lib/overlay-ui/resolveOverlayAudienceVisibility";

describe("isOverlaySectionVisibleForAudience", () => {
  it("hides advanced harness sections for user audience", () => {
    expect(isOverlaySectionVisibleForAudience("review_security", "user")).toBe(false);
    expect(isOverlaySectionVisibleForAudience("assembly_plan", "user")).toBe(false);
  });

  it("shows core diagnostics for user audience", () => {
    expect(isOverlaySectionVisibleForAudience("warning", "user")).toBe(true);
    expect(isOverlaySectionVisibleForAudience("maturity_baseline", "user")).toBe(true);
  });

  it("shows all sections for operator", () => {
    expect(isOverlaySectionVisibleForAudience("review_security", "operator")).toBe(true);
  });
});
