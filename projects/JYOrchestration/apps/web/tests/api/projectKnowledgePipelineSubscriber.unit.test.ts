import { describe, expect, it, vi, beforeEach } from "vitest";

const pipelineMock = vi.fn();
const postProcessMock = vi.fn();

vi.mock("@/lib/project-knowledge/projectKnowledgePipeline", () => ({
  runProjectKnowledgePipeline: (...args: unknown[]) => pipelineMock(...args),
}));

vi.mock("@/lib/project-knowledge/projectKnowledgePostProcess", () => ({
  runProjectKnowledgePostProcess: (...args: unknown[]) => postProcessMock(...args),
}));

import { publishKnowledgeEvent } from "@/lib/project-knowledge/projectKnowledgeEventBus";
import { registerProjectKnowledgePipelineSubscriber } from "@/lib/project-knowledge/projectKnowledgePipelineSubscriber";

describe("projectKnowledgePipelineSubscriber", () => {
  beforeEach(() => {
    pipelineMock.mockReset();
    postProcessMock.mockReset();
    pipelineMock.mockResolvedValue({ ok: true, warnings: [] });
    postProcessMock.mockResolvedValue({ ok: true });
    registerProjectKnowledgePipelineSubscriber();
  });

  it("runs post process for conversation events", async () => {
    await publishKnowledgeEvent({
      kind: "project_event_appended",
      projectId: "p1",
      eventId: "ev-1",
      eventType: "conversation.message_created",
    });
    expect(postProcessMock).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1", eventIds: ["ev-1"] }),
    );
  });

  it("runs pipeline for requirements_saved", async () => {
    await publishKnowledgeEvent({
      kind: "requirements_saved",
      db: {} as never,
      input: { projectId: "p1", trigger: "requirements_saved" },
    });
    expect(pipelineMock).toHaveBeenCalled();
  });
});
