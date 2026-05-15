/**
 * H12.5 — priority·escalation·bottleneck **planning 보고서** 일괄 산출(H12 stability 재사용).
 */

import type { HarnessMaturityBaselineReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { RuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import type { RuntimeStabilityPlanningReports } from "@/lib/harness/runtimeStability/buildRuntimeStabilityPlanningReports";
import { evaluateRuntimePlanningDependencies } from "./evaluateRuntimePlanningDependencies";
import { evaluateRuntimeEscalation } from "./evaluateRuntimeEscalation";
import { evaluateRuntimePlanningBottlenecks } from "./evaluateRuntimePlanningBottlenecks";
import type {
  RuntimeEscalationSummary,
  RuntimePlanningBottleneckSummary,
  RuntimePlanningDependencyReport,
} from "./runtimePriorityTypes";

export type RuntimePriorityPlanningReports = Readonly<{
  dependencyReport: RuntimePlanningDependencyReport;
  escalationSummary: RuntimeEscalationSummary;
  bottleneckSummary: RuntimePlanningBottleneckSummary;
}>;

export function buildRuntimePriorityPlanningReports(input: {
  readonly baseline: HarnessMaturityBaselineReport;
  readonly governanceCtx: RuntimeGovernancePlanningContext;
  readonly stabilityReports: RuntimeStabilityPlanningReports;
  readonly extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly messageExplainabilityAvailable: boolean;
}): RuntimePriorityPlanningReports {
  const dependencyReport = evaluateRuntimePlanningDependencies({
    baseline: input.baseline,
    governanceCtx: input.governanceCtx,
    stabilityReports: input.stabilityReports,
    extract: input.extract,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
  });
  const escalationSummary = evaluateRuntimeEscalation({
    stabilityReports: input.stabilityReports,
    dependencyReport,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
    userVisibleSummaryReady: input.baseline.userVisibleSummaryReady,
  });
  const bottleneckSummary = evaluateRuntimePlanningBottlenecks({
    baseline: input.baseline,
    governanceCtx: input.governanceCtx,
    stabilityReports: input.stabilityReports,
    escalationSummary,
    extract: input.extract,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
  });

  return { dependencyReport, escalationSummary, bottleneckSummary };
}
