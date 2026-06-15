import { describe, expect, it } from "vitest";
import {
  isDisableRequiredSampleDataWiringForLegacyOnly,
  isLegacyPreviewSampleWiringEnabled,
  isLegacyPreviewWiringPatchEnabled,
  isRequiredPreviewSampleDataWiringEnabled,
} from "@/lib/prototype/integrationPreviewDeployPolicy";

describe("integrationPreviewDeployPolicy", () => {
  it("enables required preview sample wiring by default", () => {
    const prevDisable = process.env.JY_DISABLE_REQUIRED_PREVIEW_SAMPLE_WIRING;
    const prevSample = process.env.JY_LEGACY_PREVIEW_SAMPLE_WIRING;
    const prevPatch = process.env.JY_LEGACY_PREVIEW_WIRING_PATCH;
    delete process.env.JY_DISABLE_REQUIRED_PREVIEW_SAMPLE_WIRING;
    delete process.env.JY_LEGACY_PREVIEW_SAMPLE_WIRING;
    delete process.env.JY_LEGACY_PREVIEW_WIRING_PATCH;
    expect(isRequiredPreviewSampleDataWiringEnabled()).toBe(true);
    expect(isLegacyPreviewSampleWiringEnabled()).toBe(true);
    expect(isLegacyPreviewWiringPatchEnabled()).toBe(true);
    if (prevDisable !== undefined) process.env.JY_DISABLE_REQUIRED_PREVIEW_SAMPLE_WIRING = prevDisable;
    if (prevSample !== undefined) process.env.JY_LEGACY_PREVIEW_SAMPLE_WIRING = prevSample;
    if (prevPatch !== undefined) process.env.JY_LEGACY_PREVIEW_WIRING_PATCH = prevPatch;
  });

  it("can disable required wiring for legacy-only via env", () => {
    const prevDisable = process.env.JY_DISABLE_REQUIRED_PREVIEW_SAMPLE_WIRING;
    process.env.JY_DISABLE_REQUIRED_PREVIEW_SAMPLE_WIRING = "1";
    expect(isDisableRequiredSampleDataWiringForLegacyOnly()).toBe(true);
    expect(isRequiredPreviewSampleDataWiringEnabled()).toBe(false);
    if (prevDisable === undefined) delete process.env.JY_DISABLE_REQUIRED_PREVIEW_SAMPLE_WIRING;
    else process.env.JY_DISABLE_REQUIRED_PREVIEW_SAMPLE_WIRING = prevDisable;
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
