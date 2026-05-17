import { describe, expect, it } from "vitest";

import { buildOverlayRuntimeControlledPilotExecutionCandidateSectionVm } from "@/lib/overlay-ui/overlayRuntimeControlledPilotExecutionCandidateAdapter";
import {
  RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_OVERLAY_FOOTER_KO,
  RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeControlledPilotExecutionCandidate/runtimeControlledPilotExecutionCandidateLabelsKo";
import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimeControlledPilotExecutionCandidateSectionVm", () => {
  it("includes required disclaimer", () => {
    const vm = buildOverlayRuntimeControlledPilotExecutionCandidateSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_SECTION_DISCLAIMER_KO);
    expect(vm.candidateStatusKo.length).toBeGreaterThan(0);
    expect(vm.executionModeKo.length).toBeGreaterThan(0);
  });

  it("compact mode hides detail sections", () => {
    const full = buildOverlayRuntimeControlledPilotExecutionCandidateSectionVm(
      buildDefaultOverlaySectionVmTestInput(false)
    );
    const compact = buildOverlayRuntimeControlledPilotExecutionCandidateSectionVm(
      buildDefaultOverlaySectionVmTestInput(true)
    );
    expect(full.showDetailSections).toBe(true);
    expect(compact.showDetailSections).toBe(false);
    expect(compact.candidateScopeRows.length).toBeLessThanOrEqual(1);
    expect(compact.readinessChecklistRows.length).toBeLessThanOrEqual(1);
    expect(compact.inputContractRows.length).toBeLessThanOrEqual(1);
    expect(compact.outputContractRows.length).toBeLessThanOrEqual(1);
  });

  it("compact mode displays candidate status, execution mode, final gate, and blocker or forbidden operation", () => {
    const vm = buildOverlayRuntimeControlledPilotExecutionCandidateSectionVm(
      buildDefaultOverlaySectionVmTestInput(true)
    );
    expect(vm.candidateStatusKo).toBeTruthy();
    expect(vm.executionModeKo).toBeTruthy();
    expect(vm.finalGateStatusKo).toBeTruthy();
    expect(
      vm.topViolationOrBlocker !== null ||
        vm.topForbiddenExecutionOperation !== null ||
        vm.showAttention
    ).toBe(true);
  });

  it("overlay footer matches required no-execution disclaimer", () => {
    expect(RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_OVERLAY_FOOTER_KO).toContain("pilot activation");
    expect(RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_OVERLAY_FOOTER_KO).toContain("prompt 변경은 없습니다");
  });
});
