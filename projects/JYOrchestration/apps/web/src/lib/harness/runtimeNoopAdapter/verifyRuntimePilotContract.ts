/**
 * H25 — pilot contract input/output·boundary·handoff **정합성 검증**(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeNoopAdapter } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimePilotContractVerificationReport } from "./runtimeNoopAdapterTypes";

const REQUIRED_INPUT_KEYS = [
  "project",
  "candidate flow",
  "control boundary",
  "execution candidate",
  "operator approval",
  "rollback",
  "audit",
  "safety envelope",
  "abort",
] as const;

export function verifyRuntimePilotContract(
  reports: RuntimeSemanticPlanningReportsBeforeNoopAdapter
): RuntimePilotContractVerificationReport {
  const inputSchema = reports.runtimePilotContractInputSchema;
  const outputSchema = reports.runtimePilotContractOutputSchema;
  const contract = reports.runtimePilotContractSummary;
  const boundary = reports.runtimeAdapterBoundarySummary;
  const handoff = reports.runtimePilotHandoffReadiness;
  const forbidden = reports.runtimeAdapterForbiddenOperationReport;

  const requirementsText = contract.contractInputRequirements.join(" ").toLowerCase();
  const missingRequiredInputs: string[] = [];
  for (const key of REQUIRED_INPUT_KEYS) {
    if (!requirementsText.includes(key)) {
      missingRequiredInputs.push(`missing contract input ref: ${key}`);
    }
  }
  if (inputSchema.requiredFields.length === 0) {
    missingRequiredInputs.push("runtimePilotContractInputSchema.requiredFields empty");
  }

  const outputContractAligned =
    outputSchema.expectedFields.length > 0 &&
    contract.contractOutputExpectations.length > 0 &&
    outputSchema.noOpResultMetadata.length > 0;

  const boundaryAligned =
    contract.adapterBoundaryMode === boundary.boundaryMode &&
    (contract.contractReadiness !== "blocked" || boundary.boundaryMode === "handoff_blocked");

  const handoffAligned =
    handoff.contractReadiness === contract.contractReadiness &&
    handoff.adapterBoundaryMode === boundary.boundaryMode;

  const forbiddenOperationAligned = forbidden.forbiddenOperations.length > 0;

  const findings: string[] = [];
  if (missingRequiredInputs.length > 0) {
    findings.push("required contract input coverage incomplete(메타)");
  }
  if (!outputContractAligned) {
    findings.push("output contract schema vs summary misaligned(메타)");
  }
  if (!boundaryAligned) {
    findings.push("contract summary vs adapter boundary misaligned(메타)");
  }
  if (!handoffAligned) {
    findings.push("handoff readiness vs contract/boundary misaligned(메타)");
  }
  if (!forbiddenOperationAligned) {
    findings.push("forbidden operation list empty(메타)");
  }

  let verificationStatus: RuntimePilotContractVerificationReport["verificationStatus"];
  if (contract.contractReadiness === "blocked" || handoff.handoffReadiness === "blocked") {
    verificationStatus = "failed";
  } else if (missingRequiredInputs.length === 0 && outputContractAligned && boundaryAligned && handoffAligned) {
    verificationStatus = "verified_noop";
  } else {
    verificationStatus = "partial";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(verificationStatus === "verified_noop"
      ? ["H25: contract verified no-op — adapter invocation 금지 유지"]
      : []),
    ...(verificationStatus === "failed" ? ["H25: contract verification failed — adapter skeleton blocked"] : []),
  ]);

  return {
    mode: "runtime_pilot_contract_verification_report",
    actualRuntimeOrchestrationEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    verificationStatus,
    missingRequiredInputs: mergeSortedUniqueKo(missingRequiredInputs),
    outputContractAligned,
    boundaryAligned,
    handoffAligned,
    forbiddenOperationAligned,
    findings: mergeSortedUniqueKo(findings),
    recommendations,
  };
}
