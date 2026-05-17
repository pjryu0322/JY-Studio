import { describe, expect, it } from "vitest";

import { RUNTIME_PILOT_VALIDATION_READ_ONLY_CHAIN_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimePilotValidation/runtimePilotValidationLabelsKo";
import { buildOverlayRuntimePilotValidationReadOnlyChainSectionVm } from "@/lib/overlay-ui/overlayRuntimePilotValidationReadOnlyChainAdapter";
import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimePilotValidationReadOnlyChainSectionVm", () => {
  it("includes required disclaimer", () => {
    const vm = buildOverlayRuntimePilotValidationReadOnlyChainSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_PILOT_VALIDATION_READ_ONLY_CHAIN_SECTION_DISCLAIMER_KO);
    expect(vm.validationStatusKo.length).toBeGreaterThan(0);
    expect(vm.finalGateStatusKo.length).toBeGreaterThan(0);
  });

  it("compact mode hides detail sections and shows validation status", () => {
    const full = buildOverlayRuntimePilotValidationReadOnlyChainSectionVm(
      buildDefaultOverlaySectionVmTestInput(false)
    );
    const compact = buildOverlayRuntimePilotValidationReadOnlyChainSectionVm(
      buildDefaultOverlaySectionVmTestInput(true)
    );
    expect(full.showDetailSections).toBe(true);
    expect(compact.showDetailSections).toBe(false);
    expect(compact.validationStatusKo).toBeTruthy();
    expect(compact.finalGateStatusKo).toBeTruthy();
    expect(compact.finalProofSummaryRows.length).toBeLessThanOrEqual(1);
  });

  it("compact mode displays validation status, final gate, and top blocker or warning", () => {
    const vm = buildOverlayRuntimePilotValidationReadOnlyChainSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(vm.validationStatusKo).toBeTruthy();
    expect(vm.finalGateStatusKo).toBeTruthy();
    expect(vm.topBlocker !== null || vm.topWarning !== null || vm.showAttention).toBe(true);
  });
});
