import { describe, expect, it } from "vitest";
import {
  buildFastPlanArtifactCreatedChatMessage,
  buildFastPlanArtifactCreatedTimelineEntry,
  buildFastPlanDraftGenerationHandoffTimeline,
  buildFastPlanDraftSuggestionPickedTimelineEntry,
  evaluateFastPlanGenerationHandoffReadiness,
  resolveFastPlanViewArtifactId,
} from "@/lib/requirements/fastPlanDraftGenerationHandoff";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

describe("fastPlanDraftGenerationHandoff", () => {
  it("returns blocked result with reason when fast plan generation is not allowed", () => {
    const result = evaluateFastPlanGenerationHandoffReadiness({
      projectId: "",
      busy: false,
      deliverableGenerateBusy: false,
      remoteLocked: false,
    });

    expect(result.ready).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("builds timeline entries for fast plan draft to generation handoff", () => {
    const entries = buildFastPlanDraftGenerationHandoffTimeline({
      actionLabel: "기획안 생성",
      projectId: "p1",
      nowIso: "2026-01-01T00:00:00.000Z",
    });

    expect(entries.map((e) => e.action)).toEqual(
      expect.arrayContaining(["fast_plan_draft_suggestion_picked", "planning_artifact_generation_requested"]),
    );
    for (const entry of entries) {
      expect(entry.provider).toBe("platform");
      expect(String(entry.responseText ?? "").length).toBeGreaterThan(0);
    }
  });

  it("builds suggestion picked timeline with non-empty response for prompt timeline UI", () => {
    const entry = buildFastPlanDraftSuggestionPickedTimelineEntry({
      actionLabel: "기획안 생성",
      routingDecision: "generate_artifact",
      projectId: "p1",
      nowIso: "2026-01-01T00:00:00.000Z",
    });

    expect(entry.source).toBe("platform");
    expect(entry.responseText).toContain("generate_artifact");
  });

  it("records artifact created timeline after fast plan generation", () => {
    const entry = buildFastPlanArtifactCreatedTimelineEntry({
      artifactId: "artifact-1",
      projectId: "p1",
      nowIso: "2026-01-01T00:00:00.000Z",
    });

    expect(entry.action).toBe("planning_artifact_created");
    expect(entry.responseText).toContain("artifact-1");
  });

  it("builds a completion message after fast plan artifact generation", () => {
    const message = buildFastPlanArtifactCreatedChatMessage({
      artifactTitle: "기획안",
      artifactId: "artifact-1",
      nowIso: "2026-01-01T00:00:00.000Z",
    });

    expect(message.content).toContain("기획안을 생성했습니다");
    expect(message.content).not.toContain("빠른 기획안");
    expect(message.meta?.interviewSuggestions).toEqual(
      expect.arrayContaining(["기획안 보기", "생성 단계 준비", "기획 보완 계속하기"]),
    );
    expect(message.meta?.fastPlanArtifactId).toBe("artifact-1");
  });

  it("resolves fast plan artifact id from generation state and project artifacts", () => {
    expect(
      resolveFastPlanViewArtifactId({
        state: parseRequirementsStateJson({
          fastPlanGenerationV1: { artifactId: "from-gen", mode: "fast_plan_from_current_context", generatedAt: "t", source: "x", assumptions: [], missingAtGeneration: [] },
        }),
      }),
    ).toBe("from-gen");

    expect(
      resolveFastPlanViewArtifactId({
        state: parseRequirementsStateJson({
          projectArtifacts: [
            {
              id: "artifact-legacy",
              type: "fast_prototype_plan",
              title: "빠른 프로토타입 기획안",
              createdAt: "t",
              createdBy: "ai",
              sourceStage: "IDEATION",
              content: "body",
            },
          ],
        }),
      }),
    ).toBe("artifact-legacy");
  });
});
