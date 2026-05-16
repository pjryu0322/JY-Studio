/**
 * H25 — no-op adapter planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeNoopAdapter } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { buildRuntimeNoopAdapterResultMetadata } from "./buildRuntimeNoopAdapterResultMetadata";
import { buildRuntimeNoopAdapterSkeleton } from "./buildRuntimeNoopAdapterSkeleton";
import { detectRuntimeNoopAdapterBoundaryViolations } from "./detectRuntimeNoopAdapterBoundaryViolations";
import { evaluateRuntimeAdapterInvocationGuard } from "./evaluateRuntimeAdapterInvocationGuard";
import { verifyRuntimePilotContract } from "./verifyRuntimePilotContract";
import type {
  RuntimeNoopAdapterPlanningReports,
  RuntimeNoopAdapterStatus,
  RuntimeNoopAdapterSummary,
} from "./runtimeNoopAdapterTypes";

export type { RuntimeNoopAdapterPlanningReports } from "./runtimeNoopAdapterTypes";

export function buildRuntimeNoopAdapterPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeNoopAdapter
): RuntimeNoopAdapterPlanningReports {
  const runtimeNoopAdapterSkeleton = buildRuntimeNoopAdapterSkeleton(reports);
  const runtimePilotContractVerificationReport = verifyRuntimePilotContract(reports);
  const runtimeNoopAdapterResultMetadata = buildRuntimeNoopAdapterResultMetadata();
  const runtimeAdapterInvocationGuardReport = evaluateRuntimeAdapterInvocationGuard(reports);
  const runtimeNoopAdapterBoundaryViolationReport = detectRuntimeNoopAdapterBoundaryViolations(
    reports,
    runtimeNoopAdapterSkeleton,
    runtimeNoopAdapterResultMetadata
  );

  const guard = runtimeAdapterInvocationGuardReport.invocationGuard;
  const verification = runtimePilotContractVerificationReport;

  let noopAdapterStatus: RuntimeNoopAdapterStatus;
  if (guard === "always_blocked" || verification.verificationStatus === "failed") {
    noopAdapterStatus = "blocked";
  } else if (verification.verificationStatus === "verified_noop" && guard === "contract_metadata_only") {
    noopAdapterStatus = "contract_verified_noop";
  } else if (verification.verificationStatus === "partial" || guard === "noop_only") {
    noopAdapterStatus = "watch";
  } else {
    noopAdapterStatus = "not_available";
  }

  const rationaleKo =
    noopAdapterStatus === "contract_verified_noop"
      ? "pilot contract no-op 검증 완료 — skeleton만 고정, adapter 미호출."
      : noopAdapterStatus === "blocked"
        ? "no-op adapter skeleton 차단 — contract·guard·violation 신호."
        : noopAdapterStatus === "watch"
          ? "no-op adapter skeleton 주시 — contract partial·noop_only guard."
          : "no-op adapter skeleton 미가용 — H24.5 contract 정렬 필요.";

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
      ...runtimeNoopAdapterBoundaryViolationReport.recommendations,
    ]),
  };

  return {
    runtimeNoopAdapterSummary,
    runtimeNoopAdapterSkeleton,
    runtimePilotContractVerificationReport,
    runtimeNoopAdapterResultMetadata,
    runtimeAdapterInvocationGuardReport,
    runtimeNoopAdapterBoundaryViolationReport,
  };
}
