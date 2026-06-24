import { describe, expect, it, vi } from "vitest";
import {
  publishKnowledgeEvent,
  subscribeKnowledgeEvent,
  unsubscribeKnowledgeEvent,
} from "@/lib/project-knowledge/projectKnowledgeEventBus";

describe("projectKnowledgeEventBus", () => {
  it("delivers events to subscribers", async () => {
    const handler = vi.fn();
    const off = subscribeKnowledgeEvent(handler);
    await publishKnowledgeEvent({
      kind: "project_event_appended",
      projectId: "p1",
      eventId: "ev-1",
      eventType: "conversation.message_created",
    });
    expect(handler).toHaveBeenCalledTimes(1);
    off();
    unsubscribeKnowledgeEvent(handler);
  });
});
