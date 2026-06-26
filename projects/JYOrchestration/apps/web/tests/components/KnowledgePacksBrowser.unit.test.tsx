import { describe, expect, it, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/knowledge-packs",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/layout/WorkspaceModeContext", () => ({
  useWorkspaceModeOptional: () => undefined,
}));

vi.mock("@/components/ui/useMediaQuery", () => ({
  useMediaQuery: () => false,
}));

describe("KnowledgePacksBrowser", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          ok: true,
          packs: [
            {
              id: "ag-grid-community",
              name: "AG Grid Community",
              summary: "Grid library",
              category: "GRID",
              agents: ["AI_DEVELOPER"],
              license: { type: "MIT" },
              status: "ACTIVE",
              source: "SEED",
            },
          ],
        }),
      }),
    );
  });

  it("renders filters and project-modal variant without page chrome", async () => {
    const { KnowledgePacksBrowser } = await import("@/components/knowledge-packs/KnowledgePacksBrowser");
    const html = renderToStaticMarkup(
      createElement(KnowledgePacksBrowser, { variant: "project-modal", projectId: "proj-1" }),
    );
    expect(html).toContain('data-knowledge-packs-variant="project-modal"');
    expect(html).toContain("knowledge-packs-agent-filter");
    expect(html).toContain("knowledge-packs-category-filter");
    expect(html).not.toContain("← 프로젝트 목록");
  });

  it("page variant includes footer hint", async () => {
    const { KnowledgePacksBrowser } = await import("@/components/knowledge-packs/KnowledgePacksBrowser");
    const html = renderToStaticMarkup(createElement(KnowledgePacksBrowser, { variant: "page" }));
    expect(html).toContain("/knowledge-packs/detail");
  });
});
