import { describe, expect, it } from "vitest";

import { buildOverlayRuntimeUltimateGovernanceReviewSectionVm } from "@/lib/overlay-ui/overlayRuntimeUltimateGovernanceReviewAdapter";
import {
  RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_OVERLAY_FOOTER_KO,
  RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeUltimateGovernanceReview/runtimeUltimateGovernanceReviewLabelsKo";
import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimeUltimateGovernanceReviewSectionVm", () => {
  it("includes required disclaimer", () => {
    const vm = buildOverlayRuntimeUltimateGovernanceReviewSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_SECTION_DISCLAIMER_KO);
    expect(vm.reviewStatusKo.length).toBeGreaterThan(0);
    expect(vm.reviewModeKo.length).toBeGreaterThan(0);
  });

  it("compact mode hides detail sections", () => {
    const full = buildOverlayRuntimeUltimateGovernanceReviewSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimeUltimateGovernanceReviewSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(full.showDetailSections).toBe(true);
    expect(compact.showDetailSections).toBe(false);
    expect(compact.inputEnvelopeRows.length).toBeLessThanOrEqual(1);
  });

  it("compact mode displays review status, mode, final gate, and blocker or attention", () => {
    const vm = buildOverlayRuntimeUltimateGovernanceReviewSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(vm.reviewStatusKo).toBeTruthy();
    expect(vm.reviewModeKo).toBeTruthy();
    expect(vm.finalGateStatusKo).toBeTruthy();
    expect(vm.topViolationOrBlocker !== null || vm.showAttention).toBe(true);
  });

  it("overlay footer matches required no-enforcement disclaimer", () => {
    expect(RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_OVERLAY_FOOTER_KO).toContain("actual orchestration");
    expect(RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_OVERLAY_FOOTER_KO).toContain("prompt 변경은 없습니다");
  });
});
