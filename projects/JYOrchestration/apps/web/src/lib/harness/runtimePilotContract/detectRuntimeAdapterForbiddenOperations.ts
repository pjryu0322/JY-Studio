/**
 * H24.5 — adapter 연동 전 **금지 작업 후보** 탐지(read-only; report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforePilotContract } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeAdapterForbiddenOperationReport } from "./runtimePilotContractTypes";

const FORBIDDEN_PHRASES: readonly { readonly phrase: string; readonly label: string }[] = [
  { phrase: "provider routing", label: "provider routing" },
  { phrase: "provider switching", label: "provider switching" },
  { phrase: "queue control", label: "queue control" },
  { phrase: "prompt mutation", label: "prompt mutation" },
  { phrase: "prompt payload", label: "prompt payload 변경" },
  { phrase: "token enforcement", label: "token enforcement" },
  { phrase: "rollback execution", label: "rollback execution" },
  { phrase: "approval enforcement", label: "approval enforcement" },
  { phrase: "execution blocking", label: "execution blocking" },
  { phrase: "merge blocking", label: "merge blocking" },
  { phrase: "actual execution", label: "actual execution" },
  { phrase: "actual pilot", label: "actual pilot execution" },
];

function collectTextBlobs(reports: RuntimeSemanticPlanningReportsBeforePilotContract): readonly string[] {
  const blobs: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string" && v.trim()) blobs.push(v);
    if (Array.isArray(v)) {
      for (const row of v) {
        if (typeof row === "string" && row.trim()) blobs.push(row);
      }
    }
  };
  const cp = reports.runtimeControlledPilotSummary;
  const env = reports.runtimeControlledPilotSafetyEnvelope;
  const viol = reports.runtimeControlBoundaryViolationReport;
  push(cp.rationaleKo);
  push(cp.recommendations);
  push(env.safetyWarnings);
  push(env.forbiddenPilotExecutionScopes);
  push(viol.wordingRiskFindings);
  push(reports.runtimeExecutionCandidateSummary.recommendations);
  push(reports.runtimeOperatorApprovalSummary.recommendations);
  return blobs;
}

export function detectRuntimeAdapterForbiddenOperations(
  reports: RuntimeSemanticPlanningReportsBeforePilotContract
): RuntimeAdapterForbiddenOperationReport {
  const blobs = collectTextBlobs(reports).join(" ").toLowerCase();
  const forbiddenOperations: string[] = [];
  const wordingRiskFindings: string[] = [];

  for (const { phrase, label } of FORBIDDEN_PHRASES) {
    if (blobs.includes(phrase)) {
      wordingRiskFindings.push(`wording risk: ${label}`);
    }
  }

  forbiddenOperations.push(
    ...mergeSortedUniqueKo([
      "provider routing",
      "queue control",
      "prompt mutation",
      "token enforcement",
      "rollback execution",
      "approval enforcement",
      "execution blocking",
      "merge blocking",
    ])
  );

  const recommendations = mergeSortedUniqueKo([
    ...(wordingRiskFindings.length > 0
      ? ["H24.5: 금지 작업 문구 후보 — adapter 연동 전 문구 정리"]
      : []),
    "H24.5: adapter는 no-op boundary 내 contract metadata만 허용",
  ]);

  return {
    mode: "runtime_adapter_forbidden_operation_report",
    actualRuntimeOrchestrationEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    forbiddenOperations,
    wordingRiskFindings: mergeSortedUniqueKo(wordingRiskFindings),
    recommendations,
  };
}
