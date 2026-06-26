import { describe, expect, it } from "vitest";
import {
  appendUserProjectKnowledgeMemorySection,
  composeProjectTurnContextBlocks,
  orchestrationPromptContextForAgent,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptInjection";
import { buildUserProjectKnowledgeAgentPromptContext } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptContext";
import type { UserProjectKnowledgeMemoryItem } from "@/lib/project-knowledge/projectKnowledgeUserMemoryTypes";

const referenceBlock = "[reference_context]\nActor summary from selected snapshot.";

function plannerContextWithItems(): ReturnType<typeof buildUserProjectKnowledgeAgentPromptContext> {
  const item: UserProjectKnowledgeMemoryItem = {
    id: "p1:n1:planner",
    sourceProjectId: "p1",
    sourceNodeId: "n1",
    nodeType: "Feature",
    title: "Title",
    summary: "Summary",
    lifecycle: "AUTO_CAPTURED",
    scope: "same_user",
    agent: "planner",
    relevance: 0.86,
    useAs: "mvp_scope",
    reason: "MVP",
    promptSummary: "MVP hint for planner",
  };
  return buildUserProjectKnowledgeAgentPromptContext({ agent: "planner", items: [item] });
}

describe("projectKnowledgeUserMemoryPromptInjection", () => {
  it("appends memory section when itemCount > 0", () => {
    const ctx = plannerContextWithItems();
    const out = appendUserProjectKnowledgeMemorySection({ basePrompt: "base", context: ctx });
    expect(out).toContain("base");
    expect(out).toContain("[User Project Knowledge for Planner]");
    expect(out).toContain("MVP hint for planner");
  });

  it("skips append when itemCount is 0 by default", () => {
    const ctx = buildUserProjectKnowledgeAgentPromptContext({ agent: "planner", items: [] });
    const out = appendUserProjectKnowledgeMemorySection({ basePrompt: "base", context: ctx });
    expect(out).toBe("base");
  });

  it("appends empty context when includeEmptyContext is true", () => {
    const ctx = buildUserProjectKnowledgeAgentPromptContext({ agent: "planner", items: [] });
    const out = appendUserProjectKnowledgeMemorySection({
      basePrompt: "base",
      context: ctx,
      includeEmptyContext: true,
    });
    expect(out).toContain("No same-user prior project knowledge");
  });

  it("does not duplicate memory section", () => {
    const ctx = plannerContextWithItems();
    const once = appendUserProjectKnowledgeMemorySection({ basePrompt: "base", context: ctx });
    const twice = appendUserProjectKnowledgeMemorySection({ basePrompt: once, context: ctx });
    expect(twice).toBe(once);
  });

  it("preserves reference_context block when composing turn context", () => {
    const ctx = plannerContextWithItems();
    const out = composeProjectTurnContextBlocks({
      referencePromptContextBlock: referenceBlock,
      userMemoryContext: ctx,
    });
    expect(out).toContain("[reference_context]");
    expect(out).toContain("[User Project Knowledge for Planner]");
    expect(out.indexOf("[reference_context]")).toBeLessThan(out.indexOf("[User Project Knowledge for Planner]"));
  });

  it("keeps markdown free of internal ids", () => {
    const ctx = plannerContextWithItems();
    const out = composeProjectTurnContextBlocks({ userMemoryContext: ctx });
    expect(out).not.toContain("p1:n1:planner");
    expect(out).not.toContain("sourceProjectId");
  });

  it("injects planner-only memory into planner orchestration block", () => {
    const plannerCtx = plannerContextWithItems();
    const developerCtx = buildUserProjectKnowledgeAgentPromptContext({
      agent: "developer",
      items: [
        {
          id: "p2:n2:developer",
          sourceProjectId: "p2",
          sourceNodeId: "n2",
          nodeType: "Feature",
          title: "Dev",
          summary: "Dev",
          lifecycle: "AUTO_CAPTURED",
          scope: "same_user",
          agent: "developer",
          relevance: 0.9,
          useAs: "implementation_hint",
          reason: "dev",
          promptSummary: "developer only hint",
        },
      ],
    });
    const plannerBlock = orchestrationPromptContextForAgent({
      referencePromptContextBlock: referenceBlock,
      userProjectKnowledgeMemoryByAgent: { planner: plannerCtx, developer: developerCtx },
      agent: "planner",
    });
    expect(plannerBlock).toContain("[User Project Knowledge for Planner]");
    expect(plannerBlock).not.toContain("[User Project Knowledge for Developer]");
    expect(plannerBlock).not.toContain("developer only hint");
  });
});
