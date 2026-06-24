import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectKnowledgeTracePanel } from "@/components/project-graph/ProjectKnowledgeTracePanel";

vi.mock("@/lib/project-knowledge/projectKnowledgeTraceClient", () => ({
  fetchKnowledgeTrace: vi.fn(),
}));

describe("ProjectKnowledgeTracePanel", () => {
  it("renders empty state without nodeId", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeTracePanel, {
        projectId: "p1",
        nodeId: null,
        active: false,
      }),
    );
    expect(html).toContain("knowledge-trace-empty");
  });

  it("renders panel shell when nodeId provided", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeTracePanel, {
        projectId: "p1",
        nodeId: "node-1",
        active: false,
      }),
    );
    expect(html).toContain("knowledge-trace-panel");
    expect(html).toContain("생성되었습니다");
  });
});

describe("ProjectGraphNodeDetailPanel tabs", () => {
  it("exports trace tab label in detail body", async () => {
    const { ProjectGraphNodeDetailBody } = await import("@/components/project-graph/ProjectGraphNodeDetailPanel");
    const html = renderToStaticMarkup(
      createElement(ProjectGraphNodeDetailBody, {
        projectId: "p1",
        node: {
          id: "n1",
          nodeType: "Feature",
          title: "Test",
          summary: null,
        },
        impact: null,
        onSelectRelatedNodeId: vi.fn(),
        detailTab: "trace",
        onDetailTabChange: vi.fn(),
      }),
    );
    expect(html).toContain("Trace");
    expect(html).toContain("project-graph-node-detail-tabs");
  });
});
