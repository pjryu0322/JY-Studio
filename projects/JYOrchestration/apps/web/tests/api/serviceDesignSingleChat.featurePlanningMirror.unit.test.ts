import { describe, expect, it } from "vitest";
import {
  buildFeaturePlanningMirroredAiTurn,
  buildFeaturePlanningMirroredUserTurn,
  shouldSkipFeaturePlanningAiMirror,
  shouldSkipFeaturePlanningMirror,
  FEATURE_PLANNING_MIRROR_INTERNAL_TYPE,
} from "@/lib/service-design/serviceDesignSingleChatFeaturePlanningMirror";

describe("feature-planning mirror helpers", () => {
  it("builds mirrored user turn with stage metadata", () => {
    const msg = buildFeaturePlanningMirroredUserTurn({
      text: "hello",
      payload: { serviceDesignStage: "feature-planning", mentionedAI: "AI분석가" },
      speakerId: "u1",
      speakerName: "나",
      createdAtIso: "2026-01-01T00:00:00.000Z",
    });
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("hello");
    expect(msg.meta.internalType).toBe(FEATURE_PLANNING_MIRROR_INTERNAL_TYPE);
    expect(msg.meta.serviceDesignStage).toBe("feature-planning");
    expect(msg.meta.mentionedAI).toBe("AI분석가");
  });

  it("skips duplicate within window when same text/stage/mention", () => {
    const nowIso = "2026-01-01T00:00:10.000Z";
    const existing = [
      buildFeaturePlanningMirroredUserTurn({
        text: "same",
        payload: { serviceDesignStage: "feature-planning", mentionedAI: null },
        speakerId: "u1",
        speakerName: "나",
        createdAtIso: "2026-01-01T00:00:05.000Z",
      }),
    ];
    expect(
      shouldSkipFeaturePlanningMirror({
        messages: existing,
        text: "same",
        mentionedAI: null,
        nowIso,
        windowMs: 10_000,
      })
    ).toBe(true);
  });

  it("does not skip when mention differs", () => {
    const nowIso = "2026-01-01T00:00:10.000Z";
    const existing = [
      buildFeaturePlanningMirroredUserTurn({
        text: "same",
        payload: { serviceDesignStage: "feature-planning", mentionedAI: "x" },
        speakerId: "u1",
        speakerName: "나",
        createdAtIso: "2026-01-01T00:00:05.000Z",
      }),
    ];
    expect(
      shouldSkipFeaturePlanningMirror({
        messages: existing,
        text: "same",
        mentionedAI: "y",
        nowIso,
        windowMs: 10_000,
      })
    ).toBe(false);
  });

  it("builds mirrored ai turn with stage metadata", () => {
    const msg = buildFeaturePlanningMirroredAiTurn({
      text: "ai reply",
      speakerName: "AI 설계자",
      createdAtIso: "2026-01-01T00:00:00.000Z",
    });
    expect(msg.role).toBe("ai");
    expect(msg.content).toBe("ai reply");
    expect(msg.meta.internalType).toBe(FEATURE_PLANNING_MIRROR_INTERNAL_TYPE);
    expect(msg.meta.serviceDesignStage).toBe("feature-planning");
    expect(msg.meta.mirroredRole).toBe("ai");
  });

  it("skips duplicate ai within window when same text", () => {
    const existing = [
      buildFeaturePlanningMirroredAiTurn({
        text: "same ai",
        createdAtIso: "2026-01-01T00:00:05.000Z",
      }),
    ];
    expect(
      shouldSkipFeaturePlanningAiMirror({
        messages: existing,
        text: "same ai",
        nowIso: "2026-01-01T00:00:10.000Z",
        windowMs: 10_000,
      })
    ).toBe(true);
  });
});

