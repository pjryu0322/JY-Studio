/**
 * H39 / H39.5 — final release governance gate 공통 상수(read-only).
 */

import type {
  RuntimeFinalReleaseGovernanceGatePolicy,
  RuntimeFinalReleaseGovernanceGateSummary,
} from "./runtimeFinalReleaseGovernanceGateTypes";

export const RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS_DISABLED = {
  actualRuntimeOrchestrationEnabled: false,
  actualPilotExecutionEnabled: false,
  actualNoopShellExecutionEnabled: false,
  actualExecutionShellExecutionEnabled: false,
  actualReleaseEnforcementEnabled: false,
  actualRuntimeAdapterInvocationEnabled: false,
  actualExecutionEnabled: false,
  actualExecutionRoutingEnabled: false,
  actualProviderRoutingEnabled: false,
  actualQueueControlEnabled: false,
  actualRollbackExecutionEnabled: false,
  actualApprovalEnforcementEnabled: false,
  actualExecutionBlockingEnabled: false,
  actualMergeBlockingEnabled: false,
} as const;

export const SERIALIZED_RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS = {
  ...RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS_DISABLED,
};

export const FINAL_RELEASE_GOVERNANCE_GATE_SCOPE_SOURCE_LAYER =
  "runtimeGovernanceReleaseReadinessFinalSafetyGate" as const;

export const FINAL_RELEASE_GOVERNANCE_GATE_SCOPE_TARGET_LAYER = "finalReleaseGovernanceGateCandidate" as const;

export const FINAL_RELEASE_GOVERNANCE_GATE_REQUIRED_FORBIDDEN_SCOPE_FRAGMENTS = [
  "actual execution",
  "release enforcement",
  "approval enforcement",
  "execution blocking",
  "merge blocking",
] as const;

export const FINAL_RELEASE_GOVERNANCE_GATE_WORDING_RISK_PHRASES: readonly {
  readonly phrase: string;
  readonly label: string;
}[] = [
  { phrase: "actualexecutionenabled=true", label: "actualExecutionEnabled=true" },
  { phrase: "actualexecutionroutingenabled=true", label: "actualExecutionRoutingEnabled=true" },
  { phrase: "actualreleaseenforcementenabled=true", label: "actualReleaseEnforcementEnabled=true" },
  { phrase: "actualapprovalenforcementenabled=true", label: "actualApprovalEnforcementEnabled=true" },
  { phrase: "actualproviderroutingenabled=true", label: "actualProviderRoutingEnabled=true" },
  { phrase: "actualqueuecontrolenabled=true", label: "actualQueueControlEnabled=true" },
  { phrase: "actualrollbackexecutionenabled=true", label: "actualRollbackExecutionEnabled=true" },
  { phrase: "actualexecutionblockingenabled=true", label: "actualExecutionBlockingEnabled=true" },
  { phrase: "actualmergeblockingenabled=true", label: "actualMergeBlockingEnabled=true" },
  { phrase: "executionperformed=true", label: "executionPerformed=true" },
  { phrase: "executionrouting=true", label: "executionRouting=true" },
  { phrase: "executionroutingperformed=true", label: "executionRoutingPerformed=true" },
  { phrase: "releaseenforced=true", label: "releaseEnforced=true" },
  { phrase: "approvalenforced=true", label: "approvalEnforced=true" },
  { phrase: "providerrouting=true", label: "providerRouting=true" },
  { phrase: "queuecontrol=true", label: "queueControl=true" },
  { phrase: "rollbackexecution=true", label: "rollbackExecution=true" },
  { phrase: "executionblocked=true", label: "executionBlocked=true" },
  { phrase: "mergeblocked=true", label: "mergeBlocked=true" },
  { phrase: "actualexecutionforbidden=false", label: "actualExecutionForbidden=false" },
  { phrase: "actualapprovalenforcementforbidden=false", label: "actualApprovalEnforcementForbidden=false" },
  { phrase: "actualexecutionblockingforbidden=false", label: "actualExecutionBlockingForbidden=false" },
  { phrase: "actualmergeblockingforbidden=false", label: "actualMergeBlockingForbidden=false" },
];

type SummaryActualFlagKey = keyof Pick<
  RuntimeFinalReleaseGovernanceGateSummary,
  | "actualExecutionEnabled"
  | "actualExecutionRoutingEnabled"
  | "actualReleaseEnforcementEnabled"
  | "actualApprovalEnforcementEnabled"
  | "actualProviderRoutingEnabled"
  | "actualQueueControlEnabled"
  | "actualRollbackExecutionEnabled"
  | "actualExecutionBlockingEnabled"
  | "actualMergeBlockingEnabled"
>;

type PolicyForbiddenFlagKey = keyof Pick<
  RuntimeFinalReleaseGovernanceGatePolicy,
  | "actualExecutionForbidden"
  | "actualExecutionRoutingForbidden"
  | "actualReleaseEnforcementForbidden"
  | "actualApprovalEnforcementForbidden"
  | "actualProviderRoutingForbidden"
  | "actualQueueControlForbidden"
  | "actualRollbackForbidden"
  | "actualExecutionBlockingForbidden"
  | "actualMergeBlockingForbidden"
>;

export const FINAL_RELEASE_GATE_SUMMARY_ACTUAL_MUST_BE_FALSE: readonly {
  readonly key: SummaryActualFlagKey;
  readonly reportPrefix: "runtimeFinalReleaseGovernanceGateSummary";
}[] = [
  { key: "actualExecutionEnabled", reportPrefix: "runtimeFinalReleaseGovernanceGateSummary" },
  { key: "actualExecutionRoutingEnabled", reportPrefix: "runtimeFinalReleaseGovernanceGateSummary" },
  { key: "actualReleaseEnforcementEnabled", reportPrefix: "runtimeFinalReleaseGovernanceGateSummary" },
  { key: "actualApprovalEnforcementEnabled", reportPrefix: "runtimeFinalReleaseGovernanceGateSummary" },
  { key: "actualProviderRoutingEnabled", reportPrefix: "runtimeFinalReleaseGovernanceGateSummary" },
  { key: "actualQueueControlEnabled", reportPrefix: "runtimeFinalReleaseGovernanceGateSummary" },
  { key: "actualRollbackExecutionEnabled", reportPrefix: "runtimeFinalReleaseGovernanceGateSummary" },
  { key: "actualExecutionBlockingEnabled", reportPrefix: "runtimeFinalReleaseGovernanceGateSummary" },
  { key: "actualMergeBlockingEnabled", reportPrefix: "runtimeFinalReleaseGovernanceGateSummary" },
];

export const FINAL_RELEASE_GATE_POLICY_FORBIDDEN_MUST_BE_TRUE: readonly {
  readonly key: PolicyForbiddenFlagKey;
  readonly reportPrefix: "runtimeFinalReleaseGovernanceGatePolicy";
}[] = [
  { key: "actualExecutionForbidden", reportPrefix: "runtimeFinalReleaseGovernanceGatePolicy" },
  { key: "actualExecutionRoutingForbidden", reportPrefix: "runtimeFinalReleaseGovernanceGatePolicy" },
  { key: "actualReleaseEnforcementForbidden", reportPrefix: "runtimeFinalReleaseGovernanceGatePolicy" },
  { key: "actualApprovalEnforcementForbidden", reportPrefix: "runtimeFinalReleaseGovernanceGatePolicy" },
  { key: "actualProviderRoutingForbidden", reportPrefix: "runtimeFinalReleaseGovernanceGatePolicy" },
  { key: "actualQueueControlForbidden", reportPrefix: "runtimeFinalReleaseGovernanceGatePolicy" },
  { key: "actualRollbackForbidden", reportPrefix: "runtimeFinalReleaseGovernanceGatePolicy" },
  { key: "actualExecutionBlockingForbidden", reportPrefix: "runtimeFinalReleaseGovernanceGatePolicy" },
  { key: "actualMergeBlockingForbidden", reportPrefix: "runtimeFinalReleaseGovernanceGatePolicy" },
];

/** H39.5 verification — policy forbidden 플래그(verifyRuntimeFinalReleaseGovernanceGateReadiness). */
export const FINAL_RELEASE_GATE_VERIFICATION_POLICY_FORBIDDEN_MUST_BE_TRUE: readonly {
  readonly key: PolicyForbiddenFlagKey;
}[] = [
  { key: "actualExecutionForbidden" },
  { key: "actualExecutionRoutingForbidden" },
  { key: "actualReleaseEnforcementForbidden" },
  { key: "actualApprovalEnforcementForbidden" },
  { key: "actualExecutionBlockingForbidden" },
  { key: "actualMergeBlockingForbidden" },
];

/** H39.5 alignment — policy forbidden 플래그(buildRuntimeFinalReleaseGovernanceGateAlignmentReport). */
export const FINAL_RELEASE_GATE_ALIGNMENT_POLICY_FORBIDDEN_MUST_BE_TRUE: readonly {
  readonly key: PolicyForbiddenFlagKey;
}[] = [
  { key: "actualExecutionForbidden" },
  { key: "actualApprovalEnforcementForbidden" },
  { key: "actualExecutionBlockingForbidden" },
  { key: "actualMergeBlockingForbidden" },
];

export const FINAL_RELEASE_GATE_VERIFICATION_CHECKLIST_LABEL_ROWS = [
  "governance release-readiness final gate ready_metadata",
  "h39 entry readiness ready_metadata",
  "governance release-readiness verification verified_metadata",
  "governance release-readiness alignment aligned_metadata",
] as const;

export const FINAL_RELEASE_GATE_VERIFICATION_CHECKLIST_ACTUAL_DISABLED_ROWS = [
  "actual execution disabled",
  "actual release enforcement disabled",
  "actual approval enforcement disabled",
  "actual execution blocking disabled",
  "actual merge blocking disabled",
] as const;

export const FINAL_RELEASE_GATE_ALIGNMENT_CHECKLIST_LABEL_ROWS = [
  "governance release-readiness final gate ready_metadata",
  "no release-readiness actual flag violations",
  "no release-readiness proof violations",
] as const;

export const FINAL_RELEASE_GOVERNANCE_GATE_FINAL_SAFETY_CHECKLIST_STATIC_ROWS = [
  "h40EntryReadiness:metadata_only_gate",
  "actualExecutionForbidden:true",
  "actualReleaseEnforcementForbidden:true",
  "actualApprovalEnforcementForbidden:true",
  "actualExecutionBlockingForbidden:true",
  "actualMergeBlockingForbidden:true",
] as const;
