import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { UserProjectKnowledgeMemoryPreviewList } from "@/components/project-knowledge/UserProjectKnowledgeMemoryPreviewList";

describe("UserProjectKnowledgeMemoryPreviewList", () => {
  it("uses opaque action ids in test ids only", () => {
    const html = renderToStaticMarkup(
      createElement(UserProjectKnowledgeMemoryPreviewList, {
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
                  actionId: "mem_test123",
                  sourceProjectActionId: "src_test123",
                  title: "T",
                  promptSummary: "P",
                  useAs: "context",
                  relevance: 0.7,
                  lifecycle: "AUTO_CAPTURED",
                  pinned: false,
                  ignored: false,
                  agent: "planner",
                  nodeType: "Feature",
                  sourceProjectTitle: "Prev",
                },
              ],
            },
            analyst: { enabled: true, itemCount: 0, items: [] },
            developer: { enabled: true, itemCount: 0, items: [] },
            reviewer: { enabled: true, itemCount: 0, items: [] },
            security: { enabled: true, itemCount: 0, items: [] },
          },
        },
        onPin: vi.fn(),
        onIgnore: vi.fn(),
        onExcludeSourceProject: vi.fn(),
      }),
    );
    expect(html).toContain('data-testid="user-memory-preview-item-planner-0"');
    expect(html).not.toContain("p1:n1:planner");
  });
});
