import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type WorkspaceTurnMode = "planning" | "implementation";

export type WorkspaceTurnIntent =
  | "planning_slot_fill"
  | "planning_question"
  | "implementation_requirement"
  | "implementation_preference"
  | "implementation_question"
  | "execution_request"
  | "scope_change"
  | "security_policy"
  | "data_policy"
  | "unknown";

export type WorkspaceTurnPatchStatus =
  | "confirmed"
  | "confirmed_candidate"
  | "candidate"
  | "question"
  | "blocked"
  | "none";

export type WorkspaceTurnConfidence = "high" | "medium" | "low";

export type WorkspaceTurnExtractedRule = Readonly<{
  readonly label: string;
  readonly value: string;
  readonly normalizedValue?: string;
  readonly confidence: WorkspaceTurnConfidence;
}>;

export type WorkspaceTurnTargetArea =
  | "implementation_seed"
  | "implementation_work_plan_draft"
  | "implementation_slots"
  | "review_criteria"
  | "security_criteria"
  | "common_detail_features"
  | "data_policy"
  | "screen_implementation_items"
  | "process_implementation_items"
  | "actor_capability_matrix";

export type WorkspaceTurnModelResult = Readonly<{
  readonly intent: WorkspaceTurnIntent;
  readonly status: WorkspaceTurnPatchStatus;
  readonly confidence: WorkspaceTurnConfidence;
  readonly responderLabel: string;
  readonly assistantMessage: string;
  readonly summary: string;
  readonly extractedRules: readonly WorkspaceTurnExtractedRule[];
  readonly targetAreas: readonly WorkspaceTurnTargetArea[];
  readonly requiresClarification: boolean;
  readonly clarifyingQuestion: string | null;
  readonly nextQuestion: string | null;
  readonly slotKeyToFill?: string | null;
  readonly slotValue?: string | null;
  readonly nextSlotKey?: string | null;
}>;

export type WorkspaceTurnInput<TContext> = Readonly<{
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly userMessage: string;
  readonly mentionedAI?: string | null;
  readonly userMessageId: string;
  readonly envOk: boolean;
  readonly context: TContext;
}>;

export type WorkspaceTurnRunResult<TPatch> = Readonly<{
  readonly mode: WorkspaceTurnMode;
  readonly modelResult: WorkspaceTurnModelResult;
  readonly statePatch: TPatch;
  readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
  readonly source: "llm" | "rule_fallback";
}>;

export type WorkspaceTurnConfig<TContext, TPatch> = Readonly<{
  readonly mode: WorkspaceTurnMode;
  readonly stage: string;
  readonly primaryMemberId: string;
  readonly primaryMemberLabel: string;
  readonly advisorMemberIds: readonly string[];
  readonly responseContract: string;
  readonly buildSystemPrompt: (input: WorkspaceTurnInput<TContext>) => string;
  readonly buildUserPrompt: (input: WorkspaceTurnInput<TContext>) => string;
  readonly validateModelJson: (raw: unknown) => WorkspaceTurnModelResult | null;
  readonly fallbackAnalyze: (input: WorkspaceTurnInput<TContext>) => WorkspaceTurnModelResult;
  readonly buildStatePatch: (input: {
    readonly context: TContext;
    readonly model: WorkspaceTurnModelResult;
    readonly userMessage: string;
    readonly userMessageId: string;
    readonly nowIso: string;
  }) => TPatch;
  readonly buildTimelineEntries: (input: {
    readonly context: TContext;
    readonly model: WorkspaceTurnModelResult;
    readonly patch: TPatch;
    readonly nowIso: string;
    readonly source: "llm" | "rule_fallback";
  }) => readonly RequirementsPromptTimelineEntry[];
}>;

export type ImplementationTurnContext = Readonly<{
  readonly requirementsStateJson: unknown;
  readonly envOk: boolean;
}>;

export type ImplementationTurnStatePatch = Readonly<{
  readonly orchestration: import("@/lib/prototype/prototypeExecutionTaskPlanPersist").PrototypeExecutionOrchestrationPersistInput;
}>;
