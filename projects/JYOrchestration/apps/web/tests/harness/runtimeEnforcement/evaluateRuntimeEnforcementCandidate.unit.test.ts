import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildRuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import {
  evaluateRuntimeEnforcementCandidate,
  serializeRuntimeEnforcementCandidateForDiagnostic,
} from "@/lib/harness/runtimeEnforcement/evaluateRuntimeEnforcementCandidate";

describe("evaluateRuntimeEnforcementCandidate", () => {
  it("never enables actual runtime enforcement", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const governanceCtx = buildRuntimeGovernancePlanningContext({
      baseline,
      releaseGate,
      extract: null,
    });
    const r = evaluateRuntimeEnforcementCandidate({
      baseline,
      releaseGate,
      governanceCtx,
      extract: null,
      messageExplainabilityAvailable: true,
    });
    expect(r.actualRuntimeEnforcementEnabled).toBe(false);
    expect(["disabled", "candidate_only", "planning_only"]).toContain(r.candidateMode);
    const w = serializeRuntimeEnforcementCandidateForDiagnostic(r);
    expect(w.actualRuntimeEnforcementEnabled).toBe(false);
  });
});
