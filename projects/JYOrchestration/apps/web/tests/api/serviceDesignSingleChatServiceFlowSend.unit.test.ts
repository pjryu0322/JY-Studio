import { describe, expect, it, vi } from "vitest";
import { dispatchServiceFlowSingleChatSend } from "@/lib/service-design/serviceDesignSingleChatServiceFlowSend";

describe("dispatchServiceFlowSingleChatSend", () => {
  it("forwards silentUserAppend when feature-planning routes orchestration chips", async () => {
    const fn = vi.fn(async () => {});
    await dispatchServiceFlowSingleChatSend({
      payload: { serviceDesignStage: "feature-planning", mentionedAI: null },
      text: "그대로 진행",
      quickAction: { id: "APPROVE_FLOW", label: "그대로 진행" },
      silentUserAppend: true,
      sendRefCurrent: fn,
      onAfterDispatch: () => {},
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0]?.[3]).toEqual({ silentUserAppend: true });
  });
});
