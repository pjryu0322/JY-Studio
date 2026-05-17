/**
 * Pilot Validation Phase 0 — diagnostic serialization (no report rebuild).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { SERIALIZED_RUNTIME_PILOT_VALIDATION_ACTUAL_FLAGS } from "./runtimePilotValidationConstants";
import type { RuntimePilotValidationReadOnlyChainSummary } from "./runtimePilotValidationTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function serializeSummary(s: RuntimePilotValidationReadOnlyChainSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    ...SERIALIZED_RUNTIME_PILOT_VALIDATION_ACTUAL_FLAGS,
    validationStatus: s.validationStatus,
    finalGateStatus: s.finalGateStatus,
    pilotValidationEntryReadiness: s.pilotValidationEntryReadiness,
    topBlockers: sortKo(s.topBlockers),
    topWarnings: sortKo(s.topWarnings),
    finalProofSummary: sortKo(s.finalProofSummary),
    userVisibleSummaryKo: s.userVisibleSummaryKo,
    operatorVisibleSummaryKo: s.operatorVisibleSummaryKo,
    recommendations: sortKo(s.recommendations),
  };
}

export function serializeRuntimePilotValidationDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<Record<string, unknown>> {
  return {
    runtimePilotValidationReadOnlyChainSummary: serializeSummary(
      reports.runtimePilotValidationReadOnlyChainSummary
    ),
  };
}
