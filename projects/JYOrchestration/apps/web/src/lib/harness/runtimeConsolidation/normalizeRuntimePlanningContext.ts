/**
 * H14.5 — planning context **1회 정규화**(stability→priority→lifecycle→coherence 단일 경로).
 */

import type {
  HarnessMaturityBaselineReport,
  HarnessReleaseGateReadinessReport,
} from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildRuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import { buildRuntimeEnforcementPlanningContext } from "@/lib/harness/runtimeEnforcement/buildRuntimeEnforcementPlanningContext";
import { buildRuntimeStabilityPlanningReports } from "@/lib/harness/runtimeStability/buildRuntimeStabilityPlanningReports";
import { buildRuntimePriorityPlanningReports } from "@/lib/harness/runtimePriority/buildRuntimePriorityPlanningReports";
import { buildRuntimeLifecyclePlanningReports } from "@/lib/harness/runtimeLifecycle/buildRuntimeLifecyclePlanningReports";
import { buildRuntimeCoherencePlanningReports } from "@/lib/harness/runtimeCoherence/buildRuntimeCoherencePlanningReports";
import type { RuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import type { RuntimeEnforcementPlanningContext } from "@/lib/harness/runtimeEnforcement/buildRuntimeEnforcementPlanningContext";
import type { NormalizedRuntimePlanningContext } from "./runtimePlanningConsolidationTypes";

export function normalizeRuntimePlanningContext(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
  readonly governanceCtx?: RuntimeGovernancePlanningContext;
  readonly enforcementPlanning?: RuntimeEnforcementPlanningContext;
}): NormalizedRuntimePlanningContext {
  const governanceCtx =
    input.governanceCtx ??
    buildRuntimeGovernancePlanningContext({
      baseline: input.maturityBaseline,
      releaseGate: input.releaseGate,
      extract: input.overlay,
    });
  const enforcementPlanning =
    input.enforcementPlanning ??
    buildRuntimeEnforcementPlanningContext({
      baseline: input.maturityBaseline,
      releaseGate: input.releaseGate,
      governanceCtx,
      extract: input.overlay,
      messageExplainabilityAvailable: input.messageExplainabilityAvailable,
    });
  const stabilityReports = buildRuntimeStabilityPlanningReports({
    baseline: input.maturityBaseline,
    releaseGate: input.releaseGate,
    governanceCtx,
    enforcementPlanning,
    extract: input.overlay,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
    overlayWarningCount: input.overlayWarningCount,
    compactAndNarrowUi: input.compactAndNarrowUi,
  });
  const priorityReports = buildRuntimePriorityPlanningReports({
    baseline: input.maturityBaseline,
    governanceCtx,
    stabilityReports,
    extract: input.overlay,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
  });
  const lifecycleReports = buildRuntimeLifecyclePlanningReports({
    governanceCtx,
    stabilityReports,
    priorityReports,
  });
  const coherenceReports = buildRuntimeCoherencePlanningReports({
    stabilityReports,
    priorityReports,
    lifecycleReports,
  });

  return {
    governanceCtx,
    enforcementPlanning,
    stabilityReports,
    priorityReports,
    lifecycleReports,
    coherenceReports,
  };
}
