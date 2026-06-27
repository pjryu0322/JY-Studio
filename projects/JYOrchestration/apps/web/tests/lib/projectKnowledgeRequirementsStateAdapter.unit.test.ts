import { describe, expect, it } from "vitest";
import {
  appendUserMemoryUsageEventsToRequirementsState,
  getUserMemoryControlFromRequirementsState,
  getUserMemoryUsageStateFromRequirementsState,
  setUserMemoryControlInRequirementsState,
} from "@/lib/project-state/projectKnowledgeRequirementsStateAdapter";
import { buildUserProjectKnowledgeMemoryUsageEvent } from "@/lib/project-knowledge/projectKnowledgeUserMemoryUsage";
import { USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_VERSION } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";

describe("projectKnowledgeRequirementsStateAdapter", () => {
  it("getUserMemoryControlFromRequirementsState defaults enabled=true", () => {
    const control = getUserMemoryControlFromRequirementsState({});
    expect(control.enabled).toBe(true);
    expect(control.version).toBe(USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_VERSION);
  });

  it("setUserMemoryControlInRequirementsState preserves other fields", () => {
    const base = {
      referenceSelectionV1: { version: "project_reference_selection_v1" as const, items: [] },
      planningKnowledgeGraphTraceV1: { version: "planning_knowledge_graph_trace_v1" as const, events: [] },
    };
    const next = setUserMemoryControlInRequirementsState(base, {
      version: USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_VERSION,
      enabled: false,
      excludedSourceProjectIds: [],
      ignoredMemoryItemIds: [],
      pinnedMemoryItemIds: [],
    });
    expect(next.referenceSelectionV1).toEqual(base.referenceSelectionV1);
    expect(next.planningKnowledgeGraphTraceV1).toEqual(base.planningKnowledgeGraphTraceV1);
    expect(next.userProjectKnowledgeMemoryControlV1?.enabled).toBe(false);
  });

  it("getUserMemoryUsageStateFromRequirementsState returns empty when absent", () => {
    const state = getUserMemoryUsageStateFromRequirementsState(undefined);
    expect(state.events).toEqual([]);
  });

  it("appendUserMemoryUsageEventsToRequirementsState preserves other fields and appends", () => {
    const event = buildUserProjectKnowledgeMemoryUsageEvent({
      projectId: "p1",
      surface: "single_chat",
      agent: "planner",
      outcome: "injected",
      itemCount: 1,
      sourceProjectCount: 1,
      controlEnabled: true,
      agentEnabled: true,
      promptTimelineEntryId: "tl-1",
    });
    const base = { materializedReferenceContextV1: { version: "materialized_reference_context_v1" as const } };
    const next = appendUserMemoryUsageEventsToRequirementsState(base, [event]);
    expect(next.materializedReferenceContextV1).toEqual(base.materializedReferenceContextV1);
    expect(next.userProjectKnowledgeMemoryUsageStateV1?.events).toHaveLength(1);
    expect(next.userProjectKnowledgeMemoryUsageStateV1?.events[0]?.outcome).toBe("injected");
  });
});
