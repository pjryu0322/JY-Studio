import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import {
  evaluateRuntimeTrialReadiness,
  serializeRuntimeTrialReadinessForDiagnostic,
} from "@/lib/harness/runtimeTrial/evaluateRuntimeTrialReadiness";

describe("evaluateRuntimeTrialReadiness", () => {
  it("marks not_prepared when release gate is not_ready", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: false,
    });
    const gate = evaluateHarnessReleaseGateReadiness(baseline);
    const r = evaluateRuntimeTrialReadiness({ baseline, releaseGate: gate, extract: null });
    expect(["not_prepared", "preparation_partial"]).toContain(r.readinessLevel);
    expect(r.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(serializeRuntimeTrialReadinessForDiagnostic(r).readinessLevel).toBe(r.readinessLevel);
  });
});
