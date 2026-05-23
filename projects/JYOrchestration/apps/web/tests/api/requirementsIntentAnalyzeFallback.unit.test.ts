import { describe, expect, it } from "vitest";
import { shouldFallbackToServiceFlowAnalyzeForUnresolvedIntent } from "@/lib/requirements/requirementsIntentDispatch";
import { buildOrchestrationHumanExplainability } from "@/lib/requirements/requirementsOrchestrationExplainability";
import type { IntentRoutingResult } from "@/lib/requirements/requirementsIntentRouterTypes";

function intent(partial: Partial<IntentRoutingResult> & Pick<IntentRoutingResult, "routerMode">): IntentRoutingResult {
  return {
    intentType: "unknown",
    suggestedActionId: null,
    confidence: 0.9,
    reason: "test",
    ...partial,
  };
}

describe("requirementsIntentAnalyzeFallback", () => {
  it("falls back to analyze for ask_advice without effective action", () => {
    expect(
      shouldFallbackToServiceFlowAnalyzeForUnresolvedIntent({
        effectiveActionId: null,
        directQuickActionId: null,
        intent: intent({
          routerMode: "llm",
          intentType: "question",
          executionIntent: "ask_advice",
        }),
      }),
    ).toBe(true);
  });

  it("falls back for high-confidence question without suggested action", () => {
    expect(
      shouldFallbackToServiceFlowAnalyzeForUnresolvedIntent({
        effectiveActionId: null,
        directQuickActionId: null,
        intent: intent({
          routerMode: "llm",
          intentType: "question",
          confidence: 0.9,
        }),
      }),
    ).toBe(true);
  });

  it("does not fall back when effective action exists", () => {
    expect(
      shouldFallbackToServiceFlowAnalyzeForUnresolvedIntent({
        effectiveActionId: "DIRECT_INPUT",
        directQuickActionId: null,
        intent: intent({ routerMode: "llm", executionIntent: "ask_advice" }),
      }),
    ).toBe(false);
  });

  it("explainability uses advice copy for ask_advice", () => {
    const ex = buildOrchestrationHumanExplainability({
      intent: intent({ routerMode: "llm", executionIntent: "ask_advice" }),
      guard: { allowed: false, reason: "blocked" },
    });
    expect(ex.humanReadableReason).toBe("기획·절차 제안 요청으로 이해했습니다.");
  });
});
