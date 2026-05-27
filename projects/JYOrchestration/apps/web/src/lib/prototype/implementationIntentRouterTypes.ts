import type { ImplementationExtractedRule } from "@/lib/prototype/implementationUserFeedback";
import type {
  LlmActionInvocationStrength,
  LlmExecutionIntent,
} from "@/lib/intent-router/llmIntentRouterTypes";

export type ImplementationActionId =
  | "CREATE_WORK_PLAN"
  | "OPEN_PLANNER_PROMPT"
  | "SHOW_SCM_CHECK"
  | "SHOW_ENV_CHECK"
  | "SHOW_ROLE_CHECK"
  | "SHOW_REVIEWER_CHECK"
  | "SHOW_SECURITY_CHECK"
  | "OPEN_ENV_SETTINGS"
  | "SHOW_ARTIFACTS"
  | "DIRECT_IMPLEMENTATION_SCOPE_INPUT"
  | "ADD_IMPLEMENTATION_REQUIREMENT"
  | "NO_ACTION";

export const IMPLEMENTATION_ROUTER_ACTION_IDS: readonly ImplementationActionId[] = [
  "CREATE_WORK_PLAN",
  "OPEN_PLANNER_PROMPT",
  "SHOW_SCM_CHECK",
  "SHOW_ENV_CHECK",
  "SHOW_ROLE_CHECK",
  "SHOW_REVIEWER_CHECK",
  "SHOW_SECURITY_CHECK",
  "OPEN_ENV_SETTINGS",
  "SHOW_ARTIFACTS",
  "DIRECT_IMPLEMENTATION_SCOPE_INPUT",
  "ADD_IMPLEMENTATION_REQUIREMENT",
  "NO_ACTION",
];

export function isImplementationActionId(id: string): id is ImplementationActionId {
  return (IMPLEMENTATION_ROUTER_ACTION_IDS as readonly string[]).includes(id);
}

export type ImplementationIntentType =
  | "orchestration_action"
  | "status_query"
  | "implementation_requirement"
  | "implementation_question"
  | "mixed"
  | "unknown";

export type ImplementationIntentClassification = Readonly<{
  intentType: ImplementationIntentType;
  suggestedActionId: ImplementationActionId | null;
  confidence: number;
  reason?: string;
  clarificationQuestion?: string | null;
  executionIntent: LlmExecutionIntent;
  actionInvocationStrength: LlmActionInvocationStrength;
  extractedRules: readonly ImplementationExtractedRule[];
  requiresPreActionPatch: boolean;
  shouldExecuteAction: boolean;
  targetAction: ImplementationActionId | null;
  routerSource: "alias" | "rule" | "llm" | "platform";
}>;

export type ImplementationIntentRouteSource = "alias" | "rule" | "llm" | "platform" | "none";

export type ImplementationUserInputRoute =
  | Readonly<{
      kind: "execute_action";
      actionId: ImplementationActionId;
      classification: ImplementationIntentClassification;
    }>
  | Readonly<{
      kind: "apply_requirement_then_execute";
      actionId: ImplementationActionId;
      classification: ImplementationIntentClassification;
      extractedRules: readonly ImplementationExtractedRule[];
    }>
  | Readonly<{
      kind: "show_status";
      actionId: ImplementationActionId;
      classification: ImplementationIntentClassification;
    }>
  | Readonly<{
      kind: "clarification";
      question: string;
      classification: ImplementationIntentClassification;
    }>
  | Readonly<{
      kind: "gate_blocked";
      actionId: ImplementationActionId;
      message: string;
      interviewSuggestions?: readonly string[];
      classification: ImplementationIntentClassification;
    }>
  | Readonly<{ kind: "fallback_llm_turn"; classification?: ImplementationIntentClassification | null }>;
