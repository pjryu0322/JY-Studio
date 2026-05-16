import { describe, expect, it } from "vitest";

import { buildOverlayRuntimeNoopAdapterSectionVm } from "@/lib/overlay-ui/overlayRuntimeNoopAdapterAdapter";

import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimeNoopAdapterSectionVm", () => {
  it("includes disclaimer, preflight, and contract labels", () => {
    const vm = buildOverlayRuntimeNoopAdapterSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer.length).toBeGreaterThan(0);
    expect(vm.noopAdapterStatusKo.length).toBeGreaterThan(0);
    expect(vm.invocationGuardKo.length).toBeGreaterThan(0);
    expect(vm.contractVerificationStatusKo.length).toBeGreaterThan(0);
    expect(vm.preflightReadinessKo.length).toBeGreaterThan(0);
  });

  it("hides detail lists in compact narrow mode but keeps preflight row fields via compact header", () => {
    const full = buildOverlayRuntimeNoopAdapterSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimeNoopAdapterSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(compact.showDetailSections).toBe(false);
    expect(full.showDetailSections).toBe(true);
    expect(compact.preflightReadinessKo.length).toBeGreaterThan(0);
    expect(compact.topViolationOrBlocker === null || compact.topViolationOrBlocker.length > 0).toBe(true);
  });

  it("full mode exposes preflight checklist and blocker rows", () => {
    const vm = buildOverlayRuntimeNoopAdapterSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    expect(vm.preflightChecklistRows.length).toBeGreaterThan(0);
    expect(vm.topPreflightBlocker === null || typeof vm.topPreflightBlocker === "string").toBe(true);
  });
});
