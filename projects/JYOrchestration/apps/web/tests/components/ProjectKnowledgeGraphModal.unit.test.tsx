import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/project-graph/ProjectKnowledgeGraphModalShell", () => ({
  ProjectKnowledgeGraphModalShell: (p: { preservePlatformRail?: boolean; children?: unknown }) =>
    createElement("div", {
      "data-testid": "mock-knowledge-graph-modal-shell",
      "data-preserve-platform-rail": p.preservePlatformRail ? "true" : "false",
      children: p.children,
    }),
}));

vi.mock("@/components/project-graph/ProjectKnowledgeGraphWorkspace", () => ({
  ProjectKnowledgeGraphWorkspace: () => createElement("div", { "data-testid": "mock-workspace" }),
}));

import { ProjectKnowledgeGraphModal } from "@/components/project-graph/ProjectKnowledgeGraphModal";

describe("ProjectKnowledgeGraphModal", () => {
  it("forwards preservePlatformRail to shell when set", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeGraphModal, {
        open: true,
        projectId: "proj-1",
        preservePlatformRail: true,
        onClose: () => {},
      }),
    );
    expect(html).toContain('data-preserve-platform-rail="true"');
  });

  it("defaults preservePlatformRail to false for non-rail entry points", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgeGraphModal, {
        open: true,
        projectId: "proj-1",
        onClose: () => {},
      }),
    );
    expect(html).toContain('data-preserve-platform-rail="false"');
  });
});
