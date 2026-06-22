export const STRUCTURE_NODE_LIFECYCLE = {
  CANDIDATE: "CANDIDATE",
  APPROVED: "APPROVED",
  MODIFIED: "MODIFIED",
  DEPRECATED: "DEPRECATED",
  ARCHIVED: "ARCHIVED",
} as const;

export type StructureNodeLifecycleStatus =
  (typeof STRUCTURE_NODE_LIFECYCLE)[keyof typeof STRUCTURE_NODE_LIFECYCLE];

export const STRUCTURE_CANDIDATE_NODE_TYPES = {
  IDEA: "Idea",
  PROBLEM: "Problem",
  REQUIREMENT: "Requirement",
  FEATURE: "Feature",
  ACTOR: "Actor",
  SCREEN: "Screen",
  FLOW: "Flow",
  REVIEW: "Review",
  TASK: "Task",
} as const;

export type StructureCandidateNodeType =
  (typeof STRUCTURE_CANDIDATE_NODE_TYPES)[keyof typeof STRUCTURE_CANDIDATE_NODE_TYPES];

export const STRUCTURE_CONFLICT_KINDS = {
  DUPLICATE_REQUIREMENT: "duplicate_requirement",
  DUPLICATE_FEATURE: "duplicate_feature",
  SIMILAR_NODE: "similar_node",
  SEMANTIC_DUPLICATE: "semantic_duplicate",
} as const;

export type StructureConflictKind = (typeof STRUCTURE_CONFLICT_KINDS)[keyof typeof STRUCTURE_CONFLICT_KINDS];

export type StructureConflict = Readonly<{
  readonly kind: StructureConflictKind;
  readonly candidateIds: readonly string[];
  readonly score: number;
  readonly message: string;
}>;
