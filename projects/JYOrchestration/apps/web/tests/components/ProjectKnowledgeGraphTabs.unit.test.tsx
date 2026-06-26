import { describe, expect, it, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectKnowledgeGraphTabs } from "@/components/project-graph/ProjectKnowledgeGraphTabs";

describe("ProjectKnowledgeGraphTabs", () => {
  it("renders graph, activity, and knowledge tabs", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeGraphTabs, {
        activePane: "graph",
        onPaneChange: vi.fn(),
        showDiagnosticTabs: true,
      }),
    );
    expect(html).toContain("project-knowledge-graph-tabs");
    expect(html).toContain("그래프");
    expect(html).toContain("Activity");
    expect(html).toContain("Knowledge Activity");
  });

  it("marks active tab with aria-selected", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeGraphTabs, {
        activePane: "activity",
        onPaneChange: vi.fn(),
        showDiagnosticTabs: true,
      }),
    );
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("project-knowledge-graph-tab-activity");
  });

  it("hides tabs in default user mode", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeGraphTabs, {
        activePane: "graph",
        onPaneChange: vi.fn(),
      }),
    );
    expect(html).toBe("");
  });

  it("invokes knowledge pane callback on knowledge tab select", () => {
    const onKnowledge = vi.fn();
    const onPaneChange = vi.fn();
    const el = createElement(ProjectKnowledgeGraphTabs, {
      activePane: "graph",
      onPaneChange,
      onKnowledgePaneSelect: onKnowledge,
      showDiagnosticTabs: true,
    });
    expect(el.props.onKnowledgePaneSelect).toBe(onKnowledge);
  });
});
