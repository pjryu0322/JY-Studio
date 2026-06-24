import { describe, expect, it, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/project-graph/ProjectKnowledgeGraphModalShell", () => ({
  ProjectKnowledgeGraphModalShell: (p: { children: unknown; open: boolean; title?: string }) =>
    p.open
      ? createElement("div", { "data-testid": "replay-shell", "data-title": p.title }, p.children)
      : null,
}));

vi.mock("@/components/project-graph/useGraphMobileUx", () => ({
  useGraphMobileUx: () => false,
}));

vi.mock("@/components/project-graph/ProjectKnowledgeReplayTimeline", () => ({
  ProjectKnowledgeReplayTimeline: () => createElement("div", { "data-testid": "mock-timeline" }),
}));

vi.mock("@/components/project-graph/ProjectKnowledgeReplayViewer", () => ({
  ProjectKnowledgeReplayViewer: () => createElement("div", { "data-testid": "mock-viewer" }),
}));

vi.mock("@/lib/project-knowledge/projectKnowledgeGraphRevisionClient", () => ({
  fetchKnowledgeGraphRevisions: vi.fn().mockResolvedValue([]),
  fetchKnowledgeGraphRevision: vi.fn(),
}));

import { ProjectKnowledgeReplayModal } from "@/components/project-graph/ProjectKnowledgeReplayModal";

describe("ProjectKnowledgeReplayModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders closed without shell", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeReplayModal, {
        open: false,
        projectId: "p1",
        onClose: () => {},
      }),
    );
    expect(html).not.toContain("replay-shell");
  });

  it("renders intro and empty state on first paint", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeReplayModal, {
        open: true,
        projectId: "p1",
        onClose: () => {},
      }),
    );
    expect(html).toContain("knowledge-replay-modal");
    expect(html).toContain("data-title=\"프로젝트 변화 이력\"");
    expect(html).toContain("knowledge-replay-intro");
    expect(html).toContain("knowledge-replay-empty-state");
    expect(html).toContain("아직 변화 이력이 없습니다.");
    expect(html).not.toContain("knowledge-replay-prev");
    expect(html).not.toContain("revisionId");
  });
});
