import { describe, expect, it } from "vitest";
import { isLegacyPreviewWiringPatchEnabled } from "@/lib/prototype/integrationPreviewDeployPolicy";

describe("integrationPreviewDeployPolicy", () => {
  it("disables legacy wiring patch by default", () => {
    const prev = process.env.JY_LEGACY_PREVIEW_WIRING_PATCH;
    delete process.env.JY_LEGACY_PREVIEW_WIRING_PATCH;
    expect(isLegacyPreviewWiringPatchEnabled()).toBe(false);
    if (prev !== undefined) process.env.JY_LEGACY_PREVIEW_WIRING_PATCH = prev;
  });
});
