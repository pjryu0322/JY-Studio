import { describe, expect, it } from "vitest";
import type { ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";
import {
  buildUserProjectKnowledgeMemoryItemId,
  collectUserProjectKnowledgeMemory,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryCollector";
import type { UserProjectKnowledgeMemorySourceProject } from "@/lib/project-knowledge/projectKnowledgeUserMemoryTypes";

const USER = "user-a";
const OTHER = "user-b";

function node(
  id: string,
  agentRelevance?: ProjectGraphNodeDto["agentRelevance"],
  extra?: Partial<ProjectGraphNodeDto>,
): ProjectGraphNodeDto {
  return {
    id,
    nodeType: "Feature",
    title: `Title ${id}`,
    summary: `Summary ${id}`,
    ...(agentRelevance ? { agentRelevance } : {}),
    ...extra,
  };
}

function source(
  projectId: string,
  ownerUserId: string,
  nodes: readonly ProjectGraphNodeDto[],
  updatedAt?: string,
): UserProjectKnowledgeMemorySourceProject {
  return {
    projectId,
    projectTitle: `Project ${projectId}`,
    ownerUserId,
    nodes,
    ...(updatedAt ? { updatedAt } : {}),
  };
}

const plannerUse = {
  relevance: 0.86,
  useAs: "mvp_scope" as const,
  reason: "MVP scope hint",
  promptSummary: "결제 승인 흐름은 MVP에서 관리자 승인 단계를 분리하는 것이 반복적으로 중요했다.",
};

describe("projectKnowledgeUserMemoryCollector", () => {
  it("collects only same-user source projects", () => {
    const n = node("n1", { planner: plannerUse });
    const result = collectUserProjectKnowledgeMemory({
      userId: USER,
      sourceProjects: [
        source("p-own", USER, [n]),
        source("p-other", OTHER, [n]),
      ],
    });
    expect(result.byAgent.planner).toHaveLength(1);
    expect(result.byAgent.planner[0]?.sourceProjectId).toBe("p-own");
  });

  it("excludes target project from sources", () => {
    const n = node("n1", { planner: plannerUse });
    const result = collectUserProjectKnowledgeMemory({
      userId: USER,
      targetProjectId: "p-current",
      sourceProjects: [source("p-current", USER, [n]), source("p-old", USER, [n])],
    });
    expect(result.byAgent.planner).toHaveLength(1);
    expect(result.byAgent.planner[0]?.sourceProjectId).toBe("p-old");
  });

  it("respects excludedSourceProjectIds", () => {
    const n = node("n1", { planner: plannerUse });
    const result = collectUserProjectKnowledgeMemory({
      userId: USER,
      excludedSourceProjectIds: ["p-skip"],
      sourceProjects: [source("p-skip", USER, [n]), source("p-keep", USER, [n])],
    });
    expect(result.excludedSourceProjectIds).toEqual(["p-skip"]);
    expect(result.byAgent.planner).toHaveLength(1);
    expect(result.byAgent.planner[0]?.sourceProjectId).toBe("p-keep");
  });

  it("collects nodes at or above prompt relevance threshold", () => {
    const low = node("low", {
      planner: { relevance: 0.49, useAs: "context", reason: "low", promptSummary: "low" },
    });
    const ok = node("ok", {
      planner: { relevance: 0.5, useAs: "context", reason: "ok", promptSummary: "ok summary" },
    });
    const result = collectUserProjectKnowledgeMemory({
      userId: USER,
      sourceProjects: [source("p1", USER, [low, ok])],
      minRelevance: 0.5,
    });
    expect(result.byAgent.planner.map((i) => i.sourceNodeId)).toEqual(["ok"]);
  });

  it("buckets items by agent", () => {
    const n = node("n1", {
      planner: plannerUse,
      developer: {
        relevance: 0.9,
        useAs: "implementation_hint",
        reason: "screen",
        promptSummary: "화면 구현 힌트",
      },
    });
    const result = collectUserProjectKnowledgeMemory({
      userId: USER,
      sourceProjects: [source("p1", USER, [n])],
    });
    expect(result.byAgent.planner).toHaveLength(1);
    expect(result.byAgent.developer).toHaveLength(1);
    expect(result.byAgent.analyst).toHaveLength(0);
  });

  it("applies maxItemsPerAgent", () => {
    const nodes = Array.from({ length: 12 }, (_, i) =>
      node(`n${i}`, {
        planner: {
          relevance: 0.5 + i * 0.01,
          useAs: "context",
          reason: `r${i}`,
          promptSummary: `summary ${i}`,
        },
      }),
    );
    const result = collectUserProjectKnowledgeMemory({
      userId: USER,
      sourceProjects: [source("p1", USER, nodes)],
      maxItemsPerAgent: 3,
    });
    expect(result.byAgent.planner).toHaveLength(3);
    expect(result.totalItemCount).toBe(3);
  });

  it("sorts pinned items first", () => {
    const lowPinned = node("low", {
      planner: { relevance: 0.55, useAs: "context", reason: "l", promptSummary: "low pinned" },
    });
    const high = node("high", {
      planner: { relevance: 0.99, useAs: "context", reason: "h", promptSummary: "high" },
    });
    const pinId = buildUserProjectKnowledgeMemoryItemId("p1", "low", "planner");
    const result = collectUserProjectKnowledgeMemory({
      userId: USER,
      sourceProjects: [source("p1", USER, [high, lowPinned])],
      pinnedMemoryItemIds: [pinId],
    });
    expect(result.byAgent.planner[0]?.sourceNodeId).toBe("low");
    expect(result.byAgent.planner[0]?.lifecycle).toBe("PINNED");
  });

  it("excludes ignored memory item ids", () => {
    const n = node("n1", { planner: plannerUse });
    const id = buildUserProjectKnowledgeMemoryItemId("p1", "n1", "planner");
    const result = collectUserProjectKnowledgeMemory({
      userId: USER,
      sourceProjects: [source("p1", USER, [n])],
      ignoredMemoryItemIds: [id],
    });
    expect(result.byAgent.planner).toHaveLength(0);
  });

  it("excludes sensitive promptSummary from memory items", () => {
    const n = node("n1", {
      planner: {
        relevance: 0.9,
        useAs: "context",
        reason: "api_key=sk-live-abcdef1234567890",
        promptSummary: "api_key=sk-live-abcdef1234567890",
      },
    });
    const result = collectUserProjectKnowledgeMemory({
      userId: USER,
      sourceProjects: [source("p1", USER, [n])],
    });
    expect(result.byAgent.planner).toHaveLength(0);
  });

  it("uses deterministic memory item ids", () => {
    const n = node("n1", { planner: plannerUse });
    const result = collectUserProjectKnowledgeMemory({
      userId: USER,
      sourceProjects: [source("p1", USER, [n])],
    });
    expect(result.byAgent.planner[0]?.id).toBe("p1:n1:planner");
  });

  it("filters to a single agent when agent option is set", () => {
    const n = node("n1", {
      planner: plannerUse,
      developer: {
        relevance: 0.9,
        useAs: "implementation_hint",
        reason: "d",
        promptSummary: "dev",
      },
    });
    const result = collectUserProjectKnowledgeMemory({
      userId: USER,
      agent: "planner",
      sourceProjects: [source("p1", USER, [n])],
    });
    expect(result.byAgent.planner).toHaveLength(1);
    expect(result.byAgent.developer).toHaveLength(0);
    expect(result.totalItemCount).toBe(1);
  });
});
