import { describe, expect, it } from "vitest";
import {
  buildUserProjectKnowledgeAgentPromptContext,
  userProjectKnowledgeAgentSectionTitle,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptContext";
import type { UserProjectKnowledgeMemoryItem } from "@/lib/project-knowledge/projectKnowledgeUserMemoryTypes";

function item(
  agent: UserProjectKnowledgeMemoryItem["agent"],
  overrides: Partial<UserProjectKnowledgeMemoryItem> = {},
): UserProjectKnowledgeMemoryItem {
  return {
    id: "p1:n1:planner",
    sourceProjectId: "p1",
    sourceNodeId: "n1",
    nodeType: "Feature",
    title: "Title",
    summary: "Summary",
    lifecycle: "AUTO_CAPTURED",
    scope: "same_user",
    agent,
    relevance: 0.86,
    useAs: "mvp_scope",
    reason: "reason",
    promptSummary: "MVP hint text",
    ...overrides,
  };
}

describe("projectKnowledgeUserMemoryPromptContext", () => {
  it("uses planner section title", () => {
    expect(userProjectKnowledgeAgentSectionTitle("planner")).toBe(
      "[User Project Knowledge for Planner]",
    );
    const ctx = buildUserProjectKnowledgeAgentPromptContext({ agent: "planner", items: [] });
    expect(ctx.sectionTitle).toBe("[User Project Knowledge for Planner]");
  });

  it("uses distinct section titles per agent", () => {
    expect(userProjectKnowledgeAgentSectionTitle("developer")).toBe(
      "[User Project Knowledge for Developer]",
    );
    expect(userProjectKnowledgeAgentSectionTitle("reviewer")).toBe(
      "[User Project Knowledge for Reviewer]",
    );
    expect(userProjectKnowledgeAgentSectionTitle("security")).toBe(
      "[User Project Knowledge for Security]",
    );
  });

  it("returns no context message when items are empty", () => {
    const ctx = buildUserProjectKnowledgeAgentPromptContext({ agent: "analyst", items: [] });
    expect(ctx.markdown).toContain("No same-user prior project knowledge is available for this agent.");
    expect(ctx.itemCount).toBe(0);
  });

  it("does not expose internal ids in markdown", () => {
    const ctx = buildUserProjectKnowledgeAgentPromptContext({
      agent: "planner",
      items: [
        item("planner", {
          id: "secret-proj:secret-node:planner",
          sourceProjectId: "secret-proj",
          sourceNodeId: "secret-node",
          promptSummary: "Safe summary line",
        }),
      ],
    });
    expect(ctx.markdown).toContain("Safe summary line");
    expect(ctx.markdown).toContain("useAs: mvp_scope");
    expect(ctx.markdown).toContain("relevance: 0.86");
    expect(ctx.markdown).not.toContain("secret-proj");
    expect(ctx.markdown).not.toContain("secret-node");
  });

  it("applies maxItems in prompt context", () => {
    const items = [
      item("planner", { id: "p1:a:planner", promptSummary: "first", relevance: 0.9 }),
      item("planner", { id: "p1:b:planner", promptSummary: "second", relevance: 0.8 }),
    ];
    const ctx = buildUserProjectKnowledgeAgentPromptContext({
      agent: "planner",
      items,
      maxItems: 1,
    });
    expect(ctx.itemCount).toBe(1);
    expect(ctx.markdown).toContain("first");
    expect(ctx.markdown).not.toContain("second");
  });

  it("does not mix items from other agents", () => {
    const ctx = buildUserProjectKnowledgeAgentPromptContext({
      agent: "planner",
      items: [
        item("planner", { promptSummary: "planner only" }),
        item("developer", {
          id: "p1:n1:developer",
          agent: "developer",
          promptSummary: "developer text",
        }),
      ],
    });
    expect(ctx.markdown).toContain("planner only");
    expect(ctx.markdown).not.toContain("developer text");
    expect(ctx.itemCount).toBe(1);
  });
});
