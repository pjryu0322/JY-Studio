/**
 * H14.5 — 진단 API용 consolidation wire 묶음.
 */

import type {
  HarnessMaturityBaselineReport,
  HarnessReleaseGateReadinessReport,
} from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildUnifiedRuntimePlanningSummary, serializeUnifiedRuntimePlanningSummaryForDiagnostic } from "./buildUnifiedRuntimePlanningSummary";
import { evaluateRuntimePlanningRedundancy, serializeRuntimePlanningRedundancySummaryForDiagnostic } from "./evaluateRuntimePlanningRedundancy";
import { normalizeRuntimePlanningContext } from "./normalizeRuntimePlanningContext";
import type { NormalizedRuntimePlanningContext } from "./runtimePlanningConsolidationTypes";

export function serializeRuntimeConsolidationDiagnosticBundleFromContext(
  ctx: NormalizedRuntimePlanningContext
): Readonly<{
  unifiedRuntimePlanningSummary: ReturnType<typeof serializeUnifiedRuntimePlanningSummaryForDiagnostic>;
  runtimePlanningRedundancySummary: ReturnType<typeof serializeRuntimePlanningRedundancySummaryForDiagnostic>;
}> {
  const unified = buildUnifiedRuntimePlanningSummary(ctx);
  const redundancy = evaluateRuntimePlanningRedundancy(ctx);

  return {
    unifiedRuntimePlanningSummary: serializeUnifiedRuntimePlanningSummaryForDiagnostic(unified),
    runtimePlanningRedundancySummary: serializeRuntimePlanningRedundancySummaryForDiagnostic(redundancy),
  };
}

export function serializeRuntimeConsolidationDiagnosticBundle(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): ReturnType<typeof serializeRuntimeConsolidationDiagnosticBundleFromContext> {
  return serializeRuntimeConsolidationDiagnosticBundleFromContext(normalizeRuntimePlanningContext(input));
}
