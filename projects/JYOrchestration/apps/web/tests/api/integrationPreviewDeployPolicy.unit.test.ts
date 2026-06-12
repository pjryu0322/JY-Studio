import { describe, expect, it } from "vitest";
import {
  isLegacyPreviewSampleWiringEnabled,
  isLegacyPreviewWiringPatchEnabled,
} from "@/lib/prototype/integrationPreviewDeployPolicy";

describe("integrationPreviewDeployPolicy", () => {
  it("disables legacy preview sample wiring by default", () => {
    const prevSample = process.env.JY_LEGACY_PREVIEW_SAMPLE_WIRING;
    const prevPatch = process.env.JY_LEGACY_PREVIEW_WIRING_PATCH;
    delete process.env.JY_LEGACY_PREVIEW_SAMPLE_WIRING;
    delete process.env.JY_LEGACY_PREVIEW_WIRING_PATCH;
    expect(isLegacyPreviewSampleWiringEnabled()).toBe(false);
    expect(isLegacyPreviewWiringPatchEnabled()).toBe(false);
    if (prevSample !== undefined) process.env.JY_LEGACY_PREVIEW_SAMPLE_WIRING = prevSample;
    if (prevPatch !== undefined) process.env.JY_LEGACY_PREVIEW_WIRING_PATCH = prevPatch;
  });

  it("enables legacy wiring when JY_LEGACY_PREVIEW_SAMPLE_WIRING=1", () => {
    const prevSample = process.env.JY_LEGACY_PREVIEW_SAMPLE_WIRING;
    const prevPatch = process.env.JY_LEGACY_PREVIEW_WIRING_PATCH;
    delete process.env.JY_LEGACY_PREVIEW_WIRING_PATCH;
    process.env.JY_LEGACY_PREVIEW_SAMPLE_WIRING = "1";
    expect(isLegacyPreviewSampleWiringEnabled()).toBe(true);
    if (prevSample === undefined) delete process.env.JY_LEGACY_PREVIEW_SAMPLE_WIRING;
    else process.env.JY_LEGACY_PREVIEW_SAMPLE_WIRING = prevSample;
    if (prevPatch !== undefined) process.env.JY_LEGACY_PREVIEW_WIRING_PATCH = prevPatch;
  });
});
