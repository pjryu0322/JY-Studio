export const PLANNING_PROPOSAL_CREATED_BY = "AI Planner" as const;
export const PLANNING_PROPOSAL_ACCEPTED_BY = "USER" as const;

export const PLANNING_PROPOSAL_EVENT_TYPE = "planning.proposal_approved" as const;
export const PLANNING_PROPOSAL_CREATED_EVENT_TYPE = "planning.proposal_created" as const;
export const PLANNING_PROPOSAL_REVISED_EVENT_TYPE = "planning.proposal_revised" as const;

export type PlanningProposalType =
  | "service_flow"
  | "actor_definition"
  | "feature_definition"
  | "scope_decision"
  | "mixed";

export type PlanningProposalModel = Readonly<{
  readonly projectId: string;
  readonly proposalId: string;
  readonly proposalType: PlanningProposalType;
  readonly sourceMessageId: string;
  readonly acceptedByMessageId: string;
  readonly acceptedAt: string;
  readonly acceptedSnapshot: string;
  readonly actors: readonly string[];
  readonly features: readonly string[];
  readonly requirements: readonly string[];
  readonly flows: readonly string[];
  readonly decisions: readonly string[];
  readonly assumptions: readonly string[];
  readonly scope: Readonly<{
    readonly included: readonly string[];
    readonly excluded: readonly string[];
  }>;
  readonly createdBy: typeof PLANNING_PROPOSAL_CREATED_BY;
  readonly acceptedBy: typeof PLANNING_PROPOSAL_ACCEPTED_BY;
}>;
