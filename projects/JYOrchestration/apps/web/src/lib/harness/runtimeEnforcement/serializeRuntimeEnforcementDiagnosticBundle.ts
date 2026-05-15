/**
 * H11 — 진단 API용 enforcement 후보·위험·capability planning wire 묶음.
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { RuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import { serializeCandidateCapabilityPlanningForDiagnostic } from "./buildCandidateCapabilityPlanning";
import {
  buildRuntimeEnforcementPlanningContext,
  type RuntimeEnforcementPlanningContext,
} from "./buildRuntimeEnforcementPlanningContext";
import { serializeRuntimeEnforcementCandidateForDiagnostic } from "./evaluateRuntimeEnforcementCandidate";
import {
  buildRuntimeEnforcementRiskSummary,
  serializeRuntimeEnforcementRiskSummaryForDiagnostic,
} from "./runtimeEnforcementRiskSummary";

export function serializeRuntimeEnforcementDiagnosticBundleFromPlanning(input: {
  readonly baseline: HarnessMaturityBaselineReport;
  readonly governanceCtx: RuntimeGovernancePlanningContext;
  readonly enforcementPlanning: RuntimeEnforcementPlanningContext;
  readonly extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
}): Readonly<{
  runtimeEnforcementCandidate: ReturnType<typeof serializeRuntimeEnforcementCandidateForDiagnostic>;
  runtimeEnforcementRiskSummary: ReturnType<typeof serializeRuntimeEnforcementRiskSummaryForDiagnostic>;
  candidateCapabilityPlanning: ReturnType<typeof serializeCandidateCapabilityPlanningForDiagnostic>;
}> {
  const riskSummary = buildRuntimeEnforcementRiskSummary({
    baseline: input.baseline,
    governanceCtx: input.governanceCtx,
    extract: input.extract,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
    overlayWarningCount: input.overlayWarningCount,
  });

  return {
    runtimeEnforcementCandidate: serializeRuntimeEnforcementCandidateForDiagnostic(
      input.enforcementPlanning.candidateReport
    ),
    runtimeEnforcementRiskSummary: serializeRuntimeEnforcementRiskSummaryForDiagnostic(riskSummary),
    candidateCapabilityPlanning: serializeCandidateCapabilityPlanningForDiagnostic(
      input.enforcementPlanning.capabilityPlanning
    ),
  };
}

export function serializeRuntimeEnforcementDiagnosticBundle(input: {
  readonly baseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly governanceCtx: RuntimeGovernancePlanningContext;
  readonly extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
}): ReturnType<typeof serializeRuntimeEnforcementDiagnosticBundleFromPlanning> {
  const enforcementPlanning = buildRuntimeEnforcementPlanningContext({
    baseline: input.baseline,
    releaseGate: input.releaseGate,
    governanceCtx: input.governanceCtx,
    extract: input.extract,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
  });
  return serializeRuntimeEnforcementDiagnosticBundleFromPlanning({
    baseline: input.baseline,
    governanceCtx: input.governanceCtx,
    enforcementPlanning,
    extract: input.extract,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
    overlayWarningCount: input.overlayWarningCount,
  });
}
