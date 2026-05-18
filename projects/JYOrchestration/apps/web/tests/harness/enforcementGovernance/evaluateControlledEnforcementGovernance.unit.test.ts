import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildRuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import { buildCandidateCapabilityPlanning } from "@/lib/harness/runtimeEnforcement/buildCandidateCapabilityPlanning";
import { evaluateRuntimeEnforcementCandidate } from "@/lib/harness/runtimeEnforcement/evaluateRuntimeEnforcementCandidate";
import {
  evaluateControlledEnforcementGovernance,
  serializeControlledEnforcementGovernanceForDiagnostic,
} from "@/lib/harness/enforcementGovernance/evaluateControlledEnforcementGovernance";

describe("evaluateControlledEnforcementGovernance", () => {
  it("never enables actual enforcement governance", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const governanceCtx = buildRuntimeGovernancePlanningContext({ baseline, releaseGate, extract: null });
    const candidateReport = evaluateRuntimeEnforcementCandidate({
      baseline,
      releaseGate,
      governanceCtx,
      extract: null,
      messageExplainabilityAvailable: true,
    });
    const capabilityPlanning = buildCandidateCapabilityPlanning({
      baseline,
      releaseGate,
      governanceCtx,
      candidateReport,
      extract: null,
      messageExplainabilityAvailable: true,
    });
    const r = evaluateControlledEnforcementGovernance({
      releaseGate,
      governanceCtx,
      candidateReport,
      capabilityPlanning,
    });
    expect(r.actualEnforcementGovernanceEnabled).toBe(false);
    expect(["disabled", "candidate_only", "planning_only"]).toContain(r.governanceMode);
    const w = serializeControlledEnforcementGovernanceForDiagnostic(r);
    expect(w.actualEnforcementGovernanceEnabled).toBe(false);
  });
});
