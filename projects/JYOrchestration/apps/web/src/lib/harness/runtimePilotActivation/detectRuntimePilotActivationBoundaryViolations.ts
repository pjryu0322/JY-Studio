/**
 * H27.5 — pilot activation **boundary violation** 탐지(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimePilotActivationBoundaryViolationReport,
  RuntimePilotActivationPolicy,
  RuntimePilotActivationReadinessChecklist,
  RuntimePilotActivationScope,
  RuntimePilotActivationSummary,
} from "./runtimePilotActivationTypes";

const RISK_PHRASES: readonly { readonly phrase: string; readonly label: string }[] = [
  { phrase: "pilotactivation=true", label: "pilotActivation=true" },
  { phrase: "pilotexecution=true", label: "pilotExecution=true" },
  { phrase: "runtimeadapterinvocation=true", label: "runtimeAdapterInvocation=true" },
  { phrase: "sandboxinvocation=true", label: "sandboxInvocation=true" },
  { phrase: "executionperformed=true", label: "executionPerformed=true" },
  { phrase: "providerrouting=true", label: "providerRouting=true" },
  { phrase: "queuecontrol=true", label: "queueControl=true" },
  { phrase: "rollbackexecution=true", label: "rollbackExecution=true" },
  { phrase: "actualpilotactivationenabled=true", label: "actualPilotActivationEnabled=true" },
  { phrase: "actualpilotexecutionenabled=true", label: "actualPilotExecutionEnabled=true" },
  { phrase: "actualruntimeadapterinvocationenabled=true", label: "actualRuntimeAdapterInvocationEnabled=true" },
  { phrase: "actualsandboxinvocationenabled=true", label: "actualSandboxInvocationEnabled=true" },
  { phrase: "actualexecutionenabled=true", label: "actualExecutionEnabled=true" },
  { phrase: "actualproviderroutingenabled=true", label: "actualProviderRoutingEnabled=true" },
  { phrase: "actualqueuecontrolenabled=true", label: "actualQueueControlEnabled=true" },
  { phrase: "actualrollbackexecutionenabled=true", label: "actualRollbackExecutionEnabled=true" },
];

function collectBlob(
  summary: RuntimePilotActivationSummary,
  scope: RuntimePilotActivationScope,
  policy: RuntimePilotActivationPolicy,
  checklist: RuntimePilotActivationReadinessChecklist
): string {
  const parts: string[] = [
    summary.rationaleKo,
    ...summary.activationBlockers,
    ...summary.recommendations,
    ...scope.forbiddenActivationOperations,
    ...scope.recommendations,
    ...policy.recommendations,
    ...checklist.checklist,
    ...checklist.recommendations,
  ];
  return parts.join(" ").toLowerCase().replace(/\s+/g, "");
}

export function detectRuntimePilotActivationBoundaryViolations(input: {
  readonly summary: RuntimePilotActivationSummary;
  readonly scope: RuntimePilotActivationScope;
  readonly policy: RuntimePilotActivationPolicy;
  readonly checklist: RuntimePilotActivationReadinessChecklist;
}): RuntimePilotActivationBoundaryViolationReport {
  const { summary, scope, policy, checklist } = input;
  const actualFlagViolations: string[] = [];
  const wordingRiskFindings: string[] = [];

  if (summary.actualPilotActivationEnabled !== false) {
    actualFlagViolations.push("runtimePilotActivationSummary.actualPilotActivationEnabled must be false");
  }
  if (summary.actualPilotExecutionEnabled !== false) {
    actualFlagViolations.push("runtimePilotActivationSummary.actualPilotExecutionEnabled must be false");
  }
  if (summary.actualRuntimeAdapterInvocationEnabled !== false) {
    actualFlagViolations.push(
      "runtimePilotActivationSummary.actualRuntimeAdapterInvocationEnabled must be false"
    );
  }
  if (summary.actualSandboxInvocationEnabled !== false) {
    actualFlagViolations.push("runtimePilotActivationSummary.actualSandboxInvocationEnabled must be false");
  }
  if (summary.actualExecutionEnabled !== false) {
    actualFlagViolations.push("runtimePilotActivationSummary.actualExecutionEnabled must be false");
  }
  if (summary.actualProviderRoutingEnabled !== false) {
    actualFlagViolations.push("runtimePilotActivationSummary.actualProviderRoutingEnabled must be false");
  }
  if (summary.actualQueueControlEnabled !== false) {
    actualFlagViolations.push("runtimePilotActivationSummary.actualQueueControlEnabled must be false");
  }
  if (summary.actualRollbackExecutionEnabled !== false) {
    actualFlagViolations.push("runtimePilotActivationSummary.actualRollbackExecutionEnabled must be false");
  }
  if (policy.actualActivationForbidden !== true) {
    actualFlagViolations.push("runtimePilotActivationPolicy.actualActivationForbidden must be true");
  }

  const blob = collectBlob(summary, scope, policy, checklist);
  for (const { phrase, label } of RISK_PHRASES) {
    if (blob.includes(phrase)) {
      wordingRiskFindings.push(`wording/flag risk: ${label}`);
    }
  }

  const recommendations = mergeSortedUniqueKo([
    ...(actualFlagViolations.length > 0 || wordingRiskFindings.length > 0
      ? ["H27.5: activation boundary violation — actual operation 플래그·문구 제거"]
      : []),
  ]);

  return {
    mode: "runtime_pilot_activation_boundary_violation_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotActivationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualFlagViolations: mergeSortedUniqueKo(actualFlagViolations),
    wordingRiskFindings: mergeSortedUniqueKo(wordingRiskFindings),
    recommendations,
  };
}
