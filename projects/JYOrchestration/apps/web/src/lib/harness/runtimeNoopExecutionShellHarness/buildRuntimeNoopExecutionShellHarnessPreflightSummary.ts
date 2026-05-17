/**
 * H32 — execution shell harness **preflight readiness**(read-only; H33 전 gate, shell execution 없음).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeNoopExecutionShellContractBoundary,
  RuntimeNoopExecutionShellHarnessBlockerReport,
  RuntimeNoopExecutionShellHarnessInputEnvelope,
  RuntimeNoopExecutionShellHarnessOutputEnvelope,
  RuntimeNoopExecutionShellHarnessPreflightReadiness,
  RuntimeNoopExecutionShellHarnessPreflightSummary,
  RuntimeNoopExecutionShellHarnessSafetyGuard,
  RuntimeNoopExecutionShellHarnessSummary,
  RuntimeNoopExecutionShellNoopResultMetadata,
} from "./runtimeNoopExecutionShellHarnessTypes";

function boundaryComplete(boundary: RuntimeNoopExecutionShellContractBoundary): boolean {
  return (
    boundary.requiredContractInputs.length > 0 &&
    boundary.expectedContractOutputs.length > 0 &&
    boundary.forbiddenContractOperations.length > 0
  );
}

function guardValid(guard: RuntimeNoopExecutionShellHarnessSafetyGuard): boolean {
  return (
    guard.actualShellExecutionForbidden === true &&
    guard.actualExecutionForbidden === true &&
    guard.actualAdapterInvocationForbidden === true &&
    guard.actualProviderRoutingForbidden === true &&
    guard.actualQueueControlForbidden === true &&
    guard.actualRollbackForbidden === true &&
    guard.actualPromptMutationForbidden === true &&
    guard.actualTokenEnforcementForbidden === true &&
    guard.actualContextPruningForbidden === true
  );
}

export function buildRuntimeNoopExecutionShellHarnessPreflightSummary(input: {
  readonly summary: RuntimeNoopExecutionShellHarnessSummary;
  readonly contractBoundary: RuntimeNoopExecutionShellContractBoundary;
  readonly inputEnvelope: RuntimeNoopExecutionShellHarnessInputEnvelope;
  readonly outputEnvelope: RuntimeNoopExecutionShellHarnessOutputEnvelope;
  readonly result: RuntimeNoopExecutionShellNoopResultMetadata;
  readonly safetyGuard: RuntimeNoopExecutionShellHarnessSafetyGuard;
  readonly blockerReport: RuntimeNoopExecutionShellHarnessBlockerReport;
}): RuntimeNoopExecutionShellHarnessPreflightSummary {
  const { summary, contractBoundary, inputEnvelope, outputEnvelope, result, safetyGuard, blockerReport } =
    input;

  const boundaryOk = boundaryComplete(contractBoundary);
  const envelopesOk = inputEnvelope.envelopeRows.length > 0 && outputEnvelope.envelopeRows.length > 0;

  const checklist = mergeSortedUniqueKo([
    "execution shell harness summary exists",
    "execution shell contract boundary exists",
    "execution shell harness input envelope exists",
    "execution shell harness output envelope exists",
    "execution shell no-op result metadata exists",
    "execution shell harness safety guard exists",
    "execution shell harness blocker report exists",
    `harnessReadiness:${summary.harnessReadiness}`,
    `harnessMode:${summary.harnessMode}`,
    `contractBoundaryComplete:${boundaryOk}`,
    `inputEnvelopeRows:${inputEnvelope.envelopeRows.length}`,
    `outputEnvelopeRows:${outputEnvelope.envelopeRows.length}`,
    `harnessBlockers:${summary.harnessBlockers.length}`,
    `diagnosticOnly:${result.diagnosticOnly}`,
    `safetyGuardValid:${guardValid(safetyGuard)}`,
    "overlayWordingStabilized:H32",
    "diagnosticBundleIncludesShellHarnessPreflight:metadata",
  ]);

  const blockers: string[] = [];
  if (summary.harnessBlockers.length > 0) {
    blockers.push(...summary.harnessBlockers.slice(0, 3));
  }
  if (blockerReport.blockers.length > 0) {
    blockers.push(...blockerReport.blockers.slice(0, 3));
  }
  if (summary.harnessReadiness === "blocked") {
    blockers.push("execution shell harness readiness blocked");
  }
  if (result.diagnosticOnly !== true) {
    blockers.push("execution shell no-op result metadata not diagnosticOnly");
  }
  if (!guardValid(safetyGuard)) {
    blockers.push("execution shell harness safety guard violation");
  }
  if (!boundaryOk) {
    blockers.push("execution shell contract boundary incomplete");
  }

  let preflightReadiness: RuntimeNoopExecutionShellHarnessPreflightReadiness;
  if (
    summary.harnessReadiness === "blocked" ||
    result.diagnosticOnly !== true ||
    !guardValid(safetyGuard) ||
    summary.harnessBlockers.length > 0 ||
    blockerReport.blockers.length > 0
  ) {
    preflightReadiness = "blocked";
  } else if (summary.harnessReadiness === "watch" || !boundaryOk || !envelopesOk) {
    preflightReadiness = "watch";
  } else if (
    summary.harnessReadiness === "shell_harness_metadata_ready" &&
    boundaryOk &&
    envelopesOk &&
    result.diagnosticOnly === true &&
    guardValid(safetyGuard) &&
    summary.harnessBlockers.length === 0 &&
    blockerReport.blockers.length === 0
  ) {
    preflightReadiness = "ready_metadata";
  } else {
    preflightReadiness = "not_ready";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(preflightReadiness === "ready_metadata"
      ? ["H32: execution shell harness preflight ready_metadata — H33 전 gate 통과(shell execution 없음)"]
      : []),
    ...(preflightReadiness === "watch"
      ? ["H32: execution shell harness preflight watch — contract boundary·envelope 재검토"]
      : []),
    ...(preflightReadiness === "blocked"
      ? ["H32: execution shell harness preflight blocked — guard·result·blocker 정렬"]
      : []),
    ...(preflightReadiness === "not_ready" ? ["H32: execution shell harness preflight not_ready — H31.5 gate 정렬"] : []),
    ...blockerReport.recommendations,
  ]);

  return {
    mode: "runtime_noop_execution_shell_harness_preflight_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    preflightReadiness,
    checklist,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
