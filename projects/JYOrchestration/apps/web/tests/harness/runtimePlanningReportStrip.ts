/**
 * Harness planning report strip helpers for layer-isolated unit tests.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeSemanticPlanningReportsBeforeAdapterSandbox,
  RuntimeSemanticPlanningReportsBeforeNoopAdapter,
  RuntimeSemanticPlanningReportsBeforePilotActivation,
  RuntimeSemanticPlanningReportsBeforePilotContract,
  RuntimeSemanticPlanningReportsBeforePilotSkeleton,
} from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";

/** H28 pilot skeleton fields (shared strip list). */
function omitPilotSkeletonLayer<T extends RuntimeSemanticPlanningReports>(
  semantic: T
): Omit<
  T,
  | "runtimePilotSkeletonSummary"
  | "runtimeDryRunRunnerContract"
  | "runtimePilotRunnerInputEnvelope"
  | "runtimePilotRunnerOutputEnvelope"
  | "runtimePilotRunnerSafetyGuard"
  | "runtimePilotSkeletonBlockerReport"
  | "runtimePilotRunnerContractVerificationReport"
  | "runtimePilotRunnerBoundaryViolationReport"
  | "runtimePilotRunnerNoExecutionResultMetadata"
  | "runtimePilotSkeletonPreflightSummary"
> {
  const {
    runtimePilotSkeletonSummary: _ps1,
    runtimeDryRunRunnerContract: _ps2,
    runtimePilotRunnerInputEnvelope: _ps3,
    runtimePilotRunnerOutputEnvelope: _ps4,
    runtimePilotRunnerSafetyGuard: _ps5,
    runtimePilotSkeletonBlockerReport: _ps6,
    runtimePilotRunnerContractVerificationReport: _ps7,
    runtimePilotRunnerBoundaryViolationReport: _ps8,
    runtimePilotRunnerNoExecutionResultMetadata: _ps9,
    runtimePilotSkeletonPreflightSummary: _ps10,
    ...rest
  } = semantic;
  return rest;
}

/** H25 noop adapter reports 제거 — pilot contract 이하 레이어 단독 테스트용. */
export function stripRuntimeNoopAdapterLayer(
  semantic: RuntimeSemanticPlanningReports
): RuntimeSemanticPlanningReportsBeforeNoopAdapter {
  const withoutSkeleton = omitPilotSkeletonLayer(semantic);
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
    runtimeAdapterSandboxEnvelopeVerificationReport: _m2,
    runtimeAdapterSandboxBoundaryViolationReport: _m3,
    runtimeAdapterSandboxPreflightSummary: _m4,
    runtimePilotActivationSummary: _n,
    runtimePilotActivationScope: _o,
    runtimePilotActivationPolicy: _p,
    runtimePilotActivationBlockerReport: _q,
    runtimePilotActivationReadinessChecklist: _r,
    runtimePilotActivationFinalSafetyGate: _r2,
    runtimePilotActivationBoundaryViolationReport: _r3,
    runtimePilotActivationReadinessVerificationReport: _r4,
    ...before
  } = withoutSkeleton;
  return before;
}

/** H26 adapter sandbox reports 제거 — noop adapter 이하 레이어 단독 테스트용. */
export function stripRuntimeAdapterSandboxLayer(
  semantic: RuntimeSemanticPlanningReports
): RuntimeSemanticPlanningReportsBeforeAdapterSandbox {
  const withoutSkeleton = omitPilotSkeletonLayer(semantic);
  const {
    runtimeAdapterSandboxSummary: _a,
    runtimeAdapterSandboxInputEnvelope: _b,
    runtimeAdapterSandboxOutputEnvelope: _c,
    runtimeAdapterSandboxPolicy: _d,
    runtimeAdapterSandboxResultMetadata: _e,
    runtimeAdapterSandboxBlockerReport: _f,
    runtimeAdapterSandboxEnvelopeVerificationReport: _g,
    runtimeAdapterSandboxBoundaryViolationReport: _h,
    runtimeAdapterSandboxPreflightSummary: _i,
    runtimePilotActivationSummary: _j,
    runtimePilotActivationScope: _k,
    runtimePilotActivationPolicy: _l,
    runtimePilotActivationBlockerReport: _m,
    runtimePilotActivationReadinessChecklist: _n,
    runtimePilotActivationFinalSafetyGate: _n2,
    runtimePilotActivationBoundaryViolationReport: _n3,
    runtimePilotActivationReadinessVerificationReport: _n4,
    ...before
  } = withoutSkeleton;
  return before;
}

/** H27 pilot activation reports 제거 — adapter sandbox 이하 레이어 단독 테스트용. */
export function stripRuntimePilotActivationLayer(
  semantic: RuntimeSemanticPlanningReports
): RuntimeSemanticPlanningReportsBeforePilotActivation {
  const withoutSkeleton = omitPilotSkeletonLayer(semantic);
  const {
    runtimePilotActivationSummary: _a,
    runtimePilotActivationScope: _b,
    runtimePilotActivationPolicy: _c,
    runtimePilotActivationBlockerReport: _d,
    runtimePilotActivationReadinessChecklist: _e,
    runtimePilotActivationFinalSafetyGate: _e2,
    runtimePilotActivationBoundaryViolationReport: _e3,
    runtimePilotActivationReadinessVerificationReport: _e4,
    ...before
  } = withoutSkeleton;
  return before;
}

/** H28 pilot skeleton reports 제거 — pilot activation 이하 레이어 단독 테스트용. */
export function stripRuntimePilotSkeletonLayer(
  semantic: RuntimeSemanticPlanningReports
): RuntimeSemanticPlanningReportsBeforePilotSkeleton {
  return omitPilotSkeletonLayer(semantic);
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
