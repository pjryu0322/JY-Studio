/**
 * H10.5 — governance·rollback·auditability **계획 컨텍스트**를 한 번에 산출(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { evaluateRuntimeTrialReadiness } from "@/lib/harness/runtimeTrial/evaluateRuntimeTrialReadiness";
import type { RuntimeTrialReadinessReport } from "@/lib/harness/runtimeTrial/runtimeTrialTypes";
import { buildRuntimeGovernanceSummary } from "./buildRuntimeGovernanceSummary";
import { buildRollbackSafetyPlanning } from "./rollbackSafetyPlanning";
import { buildRuntimeAuditabilitySummary } from "./runtimeAuditabilityPlanning";
import type {
  RollbackSafetyPlanningReport,
  RuntimeAuditabilitySummary,
  RuntimeGovernanceSummary,
} from "./runtimeGovernanceTypes";

export type RuntimeGovernancePlanningContext = Readonly<{
  trialReadiness: RuntimeTrialReadinessReport;
  governance: RuntimeGovernanceSummary;
  rollbackSafety: RollbackSafetyPlanningReport;
  auditability: RuntimeAuditabilitySummary;
}>;

export function buildRuntimeGovernancePlanningContext(input: {
  readonly baseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
}): RuntimeGovernancePlanningContext {
  const trialReadiness = evaluateRuntimeTrialReadiness({
    baseline: input.baseline,
    releaseGate: input.releaseGate,
    extract: input.extract,
  });
  const govInput = {
    baseline: input.baseline,
    releaseGate: input.releaseGate,
    trialReadiness,
    extract: input.extract,
  };
  return {
    trialReadiness,
    governance: buildRuntimeGovernanceSummary(govInput),
    rollbackSafety: buildRollbackSafetyPlanning(govInput),
    auditability: buildRuntimeAuditabilitySummary(),
  };
}
