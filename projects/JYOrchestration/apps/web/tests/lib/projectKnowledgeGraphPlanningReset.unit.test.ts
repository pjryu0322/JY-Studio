import { describe, expect, it } from "vitest";
import {
  buildPlanningKnowledgeGraphTraceAfterReset,
  planningKnowledgeGraphRegenerationUserMessage,
  resolvePlanningKnowledgeGraphRegenerationHint,
} from "@/lib/project-graph/planningKnowledgeGraphTraceV1";
import { buildProjectGraphActivityFeed } from "@/lib/project-graph/projectGraphActivityFeed";
import { PLANNING_GRAPH_RESET_EVENT_TYPE } from "@/lib/project-graph/planningGraphResetEvent";

describe("planningKnowledgeGraphTraceV1", () => {
  it("shows empty-after-reset message when graph counts are zero", () => {
    const trace = buildPlanningKnowledgeGraphTraceAfterReset({
      nowIso: "2026-06-25T11:00:00.000Z",
      reason: "planning_reset",
    });
    const hint = resolvePlanningKnowledgeGraphRegenerationHint({
      trace,
      nodeCount: 0,
      edgeCount: 0,
      lastGraphAppliedAt: null,
    });
    expect(hint).toBe("empty_after_reset");
    const message = planningKnowledgeGraphRegenerationUserMessage(hint);
    expect(message).toContain("기획 초기화 후");
    expect(message).not.toMatch(/materialize|batch|보정|재선택/i);
  });

  it("detects regenerated graph after reset", () => {
    const trace = buildPlanningKnowledgeGraphTraceAfterReset({
      nowIso: "2026-06-25T11:00:00.000Z",
      reason: "planning_reset",
    });
    const hint = resolvePlanningKnowledgeGraphRegenerationHint({
      trace,
      nodeCount: 3,
      edgeCount: 2,
      lastGraphAppliedAt: "2026-06-25T11:05:00.000Z",
    });
    expect(hint).toBe("regenerated_after_reset");
    expect(planningKnowledgeGraphRegenerationUserMessage(hint)).toContain("초기화 이후 새로 생성");
  });
});

describe("buildProjectGraphActivityFeed planning_graph_reset", () => {
  it("includes reset event line without graph node side effects", () => {
    const feed = buildProjectGraphActivityFeed({
      projectId: "p1",
      events: [
        {
          id: "ev-reset",
          eventType: PLANNING_GRAPH_RESET_EVENT_TYPE,
          createdAt: "2026-06-25T11:00:00.000Z",
          payload: {
            eventType: PLANNING_GRAPH_RESET_EVENT_TYPE,
            reason: "planning_reset",
            resetAt: "2026-06-25T11:00:00.000Z",
            deletedGraphNodes: 7,
            deletedGraphEdges: 6,
            deletedProjectEvents: 10,
            deletedProjectMessages: 4,
            deletedStructureCandidates: 2,
            deletedStructureCandidateEdges: 1,
          },
        },
      ],
      candidates: [],
      graphNodes: [],
      graphEdges: [],
    });
    expect(feed[0]?.line).toContain("기획 초기화로 Knowledge Graph를 초기화");
    expect(feed[0]?.line).toContain("삭제된 노드 7개");
    expect(feed[0]?.detail.view).toBe("planning_graph_reset");
  });
});
