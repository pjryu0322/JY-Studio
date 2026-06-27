import { describe, expect, it } from "vitest";
import {
  appendUserMemoryUsageEventsToRequirementsState,
  getUserMemoryControlFromRequirementsState,
  getUserMemoryUsageStateFromRequirementsState,
  setUserMemoryControlInRequirementsState,
  setReferenceSelectionInRequirementsState,
  setReferenceSelectionSummaryInRequirementsState,
  setMaterializedReferenceContextInRequirementsState,
  setPlanningKnowledgeGraphTraceInRequirementsState,
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

describe("projectKnowledgeRequirementsStateAdapter reference and graph fields", () => {
  it("setReferenceSelectionInRequirementsState preserves user memory fields", () => {
    const base = {
      userProjectKnowledgeMemoryControlV1: {
        version: USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_VERSION,
        enabled: true,
        excludedSourceProjectIds: [],
        ignoredMemoryItemIds: [],
        pinnedMemoryItemIds: [],
      },
      userProjectKnowledgeMemoryUsageStateV1: {
        version: "user_project_knowledge_memory_usage_state_v1" as const,
        events: [],
      },
    };
    const next = setReferenceSelectionInRequirementsState(base, {
      referenceSnapshotIds: ["snap-1"],
      selectedAt: "2026-06-01T00:00:00.000Z",
      source: "USER_SELECTED",
    });
    expect(next.userProjectKnowledgeMemoryControlV1).toEqual(base.userProjectKnowledgeMemoryControlV1);
    expect(next.userProjectKnowledgeMemoryUsageStateV1).toEqual(base.userProjectKnowledgeMemoryUsageStateV1);
    expect(next.referenceSelectionV1?.referenceSnapshotIds).toEqual(["snap-1"]);
  });

  it("setReferenceSelectionSummaryInRequirementsState preserves materializedReferenceContextV1", () => {
    const materialized = { version: "materialized_reference_context_v1" as const, source: {}, summary: {} };
    const base = { materializedReferenceContextV1: materialized };
    const next = setReferenceSelectionSummaryInRequirementsState(base, {
      sourceProjectTitle: "Src",
      snapshotTitle: "Snap",
      readiness: "READY",
      actorCount: 0,
      serviceFlowCount: 0,
      featureCount: 0,
      graphReusableNodeCount: 0,
    });
    expect(next.materializedReferenceContextV1).toEqual(materialized);
    expect(next.referenceSelectionSummaryV1?.snapshotTitle).toBe("Snap");
  });

  it("setMaterializedReferenceContextInRequirementsState preserves referenceSelectionV1", () => {
    const selection = {
      referenceSnapshotIds: ["a"],
      selectedAt: "2026-06-01T00:00:00.000Z",
      source: "USER_SELECTED" as const,
    };
    const base = { referenceSelectionV1: selection };
    const next = setMaterializedReferenceContextInRequirementsState(base, null);
    expect(next.referenceSelectionV1).toEqual(selection);
    expect(next.materializedReferenceContextV1).toBeNull();
  });

  it("setPlanningKnowledgeGraphTraceInRequirementsState preserves unrelated fields", () => {
    const base = { referenceSelectionV1: null, userProjectKnowledgeMemoryControlV1: { version: USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_VERSION, enabled: true, excludedSourceProjectIds: [], ignoredMemoryItemIds: [], pinnedMemoryItemIds: [] } };
    const next = setPlanningKnowledgeGraphTraceInRequirementsState(base, {
      version: "planning_knowledge_graph_trace_v1",
      events: [],
    });
    expect(next.referenceSelectionV1).toBeNull();
    expect(next.planningKnowledgeGraphTraceV1?.events).toEqual([]);
  });
});
