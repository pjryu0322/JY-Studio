import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { buildOverlayOperatorRuntimeSummaryVm } from "@/lib/overlay-ui/overlayOperatorRuntimeSummaryAdapter";
import { buildOverlayUiViewModel } from "@/lib/overlay-ui/overlayUiAdapter";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";

describe("buildOverlayOperatorRuntimeSummaryVm", () => {
  it("includes maturity and release gate labels", () => {
    const overlay: ExtractedOverlayPromptTraceMetadata = {
      overlayIdentity: { roleKey: "planner", perspective: "기획", provider: "openai", capabilities: [] },
    };
    const vm = buildOverlayUiViewModel(overlay);
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: overlay,
      messageExplainabilityAvailable: true,
    });
    const gate = evaluateHarnessReleaseGateReadiness(baseline);
    const s = buildOverlayOperatorRuntimeSummaryVm({
      overlay,
      summary: vm.summary,
      maturityBaseline: baseline,
      releaseGate: gate,
      messageExplainabilityAvailable: true,
    });
    expect(s.maturityOverallLabel.length).toBeGreaterThan(0);
    expect(s.releaseGateLabel.length).toBeGreaterThan(0);
    expect(s.explainabilitySurfaceLabel).toContain("연결");
  });
});
