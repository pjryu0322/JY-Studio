import { describe, expect, it } from "vitest";
import { buildOrchestrationInterviewDigest, normalizeLlmInterviewSuggestions } from "../../src/lib/requirements/interviewSuggestionChips";
import {
  buildIdeationBootstrapFallbackPromptTrace,
  coerceRequirementsPromptTimelineEntry,
} from "../../src/lib/requirements/requirementsIdeationBootstrapPromptTimeline";
import { parseInterviewAnalyzerPayloadFromModelText } from "../../src/lib/requirements/problemInterview";

describe("normalizeLlmInterviewSuggestions", () => {
  it("trims, dedupes, and caps length", () => {
    expect(normalizeLlmInterviewSuggestions([" a ", "a", "b", "c", "d", "e", "f", "g"], 4)).toEqual(["a", "b", "c", "d"]);
  });

  it("returns empty for null or empty input", () => {
    expect(normalizeLlmInterviewSuggestions(null)).toEqual([]);
    expect(normalizeLlmInterviewSuggestions(undefined)).toEqual([]);
  });
});

describe("buildOrchestrationInterviewDigest", () => {
  it("summarizes slot rows for LLM context (not suggestion strings)", () => {
    const digest = buildOrchestrationInterviewDigest({
      state: {
        version: 1,
        stageGroup: "requirements_ideation",
        slotDefinitionsHash: "h",
        updatedAt: "t",
        slots: {
          s1: { slotKey: "s1", stageGroup: "g", label: "L1", status: "partial", value: "v", ownerAgent: "planner", updatedAt: "t" },
        },
      },
      definitions: [{ slotKey: "s1", label: "라벨", stageGroup: "g", ownerAgent: "planner", dependsOn: [] }],
    });
    expect(digest).toContain("라벨");
    expect(digest).toContain("partial");
  });
});

describe("promptTimeline interviewSuggestionsSource", () => {
  it("coerces interviewSuggestionsSource from raw trace", () => {
    const tr = coerceRequirementsPromptTimelineEntry({
      stage: "ideation",
      action: "bootstrapInterview",
      source: "llm",
      createdAt: "2026-01-01T00:00:00.000Z",
      interviewSuggestions: ["A", "B"],
      interviewSuggestionsSource: "llm",
    });
    expect(tr?.interviewSuggestionsSource).toBe("llm");
    expect(tr?.interviewSuggestions).toEqual(["A", "B"]);
  });

  it("records source on bootstrap fallback trace", () => {
    const tr = buildIdeationBootstrapFallbackPromptTrace({
      error: "x",
      fallbackText: "q?",
      interviewQuestion: "q?",
      interviewSuggestions: [],
      interviewSuggestionsSource: "empty",
    });
    expect(tr.interviewSuggestionsSource).toBe("empty");
  });
});

describe("parseInterviewAnalyzerPayloadFromModelText", () => {
  it("parses nextInterviewSuggestions from analyzer JSON", () => {
    const raw = JSON.stringify({
      intent: "answer",
      confidence: 0.9,
      currentSlotKey: "mustHaveFeatures",
      slotAdvanceDecision: "stay_current_slot",
      shouldAskFollowUp: true,
      followUpReason: "기능명만 있고 기준/범위가 부족함",
      nextQuestionSlotKey: "mustHaveFeatures",
      slots: {
        serviceIdea: "empty",
        targetUser: "empty",
        coreProblem: "empty",
        expectedOutcome: "empty",
        roughActors: "empty",
        roughFlow: "empty",
        mustHaveFeatures: "empty",
        constraints: "empty",
      },
      summary: "s",
      nextInterviewQuestion: "주 사용자는?",
      nextInterviewSuggestions: ["직장인", "PM"],
      allowCustomInput: true,
    });
    const parsed = parseInterviewAnalyzerPayloadFromModelText(raw);
    expect(parsed?.nextInterviewSuggestions).toEqual(["직장인", "PM"]);
    expect(parsed?.slotAdvanceDecision).toBe("stay_current_slot");
    expect(parsed?.shouldAskFollowUp).toBe(true);
    expect(parsed?.nextQuestionSlotKey).toBe("mustHaveFeatures");
  });
});
