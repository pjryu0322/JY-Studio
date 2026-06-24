import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  KNOWLEDGE_TRACE_STEP_TYPE_LABELS,
  ProjectKnowledgeTracePanel,
} from "@/components/project-graph/ProjectKnowledgeTracePanel";

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
    expect(html).toContain("항목을 선택하면");
  });

  it("renders panel intro copy", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeTracePanel, {
        projectId: "p1",
        nodeId: "node-1",
        active: false,
      }),
    );
    expect(html).toContain("knowledge-trace-panel");
    expect(html).toContain("이 항목이 만들어진 과정입니다");
  });

  it("exposes Korean step type labels", () => {
    expect(KNOWLEDGE_TRACE_STEP_TYPE_LABELS.conversation).toBe("대화에서 시작됨");
    expect(KNOWLEDGE_TRACE_STEP_TYPE_LABELS["graph-node"]).toBe("현재 항목");
  });
});

describe("ProjectGraphNodeDetailPanel tabs", () => {
  it("renders Korean tab labels", async () => {
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
    expect(html).toContain("정보");
    expect(html).toContain("생성 근거");
    expect(html).toContain("생성 과정");
    expect(html).not.toContain(">Trace<");
  });
});
