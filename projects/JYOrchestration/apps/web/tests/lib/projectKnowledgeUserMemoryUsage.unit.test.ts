import { describe, expect, it } from "vitest";
import {
  appendUserProjectKnowledgeMemoryUsageEvent,
  appendUserProjectKnowledgeMemoryUsageEvents,
  buildUserProjectKnowledgeMemoryUsageEvent,
  buildUserProjectKnowledgeMemoryUsageEventsFromTimelineSummaries,
  hashPromptSectionForMemoryUsage,
  hashUserIdForMemoryUsage,
  summarizeUserProjectKnowledgeMemoryUsage,
  usageEventDedupeKey,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryUsage";
import { DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import { isAgentMemoryEnabledInControl } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";

describe("projectKnowledgeUserMemoryUsage", () => {
  it("creates usage event id", () => {
    const event = buildUserProjectKnowledgeMemoryUsageEvent({
      projectId: "p1",
      userId: "user-raw",
      surface: "single_chat",
      agent: "planner",
      outcome: "injected",
      itemCount: 2,
      sourceProjectCount: 1,
      controlEnabled: true,
      agentEnabled: true,
      nowIso: "2026-06-03T00:00:00.000Z",
    });
    expect(event.id.length).toBeGreaterThan(10);
    expect(JSON.stringify(event)).not.toContain("user-raw");
    expect(event.userIdHash).toBe(hashUserIdForMemoryUsage("user-raw"));
  });

  it("stores prompt hash not markdown", () => {
    const md = "## Same-user memory\nsecret content";
    const event = buildUserProjectKnowledgeMemoryUsageEvent({
      projectId: "p1",
      surface: "single_chat",
      agent: "developer",
      outcome: "injected",
      itemCount: 1,
      sourceProjectCount: 1,
      controlEnabled: true,
      agentEnabled: true,
      promptSectionMarkdown: md,
    });
    expect(event.promptSectionHash).toBe(hashPromptSectionForMemoryUsage(md));
    expect(JSON.stringify(event)).not.toContain("secret content");
  });

  it("append keeps maxEvents", () => {
    let state: unknown = { version: "user_project_knowledge_memory_usage_state_v1", events: [] };
    for (let i = 0; i < 105; i += 1) {
      state = appendUserProjectKnowledgeMemoryUsageEvent({
        current: state,
        event: buildUserProjectKnowledgeMemoryUsageEvent({
          projectId: "p1",
          surface: "single_chat",
          agent: "planner",
          outcome: "skipped_empty",
          itemCount: 0,
          sourceProjectCount: 0,
          controlEnabled: true,
          agentEnabled: true,
          promptTimelineEntryId: `entry-${i}`,
          nowIso: `2026-06-03T00:00:${String(i).padStart(2, "0")}.000Z`,
        }),
        maxEvents: 100,
      });
    }
    const normalized = summarizeUserProjectKnowledgeMemoryUsage({ state });
    expect(normalized.totalEvents).toBe(100);
  });

  it("dedupes by surface/agent/timeline id", () => {
    const event = buildUserProjectKnowledgeMemoryUsageEvent({
      projectId: "p1",
      surface: "codetask_prompt",
      agent: "developer",
      outcome: "injected",
      itemCount: 2,
      sourceProjectCount: 1,
      controlEnabled: true,
      agentEnabled: true,
      codeTaskId: "ct1",
      runId: "run1",
    });
    const next = appendUserProjectKnowledgeMemoryUsageEvents({
      current: { version: "user_project_knowledge_memory_usage_state_v1", events: [event] },
      events: [event],
    });
    expect(next.events).toHaveLength(1);
    expect(usageEventDedupeKey(event)).toContain("codetask_prompt");
  });

  it("summarize computes agent injected stats", () => {
    const events = buildUserProjectKnowledgeMemoryUsageEventsFromTimelineSummaries({
      projectId: "p1",
      surface: "single_chat",
      summaries: [
        {
          kind: "user_project_knowledge_memory_context",
          agent: "planner",
          itemCount: 2,
          sourceProjectCount: 1,
          injected: true,
        },
        {
          kind: "user_project_knowledge_memory_context",
          agent: "developer",
          itemCount: 0,
          sourceProjectCount: 0,
          injected: false,
        },
      ],
      controlEnabled: true,
      isAgentEnabled: (agent) => isAgentMemoryEnabledInControl(DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1, agent),
      promptTimelineEntryId: "tl-1",
    });
    const state = appendUserProjectKnowledgeMemoryUsageEvents({ current: undefined, events });
    const summary = summarizeUserProjectKnowledgeMemoryUsage({ state });
    expect(summary.injectedEvents).toBe(1);
    expect(summary.skippedEvents).toBe(1);
    expect(summary.byAgent.planner.injectedCount).toBe(1);
    expect(summary.byAgent.planner.lastItemCount).toBe(2);
  });

  it("builds skipped_disabled from timeline when control off", () => {
    const events = buildUserProjectKnowledgeMemoryUsageEventsFromTimelineSummaries({
      projectId: "p1",
      surface: "single_chat",
      summaries: [
        {
          kind: "user_project_knowledge_memory_context",
          agent: "planner",
          itemCount: 0,
          sourceProjectCount: 0,
          injected: false,
        },
      ],
      controlEnabled: false,
      isAgentEnabled: () => true,
      promptTimelineEntryId: "tl-off",
    });
    expect(events[0]?.outcome).toBe("skipped_disabled");
  });
});
