import { describe, expect, it } from "vitest";

import { buildOverlayRuntimeNoopShellHardeningSectionVm } from "@/lib/overlay-ui/overlayRuntimeNoopShellHardeningAdapter";
import { RUNTIME_NOOP_SHELL_HARDENING_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeNoopShellHardening/runtimeNoopShellHardeningLabelsKo";
import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimeNoopShellHardeningSectionVm", () => {
  it("includes required disclaimer", () => {
    const vm = buildOverlayRuntimeNoopShellHardeningSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_NOOP_SHELL_HARDENING_SECTION_DISCLAIMER_KO);
    expect(vm.hardeningReadinessKo.length).toBeGreaterThan(0);
    expect(vm.hardeningModeKo.length).toBeGreaterThan(0);
  });

  it("compact mode hides detail sections", () => {
    const full = buildOverlayRuntimeNoopShellHardeningSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimeNoopShellHardeningSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(full.showDetailSections).toBe(true);
    expect(compact.showDetailSections).toBe(false);
    expect(compact.inputEnvelopeRows.length).toBeLessThanOrEqual(1);
    expect(compact.recommendationRows.length).toBeLessThanOrEqual(1);
  });

  it("compact mode displays hardening readiness, mode, preflight, final gate, and top blocker or attention", () => {
    const vm = buildOverlayRuntimeNoopShellHardeningSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(vm.hardeningReadinessKo).toBeTruthy();
    expect(vm.hardeningModeKo).toBeTruthy();
    expect(vm.preflightReadinessKo).toBeTruthy();
    expect(vm.finalGateStatusKo).toBeTruthy();
    expect(vm.h34EntryReadinessKo).toBeTruthy();
    expect(vm.topViolationOrBlocker !== null || vm.showAttention).toBe(true);
  });
});
