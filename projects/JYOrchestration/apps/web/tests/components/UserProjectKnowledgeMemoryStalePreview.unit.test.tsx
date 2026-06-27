import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { UserProjectKnowledgeMemoryStalePreview } from "@/components/project-knowledge/UserProjectKnowledgeMemoryStalePreview";
import { buildUserProjectKnowledgeMemoryItemId } from "@/lib/project-knowledge/projectKnowledgeUserMemoryCollector";

const rawItemId = buildUserProjectKnowledgeMemoryItemId("secret-project", "secret-node", "planner");

describe("UserProjectKnowledgeMemoryStalePreview", () => {
  it("renders stale candidates and reuses pin/ignore callbacks", () => {
    const onPin = vi.fn();
    const onIgnore = vi.fn();
    const html = renderToStaticMarkup(
      createElement(UserProjectKnowledgeMemoryStalePreview, {
        stalePreview: {
          version: "user_project_knowledge_memory_stale_state_v1",
          candidateCount: 1,
          candidates: [
            {
              actionId: "opaque-stale",
              agent: "planner",
              title: "Candidate title",
              promptSummary: "Candidate summary",
              reasons: ["ignored", "low_relevance"],
              relevance: 0.2,
              ignored: true,
              pinned: false,
            },
          ],
        },
        onPin,
        onIgnore,
      }),
    );
    expect(html).toContain('data-testid="user-memory-stale-preview"');
    expect(html).toContain("정리 후보");
    expect(html).toContain("무시된 항목 1개");
    expect(html).toContain('data-testid="user-memory-stale-unignore-stale-planner-0"');
    expect(html).toContain('data-testid="user-memory-stale-pin-stale-planner-0"');
    expect(html).not.toContain(rawItemId);
    expect(html).not.toContain("secret-project");
  });
});
