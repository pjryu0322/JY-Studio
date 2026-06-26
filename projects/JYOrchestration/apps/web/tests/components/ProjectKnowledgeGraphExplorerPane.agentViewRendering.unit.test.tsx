import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";
import { buildAgentViewExplorerPresentation } from "@/lib/project-knowledge/projectKnowledgeAgentGraphViewUi";

function node(id: string, title: string): ProjectGraphNodeDto {
  return { id, nodeType: "Feature", title, summary: null };
}

describe("ProjectKnowledgeGraphExplorerPane agent view rendering", () => {
  it("does not render agent reason when detail node is hidden in planner view", () => {
    const hidden = node("node-b", "Hidden Node");
    const presentation = buildAgentViewExplorerPresentation({
      graphView: "planner",
      visibleNodeIds: ["node-a"],
      visibleEdgeIds: [],
      selectedNode: hidden,
      selectedNodeId: "node-b",
      detailNode: hidden,
      selectedEdgeId: null,
      reasonByNodeId: { "node-b": "should not show" },
    });
    expect(presentation.projectedDetailNode).toBeNull();
    expect(presentation.agentViewReason).toBeUndefined();

    const html = renderToStaticMarkup(
      createElement(ProjectGraphNodeDetailPanelFixture, {
        projectedDetailNode: presentation.projectedDetailNode,
        agentViewReason: presentation.agentViewReason,
      }),
    );
    expect(html).not.toContain("should not show");
    expect(html).not.toContain("project-graph-agent-view-reason");
  });
});

function ProjectGraphNodeDetailPanelFixture(p: {
  readonly projectedDetailNode: ProjectGraphNodeDto | null;
  readonly agentViewReason: string | undefined;
}) {
  if (!p.projectedDetailNode) {
    return createElement("aside", { "data-testid": "detail-empty" }, "선택된 노드 없음");
  }
  if (!p.agentViewReason) return createElement("aside", null, p.projectedDetailNode.title);
  return createElement(
    "aside",
    null,
    createElement("div", { "data-testid": "project-graph-agent-view-reason" }, p.agentViewReason),
  );
}
