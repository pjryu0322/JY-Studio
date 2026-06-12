import type { ImplementationStatusQueryIntent } from "@/lib/prototype/implementationStatusQueryIntent";
import { detectImplementationActionAlias } from "@/lib/prototype/implementationActionAliasGuard";
import { evaluateImplementationActionGate } from "@/lib/prototype/implementationActionGate";
import { classifyImplementationIntentWithLlm } from "@/lib/prototype/implementationIntentRouterLlm";
import { classifyImplementationIntentByRule } from "@/lib/prototype/implementationIntentRouterRule";
import type {
  ImplementationActionId,
  ImplementationIntentClassification,
  ImplementationUserInputRoute,
} from "@/lib/prototype/implementationIntentRouterTypes";
import { isImplementationActionId } from "@/lib/prototype/implementationIntentRouterTypes";

/**
 * Phase 8+: stage-action-compatible routes can be executed via
 * `orchestrateImplementationStageAction(source="natural_language")` from the implementation panel.
 */
export type RouteImplementationUserInputParams = Readonly<{
  text: string;
  visibleActionLabels: readonly string[];
  envOk: boolean;
  templatePlanningReady: boolean;
  implementationSeedReady: boolean;
  hasWorkUnits: boolean;
  isPlannerRunning: boolean;
  plannerCreatePending: boolean;
  protoBusy: boolean;
  projectName: string;
  projectDescription: string;
  implementationBootstrapSummary?: string;
  latestRunStatus?: string | null;
  /** true면 LLM classifier 호출 시도 (NO_KEY 시 rule만). */
  enableLlmClassifier?: boolean;
}>;

const STATUS_ACTION_TO_QUERY: Readonly<Partial<Record<ImplementationActionId, ImplementationStatusQueryIntent>>> = {
  SHOW_SCM_CHECK: "scm_check_details",
  SHOW_ENV_CHECK: "environment_check_details",
  SHOW_ROLE_CHECK: "role_check_details",
  SHOW_REVIEWER_CHECK: "reviewer_check_details",
  SHOW_SECURITY_CHECK: "security_check_details",
};

function classificationFromAlias(actionId: ImplementationActionId): ImplementationIntentClassification {
  return {
    intentType: STATUS_ACTION_TO_QUERY[actionId] ? "status_query" : "orchestration_action",
    suggestedActionId: actionId,
    confidence: 1,
    reason: "action_alias",
    clarificationQuestion: null,
    executionIntent: "explicit_execute",
    actionInvocationStrength: "explicit",
    extractedRules: [],
    requiresPreActionPatch: false,
    shouldExecuteAction: actionId !== "NO_ACTION" && actionId !== "ADD_IMPLEMENTATION_REQUIREMENT",
    targetAction: actionId,
    routerSource: "alias",
  };
}

function routeFromClassification(
  classification: ImplementationIntentClassification,
  gateInput: Omit<RouteImplementationUserInputParams, "text" | "visibleActionLabels" | "enableLlmClassifier">,
): ImplementationUserInputRoute {
  if (
    classification.clarificationQuestion &&
    !classification.shouldExecuteAction &&
    classification.confidence < 0.55
  ) {
    return { kind: "clarification", question: classification.clarificationQuestion, classification };
  }

  const actionId =
    classification.targetAction ??
    classification.suggestedActionId ??
    (classification.shouldExecuteAction ? null : null);

  if (actionId && STATUS_ACTION_TO_QUERY[actionId]) {
    return { kind: "show_status", actionId, classification };
  }

  if (classification.requiresPreActionPatch && classification.extractedRules.length > 0 && actionId) {
    const gate = evaluateImplementationActionGate({ actionId, ...gateInput });
    if (!gate.allowed) {
      return {
        kind: "gate_blocked",
        actionId,
        message: gate.message,
        interviewSuggestions: gate.interviewSuggestions,
        classification,
      };
    }
    if (classification.shouldExecuteAction) {
      return {
        kind: "apply_requirement_then_execute",
        actionId,
        classification,
        extractedRules: classification.extractedRules,
      };
    }
  }

  if (classification.shouldExecuteAction && actionId && isImplementationActionId(actionId)) {
    const gate = evaluateImplementationActionGate({ actionId, ...gateInput });
    if (!gate.allowed) {
      return {
        kind: "gate_blocked",
        actionId,
        message: gate.message,
        interviewSuggestions: gate.interviewSuggestions,
        classification,
      };
    }
    return { kind: "execute_action", actionId, classification };
  }

  if (
    classification.intentType === "implementation_requirement" ||
    classification.intentType === "implementation_question" ||
    classification.intentType === "unknown"
  ) {
    return { kind: "fallback_llm_turn", classification };
  }

  return { kind: "fallback_llm_turn", classification };
}

export async function routeImplementationUserInput(
  params: RouteImplementationUserInputParams,
): Promise<ImplementationUserInputRoute> {
  const text = String(params.text ?? "").trim();
  const gateInput = {
    envOk: params.envOk,
    templatePlanningReady: params.templatePlanningReady,
    implementationSeedReady: params.implementationSeedReady,
    hasWorkUnits: params.hasWorkUnits,
    isPlannerRunning: params.isPlannerRunning,
    plannerCreatePending: params.plannerCreatePending,
    protoBusy: params.protoBusy,
    projectName: params.projectName,
    projectDescription: params.projectDescription,
    implementationBootstrapSummary: params.implementationBootstrapSummary,
    latestRunStatus: params.latestRunStatus,
  };

  const alias = detectImplementationActionAlias({
    text,
    visibleActionLabels: params.visibleActionLabels,
  });
  if (alias) {
    return routeFromClassification(classificationFromAlias(alias), gateInput);
  }

  const rule = classifyImplementationIntentByRule(text);
  if (rule) {
    return routeFromClassification(rule, gateInput);
  }

  if (params.enableLlmClassifier !== false) {
    const llm = await classifyImplementationIntentWithLlm({
      userMessage: text,
      visibleActionLabels: params.visibleActionLabels,
      projectName: params.projectName,
      projectDescription: params.projectDescription,
      envOk: params.envOk,
      templatePlanningReady: params.templatePlanningReady,
      implementationSeedReady: params.implementationSeedReady,
      hasWorkUnits: params.hasWorkUnits,
      plannerRunning: params.isPlannerRunning,
      plannerCreatePending: params.plannerCreatePending,
      implementationBootstrapSummary: params.implementationBootstrapSummary,
      latestRunStatus: params.latestRunStatus,
    });
    if (llm.ok) {
      return routeFromClassification(llm.classification, gateInput);
    }
  }

  return { kind: "fallback_llm_turn", classification: null };
}

export function implementationStatusQueryFromAction(
  actionId: ImplementationActionId,
): ImplementationStatusQueryIntent {
  return STATUS_ACTION_TO_QUERY[actionId] ?? "none";
}
