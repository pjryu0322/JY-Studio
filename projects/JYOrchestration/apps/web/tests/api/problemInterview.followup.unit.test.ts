import { describe, expect, it } from "vitest";
import { planNextInterviewTurn, type InterviewAnalyzerPayload } from "../../src/lib/requirements/problemInterview";
import { emptyProblemInterviewState } from "../../src/lib/requirements/problemInterview";

describe("planNextInterviewTurn follow-up guard", () => {
  it("stays on currentSlotKey when analyzer requests follow-up", () => {
    const state = emptyProblemInterviewState("2026-01-01T00:00:00.000Z");
    const analyzer: InterviewAnalyzerPayload = {
      summary: "ok",
      intent: "answer",
      delegatedSlot: null,
      delegatedDefault: "",
      globalDelegation: false,
      slots: {
        serviceIdea: "partial",
        targetUser: "empty",
        coreProblem: "empty",
        expectedOutcome: "empty",
        roughActors: "empty",
        roughFlow: "empty",
        mustHaveFeatures: "partial",
        constraints: "empty",
      },
      notes: {},
      nextBestSlot: "targetUser",
      confidence: 0.7,
      currentSlotKey: "mustHaveFeatures",
      slotAdvanceDecision: "stay_current_slot",
      shouldAskFollowUp: true,
      followUpReason: "짧음",
      nextQuestionSlotKey: "mustHaveFeatures",
      nextInterviewQuestion: "검토 기능에서 가장 중요한 기준은 무엇인가요?",
      nextInterviewSuggestions: ["오탈자", "누락", "정확도"],
      allowCustomInput: true,
    };

    const plan = planNextInterviewTurn(state, analyzer, [], 0, 0.55, "", {});
    expect(plan?.kind).toBe("slot");
    if (plan?.kind === "slot") {
      expect(plan.slot).toBe("mustHaveFeatures");
      expect(plan.question).toContain("기준");
      expect((plan.suggestions ?? []).length).toBeGreaterThan(0);
    }
  });
});

