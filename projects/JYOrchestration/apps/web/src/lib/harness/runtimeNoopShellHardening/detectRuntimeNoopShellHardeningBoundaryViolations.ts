/**
 * H32 ??shell hardening **boundary violation** ?��?(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeNoopShellHardeningBoundaryViolationReport,
  RuntimeNoopShellHardeningInputEnvelope,
  RuntimeNoopShellHardeningSafetyGuard,
  RuntimeNoopShellHardeningSummary,
  RuntimeNoopShellNoExecutionResultMetadata,
} from "./runtimeNoopShellHardeningTypes";

const RISK_PHRASES: readonly { readonly phrase: string; readonly label: string }[] = [
  { phrase: "noopshellexecuted=true", label: "noopShellExecuted=true" },
  { phrase: "executionshellexecuted=true", label: "executionShellExecuted=true" },
  { phrase: "runtimeadapterinvoked=true", label: "runtimeAdapterInvoked=true" },
  { phrase: "executionperformed=true", label: "executionPerformed=true" },
  { phrase: "providerroutingperformed=true", label: "providerRoutingPerformed=true" },
  { phrase: "queuecontrolperformed=true", label: "queueControlPerformed=true" },
  { phrase: "rollbackperformed=true", label: "rollbackPerformed=true" },
  { phrase: "promptmutated=true", label: "promptMutated=true" },
  { phrase: "actualnoopshellexecutionenabled=true", label: "actualNoopShellExecutionEnabled=true" },
  { phrase: "actualexecutionshellexecutionenabled=true", label: "actualExecutionShellExecutionEnabled=true" },
  { phrase: "actualruntimeadapterinvocationenabled=true", label: "actualRuntimeAdapterInvocationEnabled=true" },
  { phrase: "actualexecutionenabled=true", label: "actualExecutionEnabled=true" },
];

function collectBlob(
  summary: RuntimeNoopShellHardeningSummary,
  inputEnvelope: RuntimeNoopShellHardeningInputEnvelope,
  result: RuntimeNoopShellNoExecutionResultMetadata,
  guard: RuntimeNoopShellHardeningSafetyGuard
): string {
  const parts: string[] = [
    summary.rationaleKo,
    ...summary.hardeningBlockers,
    ...summary.recommendations,
    ...inputEnvelope.envelopeRows,
    ...inputEnvelope.recommendations,
    ...result.resultRows,
    ...guard.guardRows,
  ];
  return parts.join(" ").toLowerCase().replace(/\s+/g, "");
}

export function detectRuntimeNoopShellHardeningBoundaryViolations(input: {
  readonly summary: RuntimeNoopShellHardeningSummary;
  readonly inputEnvelope: RuntimeNoopShellHardeningInputEnvelope;
  readonly result: RuntimeNoopShellNoExecutionResultMetadata;
  readonly safetyGuard: RuntimeNoopShellHardeningSafetyGuard;
}): RuntimeNoopShellHardeningBoundaryViolationReport {
  const { summary, inputEnvelope, result, safetyGuard } = input;
  const actualFlagViolations: string[] = [];
  const wordingRiskFindings: string[] = [];

  if (summary.actualNoopShellExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeNoopShellHardeningSummary.actualNoopShellExecutionEnabled must be false");
  }
  if (summary.actualExecutionShellExecutionEnabled !== false) {
    actualFlagViolations.push(
      "runtimeNoopShellHardeningSummary.actualExecutionShellExecutionEnabled must be false"
    );
  }
  if (summary.actualRuntimeAdapterInvocationEnabled !== false) {
    actualFlagViolations.push(
      "runtimeNoopShellHardeningSummary.actualRuntimeAdapterInvocationEnabled must be false"
    );
  }
  if (summary.actualExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeNoopShellHardeningSummary.actualExecutionEnabled must be false");
  }
  if (summary.actualProviderRoutingEnabled !== false) {
    actualFlagViolations.push("runtimeNoopShellHardeningSummary.actualProviderRoutingEnabled must be false");
  }
  if (summary.actualQueueControlEnabled !== false) {
    actualFlagViolations.push("runtimeNoopShellHardeningSummary.actualQueueControlEnabled must be false");
  }
  if (summary.actualRollbackExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeNoopShellHardeningSummary.actualRollbackExecutionEnabled must be false");
  }
  if (result.noopShellExecuted !== false) {
    actualFlagViolations.push("runtimeNoopShellNoExecutionResultMetadata.noopShellExecuted must be false");
  }
  if (result.executionShellExecuted !== false) {
    actualFlagViolations.push("runtimeNoopShellNoExecutionResultMetadata.executionShellExecuted must be false");
  }
  if (result.runtimeAdapterInvoked !== false) {
    actualFlagViolations.push("runtimeNoopShellNoExecutionResultMetadata.runtimeAdapterInvoked must be false");
  }
  if (result.executionPerformed !== false) {
    actualFlagViolations.push("runtimeNoopShellNoExecutionResultMetadata.executionPerformed must be false");
  }
  if (result.providerRoutingPerformed !== false) {
    actualFlagViolations.push("runtimeNoopShellNoExecutionResultMetadata.providerRoutingPerformed must be false");
  }
  if (result.queueControlPerformed !== false) {
    actualFlagViolations.push("runtimeNoopShellNoExecutionResultMetadata.queueControlPerformed must be false");
  }
  if (result.rollbackPerformed !== false) {
    actualFlagViolations.push("runtimeNoopShellNoExecutionResultMetadata.rollbackPerformed must be false");
  }
  if (result.promptMutated !== false) {
    actualFlagViolations.push("runtimeNoopShellNoExecutionResultMetadata.promptMutated must be false");
  }
  if (result.diagnosticOnly !== true) {
    actualFlagViolations.push("runtimeNoopShellNoExecutionResultMetadata.diagnosticOnly must be true");
  }
  if (safetyGuard.actualShellExecutionForbidden !== true) {
    actualFlagViolations.push("runtimeNoopShellHardeningSafetyGuard.actualShellExecutionForbidden must be true");
  }

  const blob = collectBlob(summary, inputEnvelope, result, safetyGuard);
  for (const { phrase, label } of RISK_PHRASES) {
    if (blob.includes(phrase)) {
      wordingRiskFindings.push(`wording/flag risk: ${label}`);
    }
  }

  const recommendations = mergeSortedUniqueKo([
    ...(actualFlagViolations.length > 0 || wordingRiskFindings.length > 0
      ? ["H33: shell hardening boundary violation ??actual shell execution·routing ?�래그·문�??�거"]
      : []),
  ]);

  return {
    mode: "runtime_noop_shell_hardening_boundary_violation_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualFlagViolations: mergeSortedUniqueKo(actualFlagViolations),
    wordingRiskFindings: mergeSortedUniqueKo(wordingRiskFindings),
    recommendations,
  };
}
