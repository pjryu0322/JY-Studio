import { describe, expect, it, vi } from "vitest";
import {
  extractRequirementsMessagesForEventStore,
  mapServiceDesignStageToProcessStage,
} from "@/lib/project-process/projectEventMessageExtract";
import {
  appendProjectCreatedEvents,
  appendProjectMessageWithEvent,
  buildConversationMessageCreatedEventIdempotencyKey,
  resolveRequirementsMessageActor,
  syncRequirementsConversationMessagesToEventStore,
} from "@/lib/project-process/projectEventStore";
import { PROJECT_EVENT_TYPES, PROJECT_PROCESS_STAGES } from "@/lib/project-process/projectEventTypes";
import { newRequirementsMessage } from "@/lib/requirements/requirementsMessage";

function sampleMessage(id: string, content: string, serviceDesignStage?: string) {
  return newRequirementsMessage({
    id,
    role: "user",
    speakerType: "USER",
    speakerId: "u1",
    speakerName: "테스트",
    messageType: "STATEMENT",
    content,
    meta: serviceDesignStage ? { serviceDesignStage: serviceDesignStage as never } : {},
  });
}

describe("extractRequirementsMessagesForEventStore", () => {
  it("extracts messages present only in next conversation", () => {
    const prev = { messages: [sampleMessage("m1", "hello")] };
    const next = {
      messages: [sampleMessage("m1", "hello"), sampleMessage("m2", "world")],
    };
    const extracted = extractRequirementsMessagesForEventStore({
      previousConversationJson: prev,
      nextConversationJson: next,
    });
    expect(extracted).toHaveLength(1);
    expect(extracted[0]?.message.id).toBe("m2");
  });

  it("excludes messages already in previous conversation", () => {
    const msg = sampleMessage("m1", "only");
    const extracted = extractRequirementsMessagesForEventStore({
      previousConversationJson: { messages: [msg] },
      nextConversationJson: { messages: [msg] },
    });
    expect(extracted).toHaveLength(0);
  });

  it("skips messages without id", () => {
    const extracted = extractRequirementsMessagesForEventStore({
      nextConversationJson: {
        messages: [{ role: "user", content: "no id" }],
      },
    });
    expect(extracted).toHaveLength(0);
  });

  it("skips messages without content", () => {
    const extracted = extractRequirementsMessagesForEventStore({
      nextConversationJson: {
        messages: [sampleMessage("m-empty", "   ")],
      },
    });
    expect(extracted).toHaveLength(0);
  });

  it("uses serviceDesignStage for process stage when present", () => {
    const extracted = extractRequirementsMessagesForEventStore({
      nextConversationJson: {
        messages: [sampleMessage("m1", "x", "service-flow")],
      },
    });
    expect(extracted[0]?.stage).toBe(PROJECT_PROCESS_STAGES.REQUIREMENTS_SERVICE_FLOW);
  });

  it("uses fallbackStage when serviceDesignStage is absent", () => {
    const extracted = extractRequirementsMessagesForEventStore({
      nextConversationJson: { messages: [sampleMessage("m1", "x")] },
      fallbackStage: PROJECT_PROCESS_STAGES.FEATURE_PLANNING,
    });
    expect(extracted[0]?.stage).toBe(PROJECT_PROCESS_STAGES.FEATURE_PLANNING);
  });

  it("dedupes duplicate ids within next conversation", () => {
    const msg = sampleMessage("dup", "one");
    const extracted = extractRequirementsMessagesForEventStore({
      nextConversationJson: { messages: [msg, msg] },
    });
    expect(extracted).toHaveLength(1);
  });
});

describe("mapServiceDesignStageToProcessStage", () => {
  it("maps ideation to requirements_ideation", () => {
    expect(mapServiceDesignStageToProcessStage("ideation", "fallback")).toBe(
      PROJECT_PROCESS_STAGES.REQUIREMENTS_IDEATION,
    );
  });
});

describe("resolveRequirementsMessageActor", () => {
  const loginUserId = "user-session-99";

  it("USER message uses login user id when provided", () => {
    const { actorType, actorId } = resolveRequirementsMessageActor({
      speakerType: "USER",
      speakerId: "u1",
      loginUserId,
    });
    expect(actorType).toBe("USER");
    expect(actorId).toBe(loginUserId);
  });

  it("AI message does not use login user id", () => {
    const { actorType, actorId } = resolveRequirementsMessageActor({
      speakerType: "AI",
      speakerId: "ai-planner-1",
      loginUserId,
    });
    expect(actorType).toBe("AI");
    expect(actorId).toBe("ai-planner-1");
    expect(actorId).not.toBe(loginUserId);
  });

  it("AI message without speakerId yields null actorId", () => {
    const { actorType, actorId } = resolveRequirementsMessageActor({
      speakerType: "AI",
      speakerId: "",
      loginUserId,
    });
    expect(actorType).toBe("AI");
    expect(actorId).toBeNull();
  });

  it("SYSTEM message does not use login user id", () => {
    const { actorType, actorId } = resolveRequirementsMessageActor({
      speakerType: "SYSTEM",
      speakerId: "sys",
      loginUserId,
    });
    expect(actorType).toBe("SYSTEM");
    expect(actorId).toBe("sys");
    expect(actorId).not.toBe(loginUserId);
  });
});

describe("buildConversationMessageCreatedEventIdempotencyKey", () => {
  it("uses project and source message id", () => {
    expect(buildConversationMessageCreatedEventIdempotencyKey("p1", "m1")).toBe(
      "conversation-message-created:p1:m1",
    );
  });
});

describe("syncRequirementsConversationMessagesToEventStore", () => {
  it("runs append in a single transaction when root client is passed", async () => {
    const tx = {
      projectMessage: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
      projectEvent: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
    };
    tx.projectMessage.create.mockResolvedValue({
      id: "pm1",
      projectId: "p1",
      stage: PROJECT_PROCESS_STAGES.REQUIREMENTS_IDEATION,
      source: "requirements_conversation",
      sourceMessageId: "m-new",
    });
    tx.projectEvent.create.mockResolvedValue({ id: "ev1" });

    const root = {
      $transaction: vi.fn(async (fn: (inner: typeof tx) => Promise<unknown>) => fn(tx)),
    };

    const msg = sampleMessage("m-new", "hello");
    await syncRequirementsConversationMessagesToEventStore(root as never, {
      projectId: "p1",
      actorId: "user-session-99",
      previousConversationJson: { messages: [] },
      nextConversationJson: { messages: [msg] },
    });

    expect(root.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.projectMessage.create).toHaveBeenCalledTimes(1);
    expect(tx.projectEvent.create).toHaveBeenCalledTimes(1);
    const eventData = tx.projectEvent.create.mock.calls[0]?.[0]?.data;
    expect(eventData?.actorType).toBe("USER");
    expect(eventData?.actorId).toBe("user-session-99");
    expect(eventData?.idempotencyKey).toBe("conversation-message-created:p1:m-new");
  });
});

describe("appendProjectCreatedEvents", () => {
  it("creates project.created and idea.created when description is set", async () => {
    const createdEvents: unknown[] = [];
    const db = {
      projectEvent: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(async ({ data }: { data: unknown }) => {
          createdEvents.push(data);
          return { id: `ev-${createdEvents.length}`, ...(data as object) };
        }),
      },
    };

    await appendProjectCreatedEvents(db as never, {
      projectId: "p1",
      actorId: "u1",
      name: "Demo",
      description: "An idea",
      projectType: "WEB",
      repoUrl: null,
      defaultBranch: "main",
    });

    expect(createdEvents).toHaveLength(2);
    expect((createdEvents[0] as { eventType: string }).eventType).toBe(PROJECT_EVENT_TYPES.PROJECT_CREATED);
    expect((createdEvents[1] as { eventType: string }).eventType).toBe(PROJECT_EVENT_TYPES.IDEA_CREATED);
  });
});

describe("appendProjectMessageWithEvent idempotency", () => {
  it("reuses existing message and event idempotency key on second call", async () => {
    const existingMessage = {
      id: "pm1",
      projectId: "p1",
      stage: PROJECT_PROCESS_STAGES.REQUIREMENTS_IDEATION,
      source: "requirements_conversation",
      sourceMessageId: "m1",
    };
    const existingEvent = { id: "ev1", idempotencyKey: "conversation-message-created:p1:m1" };

    const db = {
      projectMessage: {
        findFirst: vi.fn().mockResolvedValue(existingMessage),
        create: vi.fn(),
      },
      projectEvent: {
        findFirst: vi.fn().mockResolvedValue(existingEvent),
        create: vi.fn(),
      },
    };

    const first = await appendProjectMessageWithEvent(db as never, {
      projectId: "p1",
      stage: PROJECT_PROCESS_STAGES.REQUIREMENTS_IDEATION,
      sourceMessageId: "m1",
      senderType: "AI",
      senderId: "ai-1",
      content: "hi",
      actorType: "AI",
      actorId: "ai-1",
    });
    const second = await appendProjectMessageWithEvent(db as never, {
      projectId: "p1",
      stage: PROJECT_PROCESS_STAGES.REQUIREMENTS_IDEATION,
      sourceMessageId: "m1",
      senderType: "AI",
      senderId: "ai-1",
      content: "hi",
      actorType: "AI",
      actorId: "ai-1",
    });

    expect(db.projectMessage.create).not.toHaveBeenCalled();
    expect(db.projectEvent.create).not.toHaveBeenCalled();
    expect(first.event).toBe(existingEvent);
    expect(second.event).toBe(existingEvent);
  });
});
