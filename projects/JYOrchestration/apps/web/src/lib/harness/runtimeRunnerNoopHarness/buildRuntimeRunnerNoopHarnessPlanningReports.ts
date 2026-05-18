/**
 * H30–H30.5 — runner no-op harness planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeRunnerNoopHarness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { buildRuntimeRunnerNoopHarnessAlignmentReport } from "./buildRuntimeRunnerNoopHarnessAlignmentReport";
import { buildRuntimeRunnerNoopHarnessFinalSafetyGate } from "./buildRuntimeRunnerNoopHarnessFinalSafetyGate";
import { buildRuntimeRunnerNoopHarnessPreflightSummary } from "./buildRuntimeRunnerNoopHarnessPreflightSummary";
import { buildRuntimeRunnerNoopHarnessSafetyGuard } from "./buildRuntimeRunnerNoopHarnessSafetyGuard";
import { buildRuntimeRunnerNoopHarnessSummary } from "./buildRuntimeRunnerNoopHarnessSummary";
import { buildRuntimeRunnerNoopInvocationEnvelope } from "./buildRuntimeRunnerNoopInvocationEnvelope";
import { buildRuntimeRunnerNoopResultMetadata } from "./buildRuntimeRunnerNoopResultMetadata";
import { detectRuntimeRunnerNoopHarnessBoundaryViolations } from "./detectRuntimeRunnerNoopHarnessBoundaryViolations";
import { verifyRuntimeRunnerNoopHarnessContract } from "./verifyRuntimeRunnerNoopHarnessContract";
import { verifyRuntimeRunnerNoopHarnessReadiness } from "./verifyRuntimeRunnerNoopHarnessReadiness";
import type { RuntimeRunnerNoopHarnessPlanningReports, RuntimeRunnerNoopHarnessSummary } from "./runtimeRunnerNoopHarnessTypes";

export type { RuntimeRunnerNoopHarnessPlanningReports } from "./runtimeRunnerNoopHarnessTypes";

export function buildRuntimeRunnerNoopHarnessPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeRunnerNoopHarness
): RuntimeRunnerNoopHarnessPlanningReports {
  const runtimeRunnerNoopHarnessSummary = buildRuntimeRunnerNoopHarnessSummary(reports);
  const runtimeRunnerNoopInvocationEnvelope = buildRuntimeRunnerNoopInvocationEnvelope(reports);
  const runtimeRunnerNoopResultMetadata = buildRuntimeRunnerNoopResultMetadata();
  const runtimeRunnerNoopHarnessSafetyGuard = buildRuntimeRunnerNoopHarnessSafetyGuard();

  const runtimeRunnerNoopHarnessContractVerificationReport = verifyRuntimeRunnerNoopHarnessContract({
    summary: runtimeRunnerNoopHarnessSummary,
    envelope: runtimeRunnerNoopInvocationEnvelope,
    result: runtimeRunnerNoopResultMetadata,
    safetyGuard: runtimeRunnerNoopHarnessSafetyGuard,
  });

  const runtimeRunnerNoopHarnessBoundaryViolationReport = detectRuntimeRunnerNoopHarnessBoundaryViolations({
    summary: runtimeRunnerNoopHarnessSummary,
    envelope: runtimeRunnerNoopInvocationEnvelope,
    result: runtimeRunnerNoopResultMetadata,
    safetyGuard: runtimeRunnerNoopHarnessSafetyGuard,
  });

  const runtimeRunnerNoopHarnessPreflightSummary = buildRuntimeRunnerNoopHarnessPreflightSummary({
    summary: runtimeRunnerNoopHarnessSummary,
    contractVerification: runtimeRunnerNoopHarnessContractVerificationReport,
    boundaryViolation: runtimeRunnerNoopHarnessBoundaryViolationReport,
    result: runtimeRunnerNoopResultMetadata,
  });

  const runtimeRunnerNoopHarnessReadinessVerificationReport = verifyRuntimeRunnerNoopHarnessReadiness({
    summary: runtimeRunnerNoopHarnessSummary,
    preflight: runtimeRunnerNoopHarnessPreflightSummary,
    contractVerification: runtimeRunnerNoopHarnessContractVerificationReport,
    boundaryViolation: runtimeRunnerNoopHarnessBoundaryViolationReport,
    result: runtimeRunnerNoopResultMetadata,
    safetyGuard: runtimeRunnerNoopHarnessSafetyGuard,
  });

  const runtimeRunnerNoopHarnessAlignmentReport = buildRuntimeRunnerNoopHarnessAlignmentReport({
    envelope: runtimeRunnerNoopInvocationEnvelope,
    result: runtimeRunnerNoopResultMetadata,
    safetyGuard: runtimeRunnerNoopHarnessSafetyGuard,
    contractVerification: runtimeRunnerNoopHarnessContractVerificationReport,
    boundaryViolation: runtimeRunnerNoopHarnessBoundaryViolationReport,
    preflight: runtimeRunnerNoopHarnessPreflightSummary,
  });

  const runtimeRunnerNoopHarnessFinalSafetyGate = buildRuntimeRunnerNoopHarnessFinalSafetyGate({
    summary: runtimeRunnerNoopHarnessSummary,
    preflight: runtimeRunnerNoopHarnessPreflightSummary,
    contractVerification: runtimeRunnerNoopHarnessContractVerificationReport,
    boundaryViolation: runtimeRunnerNoopHarnessBoundaryViolationReport,
    readinessVerification: runtimeRunnerNoopHarnessReadinessVerificationReport,
    alignmentReport: runtimeRunnerNoopHarnessAlignmentReport,
  });

  const runtimeRunnerNoopHarnessSummaryFinal: RuntimeRunnerNoopHarnessSummary = {
    ...runtimeRunnerNoopHarnessSummary,
    recommendations: mergeSortedUniqueKo([
      ...runtimeRunnerNoopHarnessSummary.recommendations,
      ...runtimeRunnerNoopInvocationEnvelope.recommendations,
      ...runtimeRunnerNoopResultMetadata.recommendations,
      ...runtimeRunnerNoopHarnessSafetyGuard.recommendations,
      ...runtimeRunnerNoopHarnessContractVerificationReport.recommendations,
      ...runtimeRunnerNoopHarnessBoundaryViolationReport.recommendations,
      ...runtimeRunnerNoopHarnessPreflightSummary.recommendations,
      ...runtimeRunnerNoopHarnessReadinessVerificationReport.recommendations,
      ...runtimeRunnerNoopHarnessAlignmentReport.recommendations,
      ...runtimeRunnerNoopHarnessFinalSafetyGate.recommendations,
    ]),
  };

  return {
    runtimeRunnerNoopHarnessSummary: runtimeRunnerNoopHarnessSummaryFinal,
    runtimeRunnerNoopInvocationEnvelope,
    runtimeRunnerNoopResultMetadata,
    runtimeRunnerNoopHarnessSafetyGuard,
    runtimeRunnerNoopHarnessContractVerificationReport,
    runtimeRunnerNoopHarnessBoundaryViolationReport,
    runtimeRunnerNoopHarnessPreflightSummary,
    runtimeRunnerNoopHarnessReadinessVerificationReport,
    runtimeRunnerNoopHarnessAlignmentReport,
    runtimeRunnerNoopHarnessFinalSafetyGate,
  };
}
