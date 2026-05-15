import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildRuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import { buildRuntimeEnforcementPlanningContext } from "@/lib/harness/runtimeEnforcement/buildRuntimeEnforcementPlanningContext";
import { evaluateControlledEnforcementGovernance } from "@/lib/harness/enforcementGovernance/evaluateControlledEnforcementGovernance";
import { buildGovernanceDependencyPlanning } from "@/lib/harness/enforcementGovernance/buildGovernanceDependencyPlanning";
import { evaluateRuntimeCandidateConflicts } from "@/lib/harness/runtimeStability/evaluateRuntimeCandidateConflicts";
import { evaluateCandidateSaturation } from "@/lib/harness/runtimeStability/evaluateCandidateSaturation";
import { summarizeOverlayOverloadMitigation } from "@/lib/overlay-ui/overlayOverloadMitigation";

describe("evaluateRuntimeCandidateConflicts", () => {
  it("never enables actual runtime enforcement", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const governanceCtx = buildRuntimeGovernancePlanningContext({ baseline, releaseGate, extract: null });
    const enforcementPlanning = buildRuntimeEnforcementPlanningContext({
      baseline,
      releaseGate,
      governanceCtx,
      extract: null,
      messageExplainabilityAvailable: true,
    });
    const controlled = evaluateControlledEnforcementGovernance({
      releaseGate,
      governanceCtx,
      candidateReport: enforcementPlanning.candidateReport,
      capabilityPlanning: enforcementPlanning.capabilityPlanning,
    });
    const dependencyPlanning = buildGovernanceDependencyPlanning({ governanceCtx, controlledGovernance: controlled });
    const saturation = evaluateCandidateSaturation({
      candidateReport: enforcementPlanning.candidateReport,
      capabilityPlanning: enforcementPlanning.capabilityPlanning,
      controlledGovernance: controlled,
      dependencyPlanning,
      extract: null,
      overlayWarningCount: 0,
      overlayOverload: summarizeOverlayOverloadMitigation({ extract: null }),
    });
    const r = evaluateRuntimeCandidateConflicts({
      baseline,
      governanceCtx,
      candidateReport: enforcementPlanning.candidateReport,
      capabilityPlanning: enforcementPlanning.capabilityPlanning,
      controlledGovernance: controlled,
      dependencyPlanning,
      extract: null,
      messageExplainabilityAvailable: true,
      overlayWarningCount: 0,
      saturationLevel: saturation.saturationLevel,
    });
    expect(r.actualRuntimeEnforcementEnabled).toBe(false);
    expect(["low", "medium", "high"]).toContain(r.severity);
  });
});
