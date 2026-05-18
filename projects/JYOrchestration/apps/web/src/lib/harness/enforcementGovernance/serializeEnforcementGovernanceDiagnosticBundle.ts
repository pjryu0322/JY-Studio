/**
 * H11.5 — 진단 API용 controlled enforcement governance wire 묶음.
 */

import type {
  HarnessMaturityBaselineReport,
  HarnessReleaseGateReadinessReport,
} from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { RuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import {
  buildRuntimeEnforcementPlanningContext,
  type RuntimeEnforcementPlanningContext,
} from "@/lib/harness/runtimeEnforcement/buildRuntimeEnforcementPlanningContext";
import { buildGovernanceDependencyPlanning, serializeGovernanceDependencyPlanningForDiagnostic } from "./buildGovernanceDependencyPlanning";
import {
  evaluateControlledEnforcementGovernance,
  serializeControlledEnforcementGovernanceForDiagnostic,
} from "./evaluateControlledEnforcementGovernance";
import { buildGovernanceRiskSummary, serializeGovernanceRiskSummaryForDiagnostic } from "./governanceRiskSummary";

export function serializeEnforcementGovernanceDiagnosticBundleFromEnforcementPlanning(input: {
  readonly baseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly governanceCtx: RuntimeGovernancePlanningContext;
  readonly enforcementPlanning: RuntimeEnforcementPlanningContext;
  readonly extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
}): Readonly<{
  controlledEnforcementGovernance: ReturnType<typeof serializeControlledEnforcementGovernanceForDiagnostic>;
  governanceDependencyPlanning: ReturnType<typeof serializeGovernanceDependencyPlanningForDiagnostic>;
  governanceRiskSummary: ReturnType<typeof serializeGovernanceRiskSummaryForDiagnostic>;
}> {
  const controlled = evaluateControlledEnforcementGovernance({
    releaseGate: input.releaseGate,
    governanceCtx: input.governanceCtx,
    candidateReport: input.enforcementPlanning.candidateReport,
    capabilityPlanning: input.enforcementPlanning.capabilityPlanning,
  });
  const dependencyPlanning = buildGovernanceDependencyPlanning({
    governanceCtx: input.governanceCtx,
    controlledGovernance: controlled,
  });
  const riskSummary = buildGovernanceRiskSummary({
    baseline: input.baseline,
    governanceCtx: input.governanceCtx,
    candidateReport: input.enforcementPlanning.candidateReport,
    extract: input.extract,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
    overlayWarningCount: input.overlayWarningCount,
  });

  return {
    controlledEnforcementGovernance: serializeControlledEnforcementGovernanceForDiagnostic(controlled),
    governanceDependencyPlanning: serializeGovernanceDependencyPlanningForDiagnostic(dependencyPlanning),
    governanceRiskSummary: serializeGovernanceRiskSummaryForDiagnostic(riskSummary),
  };
}

export function serializeEnforcementGovernanceDiagnosticBundle(input: {
  readonly baseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly governanceCtx: RuntimeGovernancePlanningContext;
  readonly extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
}): ReturnType<typeof serializeEnforcementGovernanceDiagnosticBundleFromEnforcementPlanning> {
  const enforcementPlanning = buildRuntimeEnforcementPlanningContext({
    baseline: input.baseline,
    releaseGate: input.releaseGate,
    governanceCtx: input.governanceCtx,
    extract: input.extract,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
  });
  return serializeEnforcementGovernanceDiagnosticBundleFromEnforcementPlanning({
    baseline: input.baseline,
    releaseGate: input.releaseGate,
    governanceCtx: input.governanceCtx,
    enforcementPlanning,
    extract: input.extract,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
    overlayWarningCount: input.overlayWarningCount,
  });
}
