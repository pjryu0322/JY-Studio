import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  isDisableRequiredSampleDataWiringForLegacyOnly,
  isRequiredPreviewSampleDataWiringEnabled,
} from "@/lib/prototype/integrationPreviewDeployPolicy";

describe("integrationPreviewSampleDataWiringRequired", () => {
  it("wiring is required by default", () => {
    const prev = process.env.JY_DISABLE_REQUIRED_PREVIEW_SAMPLE_WIRING;
    delete process.env.JY_DISABLE_REQUIRED_PREVIEW_SAMPLE_WIRING;
    expect(isRequiredPreviewSampleDataWiringEnabled()).toBe(true);
    expect(isDisableRequiredSampleDataWiringForLegacyOnly()).toBe(false);
    if (prev !== undefined) process.env.JY_DISABLE_REQUIRED_PREVIEW_SAMPLE_WIRING = prev;
  });

  it("deploy service runs required preview sample wiring path", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/lib/prototype/githubPagesPreviewDeploymentService.ts"),
      "utf8",
    );
    expect(src).toContain("required_preview_sample_wiring_started");
    expect(src).toContain("isRequiredPreviewSampleDataWiringEnabled");
  });

  it("app preview step blocks complete when sample data not rendered", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/lib/prototype/implementationAppPreviewTargetStepService.ts"),
      "utf8",
    );
    expect(src).toContain("applySampleDataGatesBeforePreviewComplete");
    expect(src).toContain("sample_data_not_rendered");
    expect(src).toContain("checkPreviewSampleDataRendered");
  });
});
