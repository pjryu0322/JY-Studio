import { describe, expect, it } from "vitest";

import { buildOverlayRuntimeAdapterSandboxSectionVm } from "@/lib/overlay-ui/overlayRuntimeAdapterSandboxAdapter";

import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimeAdapterSandboxSectionVm", () => {
  it("includes disclaimer, readiness, preflight, and envelope labels", () => {
    const vm = buildOverlayRuntimeAdapterSandboxSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer.length).toBeGreaterThan(0);
    expect(vm.sandboxReadinessKo.length).toBeGreaterThan(0);
    expect(vm.sandboxModeKo.length).toBeGreaterThan(0);
    expect(vm.sandboxPreflightReadinessKo.length).toBeGreaterThan(0);
    expect(vm.envelopeVerificationStatusKo.length).toBeGreaterThan(0);
  });

  it("hides detail lists in compact narrow mode", () => {
    const full = buildOverlayRuntimeAdapterSandboxSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimeAdapterSandboxSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(compact.showDetailSections).toBe(false);
    expect(full.showDetailSections).toBe(true);
    expect(compact.sandboxReadinessKo.length).toBeGreaterThan(0);
    expect(compact.sandboxPreflightReadinessKo.length).toBeGreaterThan(0);
    expect(compact.topViolationOrBlocker === null || compact.topViolationOrBlocker.length > 0).toBe(true);
  });

  it("full mode exposes envelope rows", () => {
    const vm = buildOverlayRuntimeAdapterSandboxSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    expect(vm.inputEnvelopeSummaryRows.length).toBeGreaterThan(0);
    expect(vm.forbiddenSandboxOperationRows.length).toBeGreaterThan(0);
  });
});
