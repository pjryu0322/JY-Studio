/**
 * H12 — stability·conflict·saturation **planning 보고서** 일괄 산출(H11 planning 컨텍스트 재사용).
 */

import type {
  HarnessMaturityBaselineReport,
  HarnessReleaseGateReadinessReport,
} from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { RuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import type { RuntimeEnforcementPlanningContext } from "@/lib/harness/runtimeEnforcement/buildRuntimeEnforcementPlanningContext";
import type { ControlledEnforcementGovernanceReport } from "@/lib/harness/enforcementGovernance/controlledEnforcementGovernanceTypes";
import type { GovernanceDependencyPlanningReport } from "@/lib/harness/enforcementGovernance/controlledEnforcementGovernanceTypes";
import { evaluateControlledEnforcementGovernance } from "@/lib/harness/enforcementGovernance/evaluateControlledEnforcementGovernance";
import { buildGovernanceDependencyPlanning } from "@/lib/harness/enforcementGovernance/buildGovernanceDependencyPlanning";
import { buildGovernanceRiskSummary } from "@/lib/harness/enforcementGovernance/governanceRiskSummary";
import { buildRuntimeEnforcementRiskSummary } from "@/lib/harness/runtimeEnforcement/runtimeEnforcementRiskSummary";
import { buildRuntimeRiskSummary } from "@/lib/harness/runtimeTrial/runtimeRiskSummary";
import { summarizeOverlayOverloadMitigation, type OverlayOverloadSummary } from "@/lib/overlay-ui/overlayOverloadMitigation";
import { evaluateCandidateSaturation } from "./evaluateCandidateSaturation";
import { evaluateRuntimeCandidateConflicts } from "./evaluateRuntimeCandidateConflicts";
import { buildRuntimeStabilitySummary } from "./buildRuntimeStabilitySummary";
import type {
  CandidateSaturationSummary,
  RuntimeCandidateConflictReport,
  RuntimeStabilitySummary,
} from "./runtimeStabilityTypes";

export type RuntimeStabilityPlanningReports = Readonly<{
  controlledGovernance: ControlledEnforcementGovernanceReport;
  dependencyPlanning: GovernanceDependencyPlanningReport;
  saturationSummary: CandidateSaturationSummary;
  conflictReport: RuntimeCandidateConflictReport;
  stabilitySummary: RuntimeStabilitySummary;
  overlayOverload: OverlayOverloadSummary;
}>;

export function buildRuntimeStabilityPlanningReports(input: {
  readonly baseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly governanceCtx: RuntimeGovernancePlanningContext;
  readonly enforcementPlanning: RuntimeEnforcementPlanningContext;
  readonly extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): RuntimeStabilityPlanningReports {
  const controlledGovernance = evaluateControlledEnforcementGovernance({
    releaseGate: input.releaseGate,
    governanceCtx: input.governanceCtx,
    candidateReport: input.enforcementPlanning.candidateReport,
    capabilityPlanning: input.enforcementPlanning.capabilityPlanning,
  });
  const dependencyPlanning = buildGovernanceDependencyPlanning({
    governanceCtx: input.governanceCtx,
    controlledGovernance,
  });
  const overlayOverload = summarizeOverlayOverloadMitigation({
    extract: input.extract,
    compactAndNarrowUi: input.compactAndNarrowUi ?? false,
  });
  const saturationSummary = evaluateCandidateSaturation({
    candidateReport: input.enforcementPlanning.candidateReport,
    capabilityPlanning: input.enforcementPlanning.capabilityPlanning,
    controlledGovernance,
    dependencyPlanning,
    extract: input.extract,
    overlayWarningCount: input.overlayWarningCount,
    overlayOverload,
  });
  const conflictReport = evaluateRuntimeCandidateConflicts({
    baseline: input.baseline,
    governanceCtx: input.governanceCtx,
    candidateReport: input.enforcementPlanning.candidateReport,
    capabilityPlanning: input.enforcementPlanning.capabilityPlanning,
    controlledGovernance,
    dependencyPlanning,
    extract: input.extract,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
    overlayWarningCount: input.overlayWarningCount,
    saturationLevel: saturationSummary.saturationLevel,
  });
  const stabilitySummary = buildRuntimeStabilitySummary({
    conflictReport,
    saturationSummary,
    enforcementRisk: buildRuntimeEnforcementRiskSummary({
      baseline: input.baseline,
      governanceCtx: input.governanceCtx,
      extract: input.extract,
      messageExplainabilityAvailable: input.messageExplainabilityAvailable,
      overlayWarningCount: input.overlayWarningCount,
    }),
    governanceRisk: buildGovernanceRiskSummary({
      baseline: input.baseline,
      governanceCtx: input.governanceCtx,
      candidateReport: input.enforcementPlanning.candidateReport,
      extract: input.extract,
      messageExplainabilityAvailable: input.messageExplainabilityAvailable,
      overlayWarningCount: input.overlayWarningCount,
    }),
    runtimeRisk: buildRuntimeRiskSummary({
      baseline: input.baseline,
      releaseGate: input.releaseGate,
      extract: input.extract,
    }),
  });

  return {
    controlledGovernance,
    dependencyPlanning,
    saturationSummary,
    conflictReport,
    stabilitySummary,
    overlayOverload,
  };
}
