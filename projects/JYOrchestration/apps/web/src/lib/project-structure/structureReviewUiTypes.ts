export type StructureCandidateExplainability = Readonly<{
  readonly confidence: number;
  readonly confidenceLabel: "High" | "Medium" | "Low";
  readonly reason: string;
  readonly confidenceReason?: string;
  readonly sourceConversation: Readonly<{
    readonly excerpt: string;
    readonly messageId: string | null;
    readonly href: string | null;
  }>;
  readonly sourceEvent: Readonly<{
    readonly eventType: string;
    readonly eventId: string | null;
  }>;
  readonly createdBy: string;
  readonly createdFrom: Readonly<{
    readonly eventId: string | null;
    readonly messageId: string | null;
  }>;
}>;

export type StructureCandidateRow = Readonly<{
  readonly id: string;
  readonly projectId: string;
  readonly idempotencyKey: string;
  readonly nodeType: string;
  readonly title: string;
  readonly summary: string;
  readonly lifecycleStatus: string;
  readonly sourceEventId: string | null;
  readonly fingerprint: string | null;
  readonly approvedGraphNodeId: string | null;
  readonly metadata: unknown;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly explainability?: StructureCandidateExplainability;
  readonly confidence?: number;
  readonly confidenceLabel?: string;
  readonly reason?: string;
  readonly sourceConversation?: StructureCandidateExplainability["sourceConversation"];
  readonly sourceEvent?: StructureCandidateExplainability["sourceEvent"];
  readonly createdBy?: string;
  readonly createdFrom?: StructureCandidateExplainability["createdFrom"];
}>;

export type StructureCandidateEdgeRow = Readonly<{
  readonly id: string;
  readonly fromCandidateId: string;
  readonly toCandidateId: string;
  readonly edgeType: string;
  readonly lifecycleStatus: string;
}>;

export type StructureConflictRow = Readonly<{
  readonly kind: string;
  readonly candidateIds: readonly string[];
  readonly score: number;
  readonly message: string;
}>;

export type GraphReflectionStatus = "not_reflected" | "approved_pending_graph" | "graph_applied";

export const STRUCTURE_CONFLICT_GROUP_LABELS: Record<string, string> = {
  duplicate_requirement: "Duplicate Requirement",
  duplicate_feature: "Duplicate Feature",
  similar_node: "Similar Node",
  semantic_duplicate: "Semantic Duplicate",
};

export const STRUCTURE_LIFECYCLE_LABELS: Record<string, string> = {
  CANDIDATE: "CANDIDATE",
  APPROVED: "APPROVED",
  MODIFIED: "MODIFIED",
  DEPRECATED: "DEPRECATED",
  ARCHIVED: "ARCHIVED",
};
