import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectKnowledgePacksModal } from "@/components/knowledge-packs/ProjectKnowledgePacksModal";

vi.mock("@/components/project-graph/ProjectKnowledgeGraphModalShell", () => ({
  ProjectKnowledgeGraphModalShell: (p: {
    open: boolean;
    title: string;
    onClose: () => void;
    onOpenNewWindow?: () => void;
    children: unknown;
  }) =>
    p.open
      ? createElement(
          "div",
          { "data-testid": "mock-knowledge-packs-modal-shell", "data-title": p.title },
          createElement(
            "button",
            { type: "button", "data-testid": "mock-modal-close", onClick: p.onClose },
            "닫기",
          ),
          createElement(
            "button",
            { type: "button", "data-testid": "mock-modal-new-window", onClick: p.onOpenNewWindow },
            "새창으로 열기",
          ),
          p.children,
        )
      : null,
}));

vi.mock("@/components/knowledge-packs/KnowledgePacksBrowser", () => ({
  KnowledgePacksBrowser: () => createElement("div", { "data-testid": "mock-knowledge-packs-browser" }),
}));

describe("ProjectKnowledgePacksModal", () => {
  it("renders nothing when closed", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgePacksModal, {
        open: false,
        projectId: "p1",
        onClose: vi.fn(),
      }),
    );
    expect(html).toBe("");
  });

  it("shows title and browser when open", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectKnowledgePacksModal, {
        open: true,
        projectId: "p1",
        preservePlatformRail: true,
        onClose: vi.fn(),
      }),
    );
    expect(html).toContain("mock-knowledge-packs-modal-shell");
    expect(html).toContain('data-title="프로젝트 지식팩"');
    expect(html).toContain("현재 프로젝트의 AI Agent가 참조할 지식팩을 확인합니다.");
    expect(html).toContain("mock-knowledge-packs-browser");
    expect(html).toContain("project-knowledge-packs-open-global");
  });
});
