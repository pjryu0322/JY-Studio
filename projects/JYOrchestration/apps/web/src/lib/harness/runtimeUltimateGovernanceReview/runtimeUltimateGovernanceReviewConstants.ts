/**
 * H40 — ultimate governance review 공통 상수(read-only).
 */

import {
  RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED,
  SERIALIZED_RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS,
} from "@/lib/harness/runtimeShared/runtimeReadOnlyActualFlags";
import type { RuntimeUltimateNoEnforcementProof } from "./runtimeUltimateGovernanceReviewTypes";

export const RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED =
  RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED;

export const SERIALIZED_RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS =
  SERIALIZED_RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS;

export const FINAL_ORCHESTRATION_READINESS_BOUNDARY_SOURCE_LAYER =
  "runtimeFinalReleaseGovernanceGateFinalSafetyGate" as const;

export const FINAL_ORCHESTRATION_READINESS_BOUNDARY_TARGET_LAYER = "finalOrchestrationReadinessBoundary" as const;

type UltimateNoEnforcementMustBeFalseKey = keyof Pick<
  RuntimeUltimateNoEnforcementProof,
  | "runtimeOrchestrated"
  | "executionPerformed"
  | "executionRoutingPerformed"
  | "releaseEnforced"
  | "approvalEnforced"
  | "noopShellExecuted"
  | "executionShellExecuted"
  | "runtimeAdapterInvoked"
  | "providerRoutingPerformed"
  | "queueControlPerformed"
  | "rollbackPerformed"
  | "executionBlocked"
  | "mergeBlocked"
  | "promptMutated"
  | "tokenEnforced"
  | "contextPruned"
  | "retrievalOrchestrated"
>;

export const ULTIMATE_GOVERNANCE_NO_ENFORCEMENT_MUST_BE_FALSE: readonly {
  readonly key: UltimateNoEnforcementMustBeFalseKey;
  readonly reportPrefix: "runtimeUltimateNoEnforcementProof";
}[] = [
  { key: "runtimeOrchestrated", reportPrefix: "runtimeUltimateNoEnforcementProof" },
  { key: "executionPerformed", reportPrefix: "runtimeUltimateNoEnforcementProof" },
  { key: "executionRoutingPerformed", reportPrefix: "runtimeUltimateNoEnforcementProof" },
  { key: "releaseEnforced", reportPrefix: "runtimeUltimateNoEnforcementProof" },
  { key: "approvalEnforced", reportPrefix: "runtimeUltimateNoEnforcementProof" },
  { key: "noopShellExecuted", reportPrefix: "runtimeUltimateNoEnforcementProof" },
  { key: "executionShellExecuted", reportPrefix: "runtimeUltimateNoEnforcementProof" },
  { key: "runtimeAdapterInvoked", reportPrefix: "runtimeUltimateNoEnforcementProof" },
  { key: "providerRoutingPerformed", reportPrefix: "runtimeUltimateNoEnforcementProof" },
  { key: "queueControlPerformed", reportPrefix: "runtimeUltimateNoEnforcementProof" },
  { key: "rollbackPerformed", reportPrefix: "runtimeUltimateNoEnforcementProof" },
  { key: "executionBlocked", reportPrefix: "runtimeUltimateNoEnforcementProof" },
  { key: "mergeBlocked", reportPrefix: "runtimeUltimateNoEnforcementProof" },
  { key: "promptMutated", reportPrefix: "runtimeUltimateNoEnforcementProof" },
  { key: "tokenEnforced", reportPrefix: "runtimeUltimateNoEnforcementProof" },
  { key: "contextPruned", reportPrefix: "runtimeUltimateNoEnforcementProof" },
  { key: "retrievalOrchestrated", reportPrefix: "runtimeUltimateNoEnforcementProof" },
];

export const ULTIMATE_GOVERNANCE_REVIEW_WORDING_RISK_PHRASES: readonly {
  readonly phrase: string;
  readonly label: string;
}[] = [
  { phrase: "actualexecutionenabled=true", label: "actualExecutionEnabled=true" },
  { phrase: "actualruntimeorchestrationenabled=true", label: "actualRuntimeOrchestrationEnabled=true" },
  { phrase: "runtimeorchestrated=true", label: "runtimeOrchestrated=true" },
  { phrase: "executionperformed=true", label: "executionPerformed=true" },
  { phrase: "releaseenforced=true", label: "releaseEnforced=true" },
  { phrase: "approvalenforced=true", label: "approvalEnforced=true" },
  { phrase: "retrievalorchestrated=true", label: "retrievalOrchestrated=true" },
  { phrase: "diagnosticonly=false", label: "diagnosticOnly=false" },
  { phrase: "actualorchestrationforbidden=false", label: "actualOrchestrationForbidden=false" },
];

export const ULTIMATE_GOVERNANCE_VERIFICATION_CHECKLIST_LABEL_ROWS = [
  "final release governance gate final gate ready_metadata",
  "h40 entry readiness ready_metadata",
  "ultimate no-enforcement proof diagnosticOnly",
  "orchestration-forbidden proof complete",
] as const;

export const ULTIMATE_GOVERNANCE_VERIFICATION_INPUT_ENVELOPE_FRAGMENTS = [
  "runtimeFinalReleaseGovernanceGateFinalSafetyGate",
  "runtimeFinalReleaseGovernanceGateVerificationReport",
  "runtimeFinalReleaseGovernanceGateAlignmentReport",
  "runtimeFinalReleaseGovernanceGateViolationReport",
] as const;

export const ULTIMATE_GOVERNANCE_FINAL_SAFETY_CHECKLIST_STATIC_ROWS = [
  "actualOrchestrationDisabled:true",
  "actualExecutionDisabled:true",
  "diagnosticOnlyRequired:true",
] as const;

export const FINAL_ORCHESTRATION_READINESS_FORBIDDEN_BOUNDARY_OPERATIONS = [
  "actual orchestration",
  "actual execution",
  "actual execution routing",
  "actual release enforcement",
  "actual approval enforcement",
  "actual no-op shell execution",
  "actual execution shell execution",
  "actual runtime adapter invocation",
  "actual provider routing",
  "actual queue control",
  "actual rollback execution",
  "actual execution blocking",
  "actual merge blocking",
  "prompt mutation",
  "token enforcement",
  "context pruning",
  "retrieval orchestration",
] as const;
