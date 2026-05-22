export type ConversationScope = "pre_project" | "project";

export type ConversationParticipationMode = "planner_only" | "ai_team";

export type ConversationIntentMode =
  | "brainstorm"
  | "feasibility_check"
  | "research_request"
  | "summary"
  | "project_draft"
  | "project_execution_planning"
  | "general_chat";

export type ConversationResponsePolicy = {
  readonly avoidBrainstormExpansion?: boolean;
  readonly avoidFeatureFinalization?: boolean;
  readonly mustStateVerificationLimit?: boolean;
  readonly mustProvideCheckItems?: boolean;
  readonly shouldOfferAlternatives?: boolean;
  readonly shouldSummarizeDecisions?: boolean;
  readonly shouldPrepareProjectDraft?: boolean;
};

export type ConversationIntentClassification = {
  readonly mode: ConversationIntentMode;
  readonly confidence: number;
  readonly reason: string;
  readonly scope: ConversationScope;
  readonly participationMode: ConversationParticipationMode;
  readonly shouldInjectDocumentContext: boolean;
  readonly domainContextReason?: string | null;
  readonly userConstraints: readonly string[];
  readonly discardedDirections: readonly string[];
  readonly openOptions: readonly string[];
  readonly responsePolicy: ConversationResponsePolicy;
  /** rules | llm */
  readonly classifierSource?: "rules" | "llm";
};

export function resolveConversationScope(projectId?: string | null): ConversationScope {
  return String(projectId ?? "").trim() ? "project" : "pre_project";
}

export function resolveConversationParticipationMode(scope: ConversationScope): ConversationParticipationMode {
  return scope === "pre_project" ? "planner_only" : "ai_team";
}
