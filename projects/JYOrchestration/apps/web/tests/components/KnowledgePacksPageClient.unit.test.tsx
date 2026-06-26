import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/knowledge-packs",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/ui/useMediaQuery", () => ({
  useMediaQuery: () => false,
}));

vi.mock("@/components/knowledge-packs/KnowledgePacksPageManagementSection", () => ({
  KnowledgePacksPageManagementSection: () => createElement("div", { "data-testid": "mock-kp-management" }),
}));

vi.mock("@/components/knowledge-packs/KnowledgePacksBrowser", () => ({
  KnowledgePacksBrowser: (p: { variant?: string }) =>
    createElement("div", { "data-testid": "mock-kp-browser", "data-variant": p.variant }),
}));

import { KnowledgePacksPageClient } from "@/components/knowledge-packs/KnowledgePacksPageClient";

describe("KnowledgePacksPageClient", () => {
  it("keeps global page shell and management section", () => {
    const html = renderToStaticMarkup(createElement(KnowledgePacksPageClient));
    expect(html).toContain("지식팩");
    expect(html).toContain("← 프로젝트 목록");
    expect(html).toContain("mock-kp-management");
    expect(html).toContain('data-variant="page"');
  });
});
