/**
 * H25 / H25.5 — pilot contract·skeleton·no-op result **schema coverage 검증**(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeNoopAdapter } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeNoopAdapterResultMetadata,
  RuntimeNoopAdapterSkeleton,
  RuntimePilotContractVerificationReport,
} from "./runtimeNoopAdapterTypes";

/** input schema requiredFields → summary/skeleton blob domain 힌트. */
const INPUT_FIELD_DOMAINS: Readonly<Record<string, readonly string[]>> = {
  projectScopeReference: ["project"],
  candidateFlowMetadata: ["candidate", "flow"],
  controlBoundarySummaryRef: ["control", "boundary"],
  executionCandidateSummaryRef: ["execution", "candidate"],
  operatorApprovalSummaryRef: ["operator", "approval"],
  rollbackReadinessSummaryRef: ["rollback"],
  auditReadinessSummaryRef: ["audit"],
  controlledPilotSafetyEnvelopeRef: ["safety", "envelope", "pilot"],
  abortConditionMetadataRef: ["abort"],
};

const NOOP_RESULT_REQUIRED_TOKENS = [
  "noopaccepted=false",
  "adapterinvoked=false",
  "diagnosticonly=true",
] as const;

function normalizeBlob(parts: readonly string[]): string {
  return parts.join(" ").toLowerCase().replace(/\s+/g, "");
}

function domainCovered(domains: readonly string[], blob: string): boolean {
  return domains.some((d) => blob.includes(d.replace(/\s+/g, "")));
}

export function verifyRuntimePilotContract(
  reports: RuntimeSemanticPlanningReportsBeforeNoopAdapter,
  skeleton: RuntimeNoopAdapterSkeleton,
  result: RuntimeNoopAdapterResultMetadata
): RuntimePilotContractVerificationReport {
  const inputSchema = reports.runtimePilotContractInputSchema;
  const outputSchema = reports.runtimePilotContractOutputSchema;
  const contract = reports.runtimePilotContractSummary;
  const boundary = reports.runtimeAdapterBoundarySummary;
  const handoff = reports.runtimePilotHandoffReadiness;
  const forbidden = reports.runtimeAdapterForbiddenOperationReport;

  const summaryBlob = normalizeBlob(contract.contractInputRequirements);
  const skeletonBlob = normalizeBlob([
    ...skeleton.acceptedContractInputs,
    ...inputSchema.requiredFields,
  ]);
  const resultBlob = normalizeBlob(result.resultRows);

  const missingRequiredInputs: string[] = [];
  if (inputSchema.requiredFields.length === 0) {
    missingRequiredInputs.push("runtimePilotContractInputSchema.requiredFields empty");
  }
  for (const field of inputSchema.requiredFields) {
    const domains = INPUT_FIELD_DOMAINS[field] ?? [field.replace(/Ref$/i, "").toLowerCase()];
    if (!domainCovered(domains, summaryBlob)) {
      missingRequiredInputs.push(`summary missing domain for schema field: ${field}`);
    }
    if (!domainCovered(domains, skeletonBlob)) {
      missingRequiredInputs.push(`skeleton missing domain for schema field: ${field}`);
    }
  }
  if (contract.contractInputRequirements.length === 0) {
    missingRequiredInputs.push("runtimePilotContractSummary.contractInputRequirements empty");
  }
  if (skeleton.acceptedContractInputs.length === 0) {
    missingRequiredInputs.push("runtimeNoopAdapterSkeleton.acceptedContractInputs empty");
  }

  const inputSchemaCoverageComplete =
    inputSchema.requiredFields.length > 0 && missingRequiredInputs.every((m) => !m.includes("schema field"));

  const summaryRequirementsCoverageComplete =
    contract.contractInputRequirements.length > 0 &&
    inputSchema.requiredFields.length > 0 &&
    missingRequiredInputs.filter((m) => m.includes("summary missing")).length === 0;

  const skeletonAcceptedInputsCoverageComplete =
    skeleton.acceptedContractInputs.length > 0 &&
    missingRequiredInputs.filter((m) => m.includes("skeleton missing")).length === 0;

  const outputContractAligned =
    outputSchema.expectedFields.length > 0 &&
    contract.contractOutputExpectations.length > 0 &&
    outputSchema.noOpResultMetadata.length > 0;

  const noopResultOutputCoverageComplete =
    outputContractAligned &&
    result.diagnosticOnly === true &&
    result.noopAccepted === false &&
    NOOP_RESULT_REQUIRED_TOKENS.every((t) => resultBlob.includes(t));

  const boundaryAligned =
    contract.adapterBoundaryMode === boundary.boundaryMode &&
    (contract.contractReadiness !== "blocked" || boundary.boundaryMode === "handoff_blocked");

  const handoffAligned =
    handoff.contractReadiness === contract.contractReadiness &&
    handoff.adapterBoundaryMode === boundary.boundaryMode;

  const forbiddenOperationAligned = forbidden.forbiddenOperations.length > 0;

  const findings: string[] = [];
  if (!inputSchemaCoverageComplete || inputSchema.requiredFields.length === 0) {
    findings.push("input schema coverage incomplete");
  }
  if (!summaryRequirementsCoverageComplete) {
    findings.push("summary requirement coverage incomplete");
  }
  if (!skeletonAcceptedInputsCoverageComplete) {
    findings.push("skeleton input coverage incomplete");
  }
  if (!noopResultOutputCoverageComplete) {
    findings.push("noop result output coverage incomplete");
  }
  if (!boundaryAligned || !handoffAligned) {
    findings.push("boundary/handoff alignment incomplete");
  }
  if (!forbiddenOperationAligned) {
    findings.push("forbidden operation list empty(메타)");
  }

  let verificationStatus: RuntimePilotContractVerificationReport["verificationStatus"];
  if (contract.contractReadiness === "blocked" || handoff.handoffReadiness === "blocked") {
    verificationStatus = "failed";
  } else if (
    missingRequiredInputs.length === 0 &&
    inputSchemaCoverageComplete &&
    summaryRequirementsCoverageComplete &&
    skeletonAcceptedInputsCoverageComplete &&
    noopResultOutputCoverageComplete &&
    boundaryAligned &&
    handoffAligned &&
    forbiddenOperationAligned
  ) {
    verificationStatus = "verified_noop";
  } else {
    verificationStatus = "partial";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(verificationStatus === "verified_noop"
      ? ["H25.5: contract verified no-op — adapter invocation 금지 유지"]
      : []),
    ...(verificationStatus === "failed" ? ["H25.5: contract verification failed — adapter skeleton blocked"] : []),
    ...(verificationStatus === "partial" ? ["H25.5: contract partial — schema·skeleton·noop result 정렬"] : []),
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
