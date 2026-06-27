import { createElement } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { UserProjectKnowledgeMemoryControlPanel } from "@/components/project-knowledge/UserProjectKnowledgeMemoryControlPanel";
import { buildUserProjectKnowledgeMemoryItemId } from "@/lib/project-knowledge/projectKnowledgeUserMemoryCollector";

const rawItemId = buildUserProjectKnowledgeMemoryItemId("secret-project", "secret-node", "planner");

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
    sourceProjectCount: 1,
    totalItemCount: 1,
    byAgent: {
      planner: {
        enabled: true,
        itemCount: 1,
        items: [
          {
            actionId: "mem_opaque_token_001",
            sourceProjectActionId: "src_opaque_token_001",
            title: "Sample title",
            promptSummary: "Sample summary",
            useAs: "mvp_scope",
            relevance: 0.8,
            lifecycle: "AUTO_CAPTURED" as const,
            pinned: false,
            ignored: false,
            agent: "planner" as const,
            nodeType: "Feature",
            sourceProjectTitle: "이전 프로젝트",
          },
        ],
        ignoredItems: [
          {
            actionId: "mem_opaque_ignored",
            title: "Ignored title",
            promptSummary: "Ignored summary",
            useAs: "context",
            relevance: 0.5,
            lifecycle: "IGNORED" as const,
            pinned: false,
            ignored: true,
            agent: "planner" as const,
            nodeType: "Feature",
            sourceProjectTitle: "이전 프로젝트",
          },
        ],
      },
      analyst: { enabled: true, itemCount: 0, items: [] },
      developer: { enabled: true, itemCount: 0, items: [] },
      reviewer: { enabled: true, itemCount: 0, items: [] },
      security: { enabled: true, itemCount: 0, items: [] },
    },
  },
  usageSummary: {
    totalEvents: 3,
    injectedEvents: 2,
    skippedEvents: 1,
    byAgent: {
      planner: { injectedCount: 1, lastItemCount: 1, lastUsedAt: "2026-06-03T00:00:00.000Z" },
      analyst: { injectedCount: 0, lastItemCount: 0 },
      developer: {
        injectedCount: 1,
        lastItemCount: 3,
        lastUsedAt: "2026-06-03T01:00:00.000Z",
      },
      reviewer: { injectedCount: 0, lastItemCount: 0 },
      security: { injectedCount: 0, lastItemCount: 0 },
    },
    recentEvents: [],
  },
  usageError: null as string | null,
  loading: false,
  saving: false,
  error: null as string | null,
  reload: vi.fn(),
  reloadUsage: vi.fn(),
  reloadStalePreview: vi.fn(),
  stalePreview: {
    version: "user_project_knowledge_memory_stale_state_v1" as const,
    candidateCount: 0,
    candidates: [],
  },
  setEnabled: vi.fn(),
  setAgentEnabled: vi.fn(),
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
    expect(html).toContain('data-testid="user-memory-agent-summary"');
    expect(html).toContain('data-testid="user-memory-agent-toggles"');
    expect(html).toContain("기획자");
  });

  it("shows disabled message when memory off", () => {
    hookState.control.enabled = false;
    const html = renderToStaticMarkup(
      createElement(UserProjectKnowledgeMemoryControlPanel, { projectId: "p1" }),
    );
    expect(html).toContain('data-testid="user-memory-control-disabled-msg"');
    expect(html).not.toContain('data-testid="user-memory-agent-toggles"');
  });

  it("does not expose raw memory item id in HTML", () => {
    const html = renderToStaticMarkup(
      createElement(UserProjectKnowledgeMemoryControlPanel, { projectId: "p1" }),
    );
    expect(html).not.toContain(rawItemId);
    expect(html).not.toContain("secret-project");
    expect(html).not.toContain("secret-node");
  });

  it("shows usage summary when available", () => {
    const html = renderToStaticMarkup(
      createElement(UserProjectKnowledgeMemoryControlPanel, { projectId: "p1" }),
    );
    expect(html).toContain('data-testid="user-memory-usage-summary"');
    expect(html).toContain("2회 참조");
    expect(html).toContain("개발자 최근 3개");
  });

  it("renders control preview and usage from integrated hook state", () => {
    expect(hookState.preview?.totalItemCount).toBe(1);
    expect(hookState.usageSummary?.injectedEvents).toBe(2);
    const html = renderToStaticMarkup(
      createElement(UserProjectKnowledgeMemoryControlPanel, { projectId: "p1" }),
    );
    expect(html).toContain('data-testid="user-memory-control-panel"');
    expect(html).toContain('data-testid="user-memory-usage-summary"');
  });

  it("shows ignored section and unignore control", () => {
    const html = renderToStaticMarkup(
      createElement(UserProjectKnowledgeMemoryControlPanel, { projectId: "p1" }),
    );
    expect(html).toContain('data-testid="user-memory-ignored-section-planner"');
    expect(html).toContain('data-testid="user-memory-unignore-ignored-planner-0"');
    expect(html).toContain("무시한 항목");
  });
});
