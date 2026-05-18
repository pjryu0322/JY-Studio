import { describe, expect, it } from "vitest";

import { buildOverlayRuntimeControlledActivationCandidateSectionVm } from "@/lib/overlay-ui/overlayRuntimeControlledActivationCandidateAdapter";
import {
  RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_OVERLAY_FOOTER_KO,
  RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeControlledActivationCandidate/runtimeControlledActivationCandidateLabelsKo";
import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimeControlledActivationCandidateSectionVm", () => {
  it("includes required disclaimer", () => {
    const vm = buildOverlayRuntimeControlledActivationCandidateSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_SECTION_DISCLAIMER_KO);
    expect(vm.candidateStatusKo.length).toBeGreaterThan(0);
    expect(vm.activationModeKo.length).toBeGreaterThan(0);
  });

  it("compact mode hides detail sections", () => {
    const full = buildOverlayRuntimeControlledActivationCandidateSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimeControlledActivationCandidateSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(full.showDetailSections).toBe(true);
    expect(compact.showDetailSections).toBe(false);
    expect(compact.candidateScopeSummaryRows.length).toBeLessThanOrEqual(1);
    expect(compact.readinessChecklistRows.length).toBeLessThanOrEqual(1);
  });

  it("compact mode displays candidate status, activation mode, final gate, and blocker or forbidden operation", () => {
    const vm = buildOverlayRuntimeControlledActivationCandidateSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(vm.candidateStatusKo).toBeTruthy();
    expect(vm.activationModeKo).toBeTruthy();
    expect(vm.finalGateStatusKo).toBeTruthy();
    expect(vm.h42EntryReadinessKo).toBeTruthy();
    expect(
      vm.topViolationOrBlocker !== null ||
        vm.topForbiddenActivationOperation !== null ||
        vm.showAttention
    ).toBe(true);
  });

  it("overlay footer matches required no-enforcement disclaimer", () => {
    expect(RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_OVERLAY_FOOTER_KO).toContain("actual orchestration");
    expect(RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_OVERLAY_FOOTER_KO).toContain("prompt 변경은 없습니다");
  });
});
