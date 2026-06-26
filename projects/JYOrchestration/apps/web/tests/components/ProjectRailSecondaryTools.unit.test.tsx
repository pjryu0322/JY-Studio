import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  usePathname: () => "/requirements",
  useSearchParams: () => ({
    get: () => null,
  }),
}));

vi.mock("@/components/worknote/WorkNoteButton", () => ({
  ProjectWorkNoteButton: () => createElement("div", { "data-testid": "mock-worknote" }),
}));

vi.mock("@/components/layout/ProjectRailCountBadge", () => ({
  ProjectRailCountBadge: () => null,
}));

vi.mock("@/components/layout/platformTopNav/ProjectRailRecommendationButton", () => ({
  ProjectRailRecommendationButton: () => null,
}));

vi.mock("@/lib/debug/promptTimelineClientFlag", () => ({
  isPromptTimelineDebugClient: () => false,
}));

vi.mock("@/components/project-graph/ProjectKnowledgeGraphModal", () => ({
  ProjectKnowledgeGraphModal: (p: { preservePlatformRail?: boolean; open?: boolean }) =>
    createElement("div", {
      "data-testid": "mock-knowledge-graph-modal",
      "data-open": p.open ? "true" : "false",
      "data-preserve-platform-rail": p.preservePlatformRail ? "true" : "false",
    }),
}));

vi.mock("@/components/knowledge-packs/ProjectKnowledgePacksModal", () => ({
  ProjectKnowledgePacksModal: (p: { preservePlatformRail?: boolean; open?: boolean; projectId?: string }) =>
    createElement("div", {
      "data-testid": "mock-knowledge-packs-modal",
      "data-open": p.open ? "true" : "false",
      "data-preserve-platform-rail": p.preservePlatformRail ? "true" : "false",
      "data-project-id": p.projectId,
    }),
}));

import { ProjectRailSecondaryTools } from "@/components/layout/platformTopNav/ProjectRailSecondaryTools";

describe("ProjectRailSecondaryTools", () => {
  it("passes preservePlatformRail to knowledge graph modal", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectRailSecondaryTools, {
        effectiveProjectId: "proj-1",
        compactToolbar: false,
        meReady: true,
        me: { userId: "u1", displayName: "Test", email: "t@example.com", avatarUrl: null },
        projectMembersCount: 1,
        projectWorkNotesCount: 0,
      }),
    );
    expect(html).toContain("platform-knowledge-graph-rail-project");
    expect(html).toContain('data-preserve-platform-rail="true"');
  });

  it("uses button for knowledge packs rail item without /knowledge-packs href", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectRailSecondaryTools, {
        effectiveProjectId: "proj-1",
        compactToolbar: false,
        meReady: false,
        me: null,
        projectMembersCount: 0,
        projectWorkNotesCount: 0,
      }),
    );
    expect(html).toContain('data-testid="platform-knowledge-packs-rail-project"');
    expect(html).toMatch(/<button[^>]*data-testid="platform-knowledge-packs-rail-project"/);
    expect(html).not.toMatch(/href="\/knowledge-packs"[^>]*data-testid="platform-knowledge-packs-rail-project"/);
    expect(html).not.toContain('href="/knowledge-packs"');
    expect(html).toContain("mock-knowledge-packs-modal");
    expect(html).toContain('data-project-id="proj-1"');
  });
});
