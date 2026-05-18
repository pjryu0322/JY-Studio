import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { buildHarnessMaturityUiViewModel } from "@/lib/overlay-ui/harnessMaturityUiAdapter";

describe("buildHarnessMaturityUiViewModel", () => {
  it("returns empty VM when baseline missing", () => {
    const vm = buildHarnessMaturityUiViewModel(null, null);
    expect(vm.hasData).toBe(false);
    expect(vm.diagnosticDisclaimer).toContain("실제 실행 전환 허가");
  });

  it("builds rows and forbidden flags from reports", () => {
    const baseline = evaluateHarnessMaturityBaseline({ overlayExtract: null, messageExplainabilityAvailable: true });
    const gate = evaluateHarnessReleaseGateReadiness(baseline);
    const vm = buildHarnessMaturityUiViewModel(baseline, gate);
    expect(vm.hasData).toBe(true);
    expect(vm.layerRows.length).toBe(baseline.layers.length);
    expect(vm.forbiddenFlags.every((f) => f.value === "false")).toBe(true);
  });
});
