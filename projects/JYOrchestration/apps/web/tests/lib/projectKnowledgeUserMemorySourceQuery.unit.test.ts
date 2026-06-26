import { describe, expect, it } from "vitest";
import type { ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";
import {
  mapGraphDbNodeToProjectGraphNodeDto,
  mapOwnedProjectRowsToMemorySources,
  projectGraphHasPromptRelevantAgentKnowledge,
} from "@/lib/project-knowledge/projectKnowledgeUserMemorySourceQuery";

describe("projectKnowledgeUserMemorySourceQuery mappers", () => {
  it("maps graph db node metadata to agentRelevance on dto", () => {
    const dto = mapGraphDbNodeToProjectGraphNodeDto({
      id: "n1",
      nodeType: "Feature",
      title: "Title",
      summary: "Summary",
      metadata: {
        agentRelevance: {
          planner: {
            relevance: 0.8,
            useAs: "mvp_scope",
            reason: "MVP",
            promptSummary: "MVP hint",
          },
        },
      },
    });
    expect(dto.agentRelevance?.planner?.promptSummary).toBe("MVP hint");
  });

  it("includes only same-user owned projects and excludes target", () => {
    const node: ProjectGraphNodeDto = {
      id: "n1",
      nodeType: "Feature",
      title: "T",
      summary: null,
      agentRelevance: {
        planner: {
          relevance: 0.8,
          useAs: "context",
          reason: "r",
          promptSummary: "hint",
        },
      },
    };
    const sources = mapOwnedProjectRowsToMemorySources({
      userId: "u1",
      targetProjectId: "current",
      projects: [
        {
          id: "current",
          name: "Current",
          ownerUserId: "u1",
          updatedAt: new Date("2026-06-01T00:00:00.000Z"),
        },
        {
          id: "past",
          name: "Past",
          ownerUserId: "u1",
          updatedAt: new Date("2026-06-02T00:00:00.000Z"),
        },
        {
          id: "other-user",
          name: "Other",
          ownerUserId: "u2",
          updatedAt: new Date("2026-06-03T00:00:00.000Z"),
        },
      ],
      nodesByProjectId: {
        current: [node],
        past: [node],
        "other-user": [node],
      },
    });
    expect(sources.map((s) => s.projectId)).toEqual(["past"]);
    expect(projectGraphHasPromptRelevantAgentKnowledge([node])).toBe(true);
  });

  it("excludes projects without prompt-relevant agent knowledge", () => {
    const plain: ProjectGraphNodeDto = { id: "n0", nodeType: "Feature", title: "T", summary: null };
    const sources = mapOwnedProjectRowsToMemorySources({
      userId: "u1",
      projects: [
        {
          id: "empty",
          name: "Empty",
          ownerUserId: "u1",
          updatedAt: new Date(),
        },
      ],
      nodesByProjectId: { empty: [plain] },
    });
    expect(sources).toEqual([]);
  });
});
