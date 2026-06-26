import { describe, expect, it } from "vitest";
import type { ProjectGraphEdgeDto, ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";
import {
  buildAgentGraphProjection,
  getAgentGraphProjectionNodeState,
  normalizeProjectKnowledgeGraphView,
} from "@/lib/project-knowledge/projectKnowledgeAgentGraphProjection";

function node(
  id: string,
  agentRelevance?: ProjectGraphNodeDto["agentRelevance"],
): ProjectGraphNodeDto {
  return {
    id,
    nodeType: "Feature",
    title: id,
    summary: null,
    ...(agentRelevance ? { agentRelevance } : {}),
  };
}

function edge(id: string, from: string, to: string): ProjectGraphEdgeDto {
  return { id, fromNodeId: from, toNodeId: to, edgeType: "LINK" };
}

describe("projectKnowledgeAgentGraphProjection", () => {
  it("all view shows full graph without highlights", () => {
    const nodes = [node("n1"), node("n2"), node("n3")];
    const edges = [edge("e1", "n1", "n2"), edge("e2", "n2", "n3")];
    const projection = buildAgentGraphProjection({ nodes, edges, view: "all" });

    expect(projection.visibleNodeIds).toEqual(["n1", "n2", "n3"]);
    expect(projection.visibleEdgeIds).toEqual(["e1", "e2"]);
    expect(projection.highlightedNodeIds).toEqual([]);
    expect(projection.mutedNodeIds).toEqual([]);
    expect(projection.reasonByNodeId).toEqual({});
  });

  it("agent view highlights relevant nodes with reasons", () => {
    const nodes = [
      node("node-a", {
        planner: {
          relevance: 0.8,
          useAs: "mvp_scope",
          reason: "MVP",
          promptSummary: "MVP 범위 정리",
        },
      }),
      node("node-b", {
        developer: {
          relevance: 0.7,
          useAs: "implementation_hint",
          reason: "화면",
          promptSummary: "화면 구현",
        },
      }),
      node("node-c"),
    ];
    const projection = buildAgentGraphProjection({ nodes, edges: [], view: "planner" });

    expect(projection.highlightedNodeIds).toEqual(["node-a"]);
    expect(projection.reasonByNodeId["node-a"]).toBe("MVP 범위 정리");
    expect(projection.visibleNodeIds).toEqual(["node-a"]);
  });

  it("includes one-hop neighbor context by default", () => {
    const nodes = [
      node("node-a", {
        planner: {
          relevance: 0.8,
          useAs: "context",
          reason: "r",
          promptSummary: "p",
        },
      }),
      node("node-c"),
    ];
    const edges = [edge("e-ac", "node-a", "node-c")];
    const projection = buildAgentGraphProjection({ nodes, edges, view: "planner" });

    expect(projection.visibleNodeIds).toContain("node-a");
    expect(projection.visibleNodeIds).toContain("node-c");
    expect(projection.highlightedNodeIds).toEqual(["node-a"]);
    expect(projection.mutedNodeIds).toEqual(["node-c"]);
    expect(projection.visibleEdgeIds).toEqual(["e-ac"]);
    expect(getAgentGraphProjectionNodeState(projection, "node-c")).toBe("muted");
  });

  it("excludes neighbors when includeNeighborContext is false", () => {
    const nodes = [
      node("node-a", {
        planner: {
          relevance: 0.8,
          useAs: "context",
          reason: "r",
          promptSummary: "p",
        },
      }),
      node("node-c"),
    ];
    const edges = [edge("e-ac", "node-a", "node-c")];
    const projection = buildAgentGraphProjection({
      nodes,
      edges,
      view: "planner",
      includeNeighborContext: false,
    });

    expect(projection.visibleNodeIds).toEqual(["node-a"]);
    expect(projection.mutedNodeIds).toEqual([]);
    expect(projection.visibleEdgeIds).toEqual([]);
  });

  it("applies relevanceThreshold", () => {
    const nodes = [
      node("node-a", {
        planner: { relevance: 0.49, useAs: "context", reason: "low", promptSummary: "low" },
      }),
      node("node-b", {
        planner: { relevance: 0.5, useAs: "context", reason: "ok", promptSummary: "ok" },
      }),
    ];
    const projection = buildAgentGraphProjection({
      nodes,
      edges: [],
      view: "planner",
      relevanceThreshold: 0.5,
      includeNeighborContext: false,
    });

    expect(projection.highlightedNodeIds).toEqual(["node-b"]);
  });

  it("returns empty projection for empty input", () => {
    const projection = buildAgentGraphProjection({ nodes: [], edges: [], view: "planner" });
    expect(projection.visibleNodeIds).toEqual([]);
    expect(projection.agent).toBe("planner");
  });

  it("ignores dangling edges", () => {
    const nodes = [
      node("node-a", {
        planner: { relevance: 0.9, useAs: "context", reason: "r", promptSummary: "p" },
      }),
    ];
    const edges = [edge("e-dangle", "node-a", "missing")];
    const projection = buildAgentGraphProjection({ nodes, edges, view: "planner" });

    expect(projection.visibleEdgeIds).toEqual([]);
  });

  it("normalizes invalid view to all", () => {
    expect(normalizeProjectKnowledgeGraphView("planner")).toBe("planner");
    expect(normalizeProjectKnowledgeGraphView("unknown")).toBe("all");
    expect(normalizeProjectKnowledgeGraphView(null)).toBe("all");
  });

  it("does not mutate input nodes and edges", () => {
    const nodes = [
      node("node-a", {
        planner: { relevance: 0.8, useAs: "context", reason: "r", promptSummary: "p" },
      }),
    ];
    const edges = [edge("e1", "node-a", "node-b")];
    const nodesBefore = structuredClone(nodes);
    const edgesBefore = structuredClone(edges);

    buildAgentGraphProjection({ nodes, edges, view: "planner" });

    expect(nodes).toEqual(nodesBefore);
    expect(edges).toEqual(edgesBefore);
  });

  it("deduplicates duplicate node ids using first occurrence", () => {
    const nodes = [
      node("dup", {
        planner: { relevance: 0.9, useAs: "context", reason: "first", promptSummary: "first" },
      }),
      node("dup", {
        planner: { relevance: 0.1, useAs: "context", reason: "second", promptSummary: "second" },
      }),
    ];
    const projection = buildAgentGraphProjection({
      nodes,
      edges: [],
      view: "planner",
      includeNeighborContext: false,
    });

    expect(projection.highlightedNodeIds).toEqual(["dup"]);
    expect(projection.reasonByNodeId.dup).toBe("first");
  });
});
