import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/project-graph/ProjectKnowledgeGraphCanvas", () => ({
  ProjectKnowledgeGraphCanvas: () => createElement("div", { "data-testid": "mock-canvas" }),
}));

import { ProjectKnowledgeReplayViewer } from "@/components/project-graph/ProjectKnowledgeReplayViewer";

describe("ProjectKnowledgeReplayViewer", () => {
  it("renders viewer shell", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeReplayViewer, {
        nodes: [{ id: "rev:a", nodeType: "Feature", title: "기능", summary: null }],
        edges: [],
      }),
    );
    expect(html).toContain("knowledge-replay-viewer");
    expect(html).toContain("mock-canvas");
  });
});
