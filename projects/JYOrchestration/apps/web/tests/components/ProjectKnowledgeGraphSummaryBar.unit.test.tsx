import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectKnowledgeGraphSummaryBar } from "@/components/project-graph/ProjectKnowledgeGraphSummaryBar";

describe("ProjectKnowledgeGraphSummaryBar", () => {
  it("shows view label and display counts over runtime summary counts", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeGraphSummaryBar, {
        summary: {
          status: "NEEDS_REVIEW",
          statusLabel: "검토 필요",
          nodeCount: 21,
          edgeCount: 24,
          latestChangedAt: "2026-06-27T02:36:00.000Z",
        },
        loading: false,
        error: null,
        displayNodeCount: 8,
        displayEdgeCount: 10,
        viewLabel: "현재 보기",
      }),
    );
    expect(html).toContain("현재 보기 8 nodes · 10 edges");
    expect(html).not.toContain("21 nodes");
  });

  it("uses 전체 label for all view", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeGraphSummaryBar, {
        summary: {
          status: "READY",
          statusLabel: "완료",
          nodeCount: 21,
          edgeCount: 24,
        },
        loading: false,
        error: null,
        displayNodeCount: 21,
        displayEdgeCount: 24,
        viewLabel: "전체",
      }),
    );
    expect(html).toContain("전체 21 nodes · 24 edges");
  });

  it("shows zero display counts in agent view empty state", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeGraphSummaryBar, {
        summary: {
          status: "READY",
          statusLabel: "완료",
          nodeCount: 5,
          edgeCount: 3,
        },
        loading: false,
        error: null,
        displayNodeCount: 0,
        displayEdgeCount: 0,
        viewLabel: "현재 보기",
      }),
    );
    expect(html).toContain("현재 보기 0 nodes · 0 edges");
  });
});
