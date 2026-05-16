/**
 * Harness planning report strip helpers for layer-isolated unit tests.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeSemanticPlanningReportsBeforeAdapterSandbox,
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
    runtimeAdapterSandboxSummary: _h,
    runtimeAdapterSandboxInputEnvelope: _i,
    runtimeAdapterSandboxOutputEnvelope: _j,
    runtimeAdapterSandboxPolicy: _k,
    runtimeAdapterSandboxResultMetadata: _l,
    runtimeAdapterSandboxBlockerReport: _m,
    ...before
  } = semantic;
  return before;
}

/** H26 adapter sandbox reports 제거 — noop adapter 이하 레이어 단독 테스트용. */
export function stripRuntimeAdapterSandboxLayer(
  semantic: RuntimeSemanticPlanningReports
): RuntimeSemanticPlanningReportsBeforeAdapterSandbox {
  const {
    runtimeAdapterSandboxSummary: _a,
    runtimeAdapterSandboxInputEnvelope: _b,
    runtimeAdapterSandboxOutputEnvelope: _c,
    runtimeAdapterSandboxPolicy: _d,
    runtimeAdapterSandboxResultMetadata: _e,
    runtimeAdapterSandboxBlockerReport: _f,
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
