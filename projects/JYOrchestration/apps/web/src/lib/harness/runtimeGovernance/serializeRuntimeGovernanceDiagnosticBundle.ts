/**
 * H10.5 — governance planning 컨텍스트 → 진단 API wire 직렬화.
 */

import { serializeRuntimeGovernanceSummaryForDiagnostic } from "./buildRuntimeGovernanceSummary";
import { buildRuntimeGovernancePlanningContext } from "./buildRuntimeGovernancePlanningContext";
import { serializeRollbackSafetyPlanningForDiagnostic } from "./rollbackSafetyPlanning";
import { serializeRuntimeAuditabilitySummaryForDiagnostic } from "./runtimeAuditabilityPlanning";

export function serializeRuntimeGovernanceDiagnosticBundleFromContext(
  ctx: ReturnType<typeof buildRuntimeGovernancePlanningContext>
): Readonly<{
  runtimeGovernanceSummary: ReturnType<typeof serializeRuntimeGovernanceSummaryForDiagnostic>;
  rollbackSafetyPlanning: ReturnType<typeof serializeRollbackSafetyPlanningForDiagnostic>;
  runtimeAuditabilitySummary: ReturnType<typeof serializeRuntimeAuditabilitySummaryForDiagnostic>;
}> {
  return {
    runtimeGovernanceSummary: serializeRuntimeGovernanceSummaryForDiagnostic(ctx.governance),
    rollbackSafetyPlanning: serializeRollbackSafetyPlanningForDiagnostic(ctx.rollbackSafety),
    runtimeAuditabilitySummary: serializeRuntimeAuditabilitySummaryForDiagnostic(ctx.auditability),
  };
}

export function serializeRuntimeGovernanceDiagnosticBundle(input: Parameters<typeof buildRuntimeGovernancePlanningContext>[0]): Readonly<{
  runtimeGovernanceSummary: ReturnType<typeof serializeRuntimeGovernanceSummaryForDiagnostic>;
  rollbackSafetyPlanning: ReturnType<typeof serializeRollbackSafetyPlanningForDiagnostic>;
  runtimeAuditabilitySummary: ReturnType<typeof serializeRuntimeAuditabilitySummaryForDiagnostic>;
}> {
  return serializeRuntimeGovernanceDiagnosticBundleFromContext(buildRuntimeGovernancePlanningContext(input));
}
