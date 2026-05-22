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

export type ConversationRequiredAction = "none" | "website_inspection";

export type ConversationResponsePolicy = {
  readonly avoidBrainstormExpansion?: boolean;
  readonly avoidFeatureFinalization?: boolean;
  readonly mustStateVerificationLimit?: boolean;
  readonly mustProvideCheckItems?: boolean;
  readonly shouldOfferAlternatives?: boolean;
  readonly shouldSummarizeDecisions?: boolean;
  readonly shouldPrepareProjectDraft?: boolean;
  /** feasibility 체크리스트 반복 억제 */
  readonly avoidChecklistRepetition?: boolean;
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
  readonly requiredAction?: ConversationRequiredAction;
  readonly targetUrls?: readonly string[];
};

export function resolveConversationScope(projectId?: string | null): ConversationScope {
  return String(projectId ?? "").trim() ? "project" : "pre_project";
}

export function resolveConversationParticipationMode(scope: ConversationScope): ConversationParticipationMode {
  return scope === "pre_project" ? "planner_only" : "ai_team";
}
