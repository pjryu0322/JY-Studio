/**
 * H33 / H33.5 — no-op shell hardening planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeNoopShellHardening } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { buildRuntimeNoopShellHardeningAlignmentReport } from "./buildRuntimeNoopShellHardeningAlignmentReport";
import { buildRuntimeNoopShellHardeningContract } from "./buildRuntimeNoopShellHardeningContract";
import { buildRuntimeNoopShellHardeningFinalSafetyGate } from "./buildRuntimeNoopShellHardeningFinalSafetyGate";
import { buildRuntimeNoopShellHardeningInputEnvelope } from "./buildRuntimeNoopShellHardeningInputEnvelope";
import { buildRuntimeNoopShellHardeningOutputEnvelope } from "./buildRuntimeNoopShellHardeningOutputEnvelope";
import { buildRuntimeNoopShellHardeningPreflightSummary } from "./buildRuntimeNoopShellHardeningPreflightSummary";
import { buildRuntimeNoopShellHardeningSafetyGuard } from "./buildRuntimeNoopShellHardeningSafetyGuard";
import { buildRuntimeNoopShellHardeningSummary } from "./buildRuntimeNoopShellHardeningSummary";
import { buildRuntimeNoopShellNoExecutionResultMetadata } from "./buildRuntimeNoopShellNoExecutionResultMetadata";
import { detectRuntimeNoopShellHardeningBoundaryViolations } from "./detectRuntimeNoopShellHardeningBoundaryViolations";
import { verifyRuntimeNoopShellHardeningContract } from "./verifyRuntimeNoopShellHardeningContract";
import { verifyRuntimeNoopShellHardeningReadiness } from "./verifyRuntimeNoopShellHardeningReadiness";
import type {
  RuntimeNoopShellHardeningPlanningReports,
  RuntimeNoopShellHardeningSummary,
} from "./runtimeNoopShellHardeningTypes";

export type { RuntimeNoopShellHardeningPlanningReports } from "./runtimeNoopShellHardeningTypes";

export function buildRuntimeNoopShellHardeningPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeNoopShellHardening
): RuntimeNoopShellHardeningPlanningReports {
  const runtimeNoopShellHardeningSummary = buildRuntimeNoopShellHardeningSummary(reports);
  const runtimeNoopShellHardeningContract = buildRuntimeNoopShellHardeningContract();
  const runtimeNoopShellHardeningInputEnvelope = buildRuntimeNoopShellHardeningInputEnvelope(reports);
  const runtimeNoopShellNoExecutionResultMetadata = buildRuntimeNoopShellNoExecutionResultMetadata();
  const runtimeNoopShellHardeningSafetyGuard = buildRuntimeNoopShellHardeningSafetyGuard();
  const runtimeNoopShellHardeningOutputEnvelope = buildRuntimeNoopShellHardeningOutputEnvelope({
    summary: runtimeNoopShellHardeningSummary,
    result: runtimeNoopShellNoExecutionResultMetadata,
  });

  const runtimeNoopShellHardeningContractVerificationReport = verifyRuntimeNoopShellHardeningContract({
    contract: runtimeNoopShellHardeningContract,
    summary: runtimeNoopShellHardeningSummary,
    inputEnvelope: runtimeNoopShellHardeningInputEnvelope,
    outputEnvelope: runtimeNoopShellHardeningOutputEnvelope,
    result: runtimeNoopShellNoExecutionResultMetadata,
    safetyGuard: runtimeNoopShellHardeningSafetyGuard,
  });

  const runtimeNoopShellHardeningBoundaryViolationReport = detectRuntimeNoopShellHardeningBoundaryViolations({
    summary: runtimeNoopShellHardeningSummary,
    inputEnvelope: runtimeNoopShellHardeningInputEnvelope,
    result: runtimeNoopShellNoExecutionResultMetadata,
    safetyGuard: runtimeNoopShellHardeningSafetyGuard,
  });

  const runtimeNoopShellHardeningPreflightSummary = buildRuntimeNoopShellHardeningPreflightSummary({
    summary: runtimeNoopShellHardeningSummary,
    contractVerification: runtimeNoopShellHardeningContractVerificationReport,
    boundaryViolation: runtimeNoopShellHardeningBoundaryViolationReport,
    result: runtimeNoopShellNoExecutionResultMetadata,
  });

  const runtimeNoopShellHardeningReadinessVerificationReport = verifyRuntimeNoopShellHardeningReadiness({
    summary: runtimeNoopShellHardeningSummary,
    preflight: runtimeNoopShellHardeningPreflightSummary,
    contractVerification: runtimeNoopShellHardeningContractVerificationReport,
    boundaryViolation: runtimeNoopShellHardeningBoundaryViolationReport,
    result: runtimeNoopShellNoExecutionResultMetadata,
    safetyGuard: runtimeNoopShellHardeningSafetyGuard,
  });

  const runtimeNoopShellHardeningAlignmentReport = buildRuntimeNoopShellHardeningAlignmentReport({
    inputEnvelope: runtimeNoopShellHardeningInputEnvelope,
    result: runtimeNoopShellNoExecutionResultMetadata,
    safetyGuard: runtimeNoopShellHardeningSafetyGuard,
    contractVerification: runtimeNoopShellHardeningContractVerificationReport,
    boundaryViolation: runtimeNoopShellHardeningBoundaryViolationReport,
    preflight: runtimeNoopShellHardeningPreflightSummary,
  });

  const runtimeNoopShellHardeningFinalSafetyGate = buildRuntimeNoopShellHardeningFinalSafetyGate({
    summary: runtimeNoopShellHardeningSummary,
    preflight: runtimeNoopShellHardeningPreflightSummary,
    readinessVerification: runtimeNoopShellHardeningReadinessVerificationReport,
    alignmentReport: runtimeNoopShellHardeningAlignmentReport,
    contractVerification: runtimeNoopShellHardeningContractVerificationReport,
    boundaryViolation: runtimeNoopShellHardeningBoundaryViolationReport,
  });

  const runtimeNoopShellHardeningSummaryFinal: RuntimeNoopShellHardeningSummary = {
    ...runtimeNoopShellHardeningSummary,
    recommendations: mergeSortedUniqueKo([
      ...runtimeNoopShellHardeningSummary.recommendations,
      ...runtimeNoopShellHardeningContract.recommendations,
      ...runtimeNoopShellHardeningInputEnvelope.recommendations,
      ...runtimeNoopShellHardeningOutputEnvelope.recommendations,
      ...runtimeNoopShellNoExecutionResultMetadata.recommendations,
      ...runtimeNoopShellHardeningSafetyGuard.recommendations,
      ...runtimeNoopShellHardeningContractVerificationReport.recommendations,
      ...runtimeNoopShellHardeningBoundaryViolationReport.recommendations,
      ...runtimeNoopShellHardeningPreflightSummary.recommendations,
      ...runtimeNoopShellHardeningReadinessVerificationReport.recommendations,
      ...runtimeNoopShellHardeningAlignmentReport.recommendations,
      ...runtimeNoopShellHardeningFinalSafetyGate.recommendations,
    ]),
  };

  return {
    runtimeNoopShellHardeningSummary: runtimeNoopShellHardeningSummaryFinal,
    runtimeNoopShellHardeningContract,
    runtimeNoopShellHardeningInputEnvelope,
    runtimeNoopShellHardeningOutputEnvelope,
    runtimeNoopShellNoExecutionResultMetadata,
    runtimeNoopShellHardeningSafetyGuard,
    runtimeNoopShellHardeningContractVerificationReport,
    runtimeNoopShellHardeningBoundaryViolationReport,
    runtimeNoopShellHardeningPreflightSummary,
    runtimeNoopShellHardeningReadinessVerificationReport,
    runtimeNoopShellHardeningAlignmentReport,
    runtimeNoopShellHardeningFinalSafetyGate,
  };
}
