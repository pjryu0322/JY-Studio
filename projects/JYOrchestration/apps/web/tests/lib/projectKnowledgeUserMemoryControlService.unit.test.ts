import { describe, expect, it } from "vitest";
import {
  applyAgentEnabledToMemoryContexts,
  applyUserProjectKnowledgeMemoryControlToPrepareInput,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlService";
import { buildUserProjectKnowledgeAgentPromptContext } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptContext";
import { DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";

describe("projectKnowledgeUserMemoryControlService", () => {
  it("enabled=false yields disabled prepare input", () => {
    const apply = applyUserProjectKnowledgeMemoryControlToPrepareInput({
      control: { ...DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1, enabled: false },
    });
    expect(apply.disabled).toBe(true);
    expect(apply.excludedSourceProjectIds).toEqual([]);
  });

  it("merges excludedSourceProjectIds from control", () => {
    const apply = applyUserProjectKnowledgeMemoryControlToPrepareInput({
      control: {
        ...DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1,
        excludedSourceProjectIds: ["p1"],
      },
      base: { excludedSourceProjectIds: ["p2"] },
    });
    expect(apply.disabled).toBe(false);
    expect(apply.excludedSourceProjectIds).toEqual(["p1", "p2"]);
  });

  it("merges ignored and pinned ids", () => {
    const apply = applyUserProjectKnowledgeMemoryControlToPrepareInput({
      control: {
        ...DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1,
        ignoredMemoryItemIds: ["i1"],
        pinnedMemoryItemIds: ["pin1"],
      },
      base: { ignoredMemoryItemIds: ["i2"], pinnedMemoryItemIds: ["pin2"] },
    });
    expect(apply.ignoredMemoryItemIds).toEqual(["i1", "i2"]);
    expect(apply.pinnedMemoryItemIds).toEqual(["pin1", "pin2"]);
  });

  it("agentEnabled developer=false clears developer context", () => {
    const developerCtx = buildUserProjectKnowledgeAgentPromptContext({
      agent: "developer",
      items: [
        {
          id: "m1",
          agent: "developer",
          title: "t",
          summary: "s",
          promptSummary: "s",
          useAs: "implementation_hint",
          relevance: 0.9,
          lifecycle: "AUTO_CAPTURED",
          scope: "same_user",
          reason: "r",
          nodeType: "note",
          sourceProjectId: "sp",
          sourceNodeId: "sn",
        },
      ],
    });
    const byAgent = applyAgentEnabledToMemoryContexts({
      control: {
        ...DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1,
        agentEnabled: { developer: false },
      },
      byAgent: {
        planner: buildUserProjectKnowledgeAgentPromptContext({ agent: "planner", items: [] }),
        analyst: buildUserProjectKnowledgeAgentPromptContext({ agent: "analyst", items: [] }),
        developer: developerCtx,
        reviewer: buildUserProjectKnowledgeAgentPromptContext({ agent: "reviewer", items: [] }),
        security: buildUserProjectKnowledgeAgentPromptContext({ agent: "security", items: [] }),
      },
    });
    expect(byAgent.developer.itemCount).toBe(0);
  });
});
