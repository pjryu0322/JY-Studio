import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProjectGraphEdgeDto, ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";
import { ProjectKnowledgeAgentGraphViewTabs } from "@/components/project-graph/ProjectKnowledgeAgentGraphViewTabs";
import { applyAgentGraphViewLayer } from "@/lib/project-knowledge/projectKnowledgeAgentGraphViewUi";
import { AGENT_GRAPH_VIEW_OPTIONS } from "@/lib/project-knowledge/projectKnowledgeAgentGraphViewOptions";

function node(
  id: string,
  title: string,
  agentRelevance?: ProjectGraphNodeDto["agentRelevance"],
): ProjectGraphNodeDto {
  return {
    id,
    nodeType: "Feature",
    title,
    summary: null,
    ...(agentRelevance ? { agentRelevance } : {}),
  };
}

function edge(id: string, from: string, to: string): ProjectGraphEdgeDto {
  return { id, fromNodeId: from, toNodeId: to, edgeType: "LINK" };
}

describe("ProjectKnowledgeAgentGraphViewTabs", () => {
  it("renders agent view tab labels", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeAgentGraphViewTabs, { value: "all", onChange: () => {} }),
    );
    for (const opt of AGENT_GRAPH_VIEW_OPTIONS) {
      expect(html).toContain(opt.label);
    }
    expect(html).toContain("knowledge-graph-agent-view-tabs");
    expect(html).toContain('data-testid="knowledge-graph-agent-view-planner"');
  });
});

describe("applyAgentGraphViewLayer", () => {
  const nodes = [
    node("node-a", "node-a title", {
      planner: {
        relevance: 0.8,
        useAs: "mvp_scope",
        reason: "MVP",
        promptSummary: "MVP 범위 정리",
      },
    }),
    node("node-b", "node-b title", {
      developer: {
        relevance: 0.8,
        useAs: "implementation_hint",
        reason: "dev",
        promptSummary: "dev hint",
      },
    }),
    node("node-c", "node-c title"),
  ];
  const edges = [edge("e-ac", "node-a", "node-c")];

  it("shows all nodes on all view", () => {
    const layer = applyAgentGraphViewLayer({
      canonicalNodes: nodes,
      canonicalEdges: edges,
      displayNodes: nodes,
      displayEdges: edges,
      graphView: "all",
    });
    expect(layer.nodes.map((n) => n.id)).toEqual(["node-a", "node-b", "node-c"]);
    expect(layer.agentNodeVisualState).toEqual({});
  });

  it("applies planner projection to visible nodes", () => {
    const layer = applyAgentGraphViewLayer({
      canonicalNodes: nodes,
      canonicalEdges: edges,
      displayNodes: nodes,
      displayEdges: edges,
      graphView: "planner",
    });
    expect(layer.nodes.map((n) => n.id)).toEqual(["node-a", "node-c"]);
    expect(layer.agentNodeVisualState["node-a"]).toBe("highlighted");
    expect(layer.agentNodeVisualState["node-c"]).toBe("muted");
    expect(layer.nodes.some((n) => n.id === "node-b")).toBe(false);
    expect(layer.projection.reasonByNodeId["node-a"]).toBe("MVP 범위 정리");
  });

  it("returns empty agent layer for legacy nodes without relevance", () => {
    const legacy = [node("only", "only title")];
    const layer = applyAgentGraphViewLayer({
      canonicalNodes: legacy,
      canonicalEdges: [],
      displayNodes: legacy,
      displayEdges: [],
      graphView: "planner",
    });
    expect(layer.nodes).toEqual([]);
    expect(layer.projection.highlightedNodeIds).toEqual([]);
  });
});
