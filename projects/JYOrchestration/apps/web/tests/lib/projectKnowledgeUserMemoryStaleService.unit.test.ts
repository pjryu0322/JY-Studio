import { describe, expect, it } from "vitest";
import { buildUserProjectKnowledgeMemoryItemId } from "@/lib/project-knowledge/projectKnowledgeUserMemoryCollector";
import { buildUserProjectKnowledgeMemoryStalePreviewFromSources } from "@/lib/project-knowledge/projectKnowledgeUserMemoryStaleService";
import type { UserProjectKnowledgeMemoryPreviewV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPreviewService";
import { PROJECT_KNOWLEDGE_AGENTS } from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";

const rawItemId = buildUserProjectKnowledgeMemoryItemId("secret-project", "secret-node", "planner");

function emptyPreview(): UserProjectKnowledgeMemoryPreviewV1 {
  const byAgent = {} as UserProjectKnowledgeMemoryPreviewV1["byAgent"];
  for (const agent of PROJECT_KNOWLEDGE_AGENTS) {
    byAgent[agent] = { enabled: true, itemCount: 0, items: [], ignoredItems: [] };
  }
  return { enabled: true, sourceProjectCount: 1, totalItemCount: 1, byAgent };
}

function item(overrides: Partial<UserProjectKnowledgeMemoryPreviewV1["byAgent"]["planner"]["items"][0]> & {
  actionId: string;
}) {
  return {
    actionId: overrides.actionId,
    title: overrides.title ?? "Title",
    promptSummary: overrides.promptSummary ?? "Summary",
    useAs: "context",
    relevance: overrides.relevance ?? 0.8,
    lifecycle: "AUTO_CAPTURED" as const,
    pinned: overrides.pinned ?? false,
    ignored: overrides.ignored ?? false,
    agent: "planner" as const,
    nodeType: "Feature",
    sourceProjectTitle: "이전 프로젝트",
  };
}

describe("projectKnowledgeUserMemoryStaleService", () => {
  it("marks ignoredItems as stale candidates", () => {
    const preview = emptyPreview();
    preview.byAgent.planner.ignoredItems = [
      item({ actionId: "opaque-ignored", ignored: true, relevance: 0.9 }),
    ];
    const stale = buildUserProjectKnowledgeMemoryStalePreviewFromSources({ preview });
    expect(stale.candidateCount).toBe(1);
    expect(stale.candidates[0]?.reasons).toContain("ignored");
  });

  it("marks low relevance items as stale candidates", () => {
    const preview = emptyPreview();
    preview.byAgent.planner.items = [item({ actionId: "opaque-low", relevance: 0.2 })];
    const stale = buildUserProjectKnowledgeMemoryStalePreviewFromSources({ preview });
    expect(stale.candidates[0]?.reasons).toContain("low_relevance");
  });

  it("excludes pinned items from stale candidates", () => {
    const preview = emptyPreview();
    preview.byAgent.planner.items = [item({ actionId: "opaque-pinned", relevance: 0.1, pinned: true })];
    const stale = buildUserProjectKnowledgeMemoryStalePreviewFromSources({ preview });
    expect(stale.candidateCount).toBe(0);
  });

  it("uses opaque actionId not raw memory id", () => {
    const preview = emptyPreview();
    preview.byAgent.planner.items = [item({ actionId: "opaque-safe", relevance: 0.1 })];
    const stale = buildUserProjectKnowledgeMemoryStalePreviewFromSources({ preview });
    expect(JSON.stringify(stale)).not.toContain(rawItemId);
    expect(stale.candidates[0]?.actionId).toBe("opaque-safe");
  });
});
