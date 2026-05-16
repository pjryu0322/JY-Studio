/**
 * H26 — adapter sandbox planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeAdapterSandbox } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { buildRuntimeAdapterSandboxInputEnvelope } from "./buildRuntimeAdapterSandboxInputEnvelope";
import { buildRuntimeAdapterSandboxOutputEnvelope } from "./buildRuntimeAdapterSandboxOutputEnvelope";
import { buildRuntimeAdapterSandboxPolicy } from "./buildRuntimeAdapterSandboxPolicy";
import { buildRuntimeAdapterSandboxResultMetadata } from "./buildRuntimeAdapterSandboxResultMetadata";
import { detectRuntimeAdapterSandboxBlockers } from "./detectRuntimeAdapterSandboxBlockers";
import { evaluateRuntimeAdapterSandboxReadiness } from "./evaluateRuntimeAdapterSandboxReadiness";
import type {
  RuntimeAdapterSandboxMode,
  RuntimeAdapterSandboxPlanningReports,
  RuntimeAdapterSandboxReadiness,
  RuntimeAdapterSandboxSummary,
} from "./runtimeAdapterSandboxTypes";

export type { RuntimeAdapterSandboxPlanningReports } from "./runtimeAdapterSandboxTypes";

function resolveSandboxMode(readiness: RuntimeAdapterSandboxReadiness): RuntimeAdapterSandboxMode {
  switch (readiness) {
    case "sandbox_metadata_ready":
      return "metadata_only";
    case "blocked":
      return "blocked";
    default:
      return "disabled";
  }
}

function sandboxRationaleKo(readiness: RuntimeAdapterSandboxReadiness): string {
  switch (readiness) {
    case "sandbox_metadata_ready":
      return "sandbox 메타 준비 — envelope·policy 정의 가능(실제 sandbox 호출 없음).";
    case "blocked":
      return "sandbox 차단 — preflight·contract·handoff·violation 정렬 필요.";
    case "watch":
      return "sandbox 주시 — partial contract·wording risk 재검토.";
    default:
      return "sandbox 미준비 — H25.5 preflight·noop adapter 정렬 필요.";
  }
}

export function buildRuntimeAdapterSandboxPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeAdapterSandbox
): RuntimeAdapterSandboxPlanningReports {
  const runtimeAdapterSandboxBlockerReport = detectRuntimeAdapterSandboxBlockers(reports);
  const sandboxReadiness = evaluateRuntimeAdapterSandboxReadiness({
    reports,
    blockerReport: runtimeAdapterSandboxBlockerReport,
  });
  const sandboxMode = resolveSandboxMode(sandboxReadiness);

  const runtimeAdapterSandboxInputEnvelope = buildRuntimeAdapterSandboxInputEnvelope(reports);
  const runtimeAdapterSandboxOutputEnvelope = buildRuntimeAdapterSandboxOutputEnvelope({
    blockerReport: runtimeAdapterSandboxBlockerReport,
  });
  const runtimeAdapterSandboxPolicy = buildRuntimeAdapterSandboxPolicy({ sandboxReadiness });
  const runtimeAdapterSandboxResultMetadata = buildRuntimeAdapterSandboxResultMetadata();

  const runtimeAdapterSandboxSummary: RuntimeAdapterSandboxSummary = {
    mode: "runtime_adapter_sandbox_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualSandboxInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    sandboxReadiness,
    sandboxMode,
    rationaleKo: sandboxRationaleKo(sandboxReadiness),
    sandboxBlockers: mergeSortedUniqueKo([...runtimeAdapterSandboxBlockerReport.blockers]),
    recommendations: mergeSortedUniqueKo([
      ...runtimeAdapterSandboxBlockerReport.recommendations,
      ...runtimeAdapterSandboxInputEnvelope.recommendations,
      ...runtimeAdapterSandboxOutputEnvelope.recommendations,
      ...runtimeAdapterSandboxPolicy.recommendations,
    ]),
  };

  return {
    runtimeAdapterSandboxSummary,
    runtimeAdapterSandboxInputEnvelope,
    runtimeAdapterSandboxOutputEnvelope,
    runtimeAdapterSandboxPolicy,
    runtimeAdapterSandboxResultMetadata,
    runtimeAdapterSandboxBlockerReport,
  };
}
