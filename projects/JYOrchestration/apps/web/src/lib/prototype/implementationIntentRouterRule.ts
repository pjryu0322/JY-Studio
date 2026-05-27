import type { ImplementationIntentClassification } from "@/lib/prototype/implementationIntentRouterTypes";
import { extractRulesFromTextForTurn } from "@/lib/prototype/implementationUserFeedback";
import {
  isExplicitWorkPlanExecuteUtterance,
  isQuestionLikeWorkPlanUtterance,
} from "@/lib/prototype/implementationWorkPlanUtteranceGuards";

const DEFER_OR_REVIEW_BEFORE_PLAN =
  /생성\s*전|만들\s*기\s*전|하기\s*전에|나중에\s*(만들|생성)|먼저\s*검토|누락.*검토|검토해\s*줘|확인\s*후\s*(생성|만들)/i;

const WORK_PLAN_TOPIC = /구현\s*작업\s*안|작업\s*안|작업\s*계획|작업계획/i;
const WORK_PLAN_VERB = /생성|만들|수립|작성|해\s*줘|해주|진행/i;

function wantsWorkPlanAction(text: string): boolean {
  return WORK_PLAN_TOPIC.test(text) && WORK_PLAN_VERB.test(text);
}

function baseClassification(
  partial: Omit<ImplementationIntentClassification, "routerSource">,
  routerSource: "rule",
): ImplementationIntentClassification {
  return { ...partial, routerSource };
}

/** LLM 없이 처리 가능한 구현단계 intent (짧은·명확한 실행/질문 구분). */
export function classifyImplementationIntentByRule(text: string): ImplementationIntentClassification | null {
  const raw = String(text ?? "").trim();
  if (!raw) return null;

  if (DEFER_OR_REVIEW_BEFORE_PLAN.test(raw) && WORK_PLAN_TOPIC.test(raw)) {
    return baseClassification(
      {
        intentType: "implementation_question",
        suggestedActionId: null,
        confidence: 0.85,
        reason: "work_plan_deferred_for_review",
        clarificationQuestion: null,
        executionIntent: "ask_advice",
        actionInvocationStrength: "explicit",
        extractedRules: [],
        requiresPreActionPatch: false,
        shouldExecuteAction: false,
        targetAction: null,
      },
      "rule",
    );
  }

  const rules = extractRulesFromTextForTurn(raw);
  const workPlan = wantsWorkPlanAction(raw);

  if (
    workPlan &&
    rules.length > 0 &&
    !DEFER_OR_REVIEW_BEFORE_PLAN.test(raw) &&
    !isQuestionLikeWorkPlanUtterance(raw)
  ) {
    const highRules = rules.filter((r) => r.confidence === "high");
    return baseClassification(
      {
        intentType: "mixed",
        suggestedActionId: "CREATE_WORK_PLAN",
        confidence: highRules.length >= 1 ? 0.9 : 0.72,
        reason: "requirement_and_work_plan",
        clarificationQuestion: null,
        executionIntent: "explicit_execute",
        actionInvocationStrength: "explicit",
        extractedRules: rules,
        requiresPreActionPatch: true,
        shouldExecuteAction: highRules.length >= 1,
        targetAction: "CREATE_WORK_PLAN",
      },
      "rule",
    );
  }

  if (workPlan && raw.length <= 120) {
    if (isQuestionLikeWorkPlanUtterance(raw)) {
      return null;
    }
    if (!isExplicitWorkPlanExecuteUtterance(raw)) {
      return null;
    }
    return baseClassification(
      {
        intentType: "orchestration_action",
        suggestedActionId: "CREATE_WORK_PLAN",
        confidence: 0.88,
        reason: "work_plan_create_phrase",
        clarificationQuestion: null,
        executionIntent: "explicit_execute",
        actionInvocationStrength: "explicit",
        extractedRules: [],
        requiresPreActionPatch: false,
        shouldExecuteAction: true,
        targetAction: "CREATE_WORK_PLAN",
      },
      "rule",
    );
  }

  if (rules.length > 0 && !workPlan) {
    return baseClassification(
      {
        intentType: "implementation_requirement",
        suggestedActionId: "ADD_IMPLEMENTATION_REQUIREMENT",
        confidence: 0.8,
        reason: "extracted_requirement_rules",
        clarificationQuestion: null,
        executionIntent: "explicit_execute",
        actionInvocationStrength: rules.some((r) => r.confidence === "high") ? "explicit" : "implicit",
        extractedRules: rules,
        requiresPreActionPatch: true,
        shouldExecuteAction: false,
        targetAction: null,
      },
      "rule",
    );
  }

  return null;
}
