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
});
