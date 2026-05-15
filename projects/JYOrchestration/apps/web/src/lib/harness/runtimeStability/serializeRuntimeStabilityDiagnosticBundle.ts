/**
 * H12 — 진단 API용 runtime stability wire 묶음(H11 planning 컨텍스트 재사용).
 */

import type {
  HarnessMaturityBaselineReport,
  HarnessReleaseGateReadinessReport,
} from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { RuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import type { RuntimeEnforcementPlanningContext } from "@/lib/harness/runtimeEnforcement/buildRuntimeEnforcementPlanningContext";
import {
  buildRuntimeStabilityPlanningReports,
  type RuntimeStabilityPlanningReports,
} from "./buildRuntimeStabilityPlanningReports";
import { serializeCandidateSaturationSummaryForDiagnostic } from "./evaluateCandidateSaturation";
import { serializeRuntimeCandidateConflictReportForDiagnostic } from "./evaluateRuntimeCandidateConflicts";
import { serializeRuntimeStabilitySummaryForDiagnostic } from "./buildRuntimeStabilitySummary";

export function serializeRuntimeStabilityDiagnosticBundleFromEnforcementPlanning(input: {
  readonly baseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly governanceCtx: RuntimeGovernancePlanningContext;
  readonly enforcementPlanning: RuntimeEnforcementPlanningContext;
  readonly extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
}): Readonly<{
  runtimeStabilitySummary: ReturnType<typeof serializeRuntimeStabilitySummaryForDiagnostic>;
  runtimeCandidateConflictReport: ReturnType<typeof serializeRuntimeCandidateConflictReportForDiagnostic>;
  candidateSaturationSummary: ReturnType<typeof serializeCandidateSaturationSummaryForDiagnostic>;
}> {
  const reports = buildRuntimeStabilityPlanningReports({
    ...input,
    compactAndNarrowUi: false,
  });
  return serializeRuntimeStabilityDiagnosticBundleFromReports(reports);
}

export function serializeRuntimeStabilityDiagnosticBundleFromReports(
  reports: RuntimeStabilityPlanningReports
): Readonly<{
  runtimeStabilitySummary: ReturnType<typeof serializeRuntimeStabilitySummaryForDiagnostic>;
  runtimeCandidateConflictReport: ReturnType<typeof serializeRuntimeCandidateConflictReportForDiagnostic>;
  candidateSaturationSummary: ReturnType<typeof serializeCandidateSaturationSummaryForDiagnostic>;
}> {
  return {
    runtimeStabilitySummary: serializeRuntimeStabilitySummaryForDiagnostic(reports.stabilitySummary),
    runtimeCandidateConflictReport: serializeRuntimeCandidateConflictReportForDiagnostic(reports.conflictReport),
    candidateSaturationSummary: serializeCandidateSaturationSummaryForDiagnostic(reports.saturationSummary),
  };
}

export function serializeRuntimeStabilityDiagnosticBundle(
  input: Parameters<typeof serializeRuntimeStabilityDiagnosticBundleFromEnforcementPlanning>[0]
): ReturnType<typeof serializeRuntimeStabilityDiagnosticBundleFromEnforcementPlanning> {
  return serializeRuntimeStabilityDiagnosticBundleFromEnforcementPlanning(input);
}
