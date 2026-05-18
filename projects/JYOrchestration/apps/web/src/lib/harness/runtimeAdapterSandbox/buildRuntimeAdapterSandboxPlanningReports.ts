/**
 * H26 / H26.5 — adapter sandbox planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeAdapterSandbox } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { buildRuntimeAdapterSandboxInputEnvelope } from "./buildRuntimeAdapterSandboxInputEnvelope";
import { buildRuntimeAdapterSandboxOutputEnvelope } from "./buildRuntimeAdapterSandboxOutputEnvelope";
import { buildRuntimeAdapterSandboxPolicy } from "./buildRuntimeAdapterSandboxPolicy";
import { buildRuntimeAdapterSandboxPreflightSummary } from "./buildRuntimeAdapterSandboxPreflightSummary";
import { buildRuntimeAdapterSandboxResultMetadata } from "./buildRuntimeAdapterSandboxResultMetadata";
import { detectRuntimeAdapterSandboxBlockers } from "./detectRuntimeAdapterSandboxBlockers";
import { detectRuntimeAdapterSandboxBoundaryViolations } from "./detectRuntimeAdapterSandboxBoundaryViolations";
import { evaluateRuntimeAdapterSandboxReadiness } from "./evaluateRuntimeAdapterSandboxReadiness";
import { verifyRuntimeAdapterSandboxEnvelope } from "./verifyRuntimeAdapterSandboxEnvelope";
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
      return "sandbox 차단 — preflight·contract·handoff·violation·envelope 실패.";
    case "watch":
      return "sandbox 주시 — partial envelope·wording risk.";
    default:
      return "sandbox 미준비 — H25.5 preflight·noop adapter 정렬 필요.";
  }
}

function refineSandboxReadiness(input: {
  readonly initial: RuntimeAdapterSandboxReadiness;
  readonly envelopeVerification: ReturnType<typeof verifyRuntimeAdapterSandboxEnvelope>;
  readonly boundaryViolation: ReturnType<typeof detectRuntimeAdapterSandboxBoundaryViolations>;
}): RuntimeAdapterSandboxReadiness {
  const { initial, envelopeVerification, boundaryViolation } = input;
  if (boundaryViolation.actualFlagViolations.length > 0) {
    return "blocked";
  }
  if (envelopeVerification.verificationStatus === "failed") {
    return "blocked";
  }
  if (envelopeVerification.verificationStatus === "partial") {
    return initial === "blocked" ? "blocked" : "watch";
  }
  return initial;
}

export function buildRuntimeAdapterSandboxPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeAdapterSandbox
): RuntimeAdapterSandboxPlanningReports {
  const runtimeAdapterSandboxBlockerReport = detectRuntimeAdapterSandboxBlockers(reports);
  const initialReadiness = evaluateRuntimeAdapterSandboxReadiness({
    reports,
    blockerReport: runtimeAdapterSandboxBlockerReport,
  });

  const runtimeAdapterSandboxInputEnvelope = buildRuntimeAdapterSandboxInputEnvelope(reports);
  const runtimeAdapterSandboxOutputEnvelope = buildRuntimeAdapterSandboxOutputEnvelope({
    blockerReport: runtimeAdapterSandboxBlockerReport,
  });
  const runtimeAdapterSandboxPolicy = buildRuntimeAdapterSandboxPolicy({ sandboxReadiness: initialReadiness });
  const runtimeAdapterSandboxResultMetadata = buildRuntimeAdapterSandboxResultMetadata();

  const runtimeAdapterSandboxEnvelopeVerificationReport = verifyRuntimeAdapterSandboxEnvelope({
    inputEnvelope: runtimeAdapterSandboxInputEnvelope,
    outputEnvelope: runtimeAdapterSandboxOutputEnvelope,
    policy: runtimeAdapterSandboxPolicy,
    result: runtimeAdapterSandboxResultMetadata,
  });

  const runtimeAdapterSandboxBoundaryViolationReport = detectRuntimeAdapterSandboxBoundaryViolations({
    inputEnvelope: runtimeAdapterSandboxInputEnvelope,
    outputEnvelope: runtimeAdapterSandboxOutputEnvelope,
    policy: runtimeAdapterSandboxPolicy,
    result: runtimeAdapterSandboxResultMetadata,
  });

  const sandboxReadiness = refineSandboxReadiness({
    initial: initialReadiness,
    envelopeVerification: runtimeAdapterSandboxEnvelopeVerificationReport,
    boundaryViolation: runtimeAdapterSandboxBoundaryViolationReport,
  });
  const sandboxMode = resolveSandboxMode(sandboxReadiness);

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
      ...runtimeAdapterSandboxEnvelopeVerificationReport.recommendations,
      ...runtimeAdapterSandboxBoundaryViolationReport.recommendations,
    ]),
  };

  const runtimeAdapterSandboxPreflightSummary = buildRuntimeAdapterSandboxPreflightSummary({
    summary: runtimeAdapterSandboxSummary,
    envelopeVerification: runtimeAdapterSandboxEnvelopeVerificationReport,
    boundaryViolation: runtimeAdapterSandboxBoundaryViolationReport,
    blockerReport: runtimeAdapterSandboxBlockerReport,
  });

  return {
    runtimeAdapterSandboxSummary,
    runtimeAdapterSandboxInputEnvelope,
    runtimeAdapterSandboxOutputEnvelope,
    runtimeAdapterSandboxPolicy,
    runtimeAdapterSandboxResultMetadata,
    runtimeAdapterSandboxBlockerReport,
    runtimeAdapterSandboxEnvelopeVerificationReport,
    runtimeAdapterSandboxBoundaryViolationReport,
    runtimeAdapterSandboxPreflightSummary,
  };
}
