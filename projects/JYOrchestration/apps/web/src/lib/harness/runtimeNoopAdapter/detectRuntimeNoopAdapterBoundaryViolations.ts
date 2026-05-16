/**
 * H25 — no-op skeleton/result에 actual operation 혼입 **탐지**(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeNoopAdapter } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type {
  RuntimeNoopAdapterBoundaryViolationReport,
  RuntimeNoopAdapterResultMetadata,
  RuntimeNoopAdapterSkeleton,
} from "./runtimeNoopAdapterTypes";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";

const RISK_PHRASES: readonly { readonly phrase: string; readonly label: string }[] = [
  { phrase: "adapterinvoked=true", label: "adapterInvoked=true" },
  { phrase: "executionperformed=true", label: "executionPerformed=true" },
  { phrase: "providerroutingperformed=true", label: "providerRoutingPerformed=true" },
  { phrase: "queuecontrolperformed=true", label: "queueControlPerformed=true" },
  { phrase: "rollbackperformed=true", label: "rollbackPerformed=true" },
  { phrase: "actualruntimeadapterinvocationenabled=true", label: "actualRuntimeAdapterInvocationEnabled=true" },
  { phrase: "actualexecutionenabled=true", label: "actualExecutionEnabled=true" },
  { phrase: "actualproviderroutingenabled=true", label: "actualProviderRoutingEnabled=true" },
];

function collectBlob(
  reports: RuntimeSemanticPlanningReportsBeforeNoopAdapter,
  skeleton: RuntimeNoopAdapterSkeleton,
  result: RuntimeNoopAdapterResultMetadata
): string {
  const parts: string[] = [
    ...skeleton.forbiddenOperations,
    ...result.resultRows,
    ...reports.runtimePilotContractSummary.recommendations,
    reports.runtimeAdapterBoundarySummary.rationaleKo,
  ];
  return parts.join(" ").toLowerCase().replace(/\s+/g, "");
}

export function detectRuntimeNoopAdapterBoundaryViolations(
  reports: RuntimeSemanticPlanningReportsBeforeNoopAdapter,
  skeleton: RuntimeNoopAdapterSkeleton,
  result: RuntimeNoopAdapterResultMetadata
): RuntimeNoopAdapterBoundaryViolationReport {
  const actualFlagViolations: string[] = [];
  const wordingRiskFindings: string[] = [];

  if (result.actualRuntimeAdapterInvocationEnabled !== false) {
    actualFlagViolations.push("runtimeNoopAdapterResultMetadata.actualRuntimeAdapterInvocationEnabled must be false");
  }
  if (result.actualExecutionEnabled !== false) {
    actualFlagViolations.push("runtimeNoopAdapterResultMetadata.actualExecutionEnabled must be false");
  }
  if (result.actualProviderRoutingEnabled !== false) {
    actualFlagViolations.push("runtimeNoopAdapterResultMetadata.actualProviderRoutingEnabled must be false");
  }
  if (result.adapterInvoked !== false) {
    actualFlagViolations.push("runtimeNoopAdapterResultMetadata.adapterInvoked must be false");
  }
  if (result.executionPerformed !== false) {
    actualFlagViolations.push("runtimeNoopAdapterResultMetadata.executionPerformed must be false");
  }
  if (result.providerRoutingPerformed !== false) {
    actualFlagViolations.push("runtimeNoopAdapterResultMetadata.providerRoutingPerformed must be false");
  }

  const blob = collectBlob(reports, skeleton, result);
  for (const { phrase, label } of RISK_PHRASES) {
    if (blob.includes(phrase)) {
      wordingRiskFindings.push(`wording/flag risk: ${label}`);
    }
  }

  const recommendations = mergeSortedUniqueKo([
    ...(actualFlagViolations.length > 0 || wordingRiskFindings.length > 0
      ? ["H25: no-op boundary violation 후보 — actual operation 플래그·문구 제거"]
      : []),
  ]);

  return {
    mode: "runtime_noop_adapter_boundary_violation_report",
    actualRuntimeOrchestrationEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualFlagViolations: mergeSortedUniqueKo(actualFlagViolations),
    wordingRiskFindings: mergeSortedUniqueKo(wordingRiskFindings),
    recommendations,
  };
}
