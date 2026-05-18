import { describe, expect, it } from "vitest";

import {
  resolveMessageExplainabilityTrace,
  resolveMessageExplainabilityTraceWithConfidence,
} from "@/lib/harness/explainability/resolveMessageExplainabilityTrace";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { VIRTUAL_AI_PLANNER_ID } from "@/lib/project/requirementsRoomState";

const baseMsg = {
  id: "m-ai-1",
  role: "ai" as const,
  createdAt: "2026-05-15T12:00:00.000Z",
  content: "안녕하세요. 오늘 어떤 서비스를 설계할까요?",
  speakerId: VIRTUAL_AI_PLANNER_ID,
  meta: { stage: "REQUIREMENTS" as const },
};

describe("resolveMessageExplainabilityTrace", () => {
  it("returns null for user messages", () => {
    expect(
      resolveMessageExplainabilityTrace({
        message: { ...baseMsg, role: "user" },
        promptTimeline: [],
      })
    ).toBeNull();
  });

  it("uses direct messageOverlayExplainability when present", () => {
    const ex = {
      knowledgeActivationPlan: {
        mode: "dry_run" as const,
        roleKey: "planner",
        workspaceStage: "requirements",
        taskType: null,
        items: [
          {
            knowledgePackId: "k1",
            priority: "optional" as const,
            reasonType: "role_policy" as const,
            reasonLabel: "역할",
          },
        ],
        findings: [],
      },
    };
    const out = resolveMessageExplainabilityTrace({
      message: { ...baseMsg, meta: { stage: "REQUIREMENTS", messageOverlayExplainability: ex } },
      promptTimeline: null,
    });
    expect(out?.knowledgeActivationPlan?.items?.length).toBe(1);
  });

  it("matches timeline by responseText + time when unique", () => {
    const body = "Exact reply body for matching.";
    const timeline: RequirementsPromptTimelineEntry[] = [
      {
        stage: "ideation",
        action: "requirementsChatOrchestration",
        source: "llm",
        createdAt: "2026-05-15T12:00:05.000Z",
        responseText: body,
        knowledgeActivationPlan: {
          mode: "dry_run",
          roleKey: null,
          workspaceStage: null,
          taskType: null,
          items: [
            {
              knowledgePackId: "k2",
              priority: "optional",
              reasonType: "stage_policy",
              reasonLabel: "단계",
            },
          ],
          findings: [],
        },
      },
    ];
    const out = resolveMessageExplainabilityTrace({
      message: { ...baseMsg, content: body, meta: { stage: "REQUIREMENTS" } },
      promptTimeline: timeline,
    });
    expect(out?.knowledgeActivationPlan?.items?.some((i) => i.knowledgePackId === "k2")).toBe(true);
  });

  it("returns null when multiple responseText matches in window", () => {
    const body = "Duplicate body for ambiguity test.";
    const timeline: RequirementsPromptTimelineEntry[] = [
      {
        stage: "ideation",
        action: "a",
        source: "llm",
        createdAt: "2026-05-15T12:00:01.000Z",
        responseText: body,
      },
      {
        stage: "ideation",
        action: "b",
        source: "llm",
        createdAt: "2026-05-15T12:00:02.000Z",
        responseText: body,
      },
    ];
    expect(
      resolveMessageExplainabilityTrace({
        message: { ...baseMsg, content: body, meta: { stage: "REQUIREMENTS" } },
        promptTimeline: timeline,
      })
    ).toBeNull();
  });

  it("matches orchestratorAgent + time window when single candidate", () => {
    const timeline: RequirementsPromptTimelineEntry[] = [
      {
        stage: "ideation",
        action: "requirementsChatOrchestration",
        source: "llm",
        createdAt: "2026-05-15T12:00:02.000Z",
        orchestratorAgent: "planner",
        overlayIdentity: { roleKey: "planner", perspective: "기획", provider: "p", capabilities: [] },
      },
    ];
    const out = resolveMessageExplainabilityTrace({
      message: {
        ...baseMsg,
        content: "short",
        meta: { stage: "REQUIREMENTS" },
      },
      promptTimeline: timeline,
    });
    expect(out?.overlayIdentity?.roleKey).toBe("planner");
  });
});

describe("resolveMessageExplainabilityTraceWithConfidence", () => {
  it("returns none when no meta extract and no promptTimeline", () => {
    const r = resolveMessageExplainabilityTraceWithConfidence({
      message: baseMsg,
      promptTimeline: null,
    });
    expect(r.confidence).toBe("none");
    expect(r.extract).toBeNull();
  });

  it("returns direct when messageOverlayExplainability is populated", () => {
    const ex = {
      overlayIdentity: { roleKey: "planner", perspective: "기획", provider: "p", capabilities: [] },
    };
    const r = resolveMessageExplainabilityTraceWithConfidence({
      message: { ...baseMsg, meta: { stage: "REQUIREMENTS", messageOverlayExplainability: ex } },
      promptTimeline: null,
    });
    expect(r.confidence).toBe("direct");
    expect(r.extract?.overlayIdentity?.roleKey).toBe("planner");
  });

  it("returns response_text when unique body match", () => {
    const body = "Unique reply for confidence.";
    const timeline: RequirementsPromptTimelineEntry[] = [
      {
        stage: "ideation",
        action: "requirementsChatOrchestration",
        source: "llm",
        createdAt: "2026-05-15T12:00:03.000Z",
        responseText: body,
        overlayIdentity: { roleKey: "planner", perspective: "기획", provider: "p", capabilities: [] },
      },
    ];
    const r = resolveMessageExplainabilityTraceWithConfidence({
      message: { ...baseMsg, content: body, meta: { stage: "REQUIREMENTS" } },
      promptTimeline: timeline,
    });
    expect(r.confidence).toBe("response_text");
    expect(r.extract?.overlayIdentity?.roleKey).toBe("planner");
  });

  it("returns role_time when orchestrator single match", () => {
    const timeline: RequirementsPromptTimelineEntry[] = [
      {
        stage: "ideation",
        action: "requirementsChatOrchestration",
        source: "llm",
        createdAt: "2026-05-15T12:00:02.000Z",
        orchestratorAgent: "planner",
        overlayIdentity: { roleKey: "planner", perspective: "기획", provider: "p", capabilities: [] },
      },
    ];
    const r = resolveMessageExplainabilityTraceWithConfidence({
      message: { ...baseMsg, content: "x", meta: { stage: "REQUIREMENTS" } },
      promptTimeline: timeline,
    });
    expect(r.confidence).toBe("role_time");
  });
});
