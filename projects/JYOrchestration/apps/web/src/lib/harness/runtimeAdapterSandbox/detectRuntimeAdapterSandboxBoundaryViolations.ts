/**
 * H26.5 — sandbox result metadata **boundary violation** 탐지(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeAdapterSandboxBoundaryViolationReport,
  RuntimeAdapterSandboxInputEnvelope,
  RuntimeAdapterSandboxOutputEnvelope,
  RuntimeAdapterSandboxPolicy,
  RuntimeAdapterSandboxResultMetadata,
} from "./runtimeAdapterSandboxTypes";

const RISK_PHRASES: readonly { readonly phrase: string; readonly label: string }[] = [
  { phrase: "sandboxinvoked=true", label: "sandboxInvoked=true" },
  { phrase: "adapterinvoked=true", label: "adapterInvoked=true" },
  { phrase: "executionperformed=true", label: "executionPerformed=true" },
  { phrase: "providerroutingperformed=true", label: "providerRoutingPerformed=true" },
  { phrase: "queuecontrolperformed=true", label: "queueControlPerformed=true" },
  { phrase: "rollbackperformed=true", label: "rollbackPerformed=true" },
  { phrase: "actualsandboxinvocationenabled=true", label: "actualSandboxInvocationEnabled=true" },
  { phrase: "actualruntimeadapterinvocationenabled=true", label: "actualRuntimeAdapterInvocationEnabled=true" },
  { phrase: "actualexecutionenabled=true", label: "actualExecutionEnabled=true" },
  { phrase: "actualproviderroutingenabled=true", label: "actualProviderRoutingEnabled=true" },
  { phrase: "actualqueuecontrolenabled=true", label: "actualQueueControlEnabled=true" },
  { phrase: "actualrollbackexecutionenabled=true", label: "actualRollbackExecutionEnabled=true" },
  { phrase: "diagnosticonly=false", label: "diagnosticOnly=false" },
];

function collectBlob(
  inputEnvelope: RuntimeAdapterSandboxInputEnvelope,
  outputEnvelope: RuntimeAdapterSandboxOutputEnvelope,
  policy: RuntimeAdapterSandboxPolicy,
  result: RuntimeAdapterSandboxResultMetadata
): string {
  const parts: string[] = [
    ...inputEnvelope.envelopeRows,
    ...outputEnvelope.acceptedMetadataRows,
    ...outputEnvelope.safetyEnvelopeRows,
    ...policy.forbiddenSandboxOperations,
    ...result.resultRows,
  ];
  return parts.join(" ").toLowerCase().replace(/\s+/g, "");
}

export function detectRuntimeAdapterSandboxBoundaryViolations(input: {
  readonly inputEnvelope: RuntimeAdapterSandboxInputEnvelope;
  readonly outputEnvelope: RuntimeAdapterSandboxOutputEnvelope;
  readonly policy: RuntimeAdapterSandboxPolicy;
  readonly result: RuntimeAdapterSandboxResultMetadata;
}): RuntimeAdapterSandboxBoundaryViolationReport {
  const { inputEnvelope, outputEnvelope, policy, result } = input;
  const actualFlagViolations: string[] = [];
  const wordingRiskFindings: string[] = [];

  if (result.actualSandboxInvocationEnabled !== false) {
    actualFlagViolations.push("runtimeAdapterSandboxResultMetadata.actualSandboxInvocationEnabled must be false");
  }
  if (result.actualRuntimeAdapterInvocationEnabled !== false) {
    actualFlagViolations.push(
      "runtimeAdapterSandboxResultMetadata.actualRuntimeAdapterInvocationEnabled must be false"
    );
  }
  if (result.actualExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeAdapterSandboxResultMetadata.actualExecutionEnabled must be false");
  }
  if (result.actualProviderRoutingEnabled !== false) {
    actualFlagViolations.push("runtimeAdapterSandboxResultMetadata.actualProviderRoutingEnabled must be false");
  }
  if (result.actualQueueControlEnabled !== false) {
    actualFlagViolations.push("runtimeAdapterSandboxResultMetadata.actualQueueControlEnabled must be false");
  }
  if (result.actualRollbackExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeAdapterSandboxResultMetadata.actualRollbackExecutionEnabled must be false");
  }
  if (result.sandboxInvoked !== false) {
    actualFlagViolations.push("runtimeAdapterSandboxResultMetadata.sandboxInvoked must be false");
  }
  if (result.adapterInvoked !== false) {
    actualFlagViolations.push("runtimeAdapterSandboxResultMetadata.adapterInvoked must be false");
  }
  if (result.executionPerformed !== false) {
    actualFlagViolations.push("runtimeAdapterSandboxResultMetadata.executionPerformed must be false");
  }
  if (result.providerRoutingPerformed !== false) {
    actualFlagViolations.push("runtimeAdapterSandboxResultMetadata.providerRoutingPerformed must be false");
  }
  if (result.queueControlPerformed !== false) {
    actualFlagViolations.push("runtimeAdapterSandboxResultMetadata.queueControlPerformed must be false");
  }
  if (result.rollbackPerformed !== false) {
    actualFlagViolations.push("runtimeAdapterSandboxResultMetadata.rollbackPerformed must be false");
  }
  if (result.diagnosticOnly !== true) {
    actualFlagViolations.push("runtimeAdapterSandboxResultMetadata.diagnosticOnly must be true");
  }

  const blob = collectBlob(inputEnvelope, outputEnvelope, policy, result);
  for (const { phrase, label } of RISK_PHRASES) {
    if (blob.includes(phrase)) {
      wordingRiskFindings.push(`wording/flag risk: ${label}`);
    }
  }

  const recommendations = mergeSortedUniqueKo([
    ...(actualFlagViolations.length > 0 || wordingRiskFindings.length > 0
      ? ["H26.5: sandbox boundary violation 후보 — actual operation 플래그·문구 제거"]
      : []),
  ]);

  return {
    mode: "runtime_adapter_sandbox_boundary_violation_report",
    actualRuntimeOrchestrationEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualSandboxInvocationEnabled: false,
    actualFlagViolations: mergeSortedUniqueKo(actualFlagViolations),
    wordingRiskFindings: mergeSortedUniqueKo(wordingRiskFindings),
    recommendations,
  };
}
