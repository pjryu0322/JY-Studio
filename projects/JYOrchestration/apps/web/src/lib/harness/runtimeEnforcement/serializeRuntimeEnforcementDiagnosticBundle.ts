/**
 * H11 — 진단 API용 enforcement 후보·위험·capability planning wire 묶음.
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { RuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import {
  buildCandidateCapabilityPlanning,
  serializeCandidateCapabilityPlanningForDiagnostic,
} from "./buildCandidateCapabilityPlanning";
import {
  evaluateRuntimeEnforcementCandidate,
  serializeRuntimeEnforcementCandidateForDiagnostic,
} from "./evaluateRuntimeEnforcementCandidate";
import {
  buildRuntimeEnforcementRiskSummary,
  serializeRuntimeEnforcementRiskSummaryForDiagnostic,
} from "./runtimeEnforcementRiskSummary";

export function serializeRuntimeEnforcementDiagnosticBundle(input: {
  readonly baseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly governanceCtx: RuntimeGovernancePlanningContext;
  readonly extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
}): Readonly<{
  runtimeEnforcementCandidate: ReturnType<typeof serializeRuntimeEnforcementCandidateForDiagnostic>;
  runtimeEnforcementRiskSummary: ReturnType<typeof serializeRuntimeEnforcementRiskSummaryForDiagnostic>;
  candidateCapabilityPlanning: ReturnType<typeof serializeCandidateCapabilityPlanningForDiagnostic>;
}> {
  const candidateReport = evaluateRuntimeEnforcementCandidate({
    baseline: input.baseline,
    releaseGate: input.releaseGate,
    governanceCtx: input.governanceCtx,
    extract: input.extract,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
  });
  const riskSummary = buildRuntimeEnforcementRiskSummary({
    baseline: input.baseline,
    governanceCtx: input.governanceCtx,
    extract: input.extract,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
    overlayWarningCount: input.overlayWarningCount,
  });
  const capabilityPlanning = buildCandidateCapabilityPlanning({
    baseline: input.baseline,
    releaseGate: input.releaseGate,
    governanceCtx: input.governanceCtx,
    candidateReport,
    extract: input.extract,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
  });

  return {
    runtimeEnforcementCandidate: serializeRuntimeEnforcementCandidateForDiagnostic(candidateReport),
    runtimeEnforcementRiskSummary: serializeRuntimeEnforcementRiskSummaryForDiagnostic(riskSummary),
    candidateCapabilityPlanning: serializeCandidateCapabilityPlanningForDiagnostic(capabilityPlanning),
  };
}
