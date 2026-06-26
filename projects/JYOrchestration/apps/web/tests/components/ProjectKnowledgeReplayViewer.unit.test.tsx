import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/project-graph/ProjectKnowledgeGraphCanvas", () => ({
  ProjectKnowledgeGraphCanvas: () => createElement("div", { "data-testid": "mock-canvas" }),
}));

vi.mock("@/components/ui/useMediaQuery", () => ({
  useMediaQuery: () => false,
}));

import { ProjectKnowledgeReplayViewer } from "@/components/project-graph/ProjectKnowledgeReplayViewer";
import { computeReplayAgentViewEmpty } from "@/lib/project-knowledge/projectKnowledgeAgentGraphViewUi";

describe("ProjectKnowledgeReplayViewer", () => {
  it("renders viewer shell and graph stage", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeReplayViewer, {
        nodes: [{ id: "rev:a", nodeType: "Feature", title: "기능", summary: null }],
        edges: [],
        frameKey: "rev-1",
      }),
    );
    expect(html).toContain("knowledge-replay-viewer");
    expect(html).toContain("knowledge-replay-graph-stage");
    expect(html).toContain("knowledge-replay-frame-current");
    expect(html).toContain("knowledge-graph-agent-view-tabs");
    expect(html).toContain("mock-canvas");
  });

  it("shows loading overlay without removing canvas", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeReplayViewer, {
        nodes: [{ id: "a", nodeType: "Feature", title: "기능", summary: null }],
        edges: [],
        loading: true,
        frameKey: "rev-1",
      }),
    );
    expect(html).toContain("knowledge-replay-loading-overlay");
    expect(html).toContain("다음 변화 준비 중");
    expect(html).toContain("mock-canvas");
    expect(html).not.toContain("해당 시점 그래프 불러오는 중");
  });

  it("computes agent empty from frame nodes for planner view", () => {
    const legacy = [{ id: "a", nodeType: "Feature", title: "기능", summary: null }];
    expect(computeReplayAgentViewEmpty("planner", legacy, [])).toBe(true);
    expect(computeReplayAgentViewEmpty("all", legacy, [])).toBe(false);
  });
});
