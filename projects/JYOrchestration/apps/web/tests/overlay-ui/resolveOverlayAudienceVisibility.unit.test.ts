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

  it("hides context and budget for user audience (replay-style metadata)", () => {
    expect(isOverlaySectionVisibleForAudience("context", "user")).toBe(false);
    expect(isOverlaySectionVisibleForAudience("budget", "user")).toBe(false);
  });

  it("hides resource orchestration for user audience", () => {
    expect(isOverlaySectionVisibleForAudience("resource_orchestration", "user")).toBe(false);
  });

  it("hides operator resource summary for user audience", () => {
    expect(isOverlaySectionVisibleForAudience("operator_resource_summary", "user")).toBe(false);
  });

  it("hides runtime trial section for user audience", () => {
    expect(isOverlaySectionVisibleForAudience("runtime_trial", "user")).toBe(false);
  });

  it("hides runtime governance section for user audience", () => {
    expect(isOverlaySectionVisibleForAudience("runtime_governance", "user")).toBe(false);
  });

  it("hides runtime enforcement candidate section for user audience", () => {
    expect(isOverlaySectionVisibleForAudience("runtime_enforcement_candidate", "user")).toBe(false);
  });

  it("hides controlled enforcement governance section for user audience", () => {
    expect(isOverlaySectionVisibleForAudience("controlled_enforcement_governance", "user")).toBe(false);
  });

  it("hides runtime stability section for user audience", () => {
    expect(isOverlaySectionVisibleForAudience("runtime_stability", "user")).toBe(false);
  });

  it("hides runtime priority section for user audience", () => {
    expect(isOverlaySectionVisibleForAudience("runtime_priority", "user")).toBe(false);
  });

  it("hides runtime lifecycle section for user audience", () => {
    expect(isOverlaySectionVisibleForAudience("runtime_lifecycle", "user")).toBe(false);
  });

  it("shows all sections for operator", () => {
    expect(isOverlaySectionVisibleForAudience("review_security", "operator")).toBe(true);
  });
});
