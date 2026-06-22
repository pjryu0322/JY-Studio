import { describe, expect, it, vi } from "vitest";
import { buildProjectEntityKey, buildIdeaEntityKey } from "@/lib/project-graph/projectGraphKeys";
import { findGraphPathBfs, buildOutgoingAdjacency } from "@/lib/project-graph/projectGraphPath";
import {
  planProjectGraphProjectionFromEvent,
  type ProjectGraphEventInput,
} from "@/lib/project-graph/projectGraphProjectionPlan";
import {
  PROJECT_GRAPH_EDGE_TYPES,
  PROJECT_GRAPH_EVENT_TYPES,
  PROJECT_GRAPH_NODE_TYPES,
} from "@/lib/project-graph/projectGraphTypes";
import { applyProjectGraphProjectionForEvent } from "@/lib/project-graph/projectGraphProjection";

function eventInput(partial: Partial<ProjectGraphEventInput> & Pick<ProjectGraphEventInput, "id" | "eventType">): ProjectGraphEventInput {
  return {
    projectId: "p1",
    payload: {},
    ...partial,
  };
}

describe("planProjectGraphProjectionFromEvent", () => {
  it("maps project.created to Project node", () => {
    const plan = planProjectGraphProjectionFromEvent(
      eventInput({
        id: "e1",
        eventType: PROJECT_GRAPH_EVENT_TYPES.PROJECT_CREATED,
        payload: { name: "My App", projectType: "WEB" },
      }),
    );
    expect(plan.nodes).toHaveLength(1);
    expect(plan.nodes[0]?.nodeType).toBe(PROJECT_GRAPH_NODE_TYPES.PROJECT);
    expect(plan.nodes[0]?.entityKey).toBe(buildProjectEntityKey("p1"));
    expect(plan.edges).toHaveLength(0);
  });

  it("maps idea.created to Idea node and HAS_IDEA edge", () => {
    const plan = planProjectGraphProjectionFromEvent(
      eventInput({
        id: "e2",
        eventType: PROJECT_GRAPH_EVENT_TYPES.IDEA_CREATED,
        payload: { name: "My App", description: "Build something" },
      }),
    );
    expect(plan.nodes[0]?.nodeType).toBe(PROJECT_GRAPH_NODE_TYPES.IDEA);
    expect(plan.edges[0]?.edgeType).toBe(PROJECT_GRAPH_EDGE_TYPES.HAS_IDEA);
    expect(plan.edges[0]?.fromEntityKey).toBe(buildProjectEntityKey("p1"));
    expect(plan.edges[0]?.toEntityKey).toBe(buildIdeaEntityKey("p1"));
  });

  it("maps conversation.message_created to Requirement candidate", () => {
    const plan = planProjectGraphProjectionFromEvent(
      eventInput({
        id: "e3",
        eventType: PROJECT_GRAPH_EVENT_TYPES.CONVERSATION_MESSAGE_CREATED,
        payload: { sourceMessageId: "msg-1" },
        messageContent: "Users need login",
      }),
    );
    expect(plan.nodes[0]?.nodeType).toBe(PROJECT_GRAPH_NODE_TYPES.REQUIREMENT);
    expect(plan.edges[0]?.edgeType).toBe(PROJECT_GRAPH_EDGE_TYPES.HAS_REQUIREMENT);
  });

  it("is idempotent in plan output for same event", () => {
    const input = eventInput({
      id: "e1",
      eventType: PROJECT_GRAPH_EVENT_TYPES.PROJECT_CREATED,
      payload: { name: "X" },
    });
    const a = planProjectGraphProjectionFromEvent(input);
    const b = planProjectGraphProjectionFromEvent(input);
    expect(a).toEqual(b);
  });
});

describe("applyProjectGraphProjectionForEvent", () => {
  it("skips duplicate node create on second apply", async () => {
    const storedNode = {
      id: "n1",
      projectId: "p1",
      projectionKey: "event:e1:node:Project",
      entityKey: buildProjectEntityKey("p1"),
      nodeType: PROJECT_GRAPH_NODE_TYPES.PROJECT,
      title: "X",
      summary: "",
    };
    const db = {
      projectGraphNode: {
        findFirst: vi.fn().mockResolvedValue(storedNode),
        create: vi.fn(),
      },
      projectGraphEdge: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
    };

    await applyProjectGraphProjectionForEvent(db as never, eventInput({
      id: "e1",
      eventType: PROJECT_GRAPH_EVENT_TYPES.PROJECT_CREATED,
      payload: { name: "X" },
    }));
    await applyProjectGraphProjectionForEvent(db as never, eventInput({
      id: "e1",
      eventType: PROJECT_GRAPH_EVENT_TYPES.PROJECT_CREATED,
      payload: { name: "X" },
    }));

    expect(db.projectGraphNode.create).not.toHaveBeenCalled();
  });

  it("creates edge when both nodes exist", async () => {
    const projectNode = { id: "n-project", entityKey: buildProjectEntityKey("p1") };
    const ideaNode = { id: "n-idea", entityKey: buildIdeaEntityKey("p1") };

    const db = {
      projectGraphNode: {
        findFirst: vi
          .fn()
          .mockImplementation(async ({ where }: { where: { projectionKey?: string; entityKey?: string } }) => {
            if (where.projectionKey?.includes("Idea")) return null;
            if (where.entityKey === buildProjectEntityKey("p1")) return projectNode;
            if (where.entityKey === buildIdeaEntityKey("p1")) return ideaNode;
            return null;
          }),
        create: vi.fn().mockImplementation(async ({ data }: { data: { entityKey: string } }) => {
          if (data.entityKey === buildIdeaEntityKey("p1")) return { ...ideaNode, ...data, id: "n-idea" };
          return { id: "n-new", ...data };
        }),
      },
      projectGraphEdge: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "edge-1" }),
      },
    };

    await applyProjectGraphProjectionForEvent(db as never, eventInput({
      id: "e2",
      eventType: PROJECT_GRAPH_EVENT_TYPES.IDEA_CREATED,
      payload: { name: "App", description: "desc" },
    }));

    expect(db.projectGraphEdge.create).toHaveBeenCalledTimes(1);
  });
});

describe("findGraphPathBfs", () => {
  it("finds shortest path between nodes", () => {
    const adjacency = buildOutgoingAdjacency([
      { fromNodeId: "a", toNodeId: "b" },
      { fromNodeId: "b", toNodeId: "c" },
    ]);
    expect(findGraphPathBfs("a", "c", adjacency)).toEqual(["a", "b", "c"]);
  });

  it("returns null when no path", () => {
    const adjacency = buildOutgoingAdjacency([{ fromNodeId: "a", toNodeId: "b" }]);
    expect(findGraphPathBfs("a", "z", adjacency)).toBeNull();
  });
});
