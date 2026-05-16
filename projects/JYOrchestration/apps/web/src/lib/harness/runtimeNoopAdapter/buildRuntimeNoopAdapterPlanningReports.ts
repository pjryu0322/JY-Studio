/**
 * H25 / H25.5 — no-op adapter planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeNoopAdapter } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { buildRuntimeNoopAdapterPreflightSummary } from "./buildRuntimeNoopAdapterPreflightSummary";
import { buildRuntimeNoopAdapterResultMetadata } from "./buildRuntimeNoopAdapterResultMetadata";
import { buildRuntimeNoopAdapterSkeleton } from "./buildRuntimeNoopAdapterSkeleton";
import { detectRuntimeNoopAdapterBoundaryViolations } from "./detectRuntimeNoopAdapterBoundaryViolations";
import { evaluateRuntimeAdapterInvocationGuard } from "./evaluateRuntimeAdapterInvocationGuard";
import { verifyRuntimePilotContract } from "./verifyRuntimePilotContract";
import type {
  RuntimeAdapterInvocationGuardReport,
  RuntimeNoopAdapterBoundaryViolationReport,
  RuntimeNoopAdapterPlanningReports,
  RuntimeNoopAdapterStatus,
  RuntimeNoopAdapterSummary,
  RuntimePilotContractVerificationReport,
} from "./runtimeNoopAdapterTypes";

export type { RuntimeNoopAdapterPlanningReports } from "./runtimeNoopAdapterTypes";

function resolveRuntimeNoopAdapterStatus(input: {
  readonly guard: RuntimeAdapterInvocationGuardReport["invocationGuard"];
  readonly verification: RuntimePilotContractVerificationReport;
  readonly violations: RuntimeNoopAdapterBoundaryViolationReport;
}): RuntimeNoopAdapterStatus {
  const { guard, verification, violations } = input;
  if (
    violations.actualFlagViolations.length > 0 ||
    guard === "always_blocked" ||
    verification.verificationStatus === "failed"
  ) {
    return "blocked";
  }
  if (violations.wordingRiskFindings.length > 0 || verification.verificationStatus === "partial") {
    return "watch";
  }
  if (verification.verificationStatus === "verified_noop" && guard === "contract_metadata_only") {
    return "contract_verified_noop";
  }
  if (guard === "noop_only") {
    return "watch";
  }
  return "not_available";
}

function noopAdapterStatusRationaleKo(status: RuntimeNoopAdapterStatus): string {
  switch (status) {
    case "contract_verified_noop":
      return "pilot contract no-op 검증 완료 — skeleton·preflight 안정, adapter 미호출.";
    case "blocked":
      return "no-op adapter skeleton 차단 — violation·guard·contract 실패.";
    case "watch":
      return "no-op adapter skeleton 주시 — partial contract·wording risk.";
    default:
      return "no-op adapter skeleton 미가용 — H24.5 contract 정렬 필요.";
  }
}

export function buildRuntimeNoopAdapterPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeNoopAdapter
): RuntimeNoopAdapterPlanningReports {
  const runtimeNoopAdapterSkeleton = buildRuntimeNoopAdapterSkeleton(reports);
  const runtimeNoopAdapterResultMetadata = buildRuntimeNoopAdapterResultMetadata();
  const runtimePilotContractVerificationReport = verifyRuntimePilotContract(
    reports,
    runtimeNoopAdapterSkeleton,
    runtimeNoopAdapterResultMetadata
  );
  const runtimeAdapterInvocationGuardReport = evaluateRuntimeAdapterInvocationGuard(reports);
  const runtimeNoopAdapterBoundaryViolationReport = detectRuntimeNoopAdapterBoundaryViolations(
    reports,
    runtimeNoopAdapterSkeleton,
    runtimeNoopAdapterResultMetadata
  );

  const guard = runtimeAdapterInvocationGuardReport.invocationGuard;
  const verification = runtimePilotContractVerificationReport;
  const violations = runtimeNoopAdapterBoundaryViolationReport;
  const noopAdapterStatus = resolveRuntimeNoopAdapterStatus({ guard, verification, violations });
  const rationaleKo = noopAdapterStatusRationaleKo(noopAdapterStatus);

  const runtimeNoopAdapterSummary: RuntimeNoopAdapterSummary = {
    mode: "runtime_noop_adapter_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    noopAdapterStatus,
    invocationGuard: guard,
    rationaleKo,
    contractVerificationStatus: verification.verificationStatus,
    noopResultMetadata: mergeSortedUniqueKo([...runtimeNoopAdapterResultMetadata.resultRows]),
    recommendations: mergeSortedUniqueKo([
      ...verification.recommendations,
      ...runtimeAdapterInvocationGuardReport.recommendations,
      ...violations.recommendations,
    ]),
  };

  const runtimeNoopAdapterPreflightSummary = buildRuntimeNoopAdapterPreflightSummary({
    summary: runtimeNoopAdapterSummary,
    verification,
    guard: runtimeAdapterInvocationGuardReport,
    violations,
  });

  return {
    runtimeNoopAdapterSummary,
    runtimeNoopAdapterSkeleton,
    runtimePilotContractVerificationReport,
    runtimeNoopAdapterResultMetadata,
    runtimeAdapterInvocationGuardReport,
    runtimeNoopAdapterBoundaryViolationReport,
    runtimeNoopAdapterPreflightSummary,
  };
}
