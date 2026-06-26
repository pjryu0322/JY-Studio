import {
  PROJECT_KNOWLEDGE_AGENTS,
  type ProjectKnowledgeAgent,
} from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";
import { collectUserProjectKnowledgeMemory } from "@/lib/project-knowledge/projectKnowledgeUserMemoryCollector";
import { buildUserProjectKnowledgeAgentPromptContext } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptContext";
import { listSameUserProjectKnowledgeMemorySources } from "@/lib/project-knowledge/projectKnowledgeUserMemorySourceQuery";
import type {
  UserProjectKnowledgeAgentPromptContext,
  UserProjectKnowledgeMemorySourceProject,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryTypes";

export async function prepareUserProjectKnowledgeMemoryContext(input: {
  readonly userId: string;
  readonly targetProjectId?: string;
  readonly sourceProjects: readonly UserProjectKnowledgeMemorySourceProject[];
  readonly excludedSourceProjectIds?: readonly string[];
  readonly ignoredMemoryItemIds?: readonly string[];
  readonly pinnedMemoryItemIds?: readonly string[];
  readonly maxItemsPerAgent?: number;
  readonly minRelevance?: number;
}): Promise<{
  readonly byAgent: Readonly<Record<ProjectKnowledgeAgent, UserProjectKnowledgeAgentPromptContext>>;
  readonly totalItemCount: number;
}> {
  const collected = collectUserProjectKnowledgeMemory({
    userId: input.userId,
    targetProjectId: input.targetProjectId,
    sourceProjects: input.sourceProjects,
    excludedSourceProjectIds: input.excludedSourceProjectIds,
    ignoredMemoryItemIds: input.ignoredMemoryItemIds,
    pinnedMemoryItemIds: input.pinnedMemoryItemIds,
    maxItemsPerAgent: input.maxItemsPerAgent,
    minRelevance: input.minRelevance,
  });

  const byAgent = {} as Record<ProjectKnowledgeAgent, UserProjectKnowledgeAgentPromptContext>;
  for (const agent of PROJECT_KNOWLEDGE_AGENTS) {
    byAgent[agent] = buildUserProjectKnowledgeAgentPromptContext({
      agent,
      items: collected.byAgent[agent],
      maxItems: input.maxItemsPerAgent,
    });
  }

  return {
    byAgent,
    totalItemCount: collected.totalItemCount,
  };
}

export async function prepareSameUserProjectKnowledgeMemoryPromptContexts(input: {
  readonly userId: string;
  readonly targetProjectId?: string;
  readonly excludedSourceProjectIds?: readonly string[];
  readonly ignoredMemoryItemIds?: readonly string[];
  readonly pinnedMemoryItemIds?: readonly string[];
  readonly maxItemsPerAgent?: number;
  readonly minRelevance?: number;
  readonly limitProjects?: number;
}): Promise<{
  readonly byAgent: Readonly<Record<ProjectKnowledgeAgent, UserProjectKnowledgeAgentPromptContext>>;
  readonly totalItemCount: number;
  readonly sourceProjectCount: number;
}> {
  const sourceProjects = await listSameUserProjectKnowledgeMemorySources({
    userId: input.userId,
    targetProjectId: input.targetProjectId,
    limitProjects: input.limitProjects,
  });

  const prepared = await prepareUserProjectKnowledgeMemoryContext({
    userId: input.userId,
    targetProjectId: input.targetProjectId,
    sourceProjects,
    excludedSourceProjectIds: input.excludedSourceProjectIds,
    ignoredMemoryItemIds: input.ignoredMemoryItemIds,
    pinnedMemoryItemIds: input.pinnedMemoryItemIds,
    maxItemsPerAgent: input.maxItemsPerAgent,
    minRelevance: input.minRelevance,
  });

  return {
    byAgent: prepared.byAgent,
    totalItemCount: prepared.totalItemCount,
    sourceProjectCount: sourceProjects.length,
  };
}
