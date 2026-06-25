export type KnowledgeNodeLifecycle =
  | "DRAFT"
  | "AI_PROPOSED"
  | "USER_APPROVED"
  | "VERIFIED"
  | "REFERENCE_READY"
  | "RETIRED";

export type KnowledgeNodeProvenanceSource =
  | "CONVERSATION"
  | "AI_PROPOSAL"
  | "USER_APPROVAL"
  | "SOURCE_MATERIAL"
  | "IMPORT"
  | "SYSTEM_DERIVED";

export type KnowledgeNodeProvenance = Readonly<{
  readonly createdFrom: KnowledgeNodeProvenanceSource;
  readonly sourceEventIds?: readonly string[];
  readonly sourceCandidateIds?: readonly string[];
  readonly sourceRevisionId?: string;
  readonly approvedBy?: string;
  readonly approvedAt?: string;
}>;

export type KnowledgeNodeReusableAs =
  | "PLANNING_CONTEXT"
  | "ACTOR"
  | "SERVICE_FLOW"
  | "FEATURE"
  | "CONSTRAINT"
  | "DECISION"
  | "GRAPH_SUMMARY";

export type KnowledgeNodeReusability = Readonly<{
  readonly reusable: boolean;
  readonly reusableAs: readonly KnowledgeNodeReusableAs[];
  readonly exclusionReason?: string;
}>;

export type KnowledgeNodeSensitivity = Readonly<{
  readonly containsPersonalData: boolean;
  readonly containsConfidentialData: boolean;
  readonly containsRawConversation: boolean;
  readonly containsInternalIds: boolean;
  readonly safeForReference: boolean;
}>;

export type GraphSnapshotPurpose =
  | "REPLAY"
  | "TRACE"
  | "APPROVAL"
  | "REFERENCE_CANDIDATE"
  | "REFERENCE_PACKAGE";

export type ReferenceEligibilityLevel = "NONE" | "PARTIAL" | "READY" | "VERIFIED";

export type ReferenceEligibility = Readonly<{
  readonly eligible: boolean;
  readonly level: ReferenceEligibilityLevel;
  readonly reasons: readonly string[];
  readonly blockingIssues: readonly string[];
  readonly counts: Readonly<{
    readonly reusableActors: number;
    readonly reusableServiceFlows: number;
    readonly reusableFeatures: number;
    readonly reusableGraphNodes: number;
  }>;
}>;

export type ReferencePackageCandidateReadiness = "NOT_READY" | "PARTIAL" | "READY" | "VERIFIED";

export type ReferencePackageCandidate = Readonly<{
  readonly projectId: string;
  readonly sourceRevisionId?: string;
  readonly readiness: ReferencePackageCandidateReadiness;
  readonly summary: string;
  readonly reusableAssets: Readonly<{
    readonly actors: readonly string[];
    readonly serviceFlows: readonly string[];
    readonly features: readonly string[];
    readonly graphSummary: string;
    readonly decisions: readonly string[];
  }>;
  readonly exclusions: readonly string[];
  readonly blockingIssues: readonly string[];
}>;

/** User-facing copy only — no internal enum names */
export type KnowledgeNodeReferenceView = Readonly<{
  readonly lifecycleLabel: string;
  readonly provenanceLabel: string;
  readonly reusableLabel: string;
  readonly verificationLabel: string;
}>;

export const REFERENCE_ELIGIBILITY_USER_LABELS: Record<ReferenceEligibilityLevel, string> = {
  NONE: "참조 준비 안 됨",
  PARTIAL: "일부 참조 가능",
  READY: "참조 가능",
  VERIFIED: "검증된 참조 가능",
};
