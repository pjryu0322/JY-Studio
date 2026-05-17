import { describe, expect, it } from "vitest";

import { buildOverlayRuntimePilotExecutionReadinessSectionVm } from "@/lib/overlay-ui/overlayRuntimePilotExecutionReadinessAdapter";
import {
  RUNTIME_PILOT_EXECUTION_READINESS_OVERLAY_FOOTER_KO,
  RUNTIME_PILOT_EXECUTION_READINESS_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimePilotExecutionReadiness/runtimePilotExecutionReadinessLabelsKo";
import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimePilotExecutionReadinessSectionVm", () => {
  it("includes required disclaimer", () => {
    const vm = buildOverlayRuntimePilotExecutionReadinessSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_PILOT_EXECUTION_READINESS_SECTION_DISCLAIMER_KO);
    expect(vm.readinessStatusKo.length).toBeGreaterThan(0);
    expect(vm.readinessModeKo.length).toBeGreaterThan(0);
  });

  it("compact mode hides detail sections", () => {
    const full = buildOverlayRuntimePilotExecutionReadinessSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimePilotExecutionReadinessSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(full.showDetailSections).toBe(true);
    expect(compact.showDetailSections).toBe(false);
    expect(compact.inputEnvelopeRows.length).toBeLessThanOrEqual(1);
    expect(compact.readinessChecklistRows.length).toBeLessThanOrEqual(1);
  });

  it("compact mode displays readiness status, mode, and blocker or forbidden operation", () => {
    const vm = buildOverlayRuntimePilotExecutionReadinessSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(vm.readinessStatusKo).toBeTruthy();
    expect(vm.readinessModeKo).toBeTruthy();
    expect(
      vm.topReadinessBlocker !== null || vm.topForbiddenBoundaryOperation !== null || vm.showAttention
    ).toBe(true);
  });

  it("overlay footer matches required no-enforcement disclaimer", () => {
    expect(RUNTIME_PILOT_EXECUTION_READINESS_OVERLAY_FOOTER_KO).toContain("actual pilot activation");
    expect(RUNTIME_PILOT_EXECUTION_READINESS_OVERLAY_FOOTER_KO).toContain("prompt 변경은 없습니다");
  });
});
