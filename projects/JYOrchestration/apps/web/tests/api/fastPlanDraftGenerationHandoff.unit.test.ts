import { describe, expect, it } from "vitest";
import {
  buildFastPlanArtifactCreatedChatMessage,
  buildFastPlanArtifactCreatedTimelineEntry,
  buildFastPlanDraftGenerationHandoffTimeline,
  evaluateFastPlanGenerationHandoffReadiness,
} from "@/lib/requirements/fastPlanDraftGenerationHandoff";

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
      actionLabel: "이 초안으로 빠른 기획안 생성",
      projectId: "p1",
      nowIso: "2026-01-01T00:00:00.000Z",
    });

    expect(entries.map((e) => e.action)).toEqual(
      expect.arrayContaining(["fast_plan_draft_suggestion_picked", "fast_plan_generation_requested"]),
    );
  });

  it("records artifact created timeline after fast plan generation", () => {
    const entry = buildFastPlanArtifactCreatedTimelineEntry({
      artifactId: "artifact-1",
      projectId: "p1",
      nowIso: "2026-01-01T00:00:00.000Z",
    });

    expect(entry.action).toBe("fast_plan_artifact_created");
    expect(entry.responseText).toContain("artifact-1");
  });

  it("builds a completion message after fast plan artifact generation", () => {
    const message = buildFastPlanArtifactCreatedChatMessage({
      artifactTitle: "빠른 프로토타입 기획안",
      artifactId: "artifact-1",
      nowIso: "2026-01-01T00:00:00.000Z",
    });

    expect(message.content).toContain("빠른 기획안 산출물을 생성했습니다");
    expect(message.meta?.interviewSuggestions).toEqual(
      expect.arrayContaining(["기획안 보기", "생성 단계로 이동", "기획 보완 계속하기"]),
    );
  });
});
