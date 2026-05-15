import { describe, expect, it } from "vitest";

import { serializeOperatorRuntimeSummaryForDiagnostic } from "@/lib/overlay-ui/overlayOperatorResourceSummaryAdapter";
import { buildOverlayUiViewModel } from "@/lib/overlay-ui/overlayUiAdapter";
import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";

describe("serializeOperatorRuntimeSummaryForDiagnostic", () => {
  it("includes H8.5 labels and H9.5 resource fields", () => {
    const extract = {
      overlayIdentity: { roleKey: "planner", perspective: "기획", provider: "openai", capabilities: [] },
    };
    const vm = buildOverlayUiViewModel(extract);
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: extract,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const gate = evaluateHarnessReleaseGateReadiness(baseline);
    const s = serializeOperatorRuntimeSummaryForDiagnostic({
      overlay: extract,
      summary: vm.summary,
      maturityBaseline: baseline,
      releaseGate: gate,
      messageExplainabilityAvailable: true,
    });
    expect(s.maturityOverallLabel).toBeDefined();
    expect(s.resourcePressureSeverity).toBeDefined();
    expect(s.overloadRiskLabel).toBeDefined();
  });
});
