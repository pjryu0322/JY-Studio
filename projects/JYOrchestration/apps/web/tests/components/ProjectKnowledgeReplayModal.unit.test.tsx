import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/project-graph/ProjectKnowledgeGraphModalShell", () => ({
  ProjectKnowledgeGraphModalShell: (p: { children: unknown; open: boolean }) =>
    p.open ? createElement("div", { "data-testid": "replay-shell" }, p.children) : null,
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

const fetchList = vi.fn();
const fetchOne = vi.fn();

vi.mock("@/lib/project-knowledge/projectKnowledgeGraphRevisionClient", () => ({
  fetchKnowledgeGraphRevisions: (...args: unknown[]) => fetchList(...args),
  fetchKnowledgeGraphRevision: (...args: unknown[]) => fetchOne(...args),
}));

import { ProjectKnowledgeReplayModal } from "@/components/project-graph/ProjectKnowledgeReplayModal";

describe("ProjectKnowledgeReplayModal", () => {
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

  it("renders open modal with slider", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeReplayModal, {
        open: true,
        projectId: "p1",
        onClose: () => {},
      }),
    );
    expect(html).toContain("knowledge-replay-modal");
    expect(html).toContain("knowledge-replay-slider");
    expect(html).toContain("시점 이동");
  });
});
