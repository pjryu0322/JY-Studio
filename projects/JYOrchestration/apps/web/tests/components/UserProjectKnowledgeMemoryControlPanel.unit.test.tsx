import { createElement } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { UserProjectKnowledgeMemoryControlPanel } from "@/components/project-knowledge/UserProjectKnowledgeMemoryControlPanel";

const hookState = {
  control: {
    version: "user_project_knowledge_memory_control_v1" as const,
    enabled: true,
    excludedSourceProjectIds: [] as string[],
    ignoredMemoryItemIds: [] as string[],
    pinnedMemoryItemIds: [] as string[],
  },
  preview: {
    enabled: true,
    sourceProjectCount: 0,
    totalItemCount: 0,
    byAgent: {
      planner: { enabled: true, itemCount: 0, items: [] },
      analyst: { enabled: true, itemCount: 0, items: [] },
      developer: { enabled: true, itemCount: 0, items: [] },
      reviewer: { enabled: true, itemCount: 0, items: [] },
      security: { enabled: true, itemCount: 0, items: [] },
    },
  },
  loading: false,
  saving: false,
  error: null as string | null,
  reload: vi.fn(),
  setEnabled: vi.fn(),
  togglePin: vi.fn(),
  toggleIgnore: vi.fn(),
  excludeSourceProject: vi.fn(),
};

vi.mock("@/components/project-knowledge/hooks/useUserProjectKnowledgeMemoryControl", () => ({
  useUserProjectKnowledgeMemoryControl: () => hookState,
}));

describe("UserProjectKnowledgeMemoryControlPanel", () => {
  beforeEach(() => {
    hookState.control.enabled = true;
    hookState.loading = false;
    hookState.error = null;
  });

  it("renders toggle and agent summary when enabled", () => {
    const html = renderToStaticMarkup(
      createElement(UserProjectKnowledgeMemoryControlPanel, { projectId: "p1" }),
    );
    expect(html).toContain('data-testid="user-memory-control-panel"');
    expect(html).toContain('data-testid="user-memory-control-enabled"');
    expect(html).toContain('data-testid="user-memory-agent-summary"');
  });

  it("shows disabled message when memory off", () => {
    hookState.control.enabled = false;
    const html = renderToStaticMarkup(
      createElement(UserProjectKnowledgeMemoryControlPanel, { projectId: "p1" }),
    );
    expect(html).toContain('data-testid="user-memory-control-disabled-msg"');
  });
});
