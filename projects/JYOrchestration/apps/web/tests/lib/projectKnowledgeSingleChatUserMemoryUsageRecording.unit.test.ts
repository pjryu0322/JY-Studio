import { describe, expect, it, vi } from "vitest";
import { DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import type { UserProjectKnowledgeMemoryTimelineSummary } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptInjection";
import {
  recordSingleChatUserMemoryUsageFromPreparedContext,
  type PreparedUserProjectKnowledgeMemoryPromptContexts,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryUsageRecording";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

const promptTrace: RequirementsPromptTimelineEntry = {
  stage: "ideation",
  action: "requirementsChat",
  source: "llm",
  createdAt: "2026-06-03T12:00:00.000Z",
};

const injectedSummary: UserProjectKnowledgeMemoryTimelineSummary = {
  kind: "user_project_knowledge_memory_context",
  agent: "planner",
  itemCount: 2,
  sourceProjectCount: 1,
  injected: true,
};

function prepared(overrides?: Partial<PreparedUserProjectKnowledgeMemoryPromptContexts>): PreparedUserProjectKnowledgeMemoryPromptContexts {
  return {
    byAgent: {},
    totalItemCount: 2,
    sourceProjectCount: 1,
    memoryControlEnabled: true,
    ...overrides,
  };
}

describe("recordSingleChatUserMemoryUsageFromPreparedContext", () => {
  it("calls recorder when trace and summaries exist", async () => {
    const recorder = vi.fn().mockResolvedValue(undefined);
    const ok = await recordSingleChatUserMemoryUsageFromPreparedContext({
      projectId: "p1",
      userId: "u1",
      prepared: prepared(),
      control: DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1,
      summaries: [injectedSummary],
      promptTrace,
      recorder,
    });
    expect(ok).toBe(true);
    expect(recorder).toHaveBeenCalledOnce();
    const events = recorder.mock.calls[0]?.[0]?.events ?? [];
    expect(events[0]?.outcome).toBe("injected");
    expect(events[0]?.surface).toBe("single_chat");
  });

  it("returns false without projectId", async () => {
    const recorder = vi.fn();
    expect(
      await recordSingleChatUserMemoryUsageFromPreparedContext({
        projectId: "",
        userId: "u1",
        prepared: prepared(),
        control: DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1,
        summaries: [injectedSummary],
        promptTrace,
        recorder,
      }),
    ).toBe(false);
    expect(recorder).not.toHaveBeenCalled();
  });

  it("returns false when prepared is null", async () => {
    const recorder = vi.fn();
    expect(
      await recordSingleChatUserMemoryUsageFromPreparedContext({
        projectId: "p1",
        userId: "u1",
        prepared: null,
        control: DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1,
        summaries: [injectedSummary],
        promptTrace,
        recorder,
      }),
    ).toBe(false);
    expect(recorder).not.toHaveBeenCalled();
  });

  it("returns false when control is null", async () => {
    const recorder = vi.fn();
    expect(
      await recordSingleChatUserMemoryUsageFromPreparedContext({
        projectId: "p1",
        userId: "u1",
        prepared: prepared(),
        control: null,
        summaries: [injectedSummary],
        promptTrace,
        recorder,
      }),
    ).toBe(false);
    expect(recorder).not.toHaveBeenCalled();
  });

  it("returns false when summaries are empty", async () => {
    const recorder = vi.fn();
    expect(
      await recordSingleChatUserMemoryUsageFromPreparedContext({
        projectId: "p1",
        userId: "u1",
        prepared: prepared({ byAgent: {} }),
        control: DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1,
        summaries: [],
        promptTrace,
        recorder,
      }),
    ).toBe(false);
    expect(recorder).not.toHaveBeenCalled();
  });

  it("records skipped_disabled when memory control disabled", async () => {
    const recorder = vi.fn().mockResolvedValue(undefined);
    await recordSingleChatUserMemoryUsageFromPreparedContext({
      projectId: "p1",
      userId: "u1",
      prepared: prepared({ memoryControlEnabled: false }),
      control: DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1,
      summaries: [injectedSummary],
      promptTrace,
      recorder,
    });
    const events = recorder.mock.calls[0]?.[0]?.events ?? [];
    expect(events[0]?.outcome).toBe("skipped_disabled");
  });
});
