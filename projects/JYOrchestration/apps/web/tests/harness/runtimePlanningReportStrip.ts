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

function omitExecutionBoundaryShellLayerOnly<T extends RuntimeSemanticPlanningReports>(
  semantic: T
): Omit<
  T,
  | "runtimeExecutionBoundaryShellSummary"
  | "runtimeExecutionBoundaryShellScope"
  | "runtimeExecutionBoundaryShellPolicy"
  | "runtimeExecutionBoundaryShellBlockerReport"
  | "runtimeExecutionBoundaryShellReadinessChecklist"
  | "runtimeExecutionBoundaryShellBoundaryViolationReport"
  | "runtimeExecutionBoundaryShellReadinessVerificationReport"
  | "runtimeExecutionBoundaryShellAlignmentReport"
  | "runtimeExecutionBoundaryShellFinalSafetyGate"
> {
  const {
    runtimeExecutionBoundaryShellSummary: _eb1,
    runtimeExecutionBoundaryShellScope: _eb2,
    runtimeExecutionBoundaryShellPolicy: _eb3,
    runtimeExecutionBoundaryShellBlockerReport: _eb4,
    runtimeExecutionBoundaryShellReadinessChecklist: _eb5,
    runtimeExecutionBoundaryShellBoundaryViolationReport: _eb6,
    runtimeExecutionBoundaryShellReadinessVerificationReport: _eb7,
    runtimeExecutionBoundaryShellAlignmentReport: _eb8,
    runtimeExecutionBoundaryShellFinalSafetyGate: _eb9,
    ...rest
  } = semantic;
  return rest;
}

function omitNoopShellReleaseGateStackLayerOnly<T extends RuntimeSemanticPlanningReports>(
  semantic: T
): ReturnType<
  typeof omitExecutionBoundaryShellLayerOnly<
    ReturnType<typeof omitReleaseGatePreflightLayerOnly<ReturnType<typeof omitNoopShellReleaseGateLayerOnly<T>>>>
  >
> {
  return omitExecutionBoundaryShellLayerOnly(
    omitReleaseGatePreflightLayerOnly(omitNoopShellReleaseGateLayerOnly(semantic))
  );
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

/** H35 / H35.5 release-gate preflight reports 제거 — preflight 이하 레이어 단독 테스트용. */
export function stripRuntimeReleaseGatePreflightLayer(
  semantic: RuntimeSemanticPlanningReports
): import("@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages").RuntimeSemanticPlanningReportsBeforeReleaseGatePreflight {
  return omitReleaseGatePreflightLayerOnly(semantic);
}

function omitExecutionGovernanceBoundaryLayerOnly<T extends RuntimeSemanticPlanningReports>(
  semantic: T
): Omit<
  T,
  | "runtimeExecutionGovernanceBoundarySummary"
  | "runtimeExecutionGovernanceBoundaryScope"
  | "runtimeExecutionGovernanceBoundaryPolicy"
  | "runtimeExecutionGovernanceBoundaryBlockerReport"
  | "runtimeExecutionGovernanceBoundaryReadinessChecklist"
  | "runtimeExecutionGovernanceBoundaryViolationReport"
  | "runtimeExecutionGovernanceBoundaryReadinessVerificationReport"
  | "runtimeExecutionGovernanceBoundaryAlignmentReport"
  | "runtimeExecutionGovernanceBoundaryFinalSafetyGate"
> {
  const {
    runtimeExecutionGovernanceBoundarySummary: _eg1,
    runtimeExecutionGovernanceBoundaryScope: _eg2,
    runtimeExecutionGovernanceBoundaryPolicy: _eg3,
    runtimeExecutionGovernanceBoundaryBlockerReport: _eg4,
    runtimeExecutionGovernanceBoundaryReadinessChecklist: _eg5,
    runtimeExecutionGovernanceBoundaryViolationReport: _eg6,
    runtimeExecutionGovernanceBoundaryReadinessVerificationReport: _eg7,
    runtimeExecutionGovernanceBoundaryAlignmentReport: _eg8,
    runtimeExecutionGovernanceBoundaryFinalSafetyGate: _eg9,
    ...rest
  } = semantic;
  return rest;
}

/** H36 execution boundary shell reports 제거 — boundary shell 이하 레이어 단독 테스트용. */
export function stripRuntimeExecutionBoundaryShellLayer(
  semantic: RuntimeSemanticPlanningReports
): import("@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages").RuntimeSemanticPlanningReportsBeforeExecutionBoundaryShell {
  return omitExecutionBoundaryShellLayerOnly(semantic);
}

/** H37 execution governance boundary reports 제거 — governance boundary 이하 레이어 단독 테스트용(H38 포함). */
export function stripRuntimeExecutionGovernanceBoundaryLayer(
  semantic: RuntimeSemanticPlanningReports
): import("@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages").RuntimeSemanticPlanningReportsBeforeExecutionGovernanceBoundary {
  return omitGovernanceReleaseReadinessLayerOnly(omitExecutionGovernanceBoundaryLayerOnly(semantic));
}

function omitFinalReleaseGovernanceGateLayerOnly<T extends RuntimeSemanticPlanningReports>(
  semantic: T
): Omit<
  T,
  | "runtimeFinalReleaseGovernanceGateSummary"
  | "runtimeFinalReleaseGovernanceGateScope"
  | "runtimeFinalReleaseGovernanceGatePolicy"
  | "runtimeFinalReleaseGovernanceGateBlockerReport"
  | "runtimeFinalReleaseGovernanceGateReadinessChecklist"
  | "runtimeFinalReleaseGovernanceGateViolationReport"
  | "runtimeFinalReleaseGovernanceGateVerificationReport"
  | "runtimeFinalReleaseGovernanceGateAlignmentReport"
  | "runtimeFinalReleaseGovernanceGateFinalSafetyGate"
> {
  const {
    runtimeFinalReleaseGovernanceGateSummary: _fr1,
    runtimeFinalReleaseGovernanceGateScope: _fr2,
    runtimeFinalReleaseGovernanceGatePolicy: _fr3,
    runtimeFinalReleaseGovernanceGateBlockerReport: _fr4,
    runtimeFinalReleaseGovernanceGateReadinessChecklist: _fr5,
    runtimeFinalReleaseGovernanceGateViolationReport: _fr6,
    runtimeFinalReleaseGovernanceGateVerificationReport: _fr7,
    runtimeFinalReleaseGovernanceGateAlignmentReport: _fr8,
    runtimeFinalReleaseGovernanceGateFinalSafetyGate: _fr9,
    ...rest
  } = semantic;
  return rest;
}

function omitLimitedPilotBoundaryLayerOnly<T extends RuntimeSemanticPlanningReports>(
  semantic: T
): Omit<
  T,
  | "runtimeLimitedPilotBoundarySummary"
  | "runtimeLimitedPilotBoundaryScope"
  | "runtimeLimitedPilotBoundaryPolicy"
  | "runtimeLimitedPilotInputContract"
  | "runtimeLimitedPilotOutputContract"
  | "runtimeLimitedPilotBoundaryBlockerReport"
  | "runtimeLimitedPilotReadinessChecklist"
  | "runtimeLimitedPilotBoundaryViolationReport"
  | "runtimeLimitedPilotBoundaryVerificationReport"
  | "runtimeLimitedPilotBoundaryAlignmentReport"
  | "runtimeLimitedPilotBoundaryFinalSafetyGate"
> {
  const {
    runtimeLimitedPilotBoundarySummary: _p1,
    runtimeLimitedPilotBoundaryScope: _p2,
    runtimeLimitedPilotBoundaryPolicy: _p3,
    runtimeLimitedPilotInputContract: _p4,
    runtimeLimitedPilotOutputContract: _p5,
    runtimeLimitedPilotBoundaryBlockerReport: _p6,
    runtimeLimitedPilotReadinessChecklist: _p7,
    runtimeLimitedPilotBoundaryViolationReport: _p8,
    runtimeLimitedPilotBoundaryVerificationReport: _p9,
    runtimeLimitedPilotBoundaryAlignmentReport: _p10,
    runtimeLimitedPilotBoundaryFinalSafetyGate: _p11,
    ...rest
  } = semantic;
  return rest;
}

/** H42 limited pilot boundary reports 제거 — H42 단독 테스트용. */
export function stripRuntimeLimitedPilotBoundaryLayer(
  semantic: RuntimeSemanticPlanningReports
): import("@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages").RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary {
  return omitLimitedPilotBoundaryLayerOnly(semantic);
}

function omitControlledActivationCandidateLayerOnly<T extends RuntimeSemanticPlanningReports>(
  semantic: T
): Omit<
  T,
  | "runtimeControlledActivationCandidateSummary"
  | "runtimeControlHandoffBoundary"
  | "runtimeControlledActivationCandidateScope"
  | "runtimeControlledActivationCandidatePolicy"
  | "runtimeControlledActivationCandidateBlockerReport"
  | "runtimeControlledActivationReadinessChecklist"
  | "runtimeControlledActivationCandidateViolationReport"
  | "runtimeControlledActivationCandidateVerificationReport"
  | "runtimeControlledActivationCandidateAlignmentReport"
  | "runtimeControlledActivationCandidateFinalSafetyGate"
> {
  const withoutH42 = omitLimitedPilotBoundaryLayerOnly(semantic);
  const {
    runtimeControlledActivationCandidateSummary: _c1,
    runtimeControlHandoffBoundary: _c2,
    runtimeControlledActivationCandidateScope: _c3,
    runtimeControlledActivationCandidatePolicy: _c4,
    runtimeControlledActivationCandidateBlockerReport: _c5,
    runtimeControlledActivationReadinessChecklist: _c6,
    runtimeControlledActivationCandidateViolationReport: _c7,
    runtimeControlledActivationCandidateVerificationReport: _c8,
    runtimeControlledActivationCandidateAlignmentReport: _c9,
    runtimeControlledActivationCandidateFinalSafetyGate: _c10,
    ...rest
  } = withoutH42;
  return rest;
}

/** H41 controlled activation candidate reports 제거 — H41 단독 테스트용. */
export function stripRuntimeControlledActivationCandidateLayer(
  semantic: RuntimeSemanticPlanningReports
): import("@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages").RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate {
  return omitControlledActivationCandidateLayerOnly(semantic);
}

function omitUltimateGovernanceReviewLayerOnly<T extends RuntimeSemanticPlanningReports>(
  semantic: T
): Omit<
  T,
  | "runtimeUltimateGovernanceReviewSummary"
  | "runtimeFinalOrchestrationReadinessBoundary"
  | "runtimeOrchestrationReadinessInputEnvelope"
  | "runtimeOrchestrationReadinessOutputEnvelope"
  | "runtimeUltimateNoEnforcementProof"
  | "runtimeOrchestrationForbiddenProof"
  | "runtimeUltimateGovernanceBlockerReport"
  | "runtimeFinalOrchestrationReadinessChecklist"
  | "runtimeUltimateGovernanceReviewViolationReport"
  | "runtimeUltimateGovernanceReviewVerificationReport"
  | "runtimeUltimateGovernanceReviewAlignmentReport"
  | "runtimeUltimateGovernanceReviewFinalSafetyGate"
> {
  const withoutH41 = omitControlledActivationCandidateLayerOnly(semantic);
  const {
    runtimeUltimateGovernanceReviewSummary: _u1,
    runtimeFinalOrchestrationReadinessBoundary: _u2,
    runtimeOrchestrationReadinessInputEnvelope: _u3,
    runtimeOrchestrationReadinessOutputEnvelope: _u4,
    runtimeUltimateNoEnforcementProof: _u5,
    runtimeOrchestrationForbiddenProof: _u6,
    runtimeUltimateGovernanceBlockerReport: _u7,
    runtimeFinalOrchestrationReadinessChecklist: _u8,
    runtimeUltimateGovernanceReviewViolationReport: _u9,
    runtimeUltimateGovernanceReviewVerificationReport: _u10,
    runtimeUltimateGovernanceReviewAlignmentReport: _u11,
    runtimeUltimateGovernanceReviewFinalSafetyGate: _u12,
    ...rest
  } = withoutH41;
  return rest;
}

/** H40 ultimate governance review reports 제거 — H40 단독 테스트용. */
export function stripRuntimeUltimateGovernanceReviewLayer(
  semantic: RuntimeSemanticPlanningReports
): import("@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages").RuntimeSemanticPlanningReportsBeforeUltimateGovernanceReview {
  return omitUltimateGovernanceReviewLayerOnly(semantic);
}

/** H39 final release governance gate reports 제거 — H39 단독 테스트용. */
export function stripRuntimeFinalReleaseGovernanceGateLayer(
  semantic: RuntimeSemanticPlanningReports
): import("@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages").RuntimeSemanticPlanningReportsBeforeFinalReleaseGovernanceGate {
  return omitFinalReleaseGovernanceGateLayerOnly(semantic);
}

function omitGovernanceReleaseReadinessLayerOnly<T extends RuntimeSemanticPlanningReports>(
  semantic: T
): Omit<
  T,
  | "runtimeGovernanceReleaseReadinessSummary"
  | "runtimeGovernanceReleaseReadinessBoundary"
  | "runtimeGovernanceReleaseInputEnvelope"
  | "runtimeGovernanceReleaseOutputEnvelope"
  | "runtimeGovernanceNoEnforcementProof"
  | "runtimeExecutionGovernanceForbiddenProof"
  | "runtimeGovernanceReleaseBlockerReport"
  | "runtimeGovernanceReleaseReadinessChecklist"
  | "runtimeGovernanceReleaseReadinessViolationReport"
  | "runtimeGovernanceReleaseReadinessVerificationReport"
  | "runtimeGovernanceReleaseReadinessAlignmentReport"
  | "runtimeGovernanceReleaseReadinessFinalSafetyGate"
> {
  const withoutH40 = omitUltimateGovernanceReviewLayerOnly(semantic);
  const withoutH39 = omitFinalReleaseGovernanceGateLayerOnly(withoutH40);
  const {
    runtimeGovernanceReleaseReadinessSummary: _gr1,
    runtimeGovernanceReleaseReadinessBoundary: _gr2,
    runtimeGovernanceReleaseInputEnvelope: _gr3,
    runtimeGovernanceReleaseOutputEnvelope: _gr4,
    runtimeGovernanceNoEnforcementProof: _gr5,
    runtimeExecutionGovernanceForbiddenProof: _gr6,
    runtimeGovernanceReleaseBlockerReport: _gr7,
    runtimeGovernanceReleaseReadinessChecklist: _gr8,
    runtimeGovernanceReleaseReadinessViolationReport: _gr9,
    runtimeGovernanceReleaseReadinessVerificationReport: _gr10,
    runtimeGovernanceReleaseReadinessAlignmentReport: _gr11,
    runtimeGovernanceReleaseReadinessFinalSafetyGate: _gr12,
    ...rest
  } = withoutH39;
  return rest;
}

/** H38 governance release-readiness reports 제거 — release-readiness 이하 레이어 단독 테스트용(H39 포함). */
export function stripRuntimeGovernanceReleaseReadinessLayer(
  semantic: RuntimeSemanticPlanningReports
): import("@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages").RuntimeSemanticPlanningReportsBeforeGovernanceReleaseReadiness {
  return omitGovernanceReleaseReadinessLayerOnly(semantic);
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
