/**
 * H26 — sandbox **output envelope** metadata(read-only; 실제 output 없음).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeAdapterSandboxBlockerReport,
  RuntimeAdapterSandboxOutputEnvelope,
} from "./runtimeAdapterSandboxTypes";

export function buildRuntimeAdapterSandboxOutputEnvelope(input: {
  readonly blockerReport: RuntimeAdapterSandboxBlockerReport;
}): RuntimeAdapterSandboxOutputEnvelope {
  const { blockerReport } = input;
  const hasBlockers = blockerReport.blockers.length > 0;

  const acceptedMetadataRows = mergeSortedUniqueKo([
    "sandboxAcceptedMetadata:contract_verification_ref",
    "sandboxAcceptedMetadata:noop_preflight_ref",
    "sandboxAcceptedMetadata:invocation_guard_ref",
    "sandboxNoOpValidation:metadata_only",
    "sandboxAuditTrace:read_only_diagnostic",
    "sandboxSafetyEnvelope:actual_sandbox_invocation_forbidden",
  ]);

  const rejectedMetadataRows = hasBlockers
    ? mergeSortedUniqueKo([
        "sandboxRejectedMetadata:activation_blocked",
        ...blockerReport.blockers.slice(0, 3).map((b) => `sandboxRejected:${b}`),
      ])
    : [];

  const safetyEnvelopeRows = mergeSortedUniqueKo([
    "actualSandboxInvocationEnabled:false",
    "actualRuntimeAdapterInvocationEnabled:false",
    "sandboxInvoked:false",
    "diagnosticOnly:true",
  ]);

  return {
    mode: "runtime_adapter_sandbox_output_envelope",
    actualRuntimeOrchestrationEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualSandboxInvocationEnabled: false,
    acceptedMetadataRows,
    rejectedMetadataRows,
    safetyEnvelopeRows,
    recommendations: mergeSortedUniqueKo([
      ...(hasBlockers
        ? ["H26: sandbox output envelope — blocker 존재 시 activation metadata 거부"]
        : ["H26: sandbox output envelope — metadata schema만 정의(호출 없음)"]),
    ]),
  };
}
