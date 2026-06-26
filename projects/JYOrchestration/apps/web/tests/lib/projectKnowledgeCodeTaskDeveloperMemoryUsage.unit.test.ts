import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1,
  type UserProjectKnowledgeMemoryControlV1,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import type { UserProjectKnowledgeMemoryTimelineSummary } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptInjection";
import { recordCodeTaskDeveloperMemoryUsageForProject } from "@/lib/project-knowledge/projectKnowledgeUserMemoryUsageRecording";

const developerInjected: UserProjectKnowledgeMemoryTimelineSummary = {
  kind: "user_project_knowledge_memory_context",
  agent: "developer",
  itemCount: 3,
  sourceProjectCount: 2,
  injected: true,
};

describe("recordCodeTaskDeveloperMemoryUsageForProject", () => {
  it("records injected codetask_prompt developer event", async () => {
    const recorder = vi.fn().mockResolvedValue(undefined);
    await recordCodeTaskDeveloperMemoryUsageForProject({
      projectId: "p1",
      userId: "u1",
      control: DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1,
      memoryControlEnabled: true,
      developerSummary: developerInjected,
      developerContextMarkdown: "## dev memory\nsecret line",
      codeTaskId: "ct-1",
      runId: "run-1",
      nowIso: "2026-06-03T00:00:00.000Z",
      recorder,
    });
    expect(recorder).toHaveBeenCalledOnce();
    const events = recorder.mock.calls[0]?.[0]?.events ?? [];
    expect(events[0]?.surface).toBe("codetask_prompt");
    expect(events[0]?.agent).toBe("developer");
    expect(events[0]?.outcome).toBe("injected");
    expect(JSON.stringify(events[0])).not.toContain("secret line");
  });

  it("records skipped_empty when developerSummary is null", async () => {
    const recorder = vi.fn().mockResolvedValue(undefined);
    await recordCodeTaskDeveloperMemoryUsageForProject({
      projectId: "p1",
      userId: "u1",
      control: DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1,
      memoryControlEnabled: true,
      developerSummary: null,
      codeTaskId: "ct-2",
      recorder,
    });
    const events = recorder.mock.calls[0]?.[0]?.events ?? [];
    expect(events[0]?.outcome).toBe("skipped_empty");
  });

  it("records skipped_disabled when memoryControlEnabled is false", async () => {
    const recorder = vi.fn().mockResolvedValue(undefined);
    await recordCodeTaskDeveloperMemoryUsageForProject({
      projectId: "p1",
      userId: "u1",
      control: DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1,
      memoryControlEnabled: false,
      developerSummary: developerInjected,
      codeTaskId: "ct-3",
      recorder,
    });
    const events = recorder.mock.calls[0]?.[0]?.events ?? [];
    expect(events[0]?.outcome).toBe("skipped_disabled");
  });

  it("records skipped_agent_disabled when developer agent toggle off", async () => {
    const control: UserProjectKnowledgeMemoryControlV1 = {
      ...DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1,
      agentEnabled: { developer: false },
    };
    const recorder = vi.fn().mockResolvedValue(undefined);
    await recordCodeTaskDeveloperMemoryUsageForProject({
      projectId: "p1",
      userId: "u1",
      control,
      memoryControlEnabled: true,
      developerSummary: developerInjected,
      codeTaskId: "ct-4",
      recorder,
    });
    const events = recorder.mock.calls[0]?.[0]?.events ?? [];
    expect(events[0]?.outcome).toBe("skipped_agent_disabled");
  });
});
