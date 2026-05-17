/**
 * H44 — pilot execution readiness **output envelope** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED } from "./runtimePilotExecutionReadinessConstants";
import type {
  RuntimeFinalPilotExecutionForbiddenProof,
  RuntimeFinalPilotNoExecutionProof,
  RuntimePilotExecutionReadinessBlockerReport,
  RuntimePilotExecutionReadinessSummary,
  RuntimePilotExecutionReadinessOutputEnvelope,
} from "./runtimePilotExecutionReadinessTypes";

export function buildRuntimePilotExecutionReadinessOutputEnvelope(input: {
  readonly summary: RuntimePilotExecutionReadinessSummary;
  readonly noExecutionProof: RuntimeFinalPilotNoExecutionProof;
  readonly forbiddenProof: RuntimeFinalPilotExecutionForbiddenProof;
  readonly blockerReport: RuntimePilotExecutionReadinessBlockerReport;
}): RuntimePilotExecutionReadinessOutputEnvelope {
  const { summary, noExecutionProof, forbiddenProof, blockerReport } = input;

  const accepted =
    summary.readinessStatus === "pilot_execution_readiness_metadata_ready" &&
    blockerReport.blockers.length === 0;

  const envelopeRows = mergeSortedUniqueKo([
    `pilotExecutionReadinessAcceptedMetadata:${accepted}`,
    `pilotExecutionReadinessBoundaryMetadata:${summary.readinessMode}`,
    `finalPilotNoExecutionProofDiagnosticOnly:${noExecutionProof.diagnosticOnly}`,
    `finalPilotExecutionForbiddenProofComplete:${forbiddenProof.actualPilotActivationForbidden}`,
    `pilotExecutionReadinessBlockerCount:${blockerReport.blockers.length}`,
    `readinessMode:${summary.readinessMode}`,
    "auditTraceMetadata:planning_only",
    ...noExecutionProof.proofRows.slice(0, 4),
    ...forbiddenProof.proofRows.slice(0, 4),
  ]);

  return {
    mode: "runtime_pilot_execution_readiness_output_envelope",
    ...RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED,
    envelopeRows,
    recommendations: mergeSortedUniqueKo([
      "H44: pilot execution readiness output envelope — accepted/rejected·boundary metadata only(pilot activation·execution 없음)",
    ]),
  };
}
