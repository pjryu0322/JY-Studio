/**
 * H28 — runner **output envelope** metadata(read-only; 실제 output 없음).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimePilotRunnerOutputEnvelope,
  RuntimePilotSkeletonBlockerReport,
} from "./runtimePilotSkeletonTypes";

export function buildRuntimePilotRunnerOutputEnvelope(input: {
  readonly blockerReport: RuntimePilotSkeletonBlockerReport;
}): RuntimePilotRunnerOutputEnvelope {
  const { blockerReport } = input;
  const hasBlockers = blockerReport.blockers.length > 0;

  const acceptedMetadataRows = mergeSortedUniqueKo([
    "runnerAcceptedMetadata:activation_final_gate_ref",
    "runnerAcceptedMetadata:dry_run_contract_ref",
    "runnerSafetyValidationMetadata:metadata_only",
    "runnerNoExecutionResultMetadata:placeholder",
    "runnerAuditTraceMetadata:read_only_diagnostic",
    "runnerSafetyEnvelope:actual_runner_execution_forbidden",
  ]);

  const rejectedMetadataRows = hasBlockers
    ? mergeSortedUniqueKo([
        "runnerRejectedMetadata:skeleton_blocked",
        ...blockerReport.blockers.slice(0, 3).map((b) => `runnerRejected:${b}`),
      ])
    : [];

  const safetyEnvelopeRows = mergeSortedUniqueKo([
    "actualIsolatedRunnerExecutionEnabled:false",
    "actualDryRunRunnerExecutionEnabled:false",
    "runnerInvoked:false",
    "executionPerformed:false",
    "diagnosticOnly:true",
  ]);

  return {
    mode: "runtime_pilot_runner_output_envelope",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotActivationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    acceptedMetadataRows,
    rejectedMetadataRows,
    safetyEnvelopeRows,
    recommendations: mergeSortedUniqueKo([
      ...(hasBlockers
        ? ["H28: runner output envelope — blocker 시 runner metadata 거부"]
        : ["H28: runner output envelope — metadata schema만 정의(실행 없음)"]),
    ]),
  };
}
