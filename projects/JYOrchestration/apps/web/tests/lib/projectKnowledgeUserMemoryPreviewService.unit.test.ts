import { describe, expect, it } from "vitest";
import type { ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";
import { buildUserProjectKnowledgeMemoryItemId } from "@/lib/project-knowledge/projectKnowledgeUserMemoryCollector";
import { buildUserProjectKnowledgeMemoryPreviewFromSources } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPreviewService";
import type { UserProjectKnowledgeMemorySourceProject } from "@/lib/project-knowledge/projectKnowledgeUserMemoryTypes";
import { DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";

const USER = "user-a";
const TARGET = "p-current";

function node(id: string, agentRelevance?: ProjectGraphNodeDto["agentRelevance"]): ProjectGraphNodeDto {
  return {
    id,
    nodeType: "Feature",
    title: `Title ${id}`,
    summary: `Summary ${id}`,
    ...(agentRelevance ? { agentRelevance } : {}),
  };
}

function source(projectId: string, nodes: readonly ProjectGraphNodeDto[]): UserProjectKnowledgeMemorySourceProject {
  return { projectId, projectTitle: `Project ${projectId}`, ownerUserId: USER, nodes };
}

const plannerUse = {
  relevance: 0.86,
  useAs: "mvp_scope" as const,
  reason: "MVP",
  promptSummary: "planner summary text",
};

const developerUse = {
  relevance: 0.9,
  useAs: "implementation_hint" as const,
  reason: "dev",
  promptSummary: "developer summary text",
};

describe("projectKnowledgeUserMemoryPreviewService", () => {
  it("does not expose raw ids in preview items", () => {
    const n = node("n1", { planner: plannerUse, developer: developerUse });
    const preview = buildUserProjectKnowledgeMemoryPreviewFromSources({
      userId: USER,
      targetProjectId: TARGET,
      sourceProjects: [source("p-old", [n])],
    });
    const rawItemId = buildUserProjectKnowledgeMemoryItemId("p-old", "n1", "planner");
    const json = JSON.stringify(preview);
    expect(json).not.toContain("p-old");
    expect(json).not.toContain(rawItemId);
    expect(json).not.toContain("sourceNodeId");
    expect(json).not.toContain("sourceProjectId");

    const item = preview.byAgent.planner.items[0];
    expect(item?.actionId).toMatch(/^mem_/);
    expect(item?.actionId).not.toBe(rawItemId);
    expect(item?.sourceProjectActionId).toMatch(/^src_/);
    expect(item?.sourceProjectActionId).not.toBe("p-old");
  });

  it("puts ignored items in ignoredItems and excludes from totalItemCount", () => {
    const n = node("n1", { planner: plannerUse });
    const rawItemId = buildUserProjectKnowledgeMemoryItemId("p-old", "n1", "planner");
    const preview = buildUserProjectKnowledgeMemoryPreviewFromSources({
      userId: USER,
      targetProjectId: TARGET,
      sourceProjects: [source("p-old", [n])],
      control: {
        ...DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1,
        ignoredMemoryItemIds: [rawItemId],
      },
    });
    expect(preview.byAgent.planner.items).toHaveLength(0);
    expect(preview.byAgent.planner.ignoredItems).toHaveLength(1);
    expect(preview.totalItemCount).toBe(0);
  });

  it("agentEnabled developer=false yields developer itemCount=0", () => {
    const n = node("n1", { developer: developerUse });
    const preview = buildUserProjectKnowledgeMemoryPreviewFromSources({
      userId: USER,
      targetProjectId: TARGET,
      sourceProjects: [source("p-old", [n])],
      control: {
        ...DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1,
        agentEnabled: { developer: false },
      },
    });
    expect(preview.byAgent.developer.itemCount).toBe(0);
    expect(preview.byAgent.developer.items).toHaveLength(0);
    expect(preview.totalItemCount).toBe(0);
  });

  it("totalItemCount matches sum of agent itemCount", () => {
    const n = node("n1", { planner: plannerUse, developer: developerUse });
    const preview = buildUserProjectKnowledgeMemoryPreviewFromSources({
      userId: USER,
      targetProjectId: TARGET,
      sourceProjects: [source("p-old", [n])],
    });
    const sum = preview.byAgent.planner.itemCount + preview.byAgent.developer.itemCount;
    expect(preview.totalItemCount).toBe(sum);
  });

  it("sourceProjectCount excludes excluded sources", () => {
    const n = node("n1", { planner: plannerUse });
    const preview = buildUserProjectKnowledgeMemoryPreviewFromSources({
      userId: USER,
      targetProjectId: TARGET,
      sourceProjects: [source("p-skip", [n]), source("p-keep", [n])],
      control: {
        ...DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1,
        excludedSourceProjectIds: ["p-skip"],
      },
    });
    expect(preview.sourceProjectCount).toBe(1);
    expect(JSON.stringify(preview)).not.toContain("p-skip");
  });
});
