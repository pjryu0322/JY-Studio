import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectKnowledgeGraphTabs } from "@/components/project-graph/ProjectKnowledgeGraphTabs";

describe("ProjectKnowledgeGraphTabs", () => {
  it("renders diagnostic English tabs in diagnostic mode", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeGraphTabs, {
        activePane: "graph",
        onPaneChange: vi.fn(),
        mode: "diagnostic",
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
        mode: "diagnostic",
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
        mode: "user",
        diagnosticsOpen: false,
      }),
    );
    expect(html).toBe("");
  });

  it("renders Korean user tabs when diagnostics are open", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeGraphTabs, {
        activePane: "activity",
        onPaneChange: vi.fn(),
        mode: "user",
        diagnosticsOpen: true,
      }),
    );
    expect(html).toContain("구조");
    expect(html).toContain("변경 로그");
    expect(html).toContain("생성 과정");
    expect(html).not.toContain("Knowledge Activity");
    expect(html).not.toContain(">Activity<");
  });

  it("invokes knowledge pane callback on knowledge tab select", () => {
    const onKnowledge = vi.fn();
    const onPaneChange = vi.fn();
    const el = createElement(ProjectKnowledgeGraphTabs, {
      activePane: "graph",
      onPaneChange,
      onKnowledgePaneSelect: onKnowledge,
      mode: "diagnostic",
    });
    expect(el.props.onKnowledgePaneSelect).toBe(onKnowledge);
  });
});
