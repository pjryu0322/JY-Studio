/**
 * Harness planning report strip helpers for layer-isolated unit tests.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeSemanticPlanningReportsBeforeNoopAdapter,
  RuntimeSemanticPlanningReportsBeforePilotContract,
} from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";

/** H25 noop adapter reports 제거 — pilot contract 이하 레이어 단독 테스트용. */
export function stripRuntimeNoopAdapterLayer(
  semantic: RuntimeSemanticPlanningReports
): RuntimeSemanticPlanningReportsBeforeNoopAdapter {
  const {
    runtimeNoopAdapterSummary: _a,
    runtimeNoopAdapterSkeleton: _b,
    runtimePilotContractVerificationReport: _c,
    runtimeNoopAdapterResultMetadata: _d,
    runtimeAdapterInvocationGuardReport: _e,
    runtimeNoopAdapterBoundaryViolationReport: _f,
    runtimeNoopAdapterPreflightSummary: _g,
    ...before
  } = semantic;
  return before;
}

/** H24.5 pilot contract + H25 noop adapter reports 제거. */
export function stripRuntimePilotContractLayer(
  semantic: RuntimeSemanticPlanningReports
): RuntimeSemanticPlanningReportsBeforePilotContract {
  const {
    runtimePilotContractSummary: _a,
    runtimePilotContractInputSchema: _b,
    runtimePilotContractOutputSchema: _c,
    runtimeAdapterBoundarySummary: _d,
    runtimeAdapterForbiddenOperationReport: _e,
    runtimePilotHandoffReadiness: _f,
    ...beforeNoop
  } = stripRuntimeNoopAdapterLayer(semantic);
  return beforeNoop;
}
