import { describe, expect, it } from "vitest";

import { buildOverlayRuntimeLimitedPilotBoundarySectionVm } from "@/lib/overlay-ui/overlayRuntimeLimitedPilotBoundaryAdapter";
import {
  RUNTIME_LIMITED_PILOT_BOUNDARY_OVERLAY_FOOTER_KO,
  RUNTIME_LIMITED_PILOT_BOUNDARY_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeLimitedPilotBoundary/runtimeLimitedPilotBoundaryLabelsKo";
import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimeLimitedPilotBoundarySectionVm", () => {
  it("includes required disclaimer", () => {
    const vm = buildOverlayRuntimeLimitedPilotBoundarySectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_LIMITED_PILOT_BOUNDARY_SECTION_DISCLAIMER_KO);
    expect(vm.candidateStatusKo.length).toBeGreaterThan(0);
    expect(vm.pilotBoundaryModeKo.length).toBeGreaterThan(0);
  });

  it("compact mode hides detail sections", () => {
    const full = buildOverlayRuntimeLimitedPilotBoundarySectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimeLimitedPilotBoundarySectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(full.showDetailSections).toBe(true);
    expect(compact.showDetailSections).toBe(false);
    expect(compact.inputContractRows.length).toBeLessThanOrEqual(1);
    expect(compact.readinessChecklistRows.length).toBeLessThanOrEqual(1);
  });

  it("compact mode displays candidate status, pilot boundary mode, and blocker or forbidden operation", () => {
    const vm = buildOverlayRuntimeLimitedPilotBoundarySectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(vm.candidateStatusKo).toBeTruthy();
    expect(vm.pilotBoundaryModeKo).toBeTruthy();
    expect(
      vm.topPilotBoundaryBlocker !== null || vm.topForbiddenPilotOperation !== null || vm.showAttention
    ).toBe(true);
  });

  it("overlay footer matches required no-enforcement disclaimer", () => {
    expect(RUNTIME_LIMITED_PILOT_BOUNDARY_OVERLAY_FOOTER_KO).toContain("actual orchestration");
    expect(RUNTIME_LIMITED_PILOT_BOUNDARY_OVERLAY_FOOTER_KO).toContain("prompt 변경은 없습니다");
  });
});
