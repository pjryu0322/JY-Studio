import { describe, expect, it, vi } from "vitest";
import { dispatchServiceFlowSingleChatSend } from "@/lib/service-design/serviceDesignSingleChatServiceFlowSend";
import {
  buildFeaturePlanningMirroredAiTurn,
  buildFeaturePlanningMirroredUserTurn,
  FEATURE_PLANNING_MIRROR_INTERNAL_TYPE,
} from "@/lib/service-design/serviceDesignSingleChatFeaturePlanningMirror";
import { runOptionalAdvisoryCalls } from "@/lib/service-design/serviceDesignAdvisoryCall";

vi.mock("@/lib/ai/openAiChatCompletions", () => {
  return {
    postOpenAiChatCompletion: vi.fn(),
  };
});

describe("Service Design SingleChat execution boundaries", () => {
  it("dispatchServiceFlowSingleChatSend passes explicit text to service-flow send ref", async () => {
    const send = vi.fn(async () => {});
    const after = vi.fn();
    await dispatchServiceFlowSingleChatSend({
      payload: { serviceDesignStage: "service-flow", mentionedAI: null },
      text: " hello ",
      sendRefCurrent: send,
      onAfterDispatch: after,
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ serviceDesignStage: "service-flow", mentionedAI: null }, "hello");
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("dispatchServiceFlowSingleChatSend does not call send ref for empty text", async () => {
    const send = vi.fn(async () => {});
    const after = vi.fn();
    await dispatchServiceFlowSingleChatSend({
      payload: { serviceDesignStage: "service-flow", mentionedAI: null },
      text: "   ",
      sendRefCurrent: send,
      onAfterDispatch: after,
    });
    expect(send).toHaveBeenCalledTimes(0);
    expect(after).toHaveBeenCalledTimes(0);
  });

  it("feature-planning mirror helpers build user/ai messages with internalType and stage", () => {
    const user = buildFeaturePlanningMirroredUserTurn({
      text: "t",
      payload: { serviceDesignStage: "feature-planning", mentionedAI: null },
      speakerId: "u",
      speakerName: "나",
      createdAtIso: "2026-01-01T00:00:00.000Z",
    });
    expect(user.meta.internalType).toBe(FEATURE_PLANNING_MIRROR_INTERNAL_TYPE);
    expect(user.meta.serviceDesignStage).toBe("feature-planning");

    const ai = buildFeaturePlanningMirroredAiTurn({ text: "a", createdAtIso: "2026-01-01T00:00:01.000Z" });
    expect(ai.meta.internalType).toBe(FEATURE_PLANNING_MIRROR_INTERNAL_TYPE);
    expect(ai.meta.serviceDesignStage).toBe("feature-planning");
  });

  it("runOptionalAdvisoryCalls is sequential advisory (not multicall)", async () => {
    const { postOpenAiChatCompletion } = await import("@/lib/ai/openAiChatCompletions");

    let firstStarted = false;
    let secondStarted = false;
    let resolveFirst: (() => void) | null = null;

    (postOpenAiChatCompletion as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      if (!firstStarted) {
        firstStarted = true;
        await new Promise<void>((r) => {
          resolveFirst = r;
        });
        return { ok: true, text: "first" };
      }
      secondStarted = true;
      return { ok: true, text: "second" };
    });

    const p = runOptionalAdvisoryCalls({
      apiKey: "k",
      userMessage: "hi",
      advisors: ["a1", "a2"],
      stage: "prototype_build",
      intent: "answer",
    });

    // give the loop a tick; second must not start before first resolves
    await Promise.resolve();
    expect(firstStarted).toBe(true);
    expect(secondStarted).toBe(false);

    resolveFirst?.();
    const out = await p;
    expect(out.length).toBe(2);
    expect(secondStarted).toBe(true);
  });
});

