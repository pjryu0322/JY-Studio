import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
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
  ProjectKnowledgeReplayTimeline: () => createElement("div", null),
}));

vi.mock("@/components/project-graph/ProjectKnowledgeReplayViewer", () => ({
  ProjectKnowledgeReplayViewer: () => createElement("div", null),
}));

vi.mock("@/lib/project-knowledge/projectKnowledgeGraphRevisionClient", () => ({
  fetchKnowledgeGraphRevisions: vi.fn().mockResolvedValue([]),
  fetchKnowledgeGraphRevision: vi.fn(),
}));

import { ProjectKnowledgeReplayModal } from "@/components/project-graph/ProjectKnowledgeReplayModal";

const modalSourcePath = path.resolve(
  __dirname,
  "../../src/components/project-graph/ProjectKnowledgeReplayModal.tsx",
);

describe("ProjectKnowledgeReplayModal mobile", () => {
  it("keeps mobile change history sheet copy and aria labels in component source", () => {
    const src = readFileSync(modalSourcePath, "utf8");
    expect(src).toContain("변화 이력 닫기");
    expect(src).toContain("변화 이력 보기");
    expect(src).toContain('aria-label={timelineSheetOpen ? "변화 이력 닫기" : "변화 이력 보기"}');
    expect(src).not.toContain("타임라인 보기");
  });

  it("renders mobile layout shell when open", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeReplayModal, {
        open: true,
        projectId: "p1",
        onClose: () => {},
      }),
    );
    expect(html).toContain("knowledge-replay-modal");
  });
});
