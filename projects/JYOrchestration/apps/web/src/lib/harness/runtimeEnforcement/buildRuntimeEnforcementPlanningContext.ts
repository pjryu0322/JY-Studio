/**
 * H11 — enforcement 후보·capability planning 공유 컨텍스트(H11 / H11.5 진단에서 1회 평가).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { RuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import type {
  CandidateCapabilityPlanningReport,
  RuntimeEnforcementCandidateReport,
} from "./runtimeEnforcementCandidateTypes";
import { buildCandidateCapabilityPlanning } from "./buildCandidateCapabilityPlanning";
import { evaluateRuntimeEnforcementCandidate } from "./evaluateRuntimeEnforcementCandidate";

export type RuntimeEnforcementPlanningContext = Readonly<{
  candidateReport: RuntimeEnforcementCandidateReport;
  capabilityPlanning: CandidateCapabilityPlanningReport;
}>;

export function buildRuntimeEnforcementPlanningContext(input: {
  readonly baseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly governanceCtx: RuntimeGovernancePlanningContext;
  readonly extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly messageExplainabilityAvailable: boolean;
}): RuntimeEnforcementPlanningContext {
  const candidateReport = evaluateRuntimeEnforcementCandidate({
    baseline: input.baseline,
    releaseGate: input.releaseGate,
    governanceCtx: input.governanceCtx,
    extract: input.extract,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
  });
  const capabilityPlanning = buildCandidateCapabilityPlanning({
    baseline: input.baseline,
    releaseGate: input.releaseGate,
    governanceCtx: input.governanceCtx,
    candidateReport,
    extract: input.extract,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
  });
  return { candidateReport, capabilityPlanning };
}
