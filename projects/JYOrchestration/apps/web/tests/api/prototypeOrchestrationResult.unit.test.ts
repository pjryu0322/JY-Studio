import { describe, expect, it } from "vitest";
import {
  buildPrototypeOrchestrationResult,
  resolvePrototypeOrchestrationChatContext,
} from "@/lib/prototype/prototypeOrchestrationResult";
import { newRequirementsMessage } from "@/lib/requirements/requirementsMessage";

describe("prototypeOrchestrationResult", () => {
  it("resolves chat context from requirements state", () => {
    const prior = newRequirementsMessage({
      id: "m1",
      role: "user",
      speakerType: "USER",
      speakerId: "u1",
      speakerName: "User",
      messageType: "STATEMENT",
      content: "hello",
      createdAt: "2026-05-29T12:00:00.000Z",
    });
    const ctx = resolvePrototypeOrchestrationChatContext({
      prototypeExecutionSingleChatV1: {
        messages: [prior],
        slots: [],
        answers: {},
        currentSlotKey: null,
      },
    });
    expect(ctx.priorMessages).toHaveLength(1);
    expect(ctx.currentSlotKey).toBeNull();
  });

  it("appends new messages to prior chat", () => {
    const prior = newRequirementsMessage({
      id: "m1",
      role: "user",
      speakerType: "USER",
      speakerId: "u1",
      speakerName: "User",
      messageType: "STATEMENT",
      content: "hello",
      createdAt: "2026-05-29T12:00:00.000Z",
    });
    const next = newRequirementsMessage({
      id: "m2",
      role: "ai",
      speakerType: "AI",
      speakerId: "memo",
      speakerName: "SCM",
      messageType: "STATEMENT",
      content: "done",
      createdAt: "2026-05-29T12:00:01.000Z",
    });
    const result = buildPrototypeOrchestrationResult({
      kind: "completed",
      message: "done",
      requirementsStateJson: {
        prototypeExecutionSingleChatV1: {
          messages: [prior],
          slots: [],
          answers: {},
          currentSlotKey: null,
        },
      },
      newMessages: [next],
    });
    expect(result.kind).toBe("completed");
    expect(result.chatPatch?.messages).toHaveLength(2);
    expect(result.chatPatch?.messages[1]?.id).toBe("m2");
  });
});
