import { describe, expect, it } from "vitest";

import { buildOverlayRuntimeLimitedPilotReadinessReviewSectionVm } from "@/lib/overlay-ui/overlayRuntimeLimitedPilotReadinessReviewAdapter";
import {
  RUNTIME_LIMITED_PILOT_READINESS_REVIEW_OVERLAY_FOOTER_KO,
  RUNTIME_LIMITED_PILOT_READINESS_REVIEW_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeLimitedPilotReadinessReview/runtimeLimitedPilotReadinessReviewLabelsKo";
import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimeLimitedPilotReadinessReviewSectionVm", () => {
  it("includes required disclaimer", () => {
    const vm = buildOverlayRuntimeLimitedPilotReadinessReviewSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_LIMITED_PILOT_READINESS_REVIEW_SECTION_DISCLAIMER_KO);
    expect(vm.reviewStatusKo.length).toBeGreaterThan(0);
    expect(vm.reviewModeKo.length).toBeGreaterThan(0);
  });

  it("compact mode hides detail sections", () => {
    const full = buildOverlayRuntimeLimitedPilotReadinessReviewSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimeLimitedPilotReadinessReviewSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(full.showDetailSections).toBe(true);
    expect(compact.showDetailSections).toBe(false);
    expect(compact.inputEnvelopeRows.length).toBeLessThanOrEqual(1);
    expect(compact.readinessChecklistRows.length).toBeLessThanOrEqual(1);
  });

  it("compact mode displays review status, review mode, and blocker or forbidden operation", () => {
    const vm = buildOverlayRuntimeLimitedPilotReadinessReviewSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(vm.reviewStatusKo).toBeTruthy();
    expect(vm.reviewModeKo).toBeTruthy();
    expect(
      vm.topBlockerOrForbidden !== null || vm.topForbiddenBoundaryOperation !== null || vm.showAttention
    ).toBe(true);
  });

  it("overlay footer matches required no-enforcement disclaimer", () => {
    expect(RUNTIME_LIMITED_PILOT_READINESS_REVIEW_OVERLAY_FOOTER_KO).toContain("actual pilot activation");
    expect(RUNTIME_LIMITED_PILOT_READINESS_REVIEW_OVERLAY_FOOTER_KO).toContain("prompt 변경은 없습니다");
  });
});
