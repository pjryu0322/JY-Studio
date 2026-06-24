import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/project-graph/useGraphMobileUx", () => ({
  useGraphMobileUx: () => true,
}));

vi.mock("@/components/project-graph/ProjectKnowledgeGraphModalShell", () => ({
  ProjectKnowledgeGraphModalShell: (p: { children: unknown; open: boolean }) =>
    p.open ? createElement("div", null, p.children) : null,
}));

vi.mock("@/components/project-graph/ProjectKnowledgeReplayTimeline", () => ({
  ProjectKnowledgeReplayTimeline: () => createElement("div", { "data-testid": "mock-timeline" }),
}));

vi.mock("@/components/project-graph/ProjectKnowledgeReplayViewer", () => ({
  ProjectKnowledgeReplayViewer: () => createElement("div", null),
}));

vi.mock("@/lib/project-knowledge/projectKnowledgeGraphRevisionClient", () => ({
  fetchKnowledgeGraphRevisions: vi.fn().mockResolvedValue([]),
  fetchKnowledgeGraphRevision: vi.fn(),
}));

import { ProjectKnowledgeReplayModal } from "@/components/project-graph/ProjectKnowledgeReplayModal";

describe("ProjectKnowledgeReplayModal mobile", () => {
  it("shows mobile change history sheet labels", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeReplayModal, {
        open: true,
        projectId: "p1",
        onClose: () => {},
      }),
    );
    expect(html).toContain("변화 이력 닫기");
    expect(html).not.toContain("타임라인 보기");
  });
});
