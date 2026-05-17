/**
 * Harness planning report strip helpers for layer-isolated unit tests.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeSemanticPlanningReportsBeforeAdapterSandbox,
  RuntimeSemanticPlanningReportsBeforeNoopAdapter,
  RuntimeSemanticPlanningReportsBeforeNoopExecutionShell,
  RuntimeSemanticPlanningReportsBeforeNoopExecutionShellHarness,
  RuntimeSemanticPlanningReportsBeforeNoopShellHardening,
  RuntimeSemanticPlanningReportsBeforePilotActivation,
  RuntimeSemanticPlanningReportsBeforePilotContract,
  RuntimeSemanticPlanningReportsBeforePilotSkeleton,
  RuntimeSemanticPlanningReportsBeforeRunnerInvocation,
  RuntimeSemanticPlanningReportsBeforeRunnerNoopHarness,
} from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";

/** H28–H31 pilot skeleton·runner invocation·no-op harness·execution shell fields (shared strip list). */
function omitPilotSkeletonAndRunnerInvocationLayer<T extends RuntimeSemanticPlanningReports>(
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
  | "runtimeRunnerInvocationSummary"
  | "runtimeRunnerInvocationScope"
  | "runtimeRunnerInvocationPolicy"
  | "runtimeRunnerInvocationBlockerReport"
  | "runtimeRunnerInvocationReadinessChecklist"
  | "runtimeRunnerInvocationFinalSafetyGate"
  | "runtimeRunnerInvocationBoundaryViolationReport"
  | "runtimeRunnerInvocationReadinessVerificationReport"
  | "runtimeRunnerNoopHarnessSummary"
  | "runtimeRunnerNoopInvocationEnvelope"
  | "runtimeRunnerNoopResultMetadata"
  | "runtimeRunnerNoopHarnessSafetyGuard"
  | "runtimeRunnerNoopHarnessContractVerificationReport"
  | "runtimeRunnerNoopHarnessBoundaryViolationReport"
  | "runtimeRunnerNoopHarnessPreflightSummary"
  | "runtimeRunnerNoopHarnessReadinessVerificationReport"
  | "runtimeRunnerNoopHarnessAlignmentReport"
  | "runtimeRunnerNoopHarnessFinalSafetyGate"
  | "runtimeNoopExecutionShellSummary"
  | "runtimeNoopExecutionShellScope"
  | "runtimeNoopExecutionShellPolicy"
  | "runtimeNoopExecutionShellBlockerReport"
  | "runtimeNoopExecutionShellReadinessChecklist"
  | "runtimeNoopExecutionShellFinalSafetyGate"
  | "runtimeNoopExecutionShellBoundaryViolationReport"
  | "runtimeNoopExecutionShellReadinessVerificationReport"
  | "runtimeNoopExecutionShellHarnessSummary"
  | "runtimeNoopExecutionShellContractBoundary"
  | "runtimeNoopExecutionShellHarnessInputEnvelope"
  | "runtimeNoopExecutionShellHarnessOutputEnvelope"
  | "runtimeNoopExecutionShellNoopResultMetadata"
  | "runtimeNoopExecutionShellHarnessSafetyGuard"
  | "runtimeNoopExecutionShellHarnessBlockerReport"
  | "runtimeNoopExecutionShellHarnessPreflightSummary"
  | "runtimeNoopShellHardeningSummary"
  | "runtimeNoopShellHardeningContract"
  | "runtimeNoopShellHardeningInputEnvelope"
  | "runtimeNoopShellHardeningOutputEnvelope"
  | "runtimeNoopShellNoExecutionResultMetadata"
  | "runtimeNoopShellHardeningSafetyGuard"
  | "runtimeNoopShellHardeningContractVerificationReport"
  | "runtimeNoopShellHardeningBoundaryViolationReport"
  | "runtimeNoopShellHardeningPreflightSummary"
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
    runtimeRunnerInvocationSummary: _ri1,
    runtimeRunnerInvocationScope: _ri2,
    runtimeRunnerInvocationPolicy: _ri3,
    runtimeRunnerInvocationBlockerReport: _ri4,
    runtimeRunnerInvocationReadinessChecklist: _ri5,
    runtimeRunnerInvocationFinalSafetyGate: _ri6,
    runtimeRunnerInvocationBoundaryViolationReport: _ri7,
    runtimeRunnerInvocationReadinessVerificationReport: _ri8,
    runtimeRunnerNoopHarnessSummary: _nh1,
    runtimeRunnerNoopInvocationEnvelope: _nh2,
    runtimeRunnerNoopResultMetadata: _nh3,
    runtimeRunnerNoopHarnessSafetyGuard: _nh4,
    runtimeRunnerNoopHarnessContractVerificationReport: _nh5,
    runtimeRunnerNoopHarnessBoundaryViolationReport: _nh6,
    runtimeRunnerNoopHarnessPreflightSummary: _nh7,
    runtimeRunnerNoopHarnessReadinessVerificationReport: _nh8,
    runtimeRunnerNoopHarnessAlignmentReport: _nh9,
    runtimeRunnerNoopHarnessFinalSafetyGate: _nh10,
    runtimeNoopExecutionShellSummary: _ns1,
    runtimeNoopExecutionShellScope: _ns2,
    runtimeNoopExecutionShellPolicy: _ns3,
    runtimeNoopExecutionShellBlockerReport: _ns4,
    runtimeNoopExecutionShellReadinessChecklist: _ns5,
    runtimeNoopExecutionShellFinalSafetyGate: _ns6,
    runtimeNoopExecutionShellBoundaryViolationReport: _ns7,
    runtimeNoopExecutionShellReadinessVerificationReport: _ns8,
    runtimeNoopExecutionShellHarnessSummary: _eh1,
    runtimeNoopExecutionShellContractBoundary: _eh2,
    runtimeNoopExecutionShellHarnessInputEnvelope: _eh3,
    runtimeNoopExecutionShellHarnessOutputEnvelope: _eh4,
    runtimeNoopExecutionShellNoopResultMetadata: _eh5,
    runtimeNoopExecutionShellHarnessSafetyGuard: _eh6,
    runtimeNoopExecutionShellHarnessBlockerReport: _eh7,
    runtimeNoopExecutionShellHarnessPreflightSummary: _eh8,
    runtimeNoopShellHardeningSummary: _sh1,
    runtimeNoopShellHardeningContract: _sh2,
    runtimeNoopShellHardeningInputEnvelope: _sh3,
    runtimeNoopShellHardeningOutputEnvelope: _sh4,
    runtimeNoopShellNoExecutionResultMetadata: _sh5,
    runtimeNoopShellHardeningSafetyGuard: _sh6,
    runtimeNoopShellHardeningContractVerificationReport: _sh7,
    runtimeNoopShellHardeningBoundaryViolationReport: _sh8,
    runtimeNoopShellHardeningPreflightSummary: _sh9,
    ...rest
  } = semantic;
  return rest;
}

function omitRunnerNoopHarnessFieldsOnly<T extends RuntimeSemanticPlanningReports>(
  semantic: T
): Omit<
  T,
  | "runtimeRunnerNoopHarnessSummary"
  | "runtimeRunnerNoopInvocationEnvelope"
  | "runtimeRunnerNoopResultMetadata"
  | "runtimeRunnerNoopHarnessSafetyGuard"
  | "runtimeRunnerNoopHarnessContractVerificationReport"
  | "runtimeRunnerNoopHarnessBoundaryViolationReport"
  | "runtimeRunnerNoopHarnessPreflightSummary"
  | "runtimeRunnerNoopHarnessReadinessVerificationReport"
  | "runtimeRunnerNoopHarnessAlignmentReport"
  | "runtimeRunnerNoopHarnessFinalSafetyGate"
> {
  const {
    runtimeRunnerNoopHarnessSummary: _nh1,
    runtimeRunnerNoopInvocationEnvelope: _nh2,
    runtimeRunnerNoopResultMetadata: _nh3,
    runtimeRunnerNoopHarnessSafetyGuard: _nh4,
    runtimeRunnerNoopHarnessContractVerificationReport: _nh5,
    runtimeRunnerNoopHarnessBoundaryViolationReport: _nh6,
    runtimeRunnerNoopHarnessPreflightSummary: _nh7,
    runtimeRunnerNoopHarnessReadinessVerificationReport: _nh8,
    runtimeRunnerNoopHarnessAlignmentReport: _nh9,
    runtimeRunnerNoopHarnessFinalSafetyGate: _nh10,
    ...rest
  } = semantic;
  return rest;
}

function omitNoopExecutionShellHarnessLayerOnly<T extends RuntimeSemanticPlanningReports>(
  semantic: T
): Omit<
  T,
  | "runtimeNoopExecutionShellHarnessSummary"
  | "runtimeNoopExecutionShellContractBoundary"
  | "runtimeNoopExecutionShellHarnessInputEnvelope"
  | "runtimeNoopExecutionShellHarnessOutputEnvelope"
  | "runtimeNoopExecutionShellNoopResultMetadata"
  | "runtimeNoopExecutionShellHarnessSafetyGuard"
  | "runtimeNoopExecutionShellHarnessBlockerReport"
  | "runtimeNoopExecutionShellHarnessPreflightSummary"
> {
  const {
    runtimeNoopExecutionShellHarnessSummary: _eh1,
    runtimeNoopExecutionShellContractBoundary: _eh2,
    runtimeNoopExecutionShellHarnessInputEnvelope: _eh3,
    runtimeNoopExecutionShellHarnessOutputEnvelope: _eh4,
    runtimeNoopExecutionShellNoopResultMetadata: _eh5,
    runtimeNoopExecutionShellHarnessSafetyGuard: _eh6,
    runtimeNoopExecutionShellHarnessBlockerReport: _eh7,
    runtimeNoopExecutionShellHarnessPreflightSummary: _eh8,
    ...rest
  } = semantic;
  return rest;
}

function omitRunnerNoopHarnessLayerOnly<T extends RuntimeSemanticPlanningReports>(
  semantic: T
): ReturnType<
  typeof omitNoopShellHardeningLayerOnly<
    ReturnType<
      typeof omitNoopExecutionShellHarnessLayerOnly<
        ReturnType<typeof omitNoopExecutionShellLayerOnly<ReturnType<typeof omitRunnerNoopHarnessFieldsOnly<T>>>>
      >
    >
  >
> {
  return omitNoopShellHardeningLayerOnly(
    omitNoopExecutionShellHarnessLayerOnly(omitNoopExecutionShellLayerOnly(omitRunnerNoopHarnessFieldsOnly(semantic)))
  );
}

function omitNoopExecutionShellLayerOnly<T extends RuntimeSemanticPlanningReports>(
  semantic: T
): Omit<
  T,
  | "runtimeNoopExecutionShellSummary"
  | "runtimeNoopExecutionShellScope"
  | "runtimeNoopExecutionShellPolicy"
  | "runtimeNoopExecutionShellBlockerReport"
  | "runtimeNoopExecutionShellReadinessChecklist"
  | "runtimeNoopExecutionShellFinalSafetyGate"
  | "runtimeNoopExecutionShellBoundaryViolationReport"
  | "runtimeNoopExecutionShellReadinessVerificationReport"
> {
  const {
    runtimeNoopExecutionShellSummary: _ns1,
    runtimeNoopExecutionShellScope: _ns2,
    runtimeNoopExecutionShellPolicy: _ns3,
    runtimeNoopExecutionShellBlockerReport: _ns4,
    runtimeNoopExecutionShellReadinessChecklist: _ns5,
    runtimeNoopExecutionShellFinalSafetyGate: _ns6,
    runtimeNoopExecutionShellBoundaryViolationReport: _ns7,
    runtimeNoopExecutionShellReadinessVerificationReport: _ns8,
    ...rest
  } = semantic;
  return rest;
}

function omitNoopShellHardeningLayerOnly<T extends RuntimeSemanticPlanningReports>(
  semantic: T
): Omit<
  T,
  | "runtimeNoopShellHardeningSummary"
  | "runtimeNoopShellHardeningContract"
  | "runtimeNoopShellHardeningInputEnvelope"
  | "runtimeNoopShellHardeningOutputEnvelope"
  | "runtimeNoopShellNoExecutionResultMetadata"
  | "runtimeNoopShellHardeningSafetyGuard"
  | "runtimeNoopShellHardeningContractVerificationReport"
  | "runtimeNoopShellHardeningBoundaryViolationReport"
  | "runtimeNoopShellHardeningPreflightSummary"
  | "runtimeNoopShellHardeningReadinessVerificationReport"
  | "runtimeNoopShellHardeningAlignmentReport"
  | "runtimeNoopShellHardeningFinalSafetyGate"
> {
  const {
    runtimeNoopShellHardeningSummary: _sh1,
    runtimeNoopShellHardeningContract: _sh2,
    runtimeNoopShellHardeningInputEnvelope: _sh3,
    runtimeNoopShellHardeningOutputEnvelope: _sh4,
    runtimeNoopShellNoExecutionResultMetadata: _sh5,
    runtimeNoopShellHardeningSafetyGuard: _sh6,
    runtimeNoopShellHardeningContractVerificationReport: _sh7,
    runtimeNoopShellHardeningBoundaryViolationReport: _sh8,
    runtimeNoopShellHardeningPreflightSummary: _sh9,
    runtimeNoopShellHardeningReadinessVerificationReport: _sh10,
    runtimeNoopShellHardeningAlignmentReport: _sh11,
    runtimeNoopShellHardeningFinalSafetyGate: _sh12,
    ...rest
  } = semantic;
  return rest;
}

function omitNoopShellReleaseGateLayerOnly<T extends RuntimeSemanticPlanningReports>(
  semantic: T
): Omit<
  T,
  | "runtimeNoopShellReleaseGateSummary"
  | "runtimeNoopShellReleaseGateScope"
  | "runtimeNoopShellReleaseGatePolicy"
  | "runtimeNoopShellReleaseGateBlockerReport"
  | "runtimeNoopShellReleaseGateReadinessChecklist"
  | "runtimeNoopShellReleaseGateBoundaryViolationReport"
  | "runtimeNoopShellReleaseGateReadinessVerificationReport"
  | "runtimeNoopShellReleaseGateAlignmentReport"
  | "runtimeNoopShellReleaseGateFinalSafetyGate"
> {
  const {
    runtimeNoopShellReleaseGateSummary: _rg1,
    runtimeNoopShellReleaseGateScope: _rg2,
    runtimeNoopShellReleaseGatePolicy: _rg3,
    runtimeNoopShellReleaseGateBlockerReport: _rg4,
    runtimeNoopShellReleaseGateReadinessChecklist: _rg5,
    runtimeNoopShellReleaseGateBoundaryViolationReport: _rg6,
    runtimeNoopShellReleaseGateReadinessVerificationReport: _rg7,
    runtimeNoopShellReleaseGateAlignmentReport: _rg8,
    runtimeNoopShellReleaseGateFinalSafetyGate: _rg9,
    ...rest
  } = semantic;
  return rest;
}

function omitReleaseGatePreflightLayerOnly<T extends RuntimeSemanticPlanningReports>(
  semantic: T
): Omit<
  T,
  | "runtimeReleaseGatePreflightSummary"
  | "runtimeReleaseGateExecutionReadinessBoundary"
  | "runtimeReleaseGateInputEnvelope"
  | "runtimeReleaseGateOutputEnvelope"
  | "runtimeReleaseGateNoExecutionProof"
  | "runtimeReleaseGateOperationForbiddenProof"
  | "runtimeReleaseGatePreflightBlockerReport"
  | "runtimeReleaseGatePreflightChecklist"
  | "runtimeReleaseGatePreflightBoundaryViolationReport"
  | "runtimeReleaseGatePreflightReadinessVerificationReport"
  | "runtimeReleaseGatePreflightAlignmentReport"
  | "runtimeReleaseGatePreflightFinalSafetyGate"
> {
  const {
    runtimeReleaseGatePreflightSummary: _pf1,
    runtimeReleaseGateExecutionReadinessBoundary: _pf2,
    runtimeReleaseGateInputEnvelope: _pf3,
    runtimeReleaseGateOutputEnvelope: _pf4,
    runtimeReleaseGateNoExecutionProof: _pf5,
    runtimeReleaseGateOperationForbiddenProof: _pf6,
    runtimeReleaseGatePreflightBlockerReport: _pf7,
    runtimeReleaseGatePreflightChecklist: _pf8,
    runtimeReleaseGatePreflightBoundaryViolationReport: _pf9,
    runtimeReleaseGatePreflightReadinessVerificationReport: _pf10,
    runtimeReleaseGatePreflightAlignmentReport: _pf11,
    runtimeReleaseGatePreflightFinalSafetyGate: _pf12,
    ...rest
  } = semantic;
  return rest;
}

function omitNoopShellReleaseGateStackLayerOnly<T extends RuntimeSemanticPlanningReports>(
  semantic: T
): ReturnType<typeof omitReleaseGatePreflightLayerOnly<ReturnType<typeof omitNoopShellReleaseGateLayerOnly<T>>>> {
  return omitReleaseGatePreflightLayerOnly(omitNoopShellReleaseGateLayerOnly(semantic));
}

function omitRunnerInvocationLayerOnly<T extends RuntimeSemanticPlanningReports>(
  semantic: T
): Omit<
  T,
  | "runtimeRunnerInvocationSummary"
  | "runtimeRunnerInvocationScope"
  | "runtimeRunnerInvocationPolicy"
  | "runtimeRunnerInvocationBlockerReport"
  | "runtimeRunnerInvocationReadinessChecklist"
  | "runtimeRunnerInvocationFinalSafetyGate"
  | "runtimeRunnerInvocationBoundaryViolationReport"
  | "runtimeRunnerInvocationReadinessVerificationReport"
> {
  const {
    runtimeRunnerInvocationSummary: _ri1,
    runtimeRunnerInvocationScope: _ri2,
    runtimeRunnerInvocationPolicy: _ri3,
    runtimeRunnerInvocationBlockerReport: _ri4,
    runtimeRunnerInvocationReadinessChecklist: _ri5,
    runtimeRunnerInvocationFinalSafetyGate: _ri6,
    runtimeRunnerInvocationBoundaryViolationReport: _ri7,
    runtimeRunnerInvocationReadinessVerificationReport: _ri8,
    ...rest
  } = semantic;
  return rest;
}

/** H25 noop adapter reports 제거 — pilot contract 이하 레이어 단독 테스트용. */
export function stripRuntimeNoopAdapterLayer(
  semantic: RuntimeSemanticPlanningReports
): RuntimeSemanticPlanningReportsBeforeNoopAdapter {
  const withoutSkeleton = omitPilotSkeletonAndRunnerInvocationLayer(semantic);
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
  const withoutSkeleton = omitPilotSkeletonAndRunnerInvocationLayer(semantic);
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
  const withoutSkeleton = omitPilotSkeletonAndRunnerInvocationLayer(semantic);
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
  return omitPilotSkeletonAndRunnerInvocationLayer(semantic);
}

/** H29 runner invocation reports 제거 — runner invocation 이하 레이어 단독 테스트용. */
export function stripRuntimeRunnerInvocationLayer(
  semantic: RuntimeSemanticPlanningReports
): RuntimeSemanticPlanningReportsBeforeRunnerNoopHarness {
  return omitRunnerInvocationLayerOnly(semantic);
}

/** H30 runner no-op harness reports 제거 — no-op harness 이하 레이어 단독 테스트용. */
export function stripRuntimeRunnerNoopHarnessLayer(
  semantic: RuntimeSemanticPlanningReports
): RuntimeSemanticPlanningReportsBeforeRunnerNoopHarness {
  return omitRunnerNoopHarnessLayerOnly(semantic);
}

/** H31 no-op execution shell reports 제거 — execution shell 이하 레이어 단독 테스트용. */
export function stripRuntimeNoopExecutionShellLayer(
  semantic: RuntimeSemanticPlanningReports
): RuntimeSemanticPlanningReportsBeforeNoopExecutionShell {
  return omitNoopExecutionShellHarnessLayerOnly(
    omitNoopShellReleaseGateStackLayerOnly(omitNoopShellHardeningLayerOnly(omitNoopExecutionShellLayerOnly(semantic)))
  );
}

/** H32 controlled execution shell harness reports 제거 — harness 이하 레이어 단독 테스트용. */
export function stripRuntimeNoopExecutionShellHarnessLayer(
  semantic: RuntimeSemanticPlanningReports
): RuntimeSemanticPlanningReportsBeforeNoopExecutionShellHarness {
  return omitNoopShellReleaseGateStackLayerOnly(omitNoopShellHardeningLayerOnly(omitNoopExecutionShellHarnessLayerOnly(semantic)));
}

/** H33 no-op shell hardening reports 제거 — shell hardening 이하 레이어 단독 테스트용. */
export function stripRuntimeNoopShellHardeningLayer(
  semantic: RuntimeSemanticPlanningReports
): RuntimeSemanticPlanningReportsBeforeNoopShellHardening {
  return omitNoopShellReleaseGateStackLayerOnly(omitNoopShellHardeningLayerOnly(semantic));
}

/** H34 / H34.5 release-gate reports 제거 — release-gate 이하 레이어 단독 테스트용. */
export function stripRuntimeNoopShellReleaseGateLayer(
  semantic: RuntimeSemanticPlanningReports
): import("@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages").RuntimeSemanticPlanningReportsBeforeNoopShellReleaseGate {
  return omitNoopShellReleaseGateStackLayerOnly(semantic);
}

/** H35 release-gate preflight reports 제거 — preflight 이하 레이어 단독 테스트용. */
export function stripRuntimeReleaseGatePreflightLayer(
  semantic: RuntimeSemanticPlanningReports
): import("@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages").RuntimeSemanticPlanningReportsBeforeReleaseGatePreflight {
  return omitReleaseGatePreflightLayerOnly(semantic);
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
